<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useDownload } from '@/composables/useDownload.js'
import { usePhenotypes } from '@/composables/usePhenotypes.js'
import { useToast } from 'primevue/usetoast'
import VCodeBlock from '@wdns/vue-code-block'
import Prism from 'prismjs'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-yaml.js'
import SelectButton from 'primevue/selectbutton'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

// --- COMPOSABLES ---
const toast = useToast()
const { currentPhenotype } = usePhenotypes()
const {
    isDownloadActive,
    isPhenotypeFinalized,
    hasCodes,
    selectedFormat,
    includeHeader,
    isGenerating,
    displayContent,
    fileName,
    fetchExportData,
    triggerDownload
} = useDownload()

// --- STATE ---
const formatOptions = [
    { name: 'JSON', value: 'json' },
    { name: 'YAML', value: 'yaml' },
    { name: 'Text', value: 'text' }
]

// --- UI HELPERS ---
// These remain here because they are purely visual (icons/syntax highlighting)
const currentLanguage = computed(() => {
    return selectedFormat.value === 'text' ? 'plaintext' : selectedFormat.value
})
const fileIcon = computed(() => {
    const map = {
        json: 'pi pi-code',
        yaml: 'pi pi-list',
        text: 'pi pi-file'
    }
    return map[selectedFormat.value] || 'pi pi-file'
})

// --- HANDLERS ---
const handleDownload = () => {
    triggerDownload()
    toast.add({ severity: 'info', summary: 'Download Started', detail: fileName.value, life: 2000 })
}
// Fetch data when the phenotype changes
watch(
    [isDownloadActive, () => currentPhenotype.value?.id],
    ([isActive, newId]) => {
        if (isActive && newId) {
            // The composable handles the "don't refetch if cached" logic
            fetchExportData(newId)
        }
    },
    { immediate: true }
)

</script>


<template>
  <div class="download-container">

    <div class="toolbar">
      <div class="toolbar-section config-section">
        <SelectButton
          v-model="selectedFormat"
          :options="formatOptions"
          optionLabel="name"
          optionValue="value"
          aria-label="File Format"
          class="p-selectbutton-sm"
        />

        <div class="checkbox-wrapper">
            <Checkbox v-model="includeHeader" :binary="true" inputId="headerCheck" />
            <label for="headerCheck" class="checkbox-label">Include Header</label>
        </div>
      </div>

      <div class="toolbar-section actions-section">
        <div v-if="hasCodes && !isPhenotypeFinalized" class="status-indicator">
            <i class="pi pi-exclamation-triangle text-orange-500" v-tooltip.top="'Codes are not finalized yet.'"></i>
            <span class="status-text">Pre-finalized</span>
        </div>

        <Button
            label="Download"
            icon="pi pi-download"
            :severity="isPhenotypeFinalized ? 'primary' : 'warning'"
            size="small"
            class="action-button"
            @click="handleDownload"
            :disabled="!displayContent"
        />
      </div>
    </div>

    <div class="editor-window">
      <div v-if="isGenerating" class="loading-overlay">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>

      <div v-else-if="!hasCodes" class="empty-state">
        <div class="empty-content">
            <i class="pi pi-exclamation-circle empty-icon"></i>
            <span class="empty-title">No Consensus Codes</span>
            <p class="empty-desc">
                This phenotype does not have consensus codes. <br>
                Add codes in the <strong>Search</strong> tab and adjudicate in the <strong>Review</strong> tab to generate an export.
            </p>
        </div>
      </div>

      <template v-else>
          <div class="file-tab">
            <i :class="fileIcon" class="file-icon"></i>
            <span class="file-name">{{ fileName }}</span>
          </div>

          <div class="code-content">
             <VCodeBlock
                :code="displayContent"
                :lang="currentLanguage"
                theme="solarizedlight"
                class="v-code-block-override"
                :prismjs="true"
                :browser-window="false"
                :tabs="false"
            />
          </div>
      </template>
    </div>
  </div>
</template>


<style scoped>
/* 1. Main Container */
.download-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  box-sizing: border-box;
}

/* 2. Toolbar */
.toolbar {
  display: flex;
  flex-wrap: nowrap;     /* Forces horizontal layout */
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  overflow-x: auto;      /* Allows scrolling if screen is very narrow */
}

.toolbar-section {
  display: flex;
  align-items: center;
  flex-shrink: 0;        /* Prevents squashing of toolbar items */
}

.config-section {
  gap: 1rem;
}

.actions-section {
  gap: 0.5rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label {
  font-size: 0.875rem;   /* Equivalent to text-sm */
  color: #374151;        /* Dark gray text */
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.action-button {
  white-space: nowrap;
}

/* 3. Editor Window Container */
.editor-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: #ffffff;
  border: 1px solid #e5e7eb; /* Light gray border */
  border-radius: 0.5rem;     /* Rounded corners */
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* Subtle shadow */
}

/* 4. Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 10;
}

/* 5. File Tab (The "Header" of the editor) */
.file-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f9fafb; /* Very light gray background */
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.file-icon {
  font-size: 0.875rem;
  color: #9ca3af; /* Muted gray icon */
}

.file-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem; /* Small text */
  font-weight: 500;
  color: #374151;
}

/* 6. Code Content Area */
.code-content {
  flex: 1;
  position: relative;
  overflow: hidden; /* Vital: lets VCodeBlock manage the scrollbars */
}

/* 7. VCodeBlock Overrides */
/* strictly override library defaults to fit our container */
:deep(.v-code-block-override) {
    margin: 0 !important;
    border-radius: 0 !important;
    height: 100% !important;
    width: 100% !important;
    font-size: 0.875rem !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
}

/* Ensure the inner pre tag also fills height and uses transparent background */
:deep(.v-code-block pre) {
    margin: 0 !important;
    border-radius: 0 !important;
    height: 100% !important;
    background-color: transparent !important;
    font-family: inherit !important;
    overflow: auto !important;
}

.empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9fafb; /* Light gray background */
    color: #6b7280; /* Muted text */
}

.empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    padding: 2rem;
}

.empty-icon {
    font-size: 2rem;
    color: #9ca3af;
    margin-bottom: 0.5rem;
}

.empty-title {
    font-weight: 600;
    font-size: 1rem;
    color: #374151;
}

.empty-desc {
    font-size: 0.875rem;
    line-height: 1.5;
    max-width: 300px;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 0.5rem;
    font-size: 0.875rem;
    color: #f59e0b; /* Orange-500 */
    font-weight: 500;
}

.status-text {
    /* Hide text on very small screens if needed */
    white-space: nowrap;
}
</style>