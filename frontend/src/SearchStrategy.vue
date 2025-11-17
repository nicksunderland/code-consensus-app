<script setup>
import { ref, reactive } from 'vue'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/togglebutton'
import MultiSelect from 'primevue/multiselect'
import Tooltip from 'primevue/tooltip'
import Divider from "primevue/divider";

const autoSelect = ref(false);
const searchInOptions = ref([
  { label: 'Codes', value: 'code' },
  { label: 'Description', value: 'description' }
]);
const searchSystemsOptions = ref([
  { name: 'ICD-10', id: 1 }
]);
const makeSearchInput = () => ({
  text: '',
  regex: false,
  system_ids: searchSystemsOptions.value.map(opt => opt.id),
  columns: searchInOptions.value.map(opt => opt.value)
})
const searchInputs = ref([makeSearchInput()]);
const addSearchTerm = () => searchInputs.value.push(makeSearchInput())
const removeSearchTerm = (index) => {
  if (searchInputs.value.length > 1) {
    searchInputs.value.splice(index, 1)
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
// function clearSearchFlags(nodes) {
//   if (!Array.isArray(nodes)) return;
//   nodes.forEach(node => {
//     if (node.data) {
//       node.data.found_in_search = false;
//     }
//     if (Array.isArray(node.children) && node.children.length) {
//       clearSearchFlags(node.children);
//     }
//   });
// }
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

</script>

<template>
  <Card>
    <template #title>
      <div class="regex-header">
        <span>Search</span>
        <span v-tooltip.top="{ value: 'Add search term', showDelay: 300 }">
          <Button
            icon="pi pi-plus"
            severity="success"
            rounded
            variant="outlined"
            size="small"
            @click="addSearchTerm"
            aria-label="Add search input"
          />
        </span>
      </div>
    </template>
    <template #content>
      <!-- Search Panel -->
      <div class="panel regex-panel">
        <div class="regex-list">
          <div v-for="(input, index) in searchInputs" :key="index" class="regex-row">
            <InputText
              v-tooltip.top="{value: 'Enter search term or regular expression', showDelay: 300}"
              type="text"
              v-model="input.text"
              placeholder="Enter search term"
              class="search-line-input"
            />
            <span v-tooltip.top="{value: 'Regex search', showDelay: 300}">
              <ToggleSwitch
                  v-model="input.regex"
                  class="search-use-regex"
              />
            </span>
            <span v-tooltip.top="{value: 'Apply search to...', showDelay: 300}">
              <MultiSelect
                  v-model="input.columns"
                  :options="searchInOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="search-column"
              />
            </span>
            <span v-tooltip.top="{value: 'Coding systems', showDelay: 300}">
              <MultiSelect
                  v-model="input.system_ids"
                  :options="searchSystemsOptions"
                  optionLabel="name"
                  optionValue="id"
                  class="search-systems" />
            </span>
            <span v-tooltip.top="{value: 'Remove', showDelay: 300}">
              <Button
                icon="pi pi-times"
                severity="danger"
                rounded variant="outlined"
                size="small"
                :disabled="searchInputs.length === 1"
                @click="removeSearchTerm(index)"
                aria-label="Remove search input"
              />
            </span>
          </div>
        </div>
      </div>
    </template>
  </Card>

<!--  &lt;!&ndash; Run Search Card &ndash;&gt;-->
<!--  <Card>-->
<!--    <template #content>-->
<!--      <div class="search-button-container">-->
<!--        <Button-->
<!--          label="Run Search"-->
<!--          @click="runSearch"-->
<!--        />-->
<!--        <span v-tooltip.top="{value: 'Auto-select search results', showDelay: 300}">-->
<!--          <ToggleSwitch-->
<!--              v-model="autoSelect"-->
<!--              class="auto-select-search"-->
<!--          />-->
<!--        </span>-->
<!--        <Divider layout="vertical" />-->
<!--        <InputText-->
<!--          v-tooltip.top="{value: 'Phenotype name', showDelay: 300}"-->
<!--          type="text"-->
<!--          v-model="phenotype.name"-->
<!--          :invalid="nameError"-->
<!--          placeholder="Enter phenotype name"-->
<!--        />-->
<!--        <SplitButton-->
<!--          label="Save"-->
<!--          @click="mainSaveClick"-->
<!--          :model="saveOptions"-->
<!--        />-->
<!--        <ConfirmPopup></ConfirmPopup>-->
<!--        <Button-->
<!--          @click="confirmDelete($event)"-->
<!--          label="Delete"-->
<!--          severity="danger"-->
<!--          :disabled="!phenotype?.id"-->
<!--        />-->
<!--      </div>-->
<!--    </template>-->
<!--  </Card>-->
</template>

<style scoped>

</style>