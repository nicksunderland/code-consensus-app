<script setup>
import {onMounted, ref, toRefs} from "vue";
import Card from 'primevue/card';
import Tree from 'primevue/tree';
import 'primeicons/primeicons.css';
import Divider from "primevue/divider";
import SplitButton from "primevue/splitbutton"
import { useConfirm } from 'primevue/useconfirm'
import ConfirmPopup from 'primevue/confirmpopup';
import MultiSelect from "primevue/multiselect";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import ToggleSwitch from "primevue/toggleswitch";

// properties
const props = defineProps({
  treeSearch: { type: Object, required: true },
  phenotypes: { type: Object, required: true }
})

// keep reactivity with toRefs
const {
  nodes,
  selectedNodeKeys,
  expandedNodeKeys,
  autoSelect,
  searchInputs,
  searchInOptions,
  searchSystemsOptions,
  onNodeExpand,
  addSearchTerm,
  removeSearchTerm,
  runSearch
} = props.treeSearch;

const {
  currentPhenotype,
  nameError,
  savePhenotype,
  deletePhenotype
} = props.phenotypes;

const phenotypeSaveOptions = [
  {
    label: 'Save',
    icon: 'pi pi-save',
    command: () => savePhenotype(currentPhenotype.value.name)
  },
  {
    label: 'Update',
    icon: 'pi pi-refresh',
    command: () => savePhenotype(currentPhenotype.value.name)
  }
];


// --- Load tree on component mount ---
onMounted(async () => {
  await onNodeExpand(null)

  console.log("in onMounted:", nodes.value)

  // Populate MultiSelect system options
   searchSystemsOptions.value = nodes.value.map(node => ({
    id: node.data.system_id,
    name: node.data.code
  }))
})

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

  <!-- Run Search Card -->
  <Card>
    <template #content>
      <div class="search-button-container">
        <Button
          label="Run Search"
          @click="runSearch"
        />
        <span v-tooltip.top="{value: 'Auto-select search results', showDelay: 300}">
          <ToggleSwitch
              v-model="autoSelect"
              class="auto-select-search"
          />
        </span>
        <Divider layout="vertical" />
        <InputText
          v-tooltip.top="{value: 'Phenotype name', showDelay: 300}"
          type="text"
          v-model="currentPhenotype.name"
          :invalid="nameError"
          placeholder="Enter phenotype name"
        />
        <SplitButton
          label="Save"
          @click="() => savePhenotype(currentPhenotype.name)"
          :model="phenotypeSaveOptions"
        />
        <ConfirmPopup></ConfirmPopup>
        <Button
          @click="deletePhenotype($event)"
          label="Delete"
          severity="danger"
          :disabled="!currentPhenotype?.id"
        />
      </div>
    </template>
  </Card>

  <!-- Trees Section -->
  <Card>
    <template #title>Codes</template>
    <template #content>
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
    </template>
  </Card>
</template>

<style scoped>

</style>