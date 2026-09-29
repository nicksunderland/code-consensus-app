<script setup>
import { computed } from 'vue';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useVueFlow } from '@vue-flow/core';

// the default bezier edge, plus a remove button at the midpoint when selected
const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, default: 'right' },
  targetPosition: { type: String, default: 'left' },
  markerEnd: { type: String, default: undefined },
  style: { type: Object, default: undefined },
  selected: { type: Boolean, default: false },
});

const { removeEdges } = useVueFlow();

// [path, labelX, labelY, ...]
const path = computed(() => getBezierPath(props));

const remove = (event) => {
  event.stopPropagation();
  removeEdges([props.id]);
};
</script>

<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :style="style" />
  <EdgeLabelRenderer>
    <button
      v-if="selected"
      type="button"
      class="edge-delete nodrag nopan"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      title="Remove connection"
      @click="remove"
    >
      ✕
    </button>
  </EdgeLabelRenderer>
</template>

<style scoped>
.edge-delete {
  position: absolute;
  pointer-events: all;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid #fecaca;
  background: #fff;
  color: #c53030;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.edge-delete:hover {
  background: #fef2f2;
  color: #9b2c2c;
}
</style>
