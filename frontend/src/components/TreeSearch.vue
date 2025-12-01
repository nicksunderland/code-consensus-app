<script setup>
import {onMounted, ref} from "vue";
import Tree from 'primevue/tree';
import 'primeicons/primeicons.css';
import { useConfirm } from 'primevue/useconfirm'
import MultiSelect from "primevue/multiselect";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import ToggleSwitch from "primevue/toggleswitch";
import {useTreeSearch} from "@/composables/tree/useTreeSearch.js";
import {usePhenotypes} from "@/composables/project/usePhenotypes.js";
import {useCodeSystems} from "@/composables/shared/useCodeSystems.js";
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
    // console.log("in onMounted TreeSearch.vue:", nodes)
    if (!searchInputs.value.length) addSearchTerm(true)
    // console.log("in onMounted TreeSearch.vue:", searchInputs)
    await onNodeExpand(null)



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
        <div
          class="tree-row"
          :class="{
            'search-hit': node.data.found_in_search,
            'non-selectable': node.selectable === false
          }"
        >
          <div class="pill-stack">
            <span class="code-pill">{{ node.data.code }}</span>
          </div>
          <div class="node-body">
            <div class="node-line">
              <span
                class="node-title"
                :class="{
                  'node-root': node.parent === null,
                  'node-leaf': node.data.is_leaf
                }"
              >
                {{ node.data.description }}
              </span>
              <span v-if="node.selectable === false" class="badge muted">Group</span>
              <span v-else-if="node.data.is_leaf" class="badge leaf">Leaf</span>
              <span v-else class="badge branch">Chapter</span>
            </div>
          </div>
        </div>
      </template>
    </Tree>
  </div>
</template>

<style scoped>

    .regex-row {
      display: flex;
      align-items: center;
      gap: 0.5rem; /* Adjust spacing between items */
      margin-bottom: 0.5rem;
    }

    /* 1. The Text Input: Takes up all remaining space */
    .search-line-input {
      flex: 1;
      min-width: 0; /* Prevents overflow issues */
    }

    /* 2. The Dropdowns: Fixed width */
    .search-column {
      /* flex: grow shrink basis */
      flex: 0 0 12rem; /* Adjust '12rem' to your preferred width */
      width: 13rem;    /* Fallback/Force width */
    }

    .search-systems {
      /* flex: grow shrink basis */
      flex: 0 0 5rem;
      width: 20rem;
    }

    /* 3. The Toggle and Buttons: Only take as much space as they need */
    .search-use-regex,
    .p-button {
      flex: 0 0 auto;
    }

    .tree-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.18rem 0.3rem;
      border-radius: 8px;
      transition: background 0.15s ease, transform 0.1s ease;
    }

    .tree-row:hover {
      background: #f8fafc;
      transform: translateX(1px);
    }

    .node-body {
      flex: 1;
      min-width: 0;
    }

    .node-line {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .node-title {
      font-weight: 400;
      color: #0f172a;
    }

    .node-root {
      font-weight: 700;
    }

    .node-leaf {
      font-weight: 400;
      font-size: 0.95rem;
    }

    .pill-stack {
      display: inline-flex;
      gap: 0.2rem;
      align-items: center;
    }

    .code-pill {
      display: inline-block;
      background: #0ea5e910;
      color: #0f172a;
      border: 1px solid #bae6fd;
      padding: 0.12rem 0.35rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.82rem;
    }

    .badge {
      display: inline-block;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid transparent;
    }

    .badge.leaf {
      background: #dcfce7;
      color: #15803d;
      border-color: #bbf7d0;
    }

    .badge.branch {
      background: #e0f2fe;
      color: #0369a1;
      border-color: #bae6fd;
    }

    .badge.muted {
      background: #f1f5f9;
      color: #94a3b8;
      border-color: #e2e8f0;
    }

    .search-hit {
      background: #e0f2fe;
    }

    .non-selectable {
      opacity: 0.8;
    }

    :deep(.p-tree .p-treenode-content) {
      padding: 0.1rem 0.2rem;
    }


</style>
