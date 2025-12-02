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
import 'primeicons/primeicons.css';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import FloatLabel from 'primevue/floatlabel';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import { useConfirm } from 'primevue/useconfirm';
import ConfirmDialog from 'primevue/confirmdialog';

import { usePhenoFlow, OPERATORS } from '@/composables/phenoflow/usePhenoFlow.js';
import { usePhenoflows } from '@/composables/phenoflow/usePhenoflows.js';
import { useProjects } from '@/composables/project/useProjects.js';
import OperatorNode from '@/components/OperatorNode.vue';
import PhenotypeNode from '@/components/PhenotypeNode.vue';
import Footer from "@/components/Footer.vue";
import { ref, watch, watchEffect } from 'vue';

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
  addOperatorNode,
  addCustomPhenotype,
  removeCustomPhenotype
} = usePhenoFlow();
const {
  flows,
  selectedFlow,
  loading: flowsLoading,
  saving: flowSaving,
  fetchFlows,
  createFlow,
  updateFlow,
  deleteFlow
} = usePhenoflows();
const { currentProject } = useProjects();
const confirm = useConfirm();
const flowInstance = ref(null);
const { project } = useVueFlow();

const nodeTypes = {
  operator: OperatorNode,
  phenotype: PhenotypeNode
};

const newPhenotypeName = ref('');
const newPhenotypeDescription = ref('');
const selectedFlowId = ref(null);
const showFlowDialog = ref(false);
const flowDialogMode = ref('new');
const flowForm = ref({ name: '', description: '' });

const operatorHandles = (operator) => {
  const upper = operator?.toUpperCase();
  if (upper === 'NOT' || upper === 'NOT-AFTER' || upper === 'NOT-BEFORE') return ['in-allow', 'in-block'];
  if (upper === 'AFTER' || upper === 'BEFORE') return ['in-allow', 'in-seq'];
  if (upper === 'TARGET') return ['in-allow'];
  return ['in-left'];
};

const addCustomPhenotypeHandler = () => {
  const name = newPhenotypeName.value?.trim();
  const description = newPhenotypeDescription.value?.trim();
  if (!name) return;
  addCustomPhenotype({ name, description });
  newPhenotypeName.value = '';
  newPhenotypeDescription.value = '';
};

const removeCustomPhenotypeHandler = (ph, event) => {
  event?.stopPropagation?.();
  event?.preventDefault?.();
  if (!ph?.isCustom && !(ph?.id || '').startsWith('custom-')) return;
  removeCustomPhenotype(ph.id);
};

const getViewport = () => {
  if (flowInstance.value?.toObject) {
    const obj = flowInstance.value.toObject();
    if (obj?.viewport) return obj.viewport;
  }
  if (flowInstance.value?.getViewport) {
    const vp = flowInstance.value.getViewport();
    if (vp) return vp;
  }
  const zoom = flowInstance.value?.getZoom?.();
  if (zoom !== undefined) {
    return { x: 0, y: 0, zoom };
  }
  return null;
};

const applyViewport = (viewport) => {
  if (!viewport || !flowInstance.value?.setViewport) return;
  flowInstance.value.setViewport(viewport, { duration: 0 });
};

const loadFlowGraph = (flow) => {
  if (!flow) return;
  const g = flow.graph_json || {};
  nodes.value = Array.isArray(g.nodes)
    ? g.nodes.map((n) => ({
        ...n,
        position: n.position || n.positionAbsolute || n.__lastPosition || { x: 0, y: 0 }
      }))
    : [];
  edges.value = Array.isArray(g.edges) ? g.edges : [];
  if (g.viewport) applyViewport(g.viewport);
};

const serializeGraph = () => {
  const obj = flowInstance.value?.toObject ? flowInstance.value.toObject() : null;
  const nodesToSave = (obj?.nodes || nodes.value || []).map((n) => ({
    ...n,
    position: n.positionAbsolute || n.position || { x: 0, y: 0 }
  }));
  const edgesToSave = obj?.edges || edges.value || [];
  return {
    nodes: nodesToSave,
    edges: edgesToSave,
    viewport: obj?.viewport || getViewport()
  };
};

const handleFlowSelect = (event) => {
  const id = event?.value ?? event?.target?.value;
  selectedFlowId.value = id;
};

