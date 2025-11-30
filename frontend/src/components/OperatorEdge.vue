<script>
// Disable attribute inheritance to avoid fragment warnings
export default {
  inheritAttrs: false,
}
</script>

<script setup>
import { computed } from 'vue';
// IMPORT EdgeLabelRenderer here
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core';
import { usePhenoFlow, OPERATORS } from "@/composables/project/usePhenoFlow.js";

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  data: { type: Object, required: false, default: () => ({ operator: 'AND' }) },
  markerEnd: { type: String, required: false },
  style: { type: Object, required: false },
});

const { updateEdgeOperator } = usePhenoFlow();

// Calculate the path and the label position (labelX, labelY)
const edgePath = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
);

const path = computed(() => edgePath.value[0]);
const labelX = computed(() => edgePath.value[1]);
const labelY = computed(() => edgePath.value[2]);

const handleOperatorChange = (event) => {
  updateEdgeOperator(props.id, event.target.value);
};
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :style="style"
    :marker-end="markerEnd"
  />

  <EdgeLabelRenderer>
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all',
      }"
      class="nodrag nopan"
    >
      <div class="operator-select-container">
        <select
          :value="data ? data.operator : 'AND'"
          @change="handleOperatorChange"
          class="operator-select"
        >
          <option v-for="op in OPERATORS" :key="op" :value="op">
            {{ op }}
          </option>
        </select>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
.operator-select-container {
  background: white;
  border: 1px solid #ccc; /* Added border for visibility */
  border-radius: 4px;
  padding: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  /* Ensure it sits above the line */
  z-index: 10;
}

.operator-select {
  border: none;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  background: transparent;
  outline: none;
  color: #333;
}
</style>