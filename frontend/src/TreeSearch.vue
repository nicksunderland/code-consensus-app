<script setup>
import {onMounted, ref} from "vue";
import Tree from 'primevue/tree';
import 'primeicons/primeicons.css';
import { useConfirm } from 'primevue/useconfirm'
import MultiSelect from "primevue/multiselect";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import ToggleSwitch from "primevue/toggleswitch";
import {useTreeSearch} from "@/composables/useTreeSearch.js";
import {usePhenotypes} from "@/composables/usePhenotypes.js";
import ConfirmDialog from "primevue/confirmdialog";

// --- use composable ---
const {
  nodes,
  selectedNodeKeys,
  expandedNodeKeys,
  searchInputs,
  searchInOptions,
  searchSystemsOptions,
  autoSelect,
  addSearchTerm,
  removeSearchTerm,
  runSearch,
  onNodeExpand
} = useTreeSearch()

const {
  currentPhenotype,
  nameError,
  savePhenotype,
  deletePhenotype
} = usePhenotypes()


// removing all selected nodes with confirmation
const confirm = useConfirm();
const isVisible = ref(false);
const removeAllCodes = (event) => {
    confirm.require({
        target: event.currentTarget,
        message: 'Are you sure you want to remove all codes and all their associated consensus data!?',
        header: 'Dangerous Action!',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete All',
        acceptIcon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        onShow: () => { isVisible.value = true; },
        onHide: () => { isVisible.value = false; },
        // accept: () => { resetTree(); },
        // reject: () => {}
    });
}

// --- Load tree on component mount ---
onMounted(async () => {
    console.log("in onMounted TreeSearch.vue:", nodes)
    addSearchTerm()
    console.log("in onMounted TreeSearch.vue:", searchInputs)
    await onNodeExpand(null)



    // Populate MultiSelect system options (map so overwrites)
    // searchSystemsOptions.value = nodes.value.map(node => ({
    //     id: node.data.system_id,
    //     name: node.data.code
    // }))
})

</script>

<template>
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
              class="search-systems"
          />
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
            style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
          />
        </span>
        <span v-tooltip.top="{ value: 'Add search term', showDelay: 300 }">
          <Button
            icon="pi pi-plus"
            severity="success"
            rounded
            variant="outlined"
            size="small"
            @click="addSearchTerm"
            aria-label="Add search input"
            style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
          />
        </span>
      </div>
    </div>

    <div class="search-button-container">
      <Button
        label="Run Search"
        icon="pi pi-search"
        severity="info"
        @click="runSearch"
        style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
      />
      <span v-tooltip.top="{value: 'Auto-select search results', showDelay: 300}">
        <ToggleSwitch
            v-model="autoSelect"
            class="toggleswitch-info"
        />
      </span>
      <ConfirmDialog></ConfirmDialog>
      <Button
          icon="pi pi-trash"
          label="Deselect All"
          severity="secondary"
          @click="removeAllCodes"
          style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
      />

    </div>

    <Tree
    :value="nodes"
    selectionMode="multiple"
    v-model:selectionKeys="selectedNodeKeys"
    v-model:expandedKeys="expandedNodeKeys"
    @node-expand="onNodeExpand"
    loadingMode="icon"
    :lazy="true"
    >
      <template #default="{ node }">
        <span :class="{ 'search-hit': node.data.found_in_search }">
          {{ node.label }}
        </span>
      </template>
    </Tree>
  </div>
</template>

<style scoped>
    padding-top: 0.15rem;    /* Optional: Compress vertical space further */
    padding-bottom: 0.15rem; /* Optional: Compress vertical space further */

</style>