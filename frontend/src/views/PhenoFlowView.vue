<script setup>
import { ref } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

// PrimeVue Imports
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Divider from 'primevue/divider';
import 'primeicons/primeicons.css';

import { usePhenoFlow } from '@/composables/usePhenoFlow.js';
import OperatorEdge from "@/components/OperatorEdge.vue";
import Footer from "@/components/Footer.vue";

// Destructure handler
const { nodes, edges, addPhenotypeNode, onConnectHandler } = usePhenoFlow();

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
  <div class="page-wrapper">
    <div class="flow-container">

      <div class="header-section mb-4">
        <h1>Phenotype Flow Logic</h1>
        <Message severity="warn" :closable="false" icon="pi pi-exclamation-triangle">
          <span class="font-bold mr-2">Experimental Feature:</span>
          This tool is currently under active development. Nodes may not save correctly and logic exports are disabled.
        </Message>
      </div>

      <div class="editor-card shadow-2">

        <div class="controls-sidebar">
          <h3>Toolbox</h3>
          <span class="p-text-secondary text-sm block mb-3">Add nodes to define logic relationships.</span>

          <div class="input-group">
            <label for="pname" class="font-semibold text-sm">Node Name</label>
            <InputText
              id="pname"
              v-model="newPhenotypeName"
              placeholder="e.g. Hypertension"
              class="w-full mb-2"
              @keyup.enter="addNewNode"
            />
            <Button
              label="Add Phenotype"
              icon="pi pi-plus"
              class="w-full"
              @click="addNewNode"
              :disabled="!newPhenotypeName.trim()"
            />
          </div>

          <Divider />

          <div class="stats">
            <div class="stat-item">
              <i class="pi pi-circle text-primary"></i>
              <span>Nodes: <strong>{{ nodes.length }}</strong></span>
            </div>
            <div class="stat-item">
              <i class="pi pi-share-alt text-primary"></i>
              <span>Connections: <strong>{{ edges.length }}</strong></span>
            </div>
          </div>
        </div>

        <div class="flow-canvas-wrapper">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            @connect="onConnectHandler"
            class="phenotype-flow"
            :default-zoom="1.2"
            :min-zoom="0.2"
            :max-zoom="4"
          >
            <template #edge-operator-edge="props">
              <OperatorEdge v-bind="props" />
            </template>

            <Background variant="dots" pattern-color="#cbd5e1" :gap="20" />
            <Controls />
            <MiniMap />
          </VueFlow>
        </div>
      </div>

    </div>

    <Footer/>
  </div>
</template>

<style scoped>
/* PAGE LAYOUT */
.page-wrapper {
  background-color: #f8f9fa; /* Matches HomeView bg */
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.flow-container {
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  flex: 1; /* Pushes footer down */
}

/* HEADER */
.header-section h1 {
  font-size: 2rem;
  margin-top: 0;
  margin-bottom: 1rem;
  color: #1e293b;
}

/* EDITOR CARD (The White Box) */
.editor-card {
  display: flex;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden; /* Ensures canvas doesn't spill out of rounded corners */
  height: 70vh; /* Fixed height for the tool */
  min-height: 600px;
}

/* LEFT SIDEBAR */
.controls-sidebar {
  width: 300px; /* Fixed width */
  padding: 1.5rem;
  border-right: 1px solid #e2e8f0;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  z-index: 2; /* Ensure it sits above canvas if needed */
}

.controls-sidebar h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}

.input-group {
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.5rem;
  color: #64748b;
  font-size: 0.95rem;
}

/* RIGHT CANVAS */
.flow-canvas-wrapper {
  flex-grow: 1;
  background-color: #f8fafc; /* Very light slate bg for graph */
  position: relative;
}

/* VueFlow Specific Overrides to match theme */
:deep(.vue-flow__minimap) {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

:deep(.vue-flow__controls) {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

:deep(.vue-flow__controls-button) {
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

:deep(.vue-flow__controls-button:hover) {
  background: #f1f5f9;
}
</style>