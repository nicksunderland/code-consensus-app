<script setup>
import { ref } from 'vue'
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import 'primeicons/primeicons.css';
import { useTreeSearch } from "@/composables/useTreeSearch.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";


// --- use composable ---
const { selectedNodes, selectedNodeKeys, resetTree } = useTreeSearch()

//make 5 rows a synthetic example
const test_data = [
    { code: 'A01', description: 'Description for A01', system: 'ICD-10', found_in_search: 'Yes' },
    { code: 'B02', description: 'Description for B02', system: 'ICD-10', found_in_search: 'No' },
    { code: 'C03', description: 'Description for C03', system: 'SNOMED', found_in_search: 'Yes' },
    { code: 'D04', description: 'Description for D04', system: 'SNOMED', found_in_search: 'No' },
    { code: 'E05', description: 'Description for E05', system: 'LOINC', found_in_search: 'Yes' }
];



</script>

<template>
  <Card>
    <template #content>
      <DataTable
        :value="test_data"
        lazy
        loading-icon="pi pi-spinner pi-spin"
        :emptyMessage="'No nodes selected.'"
        responsiveLayout="scroll"
        scrollable
        scrollHeight="600px"
        size="small"
      >
        <Column field="code" header="Code" />
        <Column field="description" header="Description" />
        <Column field="system" header="System" />
        <Column field="found_in_search" header="Found in Search"/>
      </DataTable>
    </template>
  </Card>

</template>