import { ref, computed, watch } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useNotifications } from './useNotifications'
import { useTreeSearch } from "@/composables/useTreeSearch.js";
import { useAuth } from "@/composables/useAuth.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";
import { useProjects } from "@/composables/useProjects.js";

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
const isReviewMode = ref(false);
const teamSelections = ref({}); // Format: { codeId: { userId: { is_selected, comment, email } } }
const projectMembers = ref([]); // List of users found in the dataset

// ---------------------------------------------
// COMPOSABLE
// ---------------------------------------------
export function useCodeSelection() {
    // Get dependencies inside the composable function
    const { emitError, emitSuccess } = useNotifications()
    const { user } = useAuth()
    const { currentPhenotype } = usePhenotypes()

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
        if (!phenotypeId || !userId) return;

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

        const [userRes, consensusRes] = await Promise.all([userQuery, consensusQuery]);

        if (userRes.error) console.error(userRes.error);
        if (consensusRes.error) console.error(consensusRes.error);

        // 2. Prepare empty state objects
        const restoredSelected = {};
        const restoredSearch = {};
        const restoredComments = {};

        // Collect ALL IDs that need to be displayed (User + Consensus)
        const allIdsToLoad = new Set();

        // Process User Data
        (userRes.data || []).forEach(row => {
            allIdsToLoad.add(row.code_id); // Add to set

            if (row.is_selected) restoredSelected[row.code_id] = true;
            if (row.found_in_search) restoredSearch[row.code_id] = true;
            if (row.comment) restoredComments[row.code_id] = row.comment;
        });

        // Process Consensus Data
        const consensusMap = {};
        (consensusRes.data || []).forEach(row => {
            allIdsToLoad.add(row.code_id); // Add to set (handles items user didn't pick)
            consensusMap[row.code_id] = {
                selected: true,
                comment: row.comments || ''
            };
        });

        // --- 2. UPDATE GLOBALS ---
        selectedNodeKeys.value = restoredSelected;
        searchNodeKeys.value = restoredSearch;
        userComments.value = restoredComments;
        consensusState.value = consensusMap;

        // --- 3. HYDRATE THE TREE (The Missing Piece) ---
        // This fetches the actual Code/Description text for the table
        if (allIdsToLoad.size > 0) {
            await fetchSpecificNodes(Array.from(allIdsToLoad));
        }
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
        const userId = user.value?.id;
        if (!phenotypeId || !userId) return;

        const { data, error } = await supabase
            .from('phenotype_consensus')
            .select('code_id, comments') // implicit existence = selected
            .eq('phenotype_id', phenotypeId);

        if (error) {
            emitError("Error loading consensus", error.message);
            console.error("Error loading consensus:", error);
            return;
        }

        // Map DB results to local state
        const map = {};
        data.forEach(row => {
            map[row.code_id] = {
                selected: true, // If it's in this table, it is selected
                comment: row.comments || ''
            };
        });
        // console.log("Fetched Consensus Data:", map);
        consensusState.value = map;
    };

    const saveConsensus = async (final = false) => {
        // console.log("Using save Consensus", final);
        // finalRows should be the array of row objects from your table
        // e.g. tableRows.value.filter(r => r.selected)
        const phenotypeId = currentPhenotype.value?.id;
        const userId = user.value?.id;
        if (!phenotypeId || !userId) return;

        isSaving.value = true;

        // console.log("Table Rows:", tableRows.value);
        const finalRows = tableRows.value.filter(r => r.consensus_selected);
        // console.log("Final Rows for Consensus:", finalRows);

        try {
            // 1. Clear previous consensus for this phenotype
            // (Ensures we don't keep "stale" codes that were unselected this time)
            await supabase
                .from('phenotype_consensus')
                .delete()
                .eq('phenotype_id', phenotypeId);

            // 2. Prepare Payload
            // We map the UI table rows to the DB columns
            const payload = finalRows.map(row => ({
                phenotype_id: phenotypeId,
                code_id: parseInt(row.key),
                comments: row.consensus_comment,
                finalized_at: null
            }));

            // console.log("Consensus Payload:", payload);

            if (payload.length === 0) return;

            // 3. Insert
            const { error } = await supabase
                .from('phenotype_consensus')
                .insert(payload);

            emitSuccess("Consensus Saved", `Finalized ${payload.length} codes.`);

        } catch (err) {
            console.error(err);
            emitError("Error", "Failed to save consensus.");
        } finally {
            isSaving.value = false;
        }
    };



    const handleFinalise = async () => {
        console.log("Using finalise Team Selections");


        // Simulate Network Delay
        await new Promise(resolve => setTimeout(resolve, 500));
    };

    // ------------------------------------------------------------
    // COMPOSABLE WATCHERS
    // ------------------------------------------------------------
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
                // Reset and Fetch
                selectedNodeKeys.value = {};
                searchNodeKeys.value = {}; // Reset highlights
                userComments.value = {};

                await fetchUserSelections(); // Restore checkmarks & highlights
                await fetchConsensus();
                await fetchSearchStrategy(newId); // restore search terms used
            }
        },
        { immediate: true }
    );

    // ------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------
    return {
        // state
        isSaving,
        isReviewMode,
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
        saveConsensus,
        handleFinalise,
        clearSelectionState
    }
}