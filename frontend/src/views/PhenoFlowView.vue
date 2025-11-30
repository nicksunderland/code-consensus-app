<script setup>
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import { useVueFlow } from '@vue-flow/core';

import Button from 'primevue/button';
import Message from 'primevue/message';
import Divider from 'primevue/divider';
import 'primeicons/primeicons.css';

import { usePhenoFlow, OPERATORS } from '@/composables/project/usePhenoFlow.js';
import Footer from "@/components/Footer.vue";
import { ref } from 'vue';

const {
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnectHandler,
  palettePhenotypes,
  graphJson,
  currentDragPayload,
  addPhenotypeNode,
  addOperatorNode
} = usePhenoFlow();
const flowInstance = ref(null);
const { project } = useVueFlow();

const dragPhenotype = (ph) => (event) => {
  event.dataTransfer.effectAllowed = 'move';
  const payload = JSON.stringify({ type: 'phenotype', data: ph });
  console.log('[PhenoFlow] dragstart phenotype', payload);
  event.dataTransfer.setData('application/vueflow', payload);
  event.dataTransfer.setData('text/plain', payload);
  // store in shared ref for browsers that strip dataTransfer on drop
  if (currentDragPayload) currentDragPayload.value = { type: 'phenotype', data: ph };
};

const dragOperator = (op) => (event) => {
  event.dataTransfer.effectAllowed = 'move';
  const payload = JSON.stringify({ type: 'operator', data: op });
  console.log('[PhenoFlow] dragstart operator', payload);
  event.dataTransfer.setData('application/vueflow', payload);
  event.dataTransfer.setData('text/plain', payload);
  if (currentDragPayload) currentDragPayload.value = { type: 'operator', data: op };
};

const startDragPhenotype = (ph) => {
  if (currentDragPayload) currentDragPayload.value = { type: 'phenotype', data: ph };
};

const startDragOperator = (op) => {
  if (currentDragPayload) currentDragPayload.value = { type: 'operator', data: op };
};

const handleDrop = (event) => {
  event.preventDefault();
  const types = event.dataTransfer.types ? Array.from(event.dataTransfer.types) : [];
  const rawApp = event.dataTransfer.getData('application/vueflow');
  const rawText = event.dataTransfer.getData('text/plain');
  console.log('[PhenoFlow] onDrop payload raw', { types, rawApp, rawText });

  const raw = rawApp || rawText;
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      console.warn('[PhenoFlow] drop payload parse failed', err);
    }
  }
  if (!payload && currentDragPayload) {
    payload = currentDragPayload.value;
    console.log('[PhenoFlow] using stored drag payload', payload);
  }
  if (!payload) {
    console.warn('[PhenoFlow] drop with no payload');
    return;
  }

  const bounds = event.currentTarget?.getBoundingClientRect();
  const point = bounds
    ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
    : { x: event.clientX, y: event.clientY };

  let pos = point;
  if (flowInstance.value?.project) {
    pos = flowInstance.value.project(point);
  } else if (typeof project === 'function') {
    pos = project(point);
  }

  const addNode = (node) => {
    if (flowInstance.value?.addNodes) {
      flowInstance.value.addNodes([node]);
    } else {
      nodes.value = [...nodes.value, node];
    }
  };

  if (payload.type === 'phenotype' && payload.data) {
    addNode({
      id: payload.data.id || `ph-${Date.now()}`,
      type: 'default',
      label: payload.data.name,
      data: { type: 'phenotype', name: payload.data.name, sourceId: payload.data.id },
      position: pos,
      draggable: true
    });
  } else if (payload.type === 'operator' && payload.data) {
    addNode({
      id: `op-${Date.now()}`,
      type: 'default',
      label: payload.data,
      data: { type: 'operator', operator: payload.data },
      position: pos,
      draggable: true
    });
  }

  console.log('[PhenoFlow] canvas state', {
  nodes: nodes.value?.map?.(n => ({ id: n.id, label: n.label, data: n.data, position: n.position })) || nodes,
  edges: edges.value || edges
  });
};

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

const handlePaneReady = (instance) => {
  flowInstance.value = instance;
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

        <div class="operators-bar">
          <h4>Operators</h4>
          <div class="chip-row">
            <div
              v-for="op in OPERATORS"
              :key="op"
              class="op-chip"
              draggable="true"
              @mousedown="startDragOperator(op)"
              @dragstart="dragOperator(op)"
            >
              <span class="op-glyph">{{ op.slice(0,3) }}</span>
              <span class="op-label">{{ op }}</span>
            </div>
          </div>
        </div>

        <div class="main-body">
          <div class="controls-sidebar">
            <h3>Phenotypes</h3>
            <span class="sidebar-description">Drag from the list onto the canvas.</span>
            <div class="phenotype-list">
              <div
                v-for="ph in palettePhenotypes"
                :key="ph.id"
                class="phenotype-chip"
                draggable="true"
                @mousedown="startDragPhenotype(ph)"
                @dragstart="dragPhenotype(ph)"
              >
                <span class="ph-badge">{{ ph.name.charAt(0) }}</span>
                <span>{{ ph.name }}</span>
              </div>
            </div>

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
              :nodes="nodes"
              :edges="edges"
              @nodesChange="onNodesChange"
              @edgesChange="onEdgesChange"
              @connect="onConnectHandler"
              @drop="handleDrop"
              @dragover="handleDragOver"
              @paneReady="handlePaneReady"
              class="phenotype-flow"
              :default-zoom="1.2"
              :min-zoom="0.2"
              :max-zoom="4"
            >
              <Background variant="dots" pattern-color="#cbd5e1" :gap="20" />
              <Controls />
              <MiniMap />
            </VueFlow>
          </div>
        </div>
      </div>

      <div class="json-card">
        <h3>Graph JSON</h3>
        <pre>{{ JSON.stringify(graphJson, null, 2) }}</pre>
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
  flex-direction: column;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden; /* Ensures canvas doesn't spill out of rounded corners */
  height: 75vh; /* Fixed height for the tool */
  min-height: 600px;
}

.operators-bar {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;

  background: linear-gradient(135deg, #f8fafc, #eef2ff);
}

.operators-bar h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #1f2937;
}

.chip-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.main-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
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
  margin-bottom: 0.35rem;
  font-size: 1.25rem;
}

.sidebar-description {
  display: block;
  margin-bottom: 0.75rem;
  color: #64748b;
  font-size: 0.9rem;
}

.input-group {
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;
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

.chip-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.op-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #d0d7e2;
  border-radius: 999px;
  background: linear-gradient(135deg, #f3f4f6, #e9f0ff);
  cursor: grab;
  user-select: none;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}

.phenotype-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 240px;
  overflow: auto;
  margin-top: 0.35rem;
}

.phenotype-chip {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff8f2, #fff);
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.json-card {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1.5rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}

.json-card pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.op-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #dbeafe;
  color: #1e3a8a;
  font-weight: 700;
  font-size: 0.8rem;
}

.op-label {
  color: #1f2937;
}

.ph-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fef3c7;
  color: #92400e;
  font-weight: 700;
  font-size: 0.9rem;
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
