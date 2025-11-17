import { ref, reactive, computed } from 'vue'
import { apiClient } from '@/composables/apiClient.js'

export function useTreeSearch({toast}) {
  // ------------------------------------------------------------
  // TREE STATE
  // ------------------------------------------------------------
  const nodes = ref([])
  const selectedNodeKeys = ref({})
  const expandedNodeKeys = ref({})
  const loading = ref(false)
  const errorMessage = ref(null)
  const selectedNodes = computed(() => {
      const flat = flattenedNodes(nodes.value);
      return flat
        .filter(node => selectedNodeKeys.value[node.key?.toString()])
        .map(node => ({
          key: node.key,
          leaf: node.leaf,
          selectable: node.selectable,
          ...node.data,
          found_in_search: node.data.found_in_search ? 'Yes' : 'No',
        }));
  });
  const flattenedNodes = (nodeList) => {
      const result = [];

      const traverse = (nodes) => {
        if (!Array.isArray(nodes)) return;

        nodes.forEach((node) => {
          result.push(node);

          if (Array.isArray(node.children) && node.children.length) {
            traverse(node.children);
          }
        });
  };

  traverse(nodeList);
  return result;
};


  // ------------------------------------------------------------
  // SEARCH OPTIONS
  // ------------------------------------------------------------
  const autoSelect = ref(false)
  const searchInOptions = ref([
    { label: 'Codes', value: 'code' },
    { label: 'Description', value: 'description' },
  ])
  const searchSystemsOptions = ref([
    { name: 'ICD-10', id: 1 },
  ])

  // ------------------------------------------------------------
  // SEARCH INPUT MODEL
  // ------------------------------------------------------------
  const makeSearchInput = () => ({
    text: '',
    regex: false,
    columns: searchInOptions.value.map(x => x.value),
    system_ids: searchSystemsOptions.value.map(x => x.id),
  })
  const searchInputs = ref([makeSearchInput()])
  function addSearchTerm() {
    searchInputs.value.push(makeSearchInput())
  }
  function removeSearchTerm(index) {
    if (searchInputs.value.length > 1) {
      searchInputs.value.splice(index, 1)
    }
  }

  // ------------------------------------------------------------
  // CLEAR SEARCH FLAGS
  // ------------------------------------------------------------
  function clearSearchFlags(nodesArr) {
    if (!Array.isArray(nodesArr)) return
    nodesArr.forEach(n => {
      if (n?.data) n.data.found_in_search = false
      if (Array.isArray(n.children)) clearSearchFlags(n.children)
    })
  }

  // ------------------------------------------------------------
  // RUN SEARCH
  // ------------------------------------------------------------
  async function runSearch() {
      console.log("selectedNodeKeys internal:", selectedNodeKeys.value)
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
      toast.add({
        severity: 'warn',
        summary: 'No Search Input',
        detail: 'Please enter at least one search term.',
      })
      return
    }

    try {
      const res = await apiClient.post('/api/search-nodes', payload)

      // clear old flags first
      clearSearchFlags(nodes.value)

      // merge search results into tree
      mergeSearchNodesIntoTree({
        results: res.data.results,
        ancestor_map: res.data.ancestor_map,
        treeNodes: nodes.value,
        expandedKeys: expandedNodeKeys.value,
      })

      toast.add({
        severity: 'success',
        summary: 'Search Complete',
        detail: `${res.data.results.length} items found.`,
      })

    } catch (err) {
      toast.add({
        severity: 'error',
        summary: 'Search Failed',
        detail: err?.response?.data?.detail || err.message,
      })
    }

  }

  // ------------------------------------------------------------
  // LAZY LOAD TREE CHILDREN
  // ------------------------------------------------------------
  const onNodeExpand = async (node) => {
      console.log("async function onNodeExpand(node)")
      const isRoot = !node;
      const parentId = isRoot ? null : node.key;

      if (isRoot || !node.leaf) {
        if (isRoot) loading.value = true;
        if (node) node.loading = true;
        try {
          const res = await apiClient.get('/api/tree-nodes', { params: { parent_id: parentId } });
          const children = res.data.map(child => ({ ...child }));

          if (isRoot) {
            nodes.value = children;
            console.log('Root nodes loaded:', nodes.value);
          } else {
            node.children = children;
            console.log('Node after assigning children:', node);
          }
        } catch (err) {
          console.error('Failed to load children for node', node.key, err);
        } finally {
          if (node) node.loading = false;
        }
      }
      console.log("The nodes value", nodes.value)
  };

  function mergeSearchNodesIntoTree({ results, ancestor_map }) {
      console.log("=== mergeSearchNodesIntoTree ===");
      console.log("Results array length:", results.length);
      console.log("Initial nodes.value:", nodes.value);

       // 🔹 Reset all existing found_in_search flags before applying new search results
      clearSearchFlags(nodes.value);

      const searchResultIds = new Set(results.map(r => r.key));

      results.forEach((result, resultIndex) => {

        const pathIds = result.data.materialized_path.split('/').filter(Boolean);

        let currentLevel = nodes.value; // assuming nodes is a ref
        console.log(`\nProcessing result #${resultIndex}, pathIds:`, pathIds);

        pathIds.forEach((id, index) => {
          console.log(`  At path index ${index}, id: ${id}`);
          console.log("  currentLevel before find:", currentLevel);

          if (!Array.isArray(currentLevel)) {
            console.error('currentLevel is not an array!', currentLevel);
            currentLevel = [];
          }

          let node = currentLevel.find(n => n.key === id);
          console.log("  Found node:", node);

          if (!node) {
            // Use ancestor_map if available, otherwise fallback to result
            const source = ancestor_map[id] || result;
            node = {
              key: id.toString(),
              label: source.label,           // label for display
              children: [],
              leaf: index === pathIds.length - 1,
              selectable: source.data.is_selectable,
              data: {                        // preserve the original data object
                ...source.data,
                found_in_search: searchResultIds.has(id)
              }
            };

            currentLevel.push(node);
            console.log("  Created new node:", node);

          } else {
            // Node already exists, update search hit if applicable
            if (searchResultIds.has(id)) {
              node.data = { ...node.data, found_in_search: true };
              console.log("  Updated existing node as search hit:", node);
            }
          }

          // Mark ancestors as expanded
          if (index < pathIds.length - 1) {
            expandedNodeKeys.value[id] = true;
          }

          currentLevel = node.children = node.children || [];
          console.log("  currentLevel after update:", currentLevel);
        });
      });
  }



  // ------------------------------------------------------------
  // EXPORT
  // ------------------------------------------------------------
  return {
    // tree
    nodes,
    selectedNodeKeys,
    expandedNodeKeys,
    loading,
    errorMessage,
    onNodeExpand,
    selectedNodes,

    // search
    autoSelect,
    searchInputs,
    searchInOptions,
    searchSystemsOptions,
    addSearchTerm,
    removeSearchTerm,
    runSearch
  }
}


