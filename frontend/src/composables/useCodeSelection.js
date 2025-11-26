import { ref, computed, watch } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useNotifications } from './useNotifications'
import { useTreeSearch } from "@/composables/useTreeSearch.js";
import { useAuth } from "@/composables/useAuth.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";
import { useDownload } from "@/composables/useDownload.js";

// composables
const {
    nodes,
    selectedNodeKeys,
    searchNodeKeys,
    fetchSpecificNodes,
    fetchSearchStrategy,
    saveSearchStrategy
} = useTreeSearch()



// ---------------------------------------------
// GLOBAL STATE
// ---------------------------------------------
const userComments = ref({});
const consensusState = ref({}); // { [codeId]: { selected: boolean, comment: string } }
const tableRows = computed(() => {
    const rows = [];

    function walk(nodeArray) {
        if (!Array.isArray(nodeArray)) return;

        nodeArray.forEach(node => {
            const selected = !!selectedNodeKeys.value[node.key];
            const found = !!searchNodeKeys.value[node.key];
            const consensusData = consensusState.value[node.key] || { selected: false, comment: '' };

            if (selected || found) {
                rows.push({
                    key: node.key,
                    // 1. PERSONAL DATA
                    selected: selected,
                    comment: userComments.value[node.key] || '',
                    // 2. CONSENSUS DATA (New)
                    consensus_selected: consensusData.selected,
                    consensus_comment: consensusData.comment,
                    // 3. METADATA
                    found: found,
                    code: node.data?.code || '',
                    description: node.data?.description || '',
                    system: node.data?.system || '',
                    system_id: node.data?.system_id
                });
            }
            if (node.children?.length) walk(node.children);
        });
    }

    walk(nodes.value);
    return rows;
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
            // 2. Prepare Payload (Direct mapping)
            // We send EVERYTHING in tableRows (selected OR commented OR found)
            const payload = tableRows.value.map(row => ({
                phenotype_id: phenotypeId,
                user_id: user.value.id,
                code_id: parseInt(row.key),

                found_in_search: row.found,   // True if came from search
                is_selected: row.selected,    // True if checked
                comment: row.comment || null, // Text if typed
            }));

            console.log("Payload to save:", payload);

            if (payload.length === 0) return;

            // 3. The "One Shot" Save
            const { error } = await supabase
                .from('user_code_selections')
                .upsert(payload, {
                    // This matches the SQL PRIMARY KEY definition
                    onConflict: 'phenotype_id, code_id, user_id'
                });

            // save search strategy as well
            await saveSearchStrategy(phenotypeId);

            emitSuccess("Saved", `Updated ${payload.length} codes.`);

            await resetDownloadCache(phenotypeId);

        } catch (error) {
            console.error(error);
            emitError("Save Failed", error.message);
        } finally {
            isSaving.value = false;
        }
    };

    const fetchUserSelections = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        const userId = user.value?.id;
        if (!phenotypeId || !userId) return;

        // A. Fetch User's Personal Selections
        const userQuery = supabase
            .from('user_code_selections')
            .select('code_id, is_selected, comment, found_in_search')
            .eq('phenotype_id', phenotypeId)
            .eq('user_id', userId);

        // B. Fetch Consensus (We need these nodes too)
        const consensusQuery = supabase
            .from('phenotype_consensus')
            .select('code_id, comments')
            .eq('phenotype_id', phenotypeId);

        // C. Fetch SEARCH RESULTS (Global for this Phenotype)
        // This ensures that if User A found codes via search, User B sees them too.
        const searchResQuery = supabase
            .from('user_code_selections')
            .select('code_id')
            .eq('phenotype_id', phenotypeId)
            .eq('found_in_search', true);

        const [userRes, consensusRes, searchRes] = await Promise.all([
            userQuery,
            consensusQuery,
            searchResQuery
        ]);

        if (userRes.error) console.error(userRes.error);
        if (consensusRes.error) console.error(consensusRes.error);

        // 2. Prepare empty state objects
        const restoredSelected = {};
        const restoredSearch = {};
        const restoredComments = {};

        // Collect ALL IDs that need to be displayed (User + Consensus)
        const allIdsToLoad = new Set();

        // 3. Populate "Found in Search" (Base Layer)
        // We use the global list, so the tree is fully populated for everyone
        (searchRes.data || []).forEach(row => {
            allIdsToLoad.add(row.code_id);
            restoredSearch[row.code_id] = true;
        });

        // 4. Overlay User Data (Personal Layer)
        (userRes.data || []).forEach(row => {
            allIdsToLoad.add(row.code_id);

            if (row.is_selected) restoredSelected[row.code_id] = true;
            if (row.comment) restoredComments[row.code_id] = row.comment;

            // Note: We don't overwrite restoredSearch here.
            // The global query (Step 3) handles the 'found' status.
        });

        // 5. Overlay Consensus Data
        const consensusMap = {};
        (consensusRes.data || []).forEach(row => {
            allIdsToLoad.add(row.code_id);
            consensusMap[row.code_id] = {
                selected: true,
                comment: row.comments || ''
            };
        });

        // --- 3. HYDRATE THE TREE (The Missing Piece) ---
        // This fetches the actual Code/Description text for the table
        if (allIdsToLoad.size > 0) {
            // This maps ID -> { found_in_search: boolean } could be other data later too...
            // This is passed to fetchSpecificNodes to apply styling during creation
            const injectionMap = {};
            allIdsToLoad.forEach(id => {
                injectionMap[id] = {
                    found_in_search: !!restoredSearch[id]
                }
            });

            await fetchSpecificNodes(Array.from(allIdsToLoad), injectionMap);
        }

        // --- UPDATE GLOBALS after hydrating the tree ---
        selectedNodeKeys.value = restoredSelected;
        searchNodeKeys.value = restoredSearch;
        userComments.value = restoredComments;
        consensusState.value = consensusMap;
    };

    const fetchTeamSelections = async () => {
        const phenotypeId = currentPhenotype.value?.id;
        if (!phenotypeId) return;

        // 1. Fetch all selections for this project/phenotype
        const { data, error } = await supabase
            .from('user_code_selections')
            .select(`
                code_id,
                user_id,
                is_selected,
                comment,
                email:user_profiles(
                    email
                )
            `)
            .eq('phenotype_id', phenotypeId);

        if (error) {
            emitError("Error fetching team data", error.message);
            console.error("Error fetching team data:", error);
            return;
        }

        // TRANSFORM LOGIC
        const map = {};
        const membersSet = new Map();

        data.forEach(row => {
            const cId = row.code_id;
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
            .select('code_id, comments, finalized_at') // implicit existence = selected
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
            map[row.code_id] = {
                selected: true, // If it's in this table, it is selected
                comment: row.comments || ''
            };
            if (row.finalized_at) locked = true;
        });
        // console.log("Fetched Consensus Data:", map);
        consensusState.value = map;
        isFinalized.value = locked;
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

        if (!phenotypeId) return;

        isSaving.value = true;

        const finalRows = tableRows.value.filter(r => r.consensus_selected);

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
            const payload = finalRows.map(row => ({
                phenotype_id: phenotypeId,
                code_id: parseInt(row.key),
                comments: row.consensus_comment,
                finalized_at: finalize ? new Date().toISOString() : null
            }));

            isFinalized.value = finalize;

            // console.log("Consensus Payload:", payload);
            // 3. Insert
            if (payload.length > 0) {
                const { error } = await supabase
                    .from('phenotype_consensus')
                    .upsert(payload, {
                    // Crucial: Define what constitutes a conflict
                    onConflict: 'phenotype_id, code_id'
                });

                if (error) {
                    emitError("Error", "Failed to save consensus.");
                }
            }

            const action = finalize ? "Finalized" : "Saved";
            emitSuccess(`${action}`, `${action} ${payload.length} codes successfully.`);

            await resetDownloadCache(phenotypeId);

        } catch (err) {
            console.error(err);
            emitError("Error", "Failed to save consensus.");
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
                if (newId) {
                    clearSelectionState();
                    await fetchUserSelections(); // Restore checkmarks & highlights
                    await fetchConsensus();
                    await fetchSearchStrategy(newId); // restore search terms used
                } else {
                    clearSelectionState();
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
        unlockConsensus
    }
}