import {ref, reactive, computed, watch} from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { apiClient } from '@/composables/apiClient.js'
import { useNotifications } from './useNotifications'
import { usePhenotypes } from "@/composables/usePhenotypes.js";
import {useCodeSystems} from "@/composables/useCodeSystems.js";


// ---------------------------------------------
// GLOBAL STATE
// ---------------------------------------------
const nodes = ref([])
const selectedNodeKeys = ref({})
const searchNodeKeys = ref({})
const expandedNodeKeys = ref({})
const errorMessage = ref(null)
const autoSelect = ref(false)
const searchInOptions = [
    { label: 'Codes',       value: 'code'        },
    { label: 'Description', value: 'description' },
]
const searchInputs = ref([])

// ---------------------------------------------
// COMPOSABLE
// ---------------------------------------------
export function useTreeSearch() {
    // Get dependencies inside the composable function
    const { emitError, emitSuccess } = useNotifications()

    // get and generate the code systems options for the UI
    const { codeSystems, loadCodeSystems } = useCodeSystems()



    // ------------------------------------------------------------
    // UTILS
    // ------------------------------------------------------------
    function clearSearchFlags(nodesArr) {

        if (!Array.isArray(nodesArr)) return

        nodesArr.forEach(n => {
            if (n?.data) n.data.found_in_search = false
            if (Array.isArray(n.children)) clearSearchFlags(n.children)
        })
    }

    function resetTree() {
        clearSearchFlags(nodes.value)
        selectedNodeKeys.value = {}
        expandedNodeKeys.value = {}
        errorMessage.value = null
    }

    function clearTreeState() {
        selectedNodeKeys.value = {}
        searchNodeKeys.value = {}
        expandedNodeKeys.value = {}
        errorMessage.value = null
        searchInputs.value = [makeSearchInput()]
    }

    // ------------------------------------------------------------
    // SEARCH INPUTS
    // ------------------------------------------------------------
    loadCodeSystems().catch(err => { console.error("Failed to load code systems:", err) })
    const searchSystemsOptions = computed(() => {
        return codeSystems.value.map(sys => ({
            name: sys.name,
            id: sys.id
        }))
    })
    const getDefaultSystemIds = () => {
        if (codeSystems.value.length === 0) return []
        const defaults = ['ICD-10-UKBB', 'ICD-9-UKBB']
        return codeSystems.value
            .filter(sys => defaults.includes(sys.name))
            .map(sys => sys.id)
    }
    const makeSearchInput = () => ({
        text: '',
        regex: false,
        columns: searchInOptions.map(x => x.value),
        system_ids: getDefaultSystemIds()
    })

    function addSearchTerm() {
        if (searchInputs.value.length === 0) {
            searchInputs.value.push(makeSearchInput())
            return
        }
        const allFilled = searchInputs.value.every(input => {
            return input.text && input.text.trim() !== "";
        });
        if (allFilled) {
            searchInputs.value.push(makeSearchInput())
        } else {
            const isSingleEmptyRow = searchInputs.value.length === 1 && !searchInputs.value[0].text;
            if (!isSingleEmptyRow) {
                 emitError("Incomplete Search Term", "Please fill in all existing search terms before adding a new one.")
            }
        }
    }

    function removeSearchTerm(index) {
        if (searchInputs.value.length > 1) {
            searchInputs.value.splice(index, 1)
        }
    }

    function sortTreeNodes(nodesArr) {
        if (!Array.isArray(nodesArr)) return;

        nodesArr.sort((a, b) => {
            const valA = a.data?.code || a.label || "";
            const valB = b.data?.code || b.label || "";
            // Numeric: true handles "A1, A2, A10" correctly instead of "A1, A10, A2"
            return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Recursively sort children
        nodesArr.forEach(node => {
            if (node.children && node.children.length > 0) {
                sortTreeNodes(node.children);
            }
        });
    }

    // ------------------------------------------------------------
    // SAVE / RELOAD SEARCH
    // ------------------------------------------------------------
    const saveSearchStrategy = async (phenotypeId) => {
        if (!phenotypeId) return;

        // 1. Prepare Payload
        // Map your UI 'searchInputs' to the DB columns
        const payload = searchInputs.value.map((input, index) => ({
            phenotype_id: phenotypeId,
            term: input.text,
            is_regex: input.regex,
            target_columns: input.columns,     // ["code", "description"]
            system_ids: input.system_ids,      // [1]
            is_ai_enhanced: false,             // Future placeholder
            row_order: index
        }));

        // 2. Sync (Delete Old -> Insert New)
        // A. Delete existing strategy for this phenotype
        const { error: delError } = await supabase
            .from('phenotype_search_terms')
            .delete()
            .eq('phenotype_id', phenotypeId);

        if (delError) {
            console.error("Failed to clear old search strategy", delError);
            return;
        }

        // B. Insert new strategy (if any exist)
        if (payload.length > 0) {
            const { error: insError } = await supabase
                .from('phenotype_search_terms')
                .insert(payload);

            if (insError) console.error("Failed to save search strategy", insError);
        }
    };

    const fetchSearchStrategy = async (phenotypeId) => {
        if (!phenotypeId) return;

        const { data, error } = await supabase
            .from('phenotype_search_terms')
            .select('*')
            .eq('phenotype_id', phenotypeId)
            .order('row_order', { ascending: true });

        if (error) {
            console.error("Error loading search strategy", error);
            return;
        }

        if (data && data.length > 0) {
            // Map DB rows back to your UI object structure
            searchInputs.value = data.map(row => ({
                text: row.term,
                regex: row.is_regex,
                columns: row.target_columns, // Postgres array becomes JS array automatically
                system_ids: row.system_ids,  // Postgres array becomes JS array automatically
                // ai_enhanced: row.is_ai_enhanced (future)
            }));
        } else {
            // Default to one empty input if nothing saved
            searchInputs.value = [makeSearchInput()];
        }
    };

    // ------------------------------------------------------------
    // API: LAZY LOAD CHILDREN
    // ------------------------------------------------------------
    const onNodeExpand = async (node) => {

        const isRoot = !node;
        const parentId = isRoot ? null : node.key;

        // console.log("parentId:", parentId)
        // console.log("isRoot:", isRoot)

        if (isRoot || !node.leaf) {

            if (node) node.loading = true;

            try {
                // console.log("parentId:", parentId)
                const res = await apiClient.get('/api/tree-nodes', { params: { parent_id: parentId } });
                // console.log("await apiClient.get:", res)

                const children = res.data.map(child => ({ ...child }));

                if (isRoot) {
                    nodes.value = children;
                    // console.log('Root nodes loaded:', nodes.value);
                } else {
                    node.children = children;
                    // console.log('Node after assigning children:', node);
                }

                // Ensure loaded children are sorted immediately
                sortTreeNodes(isRoot ? nodes.value : node.children);

            } catch (err) {
                console.error('Failed to load children for node', node.key, err);
            } finally {
                if (node) node.loading = false;
            }
        }
        // console.log("The nodes value", nodes.value)
    };

    // ------------------------------------------------------------
    // API: RESTORE SPECIFIC NODES (Hydration)
    // ------------------------------------------------------------
    const fetchSpecificNodes = async (ids, inject = {}) => {
        if (!ids || ids.length === 0) return;

        try {
            // STEP 1: Fetch the requested nodes first to get their paths
            const { data: targetNodes, error: targetError } = await supabase
                .from('codes')
                .select('id, materialized_path')
                .in('id', ids);

            if (targetError) throw targetError;

            // STEP 2: Collect ALL IDs needed (Targets + Ancestors)
            const allIdsToFetch = new Set();
            targetNodes.forEach(node => {
                // Add the node itself
                allIdsToFetch.add(String(node.id));
                // Parse path "1/5/12" -> Add 1, 5, 12
                if (node.materialized_path) {
                    const pathIds = node.materialized_path.split('/').filter(Boolean);
                    pathIds.forEach(pId => allIdsToFetch.add(pId));
                }
            });

            // STEP 3: Fetch details for EVERYONE in the chain
            const { data: fullData, error: fullError } = await supabase
                .from('codes')
                .select(`
                    *,
                    system:code_systems ( name )
                `)
                .in('id', Array.from(allIdsToFetch));

            // STEP 4: Format & inject
            const fullResults = fullData.map(row => {
                // Flatten the system object into a string
                // If row.system is { name: "ICD-10" }, this grabs just "ICD-10"
                const systemName = row.system?.name || '';
                const nodeId = String(row.id);

                // Check if we have extra data to inject for this specific ID
                const extraData = inject[nodeId] || {};

                return {
                    key: String(row.id),
                    label: `${row.code} - ${row.description}`,
                    data: {
                        ...row,
                        system: systemName, // OVERWRITE the system object with the string name
                        ...extraData // OVERWRITE any other data that we want, or inject more
                    }
                };
            });

            // STEP 5: Merge
            // We pass an empty ancestor_map because we manually fetched all the ancestors
            // and included them in 'results', so the merger will find them naturally.
            mergeSearchNodesIntoTree({
                results: fullResults,
                ancestor_map: {},
                clearPrevious: false
            });

        } catch (err) {
            console.error("Error restoring specific nodes:", err);
        }
    };

    // ------------------------------------------------------------
    // LOGIC: MERGE NODES INTO TREE
    // ------------------------------------------------------------
    function mergeSearchNodesIntoTree({ results, ancestor_map, clearPrevious = false }) {
        // console.log("=== mergeSearchNodesIntoTree ===");
        // console.log("Results array length:", results.length);
        // console.log("Initial nodes.value:", nodes.value);
        if (clearPrevious) {
            clearSearchFlags(nodes.value);
            searchNodeKeys.value = {};
        }

        // Update global index based on incoming results
        results.forEach(r => {
            if (r.data?.found_in_search) {
                searchNodeKeys.value[r.key] = true;
            }
        });

        results.forEach((result, resultIndex) => {
            const pathString = result.data.materialized_path || String(result.key);
            const pathIds = pathString.split('/').filter(Boolean);

            let currentLevel = nodes.value; // assuming nodes is a ref

            pathIds.forEach((id, index) => {
                if (!Array.isArray(currentLevel)) currentLevel = [];

                let node = currentLevel.find(n => n.key === id);

                if (!node) {
                    const isTargetNode = (id === String(result.key));
                    const source = isTargetNode ? result : (ancestor_map?.[id] || {
                        label: 'Loading...',
                        data: { is_selectable: false }
                    });
                    node = {
                        key: id.toString(),
                        label: source.label || source.data?.code || id,
                        children: [],
                        leaf: index === pathIds.length - 1,
                        selectable: source.data?.is_selectable ?? true,
                        data: { ...source.data }
                    };

                    currentLevel.push(node);

                } else {
                    // If node exists, we MUST re-apply the flag if it was found again
                    if (result.data?.found_in_search && id === String(result.key)) {
                        if (!node.data) node.data = {};
                        node.data.found_in_search = true;
                    }
                }

                // Mark ancestors as expanded
                if (index < pathIds.length - 1) {
                    expandedNodeKeys.value[id] = true;
                }

                currentLevel = node.children = node.children || [];
            });
        });

        // Finally, sort the entire tree after merging
        sortTreeNodes(nodes.value);
    }

    // ------------------------------------------------------------
    // API: RUN SEARCH
    // ------------------------------------------------------------
    async function runSearch() {
        const payload = {
            searches: searchInputs.value
                .filter(s => s.text.trim())
                .map(s => ({
                    text: s.text.trim(),
                    regex: s.regex,
                    columns: s.columns,
                    system_ids: s.system_ids,
                })),
            limit: 100,
        }

        if (payload.searches.length === 0) {
            emitError("No Search Input", "Please enter at least one search term.")
            return
        }

        try {
            const res = await apiClient.post('/api/search-nodes', payload)

            // Inject found_in_search: true here, so merge logic is identical to hydration
            const preparedResults = res.data.results.map(r => ({
                ...r,
                data: {
                    ...r.data,
                    found_in_search: true
                }
            }));

            mergeSearchNodesIntoTree({
                results: preparedResults,
                ancestor_map: res.data.ancestor_map,
                clearPrevious: true
            })

            // --- AUTO SELECT RESULTS ---
            if (autoSelect.value) {
                const nextSelection = { ...selectedNodeKeys.value }
                preparedResults.forEach(r => {
                    nextSelection[r.key] = true
                })
                selectedNodeKeys.value = nextSelection
            }

            emitSuccess('Search Complete', `${res.data.results.length} items found.`)

        } catch (err) {
            emitError("Search Failed", `${err?.response?.data?.detail || err.message}`)
        }

    }

    // ------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------
    return {
        // tree
        nodes,
        selectedNodeKeys,
        searchNodeKeys,
        expandedNodeKeys,
        errorMessage,
        onNodeExpand,
        resetTree,
        clearTreeState,

        // search
        autoSelect,
        searchInputs,
        searchInOptions,
        searchSystemsOptions,
        addSearchTerm,
        removeSearchTerm,
        fetchSpecificNodes,
        runSearch,
        fetchSearchStrategy,
        saveSearchStrategy
    }
}
