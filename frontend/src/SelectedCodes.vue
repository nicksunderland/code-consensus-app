<script setup>

import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import 'primeicons/primeicons.css';


</script>

<template>
  <!-- Selected Codes Section -->
  <Card>
    <template #title>Selected Codes</template>
    <template #content>
      <DataTable
        :value="selectedNodes"
        :emptyMessage="'No nodes selected.'"
        responsiveLayout="scroll"
        scrollable
        scrollHeight="600px"
      >
        <template #header>
          <div class="text-end pb-4">
            <Button
                icon="pi pi-trash"
                label="Clear"
                @click="selectedNodeKeys = {}"
            />
          </div>
        </template>
        <Column field="code" header="Code" />
        <Column field="description" header="Description" />
        <Column field="system" header="System" />
        <Column field="found_in_search" header="Found in Search"/>
      </DataTable>
    </template>
  </Card>

</template>

<style scoped>

</style>