// const runSearch = async () => {
//   // Build payload for the simplified backend
//   const payload = {
//     searches: searchInputs.value
//       .filter(input => input.text.trim()) // ignore completely empty inputs
//       .map(input => ({
//         text: input.text.trim(),
//         regex: input.regex,
//         columns: input.columns,        // e.g., ["code", "description"]
//         system_ids: input.system_ids   // e.g., [1, 2]
//       })),
//     limit: 100
//   };
//
//   console.log('Payload:', payload);
//
//   if (payload.searches.length === 0) {
//     toast.add({
//       severity: 'warn',
//       summary: 'No Search Input',
//       detail: 'Please enter at least one search term.',
//       life: 4000
//     });
//     return;
//   }
//
//   // Format a user-friendly string for toast
//   const getSystemNames = (ids) =>
//     ids.map(id => searchSystemsOptions.value.find(s => s.id === id)?.name || id).join(', ');
//
//   const getColumnLabels = (values) =>
//     values.map(val => searchInOptions.value.find(c => c.value === val)?.label || val).join(', ');
//
//   const formattedTerms = payload.searches
//     .map((input, i) => {
//       const regex = input.regex ? ' [regex]' : '';
//       const systems = input.system_ids.length ? ` [systems: ${getSystemNames(input.system_ids)}]` : '';
//       const columns = input.columns.length ? ` [columns: ${getColumnLabels(input.columns)}]` : '';
//       return `${i + 1}: "${input.text}"${regex}${systems}${columns}`;
//     })
//     .join('\n');
//
//   toast.add({
//     severity: 'info',
//     summary: 'Search in Progress',
//     detail: formattedTerms,
//     life: 5000
//   });
//
//   try {
//     // Send payload in POST body
//     const res = await apiClient.post('/api/search-nodes', payload);
//     console.log('Search results:', res.data);
//
//     mergeSearchNodesIntoTree({
//       results: res.data.results,
//       ancestor_map: res.data.ancestor_map,
//       treeNodes: nodes.value,
//       expandedKeys: expandedNodeKeys
//     });
//
//     toast.add({
//       severity: 'success',
//       summary: 'Search Successful',
//       detail: `${res.data.results.length} items retrieved from server.`,
//       life: 5000,
//     });
//
//   } catch (err) {
//     console.error('Search failed', err);
//     toast.add({
//       severity: 'error',
//       summary: 'Search Failed',
//       detail: err?.response?.data?.detail || 'Server error occurred.',
//       life: 5000,
//     });
//   }
// };
//

