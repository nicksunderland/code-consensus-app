import { ref, computed, watch } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useNotifications } from './useNotifications'
import { useTreeSearch } from "@/composables/useTreeSearch.js";
import { useAuth } from "@/composables/useAuth.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";
import { useDownload } from "@/composables/useDownload.js";
import {useCodeImport} from "@/composables/useCodeImport.js";

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
    console.log("tableRows computed:", Array.from(rowsMap.values()));
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
        console.log("updateConsensusSelection:", key, val, consensusState.value);
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
        console.log("Saving selections for phenotype:", phenotypeId, "user:", userId);
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
            // Split tableRows into known codes and orphans
            const knownCodes = [];
            const orphans = [];

            tableRows.value.forEach(row => {
              if (row.imported && typeof row.key === 'string' && row.key.startsWith('ORPHAN')) {
                orphans.push({
                    phenotype_id: phenotypeId,
                    code: row.code,
                    user_id: userId,
                    orphan_id: row.key,
                    description: row.description || '',
                    system_name: row.system,
                    is_selected: row.selected,
                    comment: row.comment || null
                });
              } else {
                knownCodes.push({
                    phenotype_id: phenotypeId,
                    code_id: parseInt(row.key),
                    user_id: userId,
                    found_in_search: row.found,
                    is_selected: row.selected,
                    comment: row.comment || null,
                    imported: row.imported
                });
              }
            });

            // 1️⃣ Save known codes
            if (knownCodes.length > 0) {
              const { error } = await supabase
                .from('user_code_selections')
                .upsert(knownCodes, { onConflict: 'phenotype_id, code_id, user_id' });

              if (error) throw error;
            }

            // 2️⃣ Save orphan codes
            if (orphans.length > 0) {
              const { error } = await supabase
                .from('user_code_selections_orphan')
                .upsert(orphans, { onConflict: 'phenotype_id, orphan_id, user_id' });

              if (error) throw error;
            }

            // save search strategy as well
            await saveSearchStrategy(phenotypeId);

            lastSavedSelectionHash.value = getSelectionHash();

            emitSuccess("Saved", `Updated ${knownCodes.length + orphans.length} codes.`);
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

        // Fetch data in parallel
        const [userRes, orphanRes, consensusRes] = await Promise.all([
            // A. Known team selections
            supabase
                .from('user_code_selections')
                .select(`
                    code_id, 
                    user_id,
                    is_selected, 
                    comment, 
                    found_in_search, 
                    imported,
                    code_details:codes(
                        code, 
                        description,
                        system_id,
                        system_details:code_systems(name)
                    )
                 `)
                .eq('phenotype_id', phenotypeId),
            // B. Orphan team selections
            supabase
                .from('user_code_selections_orphan')
                .select('orphan_id, user_id, code, description, is_selected, comment, system_name')
                .eq('phenotype_id', phenotypeId),
            // C. Consensus
            supabase
                .from('phenotype_consensus')
                .select('code_id, orphan_id, comments')
                .eq('phenotype_id', phenotypeId),
        ]);

        console.log("fetchUserSelections::responses", { userRes, orphanRes, consensusRes });

        if (userRes.error) console.error(userRes.error);
        if (consensusRes.error) console.error(consensusRes.error);
        if (orphanRes.error) console.error(orphanRes.error);

        // 2. Prepare empty state objects
        const restoredSelected = {};
        const restoredSearch = {};
        const restoredComments = {};
        const allIdsToLoad = new Set();
        const consensusMap = {};
        const processedImportKeys = new Set();
        importedData.value = [];

        // 3. PROCESS CONSENSUS
        (consensusRes.data || []).forEach(row => {
            const key = row.code_id ?? row.orphan_id;
            consensusMap[key] = {
                selected: true,
                comment: row.comments || ''
            };
        });

        // 4. PROCESS STANDARD CODES (Merged Logic)
        (userRes.data || []).forEach(row => {

            // --- VISIBILITY (Global) ---
            // If it exists in the DB for this phenotype, we want to ensure the Tree loads it
            allIdsToLoad.add(row.code_id);

            // --- SEARCH STATE (Global) ---
            // if found_in_search is true, mark it true to help the tree highlight these
            if (row.found_in_search) {
                restoredSearch[row.code_id] = true;
            }

            // --- SELECTION STATE (Personal) ---
            // selected and comment for the currently logged-in user
            if (row.user_id === userId) {
                if (row.is_selected) restoredSelected[row.code_id] = true;
                if (row.comment) restoredComments[row.code_id] = row.comment;
            }

            // --- IMPORTED DATA (Global) ---
            // If ANYONE imported this, add to importedData (deduplicated)
            if (row.imported && !processedImportKeys.has(row.code_id)) {
                const details = row.code_details || {};
                const systemInfo = details.system_details || {};

                importedData.value.push({
                    key: row.code_id,
                    code: details.code,
                    description: details.description,
                    system: systemInfo.name,
                    system_id: details.system_id,
                    imported: true
                });
                processedImportKeys.add(row.code_id);
            }

        }); // end processing standard codes


        // 5. PROCESS ORPHANS
        (orphanRes.data || []).forEach(row => {
            // --- SELECTION STATE (Personal) ---
            if (row.user_id === userId) {
                if (row.is_selected) restoredSelected[row.orphan_id] = true;
                if (row.comment) restoredComments[row.orphan_id] = row.comment;
            }

            // --- VISIBILITY (Global) ---
            if (!processedImportKeys.has(row.orphan_id)) {
                importedData.value.push({
                    key: row.orphan_id,
                    code: row.code,
                    description: row.description,
                    system: row.system_name,
                    system_id: null,
                    imported: true,
                    consensus_selected: consensusMap[row.orphan_id]?.selected ?? false
                });
                processedImportKeys.add(row.orphan_id);
            }
        }); // end processing standard orphans

        // 6. HYDRATE TREE
        // This fetches the actual Code/Description text for the table
        if (allIdsToLoad.size > 0) {
            const injectionMap = {};
            allIdsToLoad.forEach(id => {
                injectionMap[id] = {
                    found_in_search: !!restoredSearch[id]
                }
            });
            await fetchSpecificNodes(Array.from(allIdsToLoad), injectionMap);
        }

        // 7. UPDATE STATE
        selectedNodeKeys.value = restoredSelected;
        searchNodeKeys.value = restoredSearch;
        userComments.value = restoredComments;
        consensusState.value = consensusMap;

        // 8. UPDATE DIRTY STATE TRACKER
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
            const [normalRes, orphanRes] = await Promise.all([
                supabase
                    .from('user_code_selections')
                    .select(`
                        code_id,
                        user_id,
                        is_selected,
                        comment,
                        email:user_profiles(email)
                    `)
                    .eq('phenotype_id', phenotypeId),
                supabase
                    .from('user_code_selections_orphan')
                    .select(`
                        orphan_id,
                        code,
                        user_id,
                        is_selected,
                        comment,
                        email:user_profiles(email)
                    `)
                    .eq('phenotype_id', phenotypeId)
            ]);

            if (normalRes.error) throw normalRes.error;
            if (orphanRes.error) throw orphanRes.error;

            const data = [...(normalRes.data || []), ...(orphanRes.data || [])];

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

    const fetchConsensus = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        if (!phenotypeId) return;

        const { data, error } = await supabase
            .from('phenotype_consensus')
            .select('code_id, orphan_id, comments, finalized_at')
            .eq('phenotype_id', phenotypeId);

        if (error) {
            emitError("Error loading consensus", error.message);
            console.error("Error loading consensus:", error);
            return;
        }

        // Map DB results to local state
        const map = {};
        let locked = false;

        data.forEach(row => {
            const key = row.code_id ?? row.orphan_id; // normal codes use code_id, orphans use orphan_id
            map[key] = {
                selected: true, // If it's in this table, it is selected
                comment: row.comments || ''
            };
            if (row.finalized_at) locked = true;
        });
        // console.log("Fetched Consensus Data:", map);
        consensusState.value = map;
        isFinalized.value = locked;

        // ---> UPDATE DIRTY STATE TRACKER <---
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

        console.log("saveConsensus::finalRows", finalRows);

        try {
            // 1. Clear previous consensus for this phenotype
            // (Ensures we don't keep "stale" codes that were unselected this time)
            const { error: deleteError } = await supabase
                .from('phenotype_consensus')
                .delete()
                .eq('phenotype_id', phenotypeId);

            if (deleteError) {
                emitError("Error", "Failed to clean consensus DB prior to saving.");
                return;
            }

            // 2. Prepare Payload
            const normalPayload = [];
            const orphanPayload = [];

            finalRows.forEach(row => {
                const base = {
                    phenotype_id: phenotypeId,
                    comments: row.consensus_comment || '',
                    finalized_at: finalize ? new Date().toISOString() : null
                };

                if (row.key.startsWith('ORPHAN:')) {
                    orphanPayload.push({
                        ...base,
                        orphan_id: row.key // store orphan UUID
                    });
                } else {
                    normalPayload.push({
                        ...base,
                        code_id: parseInt(row.key)
                    });
                }
            });

            isFinalized.value = finalize;

            // 3️⃣ Upsert normal codes
            if (normalPayload.length > 0) {
                const { error } = await supabase
                    .from('phenotype_consensus')
                    .upsert(normalPayload, { onConflict: 'phenotype_id, code_id' });

                if (error) throw error;
            }

            // 4️⃣ Upsert orphan codes
            if (orphanPayload.length > 0) {
                const { error } = await supabase
                    .from('phenotype_consensus')
                    .upsert(orphanPayload, { onConflict: 'phenotype_id, orphan_id' });

                if (error) throw error;
            }

            lastSavedConsensusHash.value = getConsensusHash();

            const action = finalize ? "Finalized" : "Saved";
            emitSuccess(action, `${action} ${normalPayload.length + orphanPayload.length} codes successfully.`);

            await resetDownloadCache(phenotypeId);

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
            // 0️⃣ Check if user has any imported codes first
            const [orphanCheck, importedCheck] = await Promise.all([
                supabase
                    .from('user_code_selections_orphan')
                    .select('orphan_id', { count: 'exact', head: true })
                    .eq('phenotype_id', phenotypeId)
                    .eq('user_id', userId),
                supabase
                    .from('user_code_selections')
                    .select('code_id', { count: 'exact', head: true })
                    .eq('phenotype_id', phenotypeId)
                    .eq('user_id', userId)
                    .eq('imported', true)
            ]);

            const totalImported = (orphanCheck.count || 0) + (importedCheck.count || 0);

            if (totalImported === 0) {
                emitError("Nothing to Clear", "You have no imported codes for this phenotype (codes were imported by another group member).");
                isSaving.value = false;
                return;
            }

            // Get list of orphan_ids and code_ids to delete from consensus
            const { data: orphanIds } = await supabase
                .from('user_code_selections_orphan')
                .select('orphan_id')
                .eq('phenotype_id', phenotypeId)
                .eq('user_id', userId);

            const { data: importedIds } = await supabase
                .from('user_code_selections')
                .select('code_id')
                .eq('phenotype_id', phenotypeId)
                .eq('user_id', userId)
                .eq('imported', true);

            // 1️⃣ Delete all orphan codes for this user and phenotype
            const { error: orphanError } = await supabase
                .from('user_code_selections_orphan')
                .delete()
                .eq('phenotype_id', phenotypeId)
                .eq('user_id', userId);

            if (orphanError) throw orphanError;

            // 2️⃣ Delete imported mapped codes (where imported = true)
            const { error: importedError } = await supabase
                .from('user_code_selections')
                .delete()
                .eq('phenotype_id', phenotypeId)
                .eq('user_id', userId)
                .eq('imported', true);

            if (importedError) throw importedError;

            // 3️⃣ Delete orphan codes from phenotype_consensus
            if (orphanIds && orphanIds.length > 0) {
                const orphanIdList = orphanIds.map(row => row.orphan_id);
                const { error: consensusOrphanError } = await supabase
                    .from('phenotype_consensus')
                    .delete()
                    .eq('phenotype_id', phenotypeId)
                    .in('orphan_id', orphanIdList);

                if (consensusOrphanError) throw consensusOrphanError;
            }

            // 4️⃣ Delete imported mapped codes from phenotype_consensus
            if (importedIds && importedIds.length > 0) {
                const codeIdList = importedIds.map(row => row.code_id);
                const { error: consensusImportedError } = await supabase
                    .from('phenotype_consensus')
                    .delete()
                    .eq('phenotype_id', phenotypeId)
                    .in('code_id', codeIdList);

                if (consensusImportedError) throw consensusImportedError;
            }

            // 5️⃣ Clear the importedData array
            importedData.value = [];

            // 6️⃣ Remove imported codes from local state
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

            // ---> UPDATE DIRTY STATE TRACKER <---
            // Both are updated because removing imported codes changes both your personal list and the consensus list
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

        isSaving.value = true;

        try {
            // Update all records for this phenotype to set finalized_at to NULL
            const { error } = await supabase
                .from('phenotype_consensus')
                .update({ finalized_at: null })
                .eq('phenotype_id', phenotypeId);

            if (error) throw error;

            isFinalized.value = false;

            emitSuccess("Unlocked", "Consensus codes are now editable.");

            await resetDownloadCache(phenotypeId);

        } catch (err) {
            console.error(err);
            emitError("Unlock Failed", "Could not unlock codes.");
        } finally {
            isSaving.value = false;
        }
    }

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
        clearImportedCodes
    }
}