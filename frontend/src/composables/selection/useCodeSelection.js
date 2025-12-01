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

// ---------------------------------------------
// GLOBAL STATE
// ---------------------------------------------
const lastSavedSelectionHash = ref('');
const lastSavedConsensusHash = ref('');
/**
 * Creates a unique string fingerprint of the current USER SELECTIONS.
 * Only includes fields that affect the 'Save Selections' operation.
 */
const getSelectionHash = () => {
    // Sort to ensure order doesn't affect hash
    const simplified = tableRows.value
        .map(r => ({
            k: r.key,
            s: r.selected,
            c: r.comment || ''
        }))
        .sort((a, b) => a.k.localeCompare(b.k));
    return JSON.stringify(simplified);
};

/**
 * Creates a unique string fingerprint of the current CONSENSUS.
 * Only includes fields that affect the 'Save Consensus' operation.
 */
const getConsensusHash = () => {
    const simplified = tableRows.value
        .filter(r => r.consensus_selected) // Only selected rows matter for consensus upsert
        .map(r => ({
            k: r.key,
            s: r.consensus_selected,
            c: r.consensus_comment || ''
        }))
        .sort((a, b) => a.k.localeCompare(b.k));
    return JSON.stringify(simplified);
};

// Computed flags for UI
const hasUnsavedChanges = computed(() => {
    return getSelectionHash() !== lastSavedSelectionHash.value;
});

const hasUnsavedConsensusChanges = computed(() => {
    return getConsensusHash() !== lastSavedConsensusHash.value;
});