const openNewFlowDialog = () => {
  flowDialogMode.value = 'new';
  flowForm.value = { name: '', description: '' };
  showFlowDialog.value = true;
};

const openEditFlowDialog = () => {
  if (!selectedFlow.value) return;
  flowDialogMode.value = 'edit';
  flowForm.value = {
    name: selectedFlow.value.name || '',
    description: selectedFlow.value.description || ''
  };
  showFlowDialog.value = true;
};

const handleFlowDialogSave = async () => {
  const name = flowForm.value.name?.trim();
  const description = flowForm.value.description?.trim();
  if (!name) return;
  const serialized = serializeGraph();
  if (flowDialogMode.value === 'new') {
    const created = await createFlow({
      name,
      description,
      graphJson: serialized,
      viewport: serialized.viewport
    });
    if (created) {
      selectedFlowId.value = created.id;
      loadFlowGraph(created);
    }
  } else if (flowDialogMode.value === 'edit' && selectedFlow.value) {
    const saved = await updateFlow({
      id: selectedFlow.value.id,
      name,
      description,
      graphJson: serialized,
      viewport: serialized.viewport
    });
    if (saved) {
      selectedFlowId.value = saved.id;
      selectedFlow.value = saved;
    }
  }
  showFlowDialog.value = false;
};

const saveCurrentFlow = async () => {
  if (selectedFlow.value) {
    const serialized = serializeGraph();
    const saved = await updateFlow({
      id: selectedFlow.value.id,
      name: selectedFlow.value.name,
      description: selectedFlow.value.description,
      graphJson: serialized,
      viewport: serialized.viewport
    });
    if (saved) {
      selectedFlowId.value = saved.id;
      selectedFlow.value = saved;
    }
  } else {
    openNewFlowDialog();
  }
};

const deleteCurrentFlow = async (event) => {
  if (!selectedFlow.value) return;
  confirm.require({
    target: event?.currentTarget,
    message: `Delete flow "${selectedFlow.value.name}"?`,
    header: 'Delete Flow',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    acceptIcon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Cancel',
    onHide: () => {},
    accept: async () => {
      await deleteFlow(selectedFlow.value.id);
      selectedFlowId.value = flows.value[0]?.id || null;
      if (flows.value[0]) {
        selectedFlow.value = flows.value[0];
        loadFlowGraph(flows.value[0]);
      } else {
        selectedFlow.value = null;
        nodes.value = [];
        edges.value = [];
      }
    }
  });
};

