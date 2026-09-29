import {ref, reactive, computed, watch} from 'vue'
import { supabase } from '@/composables/shared/useSupabase.js'
import { apiClient } from '@/composables/shared/apiClient.js'
import { useNotifications } from '../shared/useNotifications.js'
import { usePhenotypes } from "@/composables/project/usePhenotypes.js";
import {useCodeSystems} from "@/composables/shared/useCodeSystems.js";


// Global state
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

// Composable
export function useTreeSearch() {
    const { emitError, emitSuccess } = useNotifications()

    // code system options for the dropdowns
    const { codeSystems, loadCodeSystems } = useCodeSystems()



    // Utils
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

    // Search inputs
    loadCodeSystems().catch(err => { console.error("Failed to load code systems:", err) })
    const searchSystemsOptions = computed(() => {
        return codeSystems.value.map(sys => ({
            name: sys.name,
            id: sys.id
        }))
    })
    const getDefaultSystemIds = () => {
        if (codeSystems.value.length === 0) return []
        const defaults = ['ICD-10-UKBB', 'ICD-9-UKBB', 'SNOMED-CT']
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

    function addSearchTerm(isAuto = false) {
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
                 if (!isAuto) {
                     emitError("Incomplete Search Term", "Please fill in all existing search terms before adding a new one.")
                 }
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
            // numeric so A2 sorts before A10
            return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        });

        nodesArr.forEach(node => {
            if (node.children && node.children.length > 0) {
                sortTreeNodes(node.children);
            }
        });
    }

    // Save / reload search
    const saveSearchStrategy = async (phenotypeId) => {
        if (!phenotypeId) return;

        // searchInputs -> phenotype_search_terms rows
        const payload = searchInputs.value.map((input, index) => ({
            phenotype_id: phenotypeId,
            term: input.text,
            is_regex: input.regex,
            target_columns: input.columns,     // ["code", "description"]
            system_ids: input.system_ids,      // [1]
            row_order: index
        }));

        // replace the saved search: delete then insert
        const { error: delError } = await supabase
            .from('phenotype_search_terms')
            .delete()
            .eq('phenotype_id', phenotypeId);

        if (delError) {
            console.error("Failed to clear old search strategy", delError);
            return;
        }

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
            // rows -> searchInputs
            searchInputs.value = data.map(row => ({
                text: row.term,
                regex: row.is_regex,
                columns: row.target_columns, // Postgres array becomes JS array automatically
                system_ids: row.system_ids,  // Postgres array becomes JS array automatically
                // ai_enhanced: row.is_ai_enhanced (future)
            }));
        } else {
            // one empty input if nothing saved
            searchInputs.value = [makeSearchInput()];
        }
    };

    // lazy load children
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

                if (!Array.isArray(res.data)) {
                    throw new Error('Unexpected tree response shape');
                }

                const children = res.data.map(child => ({ ...child }));

                if (isRoot) {
                    nodes.value = children;
                    // console.log('Root nodes loaded:', nodes.value);
                } else {
                    node.children = children;
                    // console.log('Node after assigning children:', node);
                }

                sortTreeNodes(isRoot ? nodes.value : node.children);

            } catch (err) {
                const key = node ? node.key : 'root';
                console.error('Failed to load children for node', key, err);
            } finally {
                if (node) node.loading = false;
            }
        }
        // console.log("The nodes value", nodes.value)
    };

    // Rebuild the tree down to specific saved nodes
    const fetchSpecificNodes = async (ids, inject = {}) => {
        if (!ids || ids.length === 0) return;

        try {
            // get the nodes first for their paths
            const { data: targetNodes, error: targetError } = await supabase
                .from('codes')
                .select('id, materialized_path')
                .in('id', ids);

            if (targetError) throw targetError;

            // then every id on those paths
            const allIdsToFetch = new Set();
            targetNodes.forEach(node => {
                allIdsToFetch.add(String(node.id));
                if (node.materialized_path) {
                    const pathIds = node.materialized_path.split('/').filter(Boolean);
                    pathIds.forEach(pId => allIdsToFetch.add(pId));
                }
            });

            const { data: fullData, error: fullError } = await supabase
                .from('codes')
                .select(`
                    *,
                    system:code_systems ( name )
                `)
                .in('id', Array.from(allIdsToFetch));

            const fullResults = fullData.map(row => {
                // row.system is { name: "ICD-10" }, flatten to the name
                const systemName = row.system?.name || '';
                const nodeId = String(row.id);

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

            // ancestors are already in the results, so no ancestor_map needed
            mergeSearchNodesIntoTree({
                results: fullResults,
                ancestor_map: {},
                clearPrevious: false
            });

        } catch (err) {
            console.error("Error restoring specific nodes:", err);
        }
    };

    // merge nodes into the tree
    function mergeSearchNodesIntoTree({ results, ancestor_map, clearPrevious = false }) {
        // console.log("=== mergeSearchNodesIntoTree ===");
        // console.log("Results array length:", results.length);
        // console.log("Initial nodes.value:", nodes.value);
        if (clearPrevious) {
            clearSearchFlags(nodes.value);
            searchNodeKeys.value = {};
        }

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
                    // already in the tree, re-apply the flag if it was found again
                    if (result.data?.found_in_search && id === String(result.key)) {
                        if (!node.data) node.data = {};
                        node.data.found_in_search = true;
                    }
                }

                // expand ancestors
                if (index < pathIds.length - 1) {
                    expandedNodeKeys.value[id] = true;
                }

                currentLevel = node.children = node.children || [];
            });
        });

        sortTreeNodes(nodes.value);
    }

    // run search
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
            limit: 200,
        }

        if (payload.searches.length === 0) {
            emitError("No Search Input", "Please enter at least one search term.")
            return
        }

        try {
            const res = await apiClient.post('/api/search-nodes', payload)

            // set found_in_search here so the merge is the same as for hydration
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

            // auto-select the hits
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

    // Export
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
