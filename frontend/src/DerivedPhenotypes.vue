<script setup>
import { ref } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { useDerivedPhenotypes } from '@/composables/useDerivedPhenotypes.js';
import OperatorEdge from "@/OperatorEdge.vue";

// Destructure the new handler here
const { nodes, edges, addPhenotypeNode, onConnectHandler } = useDerivedPhenotypes();

const newPhenotypeName = ref('');

const addNewNode = () => {
  const name = newPhenotypeName.value.trim();
  if (name) {
    addPhenotypeNode(name);
    newPhenotypeName.value = '';
  }
};
</script>

<template>
  <div class="flow-container">
    <div class="controls-panel">
      <h3>Phenotype Management</h3>
      <input
        v-model="newPhenotypeName"
        placeholder="Enter new phenotype name"
        @keyup.enter="addNewNode"
      >
      <button @click="addNewNode" :disabled="!newPhenotypeName.trim()">
        ➕ Add Phenotype Node
      </button>
      <p class="count-info">Nodes: <strong>{{ nodes.length }}</strong></p>
      <p class="count-info">Edges: <strong>{{ edges.length }}</strong></p>
    </div>

    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      @connect="onConnectHandler"
      class="phenotype-flow"
    >
      <template #edge-operator-edge="props">
        <OperatorEdge v-bind="props" />
      </template>

      <Background variant="dots" pattern-color="#aaa" :gap="15" />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped>
/* (Keep your styles exactly the same) */
.flow-container {
  display: flex;
  height: 80vh;
  width: 100%;
}
.controls-panel {
  width: 250px;
  padding: 15px;
  border-right: 1px solid #eee;
  background-color: #f9f9f9;
}
.controls-panel input { width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; }
.controls-panel button { width: 100%; padding: 10px; cursor: pointer; background-color: #4CAF50; color: white; border: none; border-radius: 4px; }
.phenotype-flow { flex-grow: 1; background: #f0f0f0; }
.count-info { font-size: 0.9em; color: #555; margin-top: 15px; }
</style>