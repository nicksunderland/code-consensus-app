import { ref, computed, watch } from 'vue'
import { supabase } from '@/composables/shared/useSupabase.js'
import { useNotifications } from '../shared/useNotifications.js'
import { useTreeSearch } from "@/composables/tree/useTreeSearch.js";
import { useAuth } from "@/composables/auth/useAuth.js";
import { usePhenotypes } from "@/composables/project/usePhenotypes.js";
import { useDownload } from "@/composables/selection/useDownload.js";
import {useCodeImport} from "@/composables/selection/useCodeImport.js";

// composables
const {
    nodes,
    selectedNodeKeys,
    searchNodeKeys,
    fetchSpecificNodes,
    fetchSearchStrategy,
    saveSearchStrategy,
    clearTreeState
} = useTreeSearch()

const {
    importedData
} = useCodeImport()

// Global state
const lastSavedSelectionHash = ref('');
const lastSavedConsensusHash = ref('');
// fingerprint of the user's selections, used to detect unsaved changes
const getSelectionHash = () => {
    // sorted so order doesn't matter
    const simplified = tableRows.value
        .map(r => ({
            k: r.key,
            s: r.selected,
            c: r.comment || ''
        }))
        .sort((a, b) => a.k.localeCompare(b.k));
    return JSON.stringify(simplified);
};

// same again for the consensus fields
const getConsensusHash = () => {
    const simplified = tableRows.value
        .filter(r => r.consensus_selected) // Only selected rows matter for consensus upsert
        .map(r => ({
            k: r.key,
            s: r.consensus_selected,
            c: r.consensus_comment || '',
            n: !!r.consensus_canonical
        }))
        .sort((a, b) => a.k.localeCompare(b.k));
    return JSON.stringify(simplified);
};

// UI flags
const hasUnsavedChanges = computed(() => {
    return getSelectionHash() !== lastSavedSelectionHash.value;
});

const hasUnsavedConsensusChanges = computed(() => {
    return getConsensusHash() !== lastSavedConsensusHash.value;
});

const userComments = ref({});

// canonical codes are grouped by system name; orphan codes have no system_id
const systemGroup = (row) => row?.system || 'Custom';

const consensusState = ref({}); // { [codeId]: { selected: boolean, comment: string, canonical: boolean } }
const tableRows = computed(() => {
    // keyed by code id so each code appears once
    const rowsMap = new Map();

    // walk the tree, keeping nodes that are selected or were found by the search
    function walk(nodeArray) {
        if (!Array.isArray(nodeArray)) return;

        nodeArray.forEach(node => {
            const key = String(node.key);
            const selected = !!selectedNodeKeys.value[key]; // does the key exist in selected keys
            const found = !!searchNodeKeys.value[key]; // does the key exist in search keys

            if (selected || found) {
                const consensusData = consensusState.value[key] || { selected: false, comment: '', canonical: false }; // defaults
                const codeComment = userComments.value[key] || ''; // default
                rowsMap.set(key, {
                    key: key,
                    selected: selected,
                    comment: codeComment, // fallback as userComments[key] may not have an entry
                    consensus_selected: consensusData.selected, // no fallback; defaults defined above
                    consensus_comment: consensusData.comment, // no fallback; defaults defined above
                    consensus_canonical: !!consensusData.canonical,
                    found: found, // no fallback; defaults defined above
                    imported: false, // Default for tree nodes; might be updated below if also in importedData
                    code: node.data.code, // nodes are well-defined to have these fields
                    description: node.data.description, // nodes are well-defined to have these fields
                    system: node.data.system, // nodes are well-defined to have these fields
                    system_id: node.data.system_id // nodes are well-defined to have these fields
                });
            }
            if (node.children?.length) walk(node.children);
        });
    }
    walk(nodes.value);

    // then merge in imported codes
    if (importedData.value && Array.isArray(importedData.value)) {
        importedData.value.forEach(item => {
            const key = String(item.key);
            const selected = !!selectedNodeKeys.value[key]; // does the key exist in selected keys, may do if imported a mapped code rather than an orphan code
            const found = !!searchNodeKeys.value[key]; // does the key exist in search keys, may do if imported a mapped code rather than an orphan code
            const consensusData = consensusState.value[key] || { selected: false, comment: '', canonical: false }; // defaults
            const codeComment = userComments.value[key] || ''; // default

            if (rowsMap.has(key)) {
                // already in the tree, i.e. an imported code that mapped to a real code, so just flag it
                const existingRow = rowsMap.get(key);
                existingRow.imported = true;
            } else {
                // otherwise it's an orphan (unmapped) code
                rowsMap.set(key, {
                    ...item,
                    key,
                    selected,
                    comment: codeComment,
                    consensus_selected: consensusData.selected,
                    consensus_comment: consensusData.comment,
                    consensus_canonical: !!consensusData.canonical,
                    found,
                    imported: true
                })
            }
        });
    }
    return Array.from(rowsMap.values());
});
    const isSaving = ref(false);
    const isFinalized = ref(false);
    const isReviewMode = ref(false);
    const teamSelections = ref({}); // Format: { codeId: { userId: { is_selected, comment, email } } }
    const projectMembers = ref([]); // List of users found in the dataset
