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
import {useTreeSearch} from "@/composables/useTreeSearch.js";
import {usePhenotypes} from "@/composables/usePhenotypes.js";

// --- use composable ---
const treeSearch = useTreeSearch()
const phenotypes = usePhenotypes()

const saveClickOptions = [
  {
    label: 'Save',
    icon: 'pi pi-save',
    command: () => phenotypes.savePhenotype(phenotypes.currentPhenotype.value.name)
  },
  {
    label: 'Update',
    icon: 'pi pi-refresh',
    command: () => phenotypes.savePhenotype(phenotypes.currentPhenotype.value.name)
  }
];


// --- Load tree on component mount ---
onMounted(async () => {
    console.log("in onMounted TreeSearch.vue:", treeSearch.nodes.value)
    treeSearch.addSearchTerm()
    console.log("in onMounted TreeSearch.vue:", treeSearch.searchInputs.value)
    //await treeSearch.onNodeExpand(null)



    // Populate MultiSelect system options (map so overwrites)
    // treeSearch.searchSystemsOptions.value = treeSearch.nodes.value.map(node => ({
    //     id: node.data.system_id,
    //     name: node.data.code
    // }))
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
            @click="treeSearch.addSearchTerm"
            aria-label="Add search input"
          />
        </span>
      </div>
    </template>
    <template #content>
      <!-- Search Panel -->
      <div class="panel regex-panel">
        <div class="regex-list">
          <div v-for="(input, index) in treeSearch.searchInputs.value" :key="index" class="regex-row">
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
                  :options="treeSearch.searchInOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="search-column"
              />
            </span>
            <span v-tooltip.top="{value: 'Coding systems', showDelay: 300}">
              <MultiSelect
                  v-model="input.system_ids"
                  :options="treeSearch.searchSystemsOptions.value"
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
                :disabled="treeSearch.searchInputs.value.length === 1"
                @click="treeSearch.removeSearchTerm(index)"
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
          @click="treeSearch.runSearch"
        />
        <span v-tooltip.top="{value: 'Auto-select search results', showDelay: 300}">
          <ToggleSwitch
              v-model="treeSearch.autoSelect"
              class="auto-select-search"
          />
        </span>
        <Divider layout="vertical" />
        <InputText
          v-tooltip.top="{value: 'Phenotype name', showDelay: 300}"
          type="text"
          v-model="phenotypes.currentPhenotype.name"
          :invalid="phenotypes.nameError.value"
          placeholder="Enter phenotype name"
        />
        <SplitButton
          label="Save"
          @click="() => phenotypes.savePhenotype(phenotypes.currentPhenotype.name)"
          :model="saveClickOptions"
        />
        <ConfirmPopup></ConfirmPopup>
        <Button
          @click="phenotypes.deletePhenotype($event)"
          label="Delete"
          severity="danger"
          :disabled="!phenotypes.currentPhenotype?.id"
        />
      </div>
    </template>
  </Card>

  <!-- Trees Section -->
  <Card>
    <template #title>Codes</template>
    <template #content>
      <Tree
        :value="treeSearch.nodes.value"
        selectionMode="multiple"
        v-model:selectionKeys="treeSearch.selectedNodeKeys"
        v-model:expandedKeys="treeSearch.expandedNodeKeys"
        @node-expand="treeSearch.onNodeExpand"
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