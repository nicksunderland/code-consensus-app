<script setup>

import Card from 'primevue/card';
import Tree from 'primevue/tree';
import 'primeicons/primeicons.css';


</script>

<template>
  <!-- Trees Section -->
  <Card>
    <template #title>Codes</template>
    <template #content>
      <Tree
        v-if="!loading && !errorMessage"
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