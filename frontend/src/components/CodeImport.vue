<script setup>
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import Select from "primevue/select";
import Checkbox from 'primevue/checkbox'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Panel from 'primevue/panel'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Card from 'primevue/card'
import { useCodeImport } from "@/composables/selection/useCodeImport.js";

// --- Connect to Composable ---
const {
  showImportDialog,
  step,
  fileName,
  detectedFormat,
  importedData,
  availableColumns,
  uploadError,
  isImporting,
  columnMapping,
  systemMapping,
  unmatchedSystems,
  codeSystems,
  useFileProvidedSystem,
  // Computed
  previewData,
  exampleMapping,
  showSystemMapping,
  remainingUnmappedCount,
  validationErrors,
  canImport,
  // Methods
  closeImportDialog,
  resetDialog,
  parseFile,
  handleImport
} = useCodeImport()


// --- UI Event Wrappers ---
// These bridges are needed because PrimeVue returns event objects
const onFileSelect = async (event) => {
  const file = event.files[0]
  if (file) await parseFile(file)
}

const onDrop = async (event) => {
  const file = event.dataTransfer.files[0]
  if (file) await parseFile(file)
}

// --- UI Styling Helpers ---
const getColumnClass = (field) => {
  if (field === columnMapping.value.code) return 'text-primary'
  if (field === columnMapping.value.system) return 'text-blue-600'
  if (field === columnMapping.value.description) return 'text-green-600'
  return ''
}
</script>

<template>
  <Dialog
    v-model:visible="showImportDialog"
    modal
    :closable="!isImporting"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :draggable="false"
    @hide="resetDialog"
  >
    <template #header>
      <div class="code-import-header">
        <i class="pi pi-upload text-2xl"></i>
        <span class="font-bold text-xl">Import Codes</span>
      </div>
    </template>

    <Card class="instruction-card">
      <template #content>
        <div class="instruction-content">
          <i class="pi pi-info-circle info-icon"></i>
          <div v-if="step === 1" class="text-sm">
            <strong>Step 1: Upload.</strong> Drag and drop or select your CSV/Excel file. We will automatically detect the column headers.
          </div>
          <div v-if="step === 2" class="text-sm">
            <strong>Step 2: Mapping.</strong> Match the columns from your file to the required data fields below. Ensure the Code System column (if present) is mapped correctly.
          </div>
        </div>
      </template>
    </Card>

    <div v-if="step === 1" class="upload-section">
      <div class="upload-zone" @drop.prevent="onDrop" @dragover.prevent>
        <FileUpload
          mode="basic"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          :maxFileSize="10000000"
          @select="onFileSelect"
          chooseLabel="Choose File"
          class="upload-button"
        />
        <p class="text-file-formats">
          Supported formats: CSV, TXT, Excel (.xlsx, .xls)
        </p>
        <p class="text-file-formats">
          Maximum file size: 10MB
        </p>
      </div>

      <div v-if="uploadError" class="error-message mt-3">
        <Message severity="error" :closable="false">{{ uploadError }}</Message>
      </div>
    </div>

    <div v-if="step === 2" class="mapping-section">
      <div class="file-info">
        <Tag :value="`${detectedFormat.toUpperCase()} - ${importedData.length} rows`" severity="info" />
        <Tag :value="fileName" class="ml-2" />
      </div>

      <Card class="mapping-card">
        <template #content>
          <div class="mapping-grid">
            <div class="mapping-row">
              <label class="mapping-label required">Code Column:</label>
              <Select
                v-model="columnMapping.code"
                :options="availableColumns"
                placeholder="Select column for codes..."
                class="mapping-select"
              />
            </div>

            <div class="mapping-row">
              <label class="mapping-label required">Code System Column:</label>
              <Select
                v-model="columnMapping.system"
                :options="availableColumns"
                placeholder="Select column for code systems..."
                class="mapping-select"
              />
            </div>

            <div class="mapping-row">
              <label class="mapping-label required">Description Column:</label>
              <Select
                v-model="columnMapping.description"
                :options="availableColumns"
                placeholder="Select column for descriptions..."
                class="mapping-select"
              />
            </div>
          </div>

          <div v-if="exampleMapping.code" class="example-preview">
            <div class="example-header">
              <i class="pi pi-eye"></i>
              <strong>Example (first row):</strong>
            </div>
            <div class="example-values">
              <div v-if="exampleMapping.code" class="example-item">
                <span class="example-field">Code:</span>
                <Tag :value="exampleMapping.code" severity="primary" />
              </div>
              <div v-if="exampleMapping.system" class="example-item">
                <span class="example-field">System:</span>
                <Tag :value="exampleMapping.system" severity="info" />
              </div>
              <div v-if="exampleMapping.description" class="example-item">
                <span class="example-field">Description:</span>
                <Tag :value="exampleMapping.description" severity="success" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Panel v-if="showSystemMapping" class="system-mapping-panel">
        <template #header>
          <div class="system-mapping-header">
            <strong>Map Code Systems</strong>

            <div v-if="remainingUnmappedCount > 0" class="system-mapping-warning">
              <i class="pi pi-exclamation-triangle"></i>
              <span class="warning-text">
                {{ remainingUnmappedCount }} system(s) need mapping
              </span>
            </div>

            <div v-else class="system-mapping-success">
              <i class="pi pi-check-circle"></i>
              <span class="success-text">
                All systems mapped
              </span>
            </div>
          </div>
        </template>
        <div class="system-mapping-container">
          <div v-for="(unmapped, index) in unmatchedSystems" :key="index" class="system-mapping-row">
            <InputText :value="unmapped" disabled class="system-input" />

            <i class="pi pi-arrow-right"></i>

            <Select
              v-model="systemMapping[unmapped]"
              :options="codeSystems"
              optionLabel="name"
              optionValue="name"
              placeholder="Select matching system..."
              class="system-select"
              :disabled="!!useFileProvidedSystem[unmapped]"
            />

            <div style="display:flex; align-items:center; margin-left:0.5rem; gap:0.5rem;">
              <Checkbox
                :id="'use-file-system-' + index"
                v-model="useFileProvidedSystem[unmapped]"
                binary
              />
              <label :for="'use-file-system-' + index" style="font-size:0.875rem;">
                Use file value
              </label>
            </div>
          </div>
        </div>
      </Panel>

      <div v-if="validationErrors.length > 0 && !showSystemMapping" class="validation-errors">
        <Message
          v-for="(error, index) in validationErrors"
          :key="index"
          severity="warn"
          :closable="false"
        >
          {{ error }}
        </Message>
      </div>

      <Card class="preview-card">
        <template #content>
          <div class="preview-header">
            <i class="pi pi-table"></i>
            <strong>Data Preview (first 10 rows)</strong>
          </div>
          <DataTable
            :value="previewData"
            scrollable
            scrollHeight="300px"
            class="preview-table"
          >
            <Column
              v-for="col in availableColumns"
              :key="col"
              :field="col"
              :header="col"
              :class="getColumnClass(col)"
            >
              <template #body="slotProps">
                <span :class="getColumnClass(col)">
                  {{ slotProps.data[col] }}
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </div>

    <template #footer>
      <div class="footer-buttons">
        <Button
          label="Cancel"
          icon="pi pi-times"
          @click="resetDialog"
          severity="secondary"
          :disabled="isImporting"
        />
        <Button
          v-if="step === 2"
          label="Back"
          icon="pi pi-arrow-left"
          @click="step = 1"
          severity="secondary"
          :disabled="isImporting"
        />
        <Button
          v-if="step === 2"
          label="Import"
          icon="pi pi-check"
          @click="handleImport"
          :disabled="!canImport || isImporting"
          :loading="isImporting"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* Header styling */