const userComments = ref({});
const consensusState = ref({}); // { [codeId]: { selected: boolean, comment: string } }
const tableRows = computed(() => {
    // Use a Map to ensure unique rows by Key (Code ID)
    const rowsMap = new Map();

    // 1. WALK THE TREE
    // Add nodes that are Selected OR Found in search
    function walk(nodeArray) {
        if (!Array.isArray(nodeArray)) return;

        nodeArray.forEach(node => {
            const key = String(node.key);
            const selected = !!selectedNodeKeys.value[key]; // does the key exist in selected keys
            const found = !!searchNodeKeys.value[key]; // does the key exist in search keys

            if (selected || found) {
                const consensusData = consensusState.value[key] || { selected: false, comment: '' }; // defaults
                const codeComment = userComments.value[key] || ''; // default
                // add or update the row
                rowsMap.set(key, {
                    key: key,
                    selected: selected,
                    comment: codeComment, // fallback as userComments[key] may not have an entry
                    consensus_selected: consensusData.selected, // no fallback; defaults defined above
                    consensus_comment: consensusData.comment, // no fallback; defaults defined above
                    found: found, // no fallback; defaults defined above
                    imported: false, // Default for tree nodes; might be updated below if also in importedData
                    code: node.data.code, // nodes are well-defined to have these fields
                    description: node.data.description, // nodes are well-defined to have these fields
                    system: node.data.system, // nodes are well-defined to have these fields
                    system_id: node.data.system_id // nodes are well-defined to have these fields
                });
            }
            // recurse children if present
            if (node.children?.length) walk(node.children);
        });
    }
    walk(nodes.value);

    // 2. MERGE IMPORTED DATA
    // Iterate imported data to either Add new rows or Update existing ones
    if (importedData.value && Array.isArray(importedData.value)) {
        importedData.value.forEach(item => {
            const key = String(item.key);
            const selected = !!selectedNodeKeys.value[key]; // does the key exist in selected keys, may do if imported a mapped code rather than an orphan code
            const found = !!searchNodeKeys.value[key]; // does the key exist in search keys, may do if imported a mapped code rather than an orphan code
            const consensusData = consensusState.value[key] || { selected: false, comment: '' }; // defaults
            const codeComment = userComments.value[key] || ''; // default

            if (rowsMap.has(key)) {
                // CASE A: Row exists from Tree Walk, i.e. we imported a mapped code (not orphan) -> Just update imported flag
                const existingRow = rowsMap.get(key);
                existingRow.imported = true;
            } else {
                // Add new row from import (these are orphan/unmapped codes)
                rowsMap.set(key, {
                    ...item,
                    key,
                    selected,
                    comment: codeComment,
                    consensus_selected: consensusData.selected,
                    consensus_comment: consensusData.comment,
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

// ---------------------------------------------
// COMPOSABLE
// ---------------------------------------------
export function useCodeSelection() {
    // Get dependencies inside the composable function
    const { emitError, emitSuccess } = useNotifications()
    const { user } = useAuth()
    const { currentPhenotype } = usePhenotypes()
    const { resetDownloadCache } = useDownload()

    // ------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------
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

    const updateConsensusSelection = (key, val) => {
        if (!consensusState.value[key]) consensusState.value[key] = { selected: false, comment: '' };
        consensusState.value[key].selected = val;
    };

    const updateConsensusComment = (key, val) => {
        if (!consensusState.value[key]) consensusState.value[key] = { selected: false, comment: '' };
        consensusState.value[key].comment = val;
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
        // If we are currently 'all' -> Deselect All
        // If we are 'none' or 'partial' -> Select All
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

    // ------------------------------------------------------------
    // SAVE/LOAD LOGIC
    // ------------------------------------------------------------
    const saveSelections = async () => {
        // 1. Validation
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

    // (The Skeleton): This builds the Table Rows.
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

    // (The Decoration): This provides the Status/Icons inside the rows fetched by fetchUserSelections
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

            // TRANSFORM LOGIC
            const map = {};
            const membersSet = new Map();

            data.forEach(row => {
                const cId = row.code_id ?? row.orphan_id; // normal codes use code_id, orphans use orphan_id
                const uId = row.user_id;
                const email = row.email?.email || 'Unknown';

                // Add to Member List (for Column Headers)
                if (!membersSet.has(uId)) {
                    membersSet.set(uId, { id: uId, name: email });
                }

                // Add to Data Map
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

    // Helper to get data for the table cell
    const getTeamMemberStatus = (codeId, userId) => {
        // 1. Get Raw Data (or Default)
        const status = teamSelections.value[codeId]?.[userId] || { selected: false, comment: '' };

        // 2. Compute Tooltip
        const tooltip = (status.comment && status.comment.trim() !== '')
            ? status.comment
            : null;

        // 3. Compute Visuals (Icon & Color)
        // This replaces your 'getReviewIcon' function too!
        const visual = status.selected
            ? { icon: 'pi pi-check-circle', color: '#10B981' }
            : { icon: 'pi pi-times-circle', color: 'rgba(255,2,2,0.7)' };

        // 4. Return One "View Model" Object
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

        // Seed with team selections from the database
        Object.entries(teamSelections.value || {}).forEach(([codeId, userMap]) => {
            const entry = codeMap.get(codeId) || {};
            Object.entries(userMap || {}).forEach(([uid, details]) => {
                entry[uid] = !!details.selected;
            });
            codeMap.set(codeId, entry);
        });

        // Overlay current user's live selections so the bar updates immediately
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

        const { data, error } = await supabase
            .from('user_code_selections')
            .select('code_type, code_id, orphan_id, consensus_comments, is_consensus')
            .eq('phenotype_id', phenotypeId);

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
                comment: row.consensus_comments || ''
            };
        });
        consensusState.value = map;
        isFinalized.value = false;

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

        try {
            const desiredMap = new Map();
            finalRows.forEach(row => {
                desiredMap.set(row.key, row.consensus_comment || '');
            });

            const existingKeys = Object.keys(consensusState.value || {});
            const allKeys = new Set([...existingKeys, ...Array.from(desiredMap.keys())]);
            const existingComments = { ...(consensusState.value || {}) };

            const standardRows = [];
            const orphanRows = [];

            allKeys.forEach((key) => {
                const isOrphan = typeof key === 'string' && key.startsWith('ORPHAN');
                const isSelected = desiredMap.has(key);
                const comment = desiredMap.get(key) ?? existingComments[key]?.comment ?? '';
                if (isOrphan) {
                    orphanRows.push({
                        phenotype_id: phenotypeId,
                        user_id: userId,
                        code_type: 'orphan',
                        orphan_id: key,
                        code_text: null,
                        code_description: null,
                        system_name: null,
                        is_consensus: isSelected,
                        consensus_comments: comment
                    });
                } else {
                    const codeId = parseInt(key);
                    if (!Number.isNaN(codeId)) {
                        standardRows.push({
                            phenotype_id: phenotypeId,
                            user_id: userId,
                            code_type: 'standard',
                            code_id: codeId,
                            is_consensus: isSelected,
                            consensus_comments: comment
                        });
                    }
                }
            });

            if (standardRows.length > 0) {
                console.debug('[consensus] upsert standard', standardRows);
                const { error } = await supabase
                    .from('user_code_selections')
                    .upsert(standardRows, { onConflict: 'phenotype_id, code_id, user_id' });
                if (error) throw error;
            }

            if (orphanRows.length > 0) {
                console.debug('[consensus] upsert orphan', orphanRows);
                const { error } = await supabase
                    .from('user_code_selections')
                    .upsert(orphanRows, { onConflict: 'phenotype_id, orphan_id, user_id' });
                if (error) throw error;
            }

            consensusState.value = Object.fromEntries(
                Array.from(allKeys).map((k) => {
                    const selected = desiredMap.has(k);
                    const comment = desiredMap.get(k) ?? existingComments[k]?.comment ?? '';
                    return [k, { selected, comment }];
                })
            );
            lastSavedConsensusHash.value = getConsensusHash();

            isFinalized.value = finalize;

            const action = finalize ? "Finalized" : "Saved";
            emitSuccess(action, `${action} consensus for ${finalRows.length} codes.`);

            await resetDownloadCache(phenotypeId);
            await fetchConsensus();

        } catch (err) {
            console.error(err);
            emitError("Error", "Failed to save consensus.");
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

    // ------------------------------------------------------------
    // UNLOCK (Revert to Draft)
    // ------------------------------------------------------------
    const unlockConsensus = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        if (!phenotypeId) return;

        isFinalized.value = false;
        emitSuccess("Unlocked", "Consensus codes are now editable.");
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

    // ------------------------------------------------------------
    // COMPOSABLE WATCHERS
    // ------------------------------------------------------------
    if (!watchersInitialized) {
        watch(isReviewMode, async (newValue) => {
          if (newValue) {
              // Parallel Fetch: Get Team data AND Current Consensus data
              await Promise.all([
                  fetchTeamSelections(),
                  fetchConsensus()
              ]);
          }
        });

        watch(
            () => currentPhenotype.value?.id,
            async (newId) => {
                // A. ALWAYS RESET FIRST
                clearTreeState();
                importedData.value = [];
                clearSelectionState();

                // B. IF NEW ID EXISTS, LOAD NEW DATA
                if (newId) {
                    try {
                        // Load Search Strategy for this new phenotype
                        await fetchSearchStrategy(newId);
                        // Load Selections
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

    // ------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------
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
        clearSelectionState,
        saveConsensus,
        unlockConsensus,
        clearImportedCodes,
        rehydrateCurrentPhenotype
    }
}