const downloadCurrentFlow = () => {
  const serialized = serializeGraph();
  const payload = {
    name: selectedFlow.value?.name || 'Phenoflow',
    description: selectedFlow.value?.description || '',
    graph: serialized
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const base = (selectedFlow.value?.name || 'phenoflow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phenoflow';
  a.href = url;
  a.download = `${base || 'phenoflow'}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const operatorClass = (operator) => {
  if (!operator) return 'operator-node';
  const slug = operator.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `operator-node operator-${slug}`;
};

const isValidConnection = (connection) => {
  const sourceNode = nodes.value.find((n) => n.id === connection.source);
  const targetNode = nodes.value.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  const sourceType = sourceNode.data?.type;
  const targetType = targetNode.data?.type;

  // Phenotypes only output; operators only input
  if (sourceType !== 'phenotype' && sourceType !== 'operator') return false;
  if (targetType !== 'operator') return false;

  const allowedHandles = operatorHandles(targetNode.data?.operator);
  if (!connection.targetHandle || !allowedHandles.includes(connection.targetHandle)) return false;

  return true;
};

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
      type: 'phenotype',
      label: payload.data.name,
      data: {
        type: 'phenotype',
        name: payload.data.name,
        description: payload.data.description,
        sourceId: payload.data.id
      },
      position: pos,
      draggable: true
    });
  } else if (payload.type === 'operator' && payload.data) {
    addNode({
      id: `op-${Date.now()}`,
      type: 'operator',
      label: payload.data,
      data: { type: 'operator', operator: payload.data },
      position: pos,
      draggable: true,
      class: operatorClass(payload.data)
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

watch(
  () => selectedFlow.value?.id,
  (id, prevId) => {
    if (!id || id === prevId) return;
    selectedFlowId.value = id;
    loadFlowGraph(selectedFlow.value);
  }
);

watch(
  () => selectedFlowId.value,
  (id) => {
    if (!id) {
      selectedFlow.value = null;
      return;
    }
    const flow = flows.value.find((f) => f.id === id);
    if (flow) {
      selectedFlow.value = flow;
      loadFlowGraph(flow);
    }
  }
);
</script>

<template>
  <div class="page-wrapper">
    <div class="flow-container">

      <div class="header-section header-flex">
        <div class="header-title">
          <h1>Phenotype Flow Logic</h1>
        </div>
        <div class="flow-control-card">
          <div class="flow-top">
            <div class="flow-meta">
              <div class="flow-meta-eyebrow" v-if="selectedFlow?.name">
                {{ selectedFlow?.name }}
              </div>
              <div class="flow-meta-desc" v-if="selectedFlow?.description">
                {{ selectedFlow?.description }}
              </div>
            </div>
            <Button
              label="Edit"
              size="small"
              text
              icon="pi pi-pencil"
              :disabled="!selectedFlow"
              @click="openEditFlowDialog"
            />
          </div>
          <div class="flow-picker">
            <Dropdown
              class="flow-dropdown"
              :options="flows"
              optionLabel="name"
              optionValue="id"
              v-model="selectedFlowId"
              placeholder="Select flow"
              :loading="flowsLoading"
              showClear
            />
            <div class="flow-actions">
              <Button label="New" size="small" icon="pi pi-plus" @click="openNewFlowDialog" />
              <Button label="Save" size="small" icon="pi pi-save" severity="info" :loading="flowSaving" @click="saveCurrentFlow" />
              <Button label="Download" size="small" icon="pi pi-download" severity="secondary" @click="downloadCurrentFlow" />
              <Button label="Delete" size="small" icon="pi pi-trash" severity="danger" :disabled="!selectedFlowId" @click="deleteCurrentFlow($event)" />
            </div>
          </div>
        </div>
      </div>

      <div class="editor-card shadow-2">

        <div class="operators-bar">
          <h4>Operators</h4>
          <div class="operators-layout">
            <div class="handle-legend">
              <div class="legend-item">
                <span class="legend-dot legend-green"></span>
                <span>Source</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot legend-blue"></span>
                <span>Inflow</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot legend-orange"></span>
                <span>Modifier</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot legend-red"></span>
                <span>Blocker</span>
              </div>
            </div>

            <div class="chip-row">
              <div
                v-for="op in OPERATORS"
                :key="op"
                class="op-chip"
                draggable="true"
                @mousedown="startDragOperator(op)"
                @dragstart="dragOperator(op)"
              >
                <OperatorNode :data="{ operator: op }" :show-handles="false" class="op-chip-node" />
              </div>
            </div>
          </div>
        </div>

        <div class="main-body">
            <div class="controls-sidebar">
              <h3>Phenotypes</h3>
              <span class="sidebar-description">Drag from the list onto the canvas.</span>

              <div class="custom-phenotype">
                <FloatLabel variant="on">
                  <InputText
                    id="custom-name"
                    v-model="newPhenotypeName"
                    type="text"
                    fluid
                  />
                  <label for="custom-name">Name</label>
                </FloatLabel>
                <FloatLabel variant="on">
                  <Textarea
                    id="custom-desc"
                    v-model="newPhenotypeDescription"
                    rows="2"
                    auto-resize
                    fluid
                  />
                  <label for="custom-desc">Description (optional)</label>
                </FloatLabel>
                <button
                  class="add-btn"
                  :disabled="!newPhenotypeName"
                  @click="addCustomPhenotypeHandler"
                >
                Add custom phenotype
              </button>
            </div>

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
                <span class="ph-name">{{ ph.name }}</span>
                <button
                  v-if="ph.isCustom || (ph.id || '').startsWith('custom-')"
                  class="delete-ph"
                  @click="removeCustomPhenotypeHandler(ph, $event)"
                  title="Remove custom phenotype"
                >
                  ✕
                </button>
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
              :is-valid-connection="isValidConnection"
              :node-types="nodeTypes"
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
        <div class="json-header">
          <h3>Graph JSON</h3>
          <Button size="small" icon="pi pi-download" label="Download JSON" text @click="downloadCurrentFlow" />
        </div>
        <pre>{{ JSON.stringify(graphJson, null, 2) }}</pre>
      </div>

    </div>

    <Footer/>
  </div>

  <ConfirmDialog />

  <Dialog
    v-model:visible="showFlowDialog"
    modal
    :header="flowDialogMode === 'new' ? 'New Flow' : 'Edit Flow'"
    :style="{ width: '420px' }"
  >
    <div class="flow-dialog-body">
      <FloatLabel variant="on">
        <InputText v-model="flowForm.name" id="flow-name" class="w-full" fluid/>
        <label for="flow-name">Name</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <Textarea v-model="flowForm.description" id="flow-desc" rows="3" auto-resize class="w-full" fluid />
        <label for="flow-desc">Description</label>
      </FloatLabel>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="showFlowDialog = false" />
      <Button label="Save" severity="info" @click="handleFlowDialogSave" :disabled="!flowForm.name?.trim()" />
    </template>
  </Dialog>
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
  padding: 2rem 1.5rem 2.5rem;
  flex: 1; /* Pushes footer down */
}

/* HEADER */
.header-section h1 {
  font-size: 2rem;
  margin-top: 0;
  margin-bottom: 1rem;
  color: #1e293b;
}

.header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.flow-select-input,
.flow-dropdown {
  min-width: 240px;
}

.flow-picker {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.flow-select-input,
.flow-dropdown {
  min-width: 240px;
}

:deep(.flow-picker .p-inputtext.has-value) + label,
:deep(.flow-picker .p-inputtext:not(:placeholder-shown)) + label {
  transform: translateY(-50%) scale(0.85);
}

:deep(.flow-picker .p-dropdown) {
  min-width: 240px;
}

.flow-actions {
  display: flex;
  gap: 0.4rem;
}

.flow-control-card {
  display: grid;
  gap: 0.4rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.5rem;
  min-width: 340px;
}

.flow-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}

.flow-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.flow-meta-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.85rem;
  color: #0ea5e9;
}

.flow-meta-name {
  font-weight: 700;
  color: #0f172a;
}

.flow-meta-desc {
  color: #475569;
  font-size: 0.9rem;
}

.flow-dialog-body {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.3rem;
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
  min-height: 800px;
}

.operators-bar {
  padding: 0.5rem 1.1rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
}

.operators-bar h4 {
  margin: 0 0 0rem 0;
  font-size: 0.95rem;
  color: #1f2937;
}

.chip-row {
  display: flex;
  gap: 0.1rem;             /* tighter chip spacing */
  flex-wrap: nowrap;
  align-items: center;      /* center-align vertically */
}

.op-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin-bottom: 1rem;
  border: none;
  background: transparent;
  cursor: grab;
  user-select: none;
  box-shadow: none;
  height: 38px;
}

.main-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  min-height: 0;
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
  min-height: 0;
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

.custom-phenotype {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

:deep(.custom-phenotype .p-float-label) {
  width: 100%;
}

:deep(.custom-phenotype .p-inputtext),
:deep(.custom-phenotype textarea) {
  width: 100%;
}

.add-btn {
  margin-top: 0.25rem;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-btn:not(:disabled):hover {
  opacity: 0.9;
  transform: translateY(-1px);
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
  min-height: 0;
}

.phenotype-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
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
  position: relative;
}

.ph-name {
  font-weight: 500;
  color: #0f172a;
  font-size: 0.9rem;
}

.delete-ph {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #c53030;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px;
}

.delete-ph:hover {
  color: #9b2c2c;
}

.json-card {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1.5rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}

.json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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

.op-chip-node {
  transform: scale(0.63);
  transform-origin: center;
  pointer-events: none;
}

.operators-layout {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.3rem;
  align-items: start;
}

.handle-legend {
  display: grid;
  grid-template-columns: max-content max-content;
  gap: 0.5rem 0.7rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #334155;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  display: inline-block;
  border: 2px solid #cbd5e1;
  background: #fff;
}

.legend-green { border-color: #10b981; }
.legend-blue { border-color: #0ea5e9; }
.legend-orange { border-color: #f97316; }
.legend-red { border-color: #ef4444; }

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
