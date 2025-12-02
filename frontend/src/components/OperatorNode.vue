<script setup>
import { computed } from 'vue';
import { Handle } from '@vue-flow/core';

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  label: { type: String, default: '' },
  showHandles: { type: Boolean, default: true }
});

const operatorLabel = computed(() => props.data?.operator || props.label || 'OP');
const operatorSlug = computed(() =>
  operatorLabel.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
);

const displayLabel = computed(() => {
  const upper = operatorLabel.value.toUpperCase();
  if (upper === 'NOT-BEFORE') return 'NOT\nBEFORE';
  if (upper === 'NOT-AFTER') return 'NOT\nAFTER';
  return operatorLabel.value;
});

const isBlockOperator = computed(() => {
  const upper = operatorLabel.value.toUpperCase();
  return upper === 'NOT' || upper === 'NOT-AFTER' || upper === 'NOT-BEFORE';
});

const isSequenceOperator = computed(() => {
  const upper = operatorLabel.value.toUpperCase();
  return upper === 'AFTER' || upper === 'BEFORE';
});

const isTarget = computed(() => operatorLabel.value.toUpperCase() === 'TARGET');

const handleConfigs = computed(() => {
  const upper = operatorLabel.value.toUpperCase();
  if (upper === 'NOT' || upper === 'NOT-AFTER' || upper === 'NOT-BEFORE') {
    return [
      { id: 'in-allow', type: 'target', position: 'left', top: '50%', class: 'handle in allow' },
      { id: 'in-block', type: 'target', position: 'top', top: '9px', left: '50%', class: 'handle block top' }
    ];
  }
  if (upper === 'AFTER' || upper === 'BEFORE') {
    return [
      { id: 'in-allow', type: 'target', position: 'left', top: '50%', class: 'handle in allow' },
      { id: 'in-seq', type: 'target', position: 'top', top: '9px', left: '50%', class: 'handle seq top' }
    ];
  }
  if (upper === 'TARGET') {
    return [{ id: 'in-allow', type: 'target', position: 'left', top: '50%', class: 'handle in allow' }];
  }
  return [{ id: 'in-left', type: 'target', position: 'left', top: '50%', class: 'handle in' }];
});
</script>

<template>
  <div class="op-shell">
    <template v-if="showHandles">
      <Handle
        v-for="config in handleConfigs"
        :key="config.id"
        :id="config.id"
        :type="config.type"
        :position="config.position"
        :style="{ top: config.top }"
        :class="config.class"
      />
      <Handle
        v-if="!isTarget"
        id="out"
        type="source"
        position="right"
        class="handle out"
      />
    </template>

    <div :class="['op-diamond', `operator-${operatorSlug}`, { 'block-operator': isBlockOperator, 'seq-operator': isSequenceOperator, 'target-operator': isTarget }]">
      <span class="op-text" :class="{ 'text-tight': operatorLabel.length > 6 }">{{ displayLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.op-shell {
  position: relative;
  width: 120px;
  height: 114px;
  display: grid;
  place-items: center;
  overflow: visible;
}

.op-diamond {
  position: relative;
  width: 96px;
  height: 96px;
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  color: #f8fafc;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  text-align: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  z-index: 1;
}

.op-shell:hover .op-diamond {
  box-shadow:
    0 0 0 6px rgba(59, 130, 246, 0.25),
    0 12px 24px rgba(0, 0, 0, 0.16);
}

.op-diamond.operator-or {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #0f172a;
}

.op-diamond.operator-and {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #0f172a;
}

.op-diamond.operator-not,
.op-diamond.operator-not-after,
.op-diamond.operator-not-before,
.op-diamond.block-operator {
  background: linear-gradient(135deg, #fecdd3, #fda4af);
  color: #7f1d1d;
}

.op-diamond.operator-after,
.op-diamond.operator-before,
.op-diamond.seq-operator {
  background: linear-gradient(135deg, #fed7aa, #fdba74);
  color: #7c2d12;
}

.op-diamond.operator-target,
.op-diamond.target-operator {
  background: linear-gradient(135deg, #0f172a, #0b1221);
  color: #f8fafc;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.op-text {
  pointer-events: none;
  white-space: pre-line;
}

.op-text.text-tight {
  font-size: 0.8rem;
}

.handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #0f172a;
  background: #fff;
  box-shadow: 0 0 0 6px rgba(15, 23, 42, 0.1);
  display: grid;
  place-items: center;
  cursor: crosshair;
  pointer-events: auto;
  z-index: 2;
}

.handle.in {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 6px rgba(14, 165, 233, 0.18);
  left: 12px;
  top: 50%;
  transform: translate(-50%, -50%);
}

.handle.block {
  border-color: #ef4444;
  box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.2);
}

.handle.seq {
  border-color: #f97316;
  box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.2);
}

.handle.block.top {
  top: 9px;
  left: 50%;
  transform: translate(-50%, -50%);
}

.handle.seq.top {
  top: 9px;
  left: 50%;
  transform: translate(-50%, -50%);
}

.handle.out {
  border-color: #10b981;
  box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.18);
  right: 12px;
  top: 50%;
  transform: translate(50%, -50%);
}
</style>