.code-import-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 0.5rem;
}

/* Instruction card styling */
.instruction-card {
  border: 1px solid var(--gray-400);
  background-color: var(--surface-100);
  margin-bottom: 1.5rem;
}

.instruction-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
}

.info-icon {
  font-size: 1.25rem;
  color: var(--text-color-secondary);
}

/* Upload Section Styling */
.upload-section {
  padding-top: 1.5rem;
  text-align: center;
}

.upload-zone {
  width: 100%;
  height: 300px;
  border: 2px dashed #bbb;
  border-radius: 10px;
  background: #f7f7f7;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
  text-align: center;
}

.text-file-formats {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.5rem;
}

/* File Info Styling */
.file-info {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
}

/* Mapping Section */
.mapping-section {
  margin-top: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mapping-card {
  margin-bottom: 1rem;
}

.mapping-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mapping-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mapping-label {
  min-width: 180px;
  font-weight: 500;
}

.mapping-label.required::after {
  content: ' *';
  color: red;
}

.mapping-select {
  flex: 1;
}

/* Example Preview */
.example-preview {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-300);
}

.example-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--text-color-secondary);
}

.example-values {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.example-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.example-field {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* System Mapping Panel */
.system-mapping-panel {
  margin-bottom: 1rem;
}

.system-mapping-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.system-mapping-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #f59e0b;
  font-size: 0.875rem;
}
.system-mapping-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #16a34a; /* Green */
  font-size: 0.875rem;
  font-weight: 500;
}

.system-mapping-warning .pi-exclamation-triangle {
  font-size: 1.125rem;
}

.warning-text {
  font-weight: 500;
}

.system-mapping-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.5rem;
}

.system-mapping-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.system-input {
  width: 200px;
}

.system-select {
  flex: 1;
}

/* Validation Errors */
.validation-errors {
  margin-bottom: 1rem;
}

.validation-errors .p-message {
  margin-bottom: 0.5rem;
}

/* Preview card styling */
.preview-card {
  margin-top: 1rem;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.preview-table {
  font-size: 0.875rem;
}

/* Column highlighting based on mapping */
.text-primary {
  color: var(--primary-color) !important;
  font-weight: 600;
}

.text-blue-600 {
  color: #2563eb !important;
  font-weight: 500;
}

.text-green-600 {
  color: #16a34a !important;
}

/* Footer button styling */
.footer-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
</style>