//
// const nameError = ref(false)
// function flashNameError() {
//   nameError.value = true
//   setTimeout(() => {
//     nameError.value = false
//   }, 1200) // highlight for 1.2 seconds
// }
//
// const phenotype = reactive({
//   id: "",
//   name: "",
//   description: "",
//   selectedMetric: null,
//   filters: [],
//   config: {},
//   created_at: null,
// })
//
// //define save things
// const saveOptions = [
//   {
//     label: 'Save',
//     icon: 'pi pi-save',
//     command: () => save('save')
//   },
//   {
//     label: 'Update',
//     icon: 'pi pi-refresh',
//     command: () => save('update')
//   }
// ];
//
// function mainSaveClick(event) {
//   // event is the PointerEvent, ignore it
//   save('save');
// }
//
// async function save() {
//   if (!user.value) {
//     toast.add({
//       severity: 'warn',
//       summary: 'Not logged in',
//       detail: 'Please log in to save a phenotype.',
//       life: 3000
//     })
//     return
//   }
//
//   // Check global phenotype name
//   console.log('phenotype name:', JSON.stringify(phenotype.name));
//   if (!phenotype.name || phenotype.name.trim() === '') {
//     flashNameError()
//     toast.add({
//       severity: 'warn',
//       summary: 'Missing name',
//       detail: 'Please give this phenotype a name before saving.',
//       life: 3000
//     })
//     return
//   }
//
//   try {
//     const payload = {
//       user_id: user.value.id,
//       project_id: project.value.id,
//       name: phenotype.name.trim(),
//       // Later: add full phenotype JSON here
//       // data: phenotype
//     }
//
//     const { data, error } = await useSupabase
//       .from('phenotypes')
//       .insert(payload)
//       .select()
//
//     if (error) {
//       if (error.code === '23505') {
//         flashNameError()
//         toast.add({
//           severity: 'error',
//           summary: 'Name taken',
//           detail: `A phenotype named "${phenotype.name}" already exists.`,
//           life: 3000
//         })
//         return
//       }
//       throw error
//     }
//
//     const row = data[0]
//     savedPhenotypes.value.push(row)
//     phenotype.id  = row.id
//
//     toast.add({
//       severity: 'success',
//       summary: 'Saved',
//       detail: `Phenotype "${row.name}" saved successfully.`,
//       life: 3000
//     })
//
//   } catch (err) {
//     console.error('Saving phenotype failed', err)
//     toast.add({
//       severity: 'error',
//       summary: 'Error',
//       detail: `Failed to save phenotype: ${err.message || err}`,
//       life: 4000
//     })
//   }
// }
//
// const confirm = useConfirm();
// function confirmDelete(event) {
//   console.log("foo")
//   if (!phenotype?.name) return
//
//   confirm.require({
//     target: event.currentTarget,
//     message: `Are you sure you want to delete "${phenotype.name}"?`,
//     icon: 'pi pi-exclamation-triangle',
//     acceptLabel: 'Yes',
//     rejectLabel: 'No',
//     accept: async () => {
//       if (!phenotype?.id) {
//         toast.add({
//           severity: 'warn',
//           summary: 'Cannot delete',
//           detail: 'Phenotype has not been saved yet',
//           life: 3000
//         });
//         return;
//       }
//
//       try {
//         const { error } = await useSupabase
//           .from('phenotypes')
//           .delete()
//           .eq('id', phenotype.id);
//
//         if (error) throw error;
//
//         savedPhenotypes.value = savedPhenotypes.value.filter(
//           p => p.id !== phenotype.id
//         );
//
//         phenotype.id = ''
//         phenotype.name = ''
//         phenotype.description = ""
//         phenotype.selectedMetric = null
//         phenotype.filters = []
//         phenotype.config = {}
//         phenotype.created_at = null
//
//       } catch (err) {
//         console.error('Delete failed', err);
//         toast.add({
//           severity: 'error',
//           summary: 'Delete failed',
//           detail: err.message || err,
//           life: 3000
//         });
//       }
//     },
//     reject: () => {
//       console.log('Delete cancelled')
//     }
//   })
// }