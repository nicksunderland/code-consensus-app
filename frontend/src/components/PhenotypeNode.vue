<script setup>
import { Handle, useVueFlow } from '@vue-flow/core';
import { ref, watch } from 'vue';
import Textarea from 'primevue/textarea';
import FloatLabel from 'primevue/floatlabel';

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({}) },
  label: { type: String, default: '' },
  selected: { type: Boolean, default: false }
});

const { removeNodes } = useVueFlow();

// also removes any connections to this node
const remove = (event) => {
  event.stopPropagation();
  removeNodes([props.id]);
};

const isOpen = ref(false);
const comment = ref(props.data?.comment || '');

watch(
  () => props.data?.comment,
  (val) => {
    if (typeof val === 'string') comment.value = val;
  }
);

const toggle = (event) => {
  event?.stopPropagation?.();
  isOpen.value = !isOpen.value;
};

const updateComment = (event) => {
  const val = event?.target?.value ?? comment.value ?? '';
  comment.value = val;
  // Persist to node data so it can be exported
  if (props.data) props.data.comment = val;
};
</script>

<template>
  <div class="ph-node">
    <button
      type="button"
      class="node-delete nodrag"
      :class="{ visible: selected }"
      title="Remove from canvas"
      @click="remove"
    >
      ✕
    </button>
    <div class="ph-header">
      <button class="comment-toggle" type="button" @click="toggle" title="Add comment">
        <span class="chevron" :class="{ open: isOpen }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <span class="ph-text">{{ props.data?.name || props.label }}</span>
    </div>
    <transition name="fade-slide">
      <div v-if="isOpen" class="comment-box">
        <FloatLabel variant="on">
          <Textarea
            id="ph-comment"
            v-model="comment"
            rows="2"
            auto-resize
            fluid
            @input="updateComment"
          />
          <label for="ph-comment">Comment</label>
        </FloatLabel>
      </div>
    </transition>
    <Handle id="out" type="source" position="right" class="handle out" />
  </div>
</template>

<style scoped>
.ph-node {
  position: relative;
  padding: 10px 42px 10px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff8f2, #fff);
  border: 1px solid #e2e8f0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  color: #1f2937;
  font-weight: 600;
}

.ph-header {
  display: flex;
  align-items: center;
  gap: 0;
}

.ph-text {
  pointer-events: none;
}

.comment-toggle {
  margin-left: 0;
  margin-right: 6px;
  background: transparent;
  border: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #f97316; /* pastel orange */
  box-shadow: none;
  transition: transform 0.12s ease, color 0.12s ease;
}

.comment-toggle:hover {
  transform: translateY(-1px);
}

.chevron {
  display: grid;
  place-items: center;
  font-size: 16px;
  transform: rotate(0deg);
  transition: transform 0.12s ease;
  color: #f59e0b;
  line-height: 0;
}

.chevron.open {
  transform: rotate(-180deg);
}

.comment-toggle svg {
  display: block;
  transform: translateX(-0.25px); /* nudge to optical center */
}

.comment-box {
  margin-top: 6px;
}

:deep(.comment-box .p-float-label),
:deep(.comment-box .p-textarea) {
  width: 100%;
}

:global(.fade-slide-enter-active),
:global(.fade-slide-leave-active) {
  transition: all 0.12s ease;
}

:global(.fade-slide-enter-from),
:global(.fade-slide-leave-to) {
  opacity: 0;
  transform: translateY(-4px);
}

:deep(.handle) {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #0f172a;
  background: #fff;
  box-shadow: 0 0 0 6px rgba(15, 23, 42, 0.1);
}

:deep(.handle.out) {
  border-color: #10b981;
  box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.18);
}

/* remove button, shown on hover or when the node is selected */
.node-delete {
  position: absolute;
  top: -9px;
  right: -9px;
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
  opacity: 0;
  transition: opacity 0.12s ease;
  z-index: 2;
}

.node-delete.visible,
.ph-node:hover .node-delete {
  opacity: 1;
}

.node-delete:hover {
  background: #fef2f2;
  color: #9b2c2c;
}
</style>