let watchersInitialized = false;

// Composable
export function useCodeSelection() {
    const { emitError, emitSuccess } = useNotifications()
    const { user } = useAuth()
    const { currentPhenotype } = usePhenotypes()
    const { resetDownloadCache } = useDownload()

    // Helpers
    const updateComment = (key, text) => {
        userComments.value[key] = text;
    };

    const updateSelection = (key, isSelected) => {
        const newKeys = { ...selectedNodeKeys.value };
        if (isSelected) {
            newKeys[key] = true;
        } else {
            delete newKeys[key];
        }
        selectedNodeKeys.value = newKeys;
    };

    const ensureConsensusEntry = (key) => {
        if (!consensusState.value[key]) consensusState.value[key] = { selected: false, comment: '', canonical: false };
        return consensusState.value[key];
    };

    const updateConsensusSelection = (key, val) => {
        const entry = ensureConsensusEntry(key);
        entry.selected = val;
        // a code can only be canonical while it's in the consensus
        if (!val) entry.canonical = false;
    };

    const updateConsensusComment = (key, val) => {
        ensureConsensusEntry(key).comment = val;
    };

    // one canonical code per coding system, so ticking one clears the others in that system
    const updateCanonicalSelection = (key, val) => {
        if (val) {
            const row = tableRows.value.find(r => r.key === String(key));
            const system = systemGroup(row);
            tableRows.value.forEach(r => {
                if (r.key !== String(key) && r.consensus_canonical && systemGroup(r) === system) {
                    consensusState.value[r.key].canonical = false;
                }
            });
        }
        ensureConsensusEntry(key).canonical = val;
    };

    const selectionState = computed(() => {
        if (tableRows.value.length === 0) return 'none';

        let selectedCount = 0;
        tableRows.value.forEach(row => {
            if (row.selected) selectedCount++;
        });

        if (selectedCount === 0) return 'none';
        if (selectedCount === tableRows.value.length) return 'all';
        return 'partial'; // Some are selected (from here or elsewhere)
    });

    const isIndeterminate = computed(() => selectionState.value === 'partial');

    const isAllSelected = computed(() => selectionState.value === 'all');

    const toggleSelectAll = () => {
        // all -> none, otherwise select all
        const shouldSelectAll = selectionState.value !== 'all';

        const newKeys = { ...selectedNodeKeys.value };

        tableRows.value.forEach(row => {
            if (shouldSelectAll) {
                newKeys[row.key] = true;
            } else {
                delete newKeys[row.key];
            }
        });

        selectedNodeKeys.value = newKeys;
    };

    function clearSelectionState() {
        userComments.value = {}
        consensusState.value = {}
        teamSelections.value = {}
        projectMembers.value = []
        isReviewMode.value = false
        isSaving.value = false
        lastSavedSelectionHash.value = '';
        lastSavedConsensusHash.value = '';
    }

    // Save/load logic
    const saveSelections = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        const userId = user.value?.id;
        if (!userId) {
            emitError("Save Failed", "Please log in to save your selections.");
            return;
        }
        if (!phenotypeId) {
            emitError("Save Failed", "No phenotype currently active.");
            return;
        }

        isSaving.value = true;

        try {
            const standardRows = [];
            const orphanRows = [];

            tableRows.value.forEach(row => {
                const base = {
                    phenotype_id: phenotypeId,
                    user_id: userId,
                    found_in_search: row.found,
                    is_selected: row.selected,
                    comment: row.comment || null,
                    imported: row.imported
                };

                const isOrphan = typeof row.key === 'string' && row.key.startsWith('ORPHAN');

                if (isOrphan) {
                    orphanRows.push({
                        ...base,
                        code_type: 'orphan',
                        orphan_id: row.key,
                        code_text: row.code,
                        code_description: row.description || '',
                        system_name: row.system || 'Custom'
                    });
                } else {
                    const codeId = parseInt(row.key);
                    if (Number.isNaN(codeId)) return;
                    standardRows.push({
                        ...base,
                        code_type: 'standard',
                        code_id: codeId
                    });
                }
            });

            if (standardRows.length > 0) {
                const { error } = await supabase
                    .from('user_code_selections')
                    .upsert(standardRows, { onConflict: 'phenotype_id, code_id, user_id' });
                if (error) throw error;
            }

            if (orphanRows.length > 0) {
                const { error } = await supabase
                    .from('user_code_selections')
                    .upsert(orphanRows, { onConflict: 'phenotype_id, orphan_id, user_id' });
                if (error) throw error;
            }

            await saveSearchStrategy(phenotypeId);

            lastSavedSelectionHash.value = getSelectionHash();

            emitSuccess("Saved", `Updated ${standardRows.length + orphanRows.length} codes.`);
            await resetDownloadCache(phenotypeId);

        } catch (error) {
            console.error(error);
            emitError("Save Failed", error.message);
        } finally {
            isSaving.value = false;
        }
    };

    // builds the table rows
    const fetchUserSelections = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        const userId = user.value?.id;
        if (!phenotypeId || !userId) return;

        const { data, error } = await supabase
            .from('user_code_selections')
            .select(`
                code_id,
                orphan_id,
                code_type,
                is_selected,
                comment,
                found_in_search,
                imported,
                code_text,
                code_description,
                system_name,
                user_id,
                code:codes(
                    code,
                    description,
                    system_id,
                    system:code_systems(name)
                )
            `)
            .eq('phenotype_id', phenotypeId);

        if (error) {
            console.error(error);
            emitError("Load failed", error.message);
            return;
        }

        const restoredSelected = {};
        const restoredSearch = {};
        const restoredComments = {};
        const allIdsToLoad = new Set();
        const consensusMap = { ...consensusState.value }; // keep existing consensus until refreshed
        const processedImportKeys = new Set();
        importedData.value = [];

        (data || []).forEach(row => {
            const isOrphan = row.code_type === 'orphan';
            const key = String(row.code_id ?? row.orphan_id);

            if (!isOrphan && row.code_id) {
                allIdsToLoad.add(row.code_id);
                if (row.found_in_search) restoredSearch[row.code_id] = true;
            }

            if (row.user_id === userId) {
                if (row.is_selected) restoredSelected[key] = true;
                if (row.comment) restoredComments[key] = row.comment;
            }

            if (row.imported && !processedImportKeys.has(key)) {
                const details = row.code || {};
                const systemInfo = details.system || {};
                importedData.value.push({
                    key,
                    code: row.code_text || details.code,
                    description: row.code_description || details.description,
                    system: row.system_name || systemInfo.name,
                    system_id: details.system_id || null,
                    imported: true,
                    consensus_selected: consensusMap[key]?.selected ?? false
                });
                processedImportKeys.add(key);
            }
        });

        if (allIdsToLoad.size > 0) {
            const injectionMap = {};
            allIdsToLoad.forEach(id => {
                injectionMap[id] = {
                    found_in_search: !!restoredSearch[id]
                }
            });
            await fetchSpecificNodes(Array.from(allIdsToLoad), injectionMap);
        }

        selectedNodeKeys.value = restoredSelected;
        searchNodeKeys.value = restoredSearch;
        userComments.value = restoredComments;

        setTimeout(() => {
            lastSavedSelectionHash.value = getSelectionHash();
            lastSavedConsensusHash.value = getConsensusHash();
        }, 0);
    };

    // team selections, used for the per-rater status icons in each row
    const fetchTeamSelections = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        if (!phenotypeId) return;

        try {
            const { data, error } = await supabase
                .from('user_code_selections')
                .select(`
                    code_type,
                    code_id,
                    orphan_id,
                    user_id,
                    is_selected,
                    comment,
                    email:user_profiles(email)
                `)
                .eq('phenotype_id', phenotypeId);

            if (error) throw error;

            const map = {};
            const membersSet = new Map();

            data.forEach(row => {
                const cId = row.code_id ?? row.orphan_id; // normal codes use code_id, orphans use orphan_id
                const uId = row.user_id;
                const email = row.email?.email || 'Unknown';

                // member list for the column headers
                if (!membersSet.has(uId)) {
                    membersSet.set(uId, { id: uId, name: email });
                }

                if (!map[cId]) map[cId] = {};
                map[cId][uId] = {
                    selected: row.is_selected,
                    comment: row.comment
                };
            });

            teamSelections.value = map;
            projectMembers.value = Array.from(membersSet.values());

        } catch (err) {
            console.error("Error fetching team selections:", err);
            emitError("Error fetching team data", err.message || err);
        }

    };

    // everything the table cell needs for one rater/code
    const getTeamMemberStatus = (codeId, userId) => {
        const status = teamSelections.value[codeId]?.[userId] || { selected: false, comment: '' };

        const tooltip = (status.comment && status.comment.trim() !== '')
            ? status.comment
            : null;

        const visual = status.selected
            ? { icon: 'pi pi-check-circle', color: '#10B981' }
            : { icon: 'pi pi-times-circle', color: 'rgba(255,2,2,0.7)' };

        return {
            selected: status.selected,
            comment:  status.comment, // Raw comment (for boolean checks)
            tooltip: tooltip,        // Formatted text (for v-tooltip)
            icon: visual.icon,       // For class binding
            color: visual.color      // For class binding
        };
    };

    const agreementStats = computed(() => {
        const userId = user.value?.id;
        const codeMap = new Map();

        // team selections from the db
        Object.entries(teamSelections.value || {}).forEach(([codeId, userMap]) => {
            const entry = codeMap.get(codeId) || {};
            Object.entries(userMap || {}).forEach(([uid, details]) => {
                entry[uid] = !!details.selected;
            });
            codeMap.set(codeId, entry);
        });

        // overlay the current user's unsaved selections so the bar updates live
        if (userId) {
            tableRows.value.forEach(row => {
                const entry = codeMap.get(row.key) || {};
                entry[userId] = !!row.selected;
                codeMap.set(row.key, entry);
            });
        }

        let totalRatings = 0;
        let totalSelected = 0;
        let pSum = 0;
        let items = 0;

        codeMap.forEach((userMap) => {
            const votes = Object.values(userMap);
            const n = votes.length;
            if (n < 2) return; // need at least two raters
            const nSel = votes.filter(Boolean).length;
            const nNot = n - nSel;
            const p_i = ((nSel * (nSel - 1)) + (nNot * (nNot - 1))) / (n * (n - 1));
            pSum += p_i;
            items += 1;
            totalRatings += n;
            totalSelected += nSel;
        });

        const pBar = items ? pSum / items : 0;
        const pYes = totalRatings ? totalSelected / totalRatings : 0;
        const pNo = 1 - pYes;
        const pE = (pYes * pYes) + (pNo * pNo);
        const denom = 1 - pE;
        const kappa = denom ? (pBar - pE) / denom : 0;

        return {
            items,
            agreement: pBar,
            kappa
        };
    });

    const fetchConsensus = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        if (!phenotypeId) return;

        const [{ data, error }, { data: pheno }] = await Promise.all([
            supabase
                .from('user_code_selections')
                .select('code_type, code_id, orphan_id, consensus_comments, is_consensus, is_canonical')
                .eq('phenotype_id', phenotypeId),
            supabase
                .from('phenotypes')
                .select('finalized_at')
                .eq('id', phenotypeId)
        ]);

        if (error) {
            emitError("Error loading consensus", error.message);
            console.error("Error loading consensus:", error);
            return;
        }

        const map = {};
        (data || []).forEach(row => {
            const key = String(row.code_id ?? row.orphan_id);
            map[key] = {
                selected: !!row.is_consensus,
                comment: row.consensus_comments || '',
                canonical: !!row.is_canonical
            };
        });
        consensusState.value = map;
        isFinalized.value = !!pheno?.[0]?.finalized_at;

        setTimeout(() => {
            lastSavedConsensusHash.value = getConsensusHash();
        }, 0);
    };

    const saveConsensus = async (finalize = false) => {
        const userId = user.value?.id;
        const phenotypeId = currentPhenotype.value?.id;
        if (!userId) {
            emitError("Save Failed", "Please log in to save your selections.");
            return;
        }
        if (!phenotypeId) {
            emitError("Save Failed", "No phenotype currently active.");
            return;
        }

        isSaving.value = true;

        const finalRows = tableRows.value.filter(r => r.consensus_selected);

        const canonicalSystems = finalRows.filter(r => r.consensus_canonical).map(systemGroup);
        if (new Set(canonicalSystems).size !== canonicalSystems.length) {
            emitError("Save Failed", "Only one canonical code is allowed per coding system.");
            isSaving.value = false;
            return;
        }

        try {
            const codes = finalRows.map(row => {
                const key = String(row.key);
                const isOrphan = key.startsWith('ORPHAN');
                return {
                    code_type: isOrphan ? 'orphan' : 'standard',
                    code_id: isOrphan ? null : parseInt(key),
                    orphan_id: isOrphan ? key : null,
                    code_text: row.code || null,
                    code_description: row.description || null,
                    system_name: row.system || null,
                    consensus_comments: row.consensus_comment || '',
                    is_canonical: !!row.consensus_canonical
                };
            }).filter(c => c.code_type === 'orphan' || !Number.isNaN(c.code_id));

            // writes every rater's rows in one go, so the consensus is the same for everyone
            const { error } = await supabase.rpc('save_phenotype_consensus', {
                p_phenotype_id: phenotypeId,
                p_codes: codes
            });
            if (error) throw error;

            if (finalize) await setFinalized(phenotypeId, true);

            const action = finalize ? "Finalized" : "Saved";
            emitSuccess(action, `${action} consensus for ${codes.length} codes.`);

            await resetDownloadCache(phenotypeId);
            await fetchConsensus();

        } catch (err) {
            console.error(err);
            emitError("Error", err?.message || "Failed to save consensus.");
        } finally {
            isSaving.value = false;
        }
    };

    const clearImportedCodes = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        const userId = user.value?.id;

        if (!userId) {
            emitError("Clear Failed", "Please log in to clear imported codes.");
            return;
        }
        if (!phenotypeId) {
            emitError("Clear Failed", "No phenotype currently active.");
            return;
        }

        isSaving.value = true;

        try {
            const { data: importedRows, error: countError } = await supabase
                .from('user_code_selections')
                .select('code_id, orphan_id, code_type', { count: 'exact' })
                .eq('phenotype_id', phenotypeId)
                .eq('user_id', userId)
                .eq('imported', true);

            if (countError) throw countError;

            const totalImported = importedRows?.length || 0;

            if (totalImported === 0) {
                emitError("Nothing to Clear", "You have no imported codes for this phenotype (codes were imported by another group member).");
                isSaving.value = false;
                return;
            }

            const { error: deleteError } = await supabase
                .from('user_code_selections')
                .delete()
                .eq('phenotype_id', phenotypeId)
                .eq('user_id', userId)
                .eq('imported', true);

            if (deleteError) throw deleteError;

            // Clear consensus flags for removed imports
            for (const row of importedRows || []) {
                const key = row.code_id ?? row.orphan_id;
                const params = {
                    p_phenotype_id: phenotypeId,
                    p_code_type: row.code_type,
                    p_code_id: row.code_type === 'standard' ? row.code_id : null,
                    p_orphan_id: row.code_type === 'orphan' ? row.orphan_id : null,
                    p_consensus_comments: null,
                    p_is_consensus: false
                };
                await supabase.rpc('set_code_consensus', params);
            }

            importedData.value = [];

            const newSelectedKeys = { ...selectedNodeKeys.value };
            const newComments = { ...userComments.value };
            const newConsensusState = { ...consensusState.value };

            tableRows.value.forEach(row => {
                if (row.imported) {
                    delete newSelectedKeys[row.key];
                    delete newComments[row.key];
                    delete newConsensusState[row.key];
                }
            });

            selectedNodeKeys.value = newSelectedKeys;
            userComments.value = newComments;
            consensusState.value = newConsensusState;

            setTimeout(() => {
                lastSavedSelectionHash.value = getSelectionHash();
                lastSavedConsensusHash.value = getConsensusHash();
            }, 0);

            emitSuccess("Cleared", `Removed ${totalImported} imported code(s).`);
            await resetDownloadCache(phenotypeId);

        } catch (error) {
            console.error(error);
            emitError("Clear Failed", error.message);
        } finally {
            isSaving.value = false;
        }
    };

    // finalised state lives on the phenotype row so it survives reloads and is shared
    const setFinalized = async (phenotypeId, finalize) => {
        const { error } = await supabase
            .from('phenotypes')
            .update({
                finalized_at: finalize ? new Date().toISOString() : null,
                finalized_by: finalize ? (user.value?.id ?? null) : null
            })
            .eq('id', phenotypeId);
        if (error) throw error;
        isFinalized.value = finalize;
    };

    // unlock, i.e. back to draft
    const unlockConsensus = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        if (!phenotypeId) return;

        try {
            await setFinalized(phenotypeId, false);
            await resetDownloadCache(phenotypeId);
            emitSuccess("Unlocked", "Consensus codes are now editable.");
        } catch (err) {
            console.error(err);
            emitError("Unlock Failed", "Could not unlock the consensus.");
        }
    }

    const rehydrateCurrentPhenotype = async () => {
        const pid = currentPhenotype.value?.id;
        if (!pid) return;
        try {
            await fetchSearchStrategy(pid);
            await fetchUserSelections();
            await fetchConsensus();
        } catch (e) {
            console.error("Error rehydrating phenotype data", e);
        }
    };

    // Composable watchers
    if (!watchersInitialized) {
        watch(isReviewMode, async (newValue) => {
          if (newValue) {
              await Promise.all([
                  fetchTeamSelections(),
                  fetchConsensus()
              ]);
          }
        });

        watch(
            () => currentPhenotype.value?.id,
            async (newId) => {
                // always reset first
                clearTreeState();
                importedData.value = [];
                clearSelectionState();

                if (newId) {
                    try {
                        await fetchSearchStrategy(newId);
                        await fetchUserSelections();
                        await fetchConsensus();
                    } catch (e) {
                        console.error("Error loading phenotype data", e);
                    }
                }
            },
            { immediate: true }
        );

        watchersInitialized = true;
    }

    // Export
    return {
        // state
        isSaving,
        isReviewMode,
        isFinalized,
        isAllSelected,
        isIndeterminate,
        selectionState,
        hasUnsavedChanges,
        hasUnsavedConsensusChanges,
        agreementStats,

        // data
        tableRows,
        projectMembers,

        // methods
        updateSelection,
        updateComment,
        toggleSelectAll,
        saveSelections,
        fetchTeamSelections,
        getTeamMemberStatus,
        updateConsensusSelection,
        updateConsensusComment,
        updateCanonicalSelection,
        clearSelectionState,
        saveConsensus,
        unlockConsensus,
        clearImportedCodes,
        rehydrateCurrentPhenotype
    }
}
