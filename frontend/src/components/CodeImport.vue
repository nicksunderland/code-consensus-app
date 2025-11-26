<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import Select from "primevue/select";
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Panel from 'primevue/panel'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Card from 'primevue/card'
import { useCodeImport } from "@/composables/useCodeImport.js";

// Get composable functions
const {
  showImportDialog,
  closeImportDialog,
  openImportDialog
} = useCodeImport()

// DB Code Systems (hardcoded since this is global)
const dbCodeSystems = ref([
  { name: 'ICD-10-CM' },
  { name: 'ICD-10-WHO' },
  { name: 'ICD-10-UKBB' },
  { name: 'ICD-9-CM' },
  { name: 'ICD-9-UKBB' },
  { name: 'OPCS-4-UKBB' },
  { name: 'OPCS-3-UKBB' },
  { name: 'ICD-9-CM-Proc' },
  { name: 'CPT-4' }
])

// State
const step = ref(1)
const fileName = ref('')
const detectedFormat = ref('')
const parsedData = ref([])
const availableColumns = ref([])
const uploadError = ref('')
const isImporting = ref(false)
const columnMapping = ref({
  code: null,
  system: null,
  description: null
})
const systemMapping = ref({})
const unmatchedSystems = ref([])

// Max rows/cols for preview
const MAX_PREVIEW_ROWS = 5 // Changed to 5 for default empty view
const MAX_PREVIEW_COLS = 5 // Changed to 5 for default empty view

// Define the empty structure for default view
const EMPTY_PREVIEW_HEADERS = ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5']

// Computed
const isVisible = computed(() => showImportDialog.value)

const previewData = computed(() => {
  if (parsedData.value.length === 0) {
    // FIX 1: Generate 5 empty mock rows when no file is uploaded
    const mockRow = {};
    // Ensure mock rows use the defined headers
    EMPTY_PREVIEW_HEADERS.forEach(h => mockRow[h] = '—');
    return Array(MAX_PREVIEW_ROWS).fill(mockRow).map((r, i) => ({ ...r, id: i }));
  }
  // If data exists, show the first 10 rows
  return parsedData.value.slice(0, 10);
});

const previewColumns = computed(() => {
  if (parsedData.value.length === 0) {
    // FIX 1: Use the mock headers when no file is uploaded
    return EMPTY_PREVIEW_HEADERS.map(key => ({
      field: key,
      header: key
    }));
  }
  // When data exists, return up to the first 10 columns
  const allKeys = Object.keys(parsedData.value[0]);
  const selectedKeys = allKeys.slice(0, 10);

  return selectedKeys.map(key => ({
    field: key,
    header: key
  }));
});


const exampleMapping = computed(() => {
  if (!parsedData.value.length) return {}
  const firstRow = parsedData.value[0]
  return {
    code: columnMapping.value.code ? firstRow[columnMapping.value.code] : null,
    system: columnMapping.value.system ? firstRow[columnMapping.value.system] : null,
    description: columnMapping.value.description ? firstRow[columnMapping.value.description] : null
  }
})

const showSystemMapping = computed(() => unmatchedSystems.value.length > 0)

const validationErrors = computed(() => {
  const errors = []
  if (!columnMapping.value.code) {
    errors.push('Code column is required')
  }
  if (showSystemMapping.value) {
    const unmappedCount = unmatchedSystems.value.filter(
      sys => !systemMapping.value[sys]
    ).length
    if (unmappedCount > 0) {
      errors.push(`${unmappedCount} code system(s) need to be mapped`)
    }
  }
  return errors
})

const canImport = computed(() => {
  return columnMapping.value.code && validationErrors.value.length === 0
})

// Methods (Note: CloseDialog is defined in composable, but component needs method to reset local state)
const closeDialog = () => {
  resetDialog()
}

const handleFileSelect = async (event) => {
  const file = event.files[0]
  if (!file) return
  fileName.value = file.name
  uploadError.value = ''
  try {
    await parseFile(file)
    step.value = 2
  } catch (error) {
    uploadError.value = error.message
  }
}

const handleDrop = async (event) => {
  const file = event.dataTransfer.files[0]
  if (!file) return
  fileName.value = file.name
  uploadError.value = ''
  try {
    await parseFile(file)
    step.value = 2
  } catch (error) {
    uploadError.value = error.message
  }
}

const parseFile = async (file) => {
  // ... (Your existing parseFile logic) ...
  const extension = file.name.split('.').pop().toLowerCase()

  if (extension === 'csv' || extension === 'txt') {
    detectedFormat.value = 'csv'
    await parseCSV(file)
  } else if (extension === 'xlsx' || extension === 'xls') {
    detectedFormat.value = 'excel'
    await parseExcel(file)
  } else {
    throw new Error('Unsupported file format')
  }

  autoMapColumns()
  checkSystemMatches()
}

const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length === 0) {
          reject(new Error('File is empty'))
          return
        }

        const firstLine = lines[0]
        const delimiter = detectDelimiter(firstLine)

        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''))
        availableColumns.value = headers

        const rows = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''))
          const row = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          rows.push(row)
        }
        parsedData.value = rows
        resolve()
      } catch (error) {
        reject(new Error('Failed to parse CSV: ' + error.message))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

const parseExcel = async (file) => {
  throw new Error('Excel parsing requires xlsx library. Please install: npm install xlsx')
}

const detectDelimiter = (line) => {
  const delimiters = [',', '\t', ';', '|']
  let maxCount = 0
  let detected = ','

  delimiters.forEach(delim => {
    const count = line.split(delim).length
    if (count > maxCount) {
      maxCount = count
      detected = delim
    }
  })

  return detected
}

const autoMapColumns = () => {
  const codePatterns = ['code', 'icd', 'diagnosis', 'procedure', 'cpt', 'opcs']
  const systemPatterns = ['system', 'coding', 'source', 'vocabulary']
  const descPatterns = ['description', 'desc', 'name', 'label', 'text', 'term']

  availableColumns.value.forEach(col => {
    const lower = col.toLowerCase()

    if (!columnMapping.value.code && codePatterns.some(p => lower.includes(p))) {
      columnMapping.value.code = col
    }
    if (!columnMapping.value.system && systemPatterns.some(p => lower.includes(p))) {
      columnMapping.value.system = col
    }
    if (!columnMapping.value.description && descPatterns.some(p => lower.includes(p))) {
      columnMapping.value.description = col
    }
  })
}

const checkSystemMatches = () => {
  // ... (Your existing checkSystemMatches logic) ...
  if (!columnMapping.value.system) {
    unmatchedSystems.value = []
    return
  }

  const systemsInFile = new Set()
  parsedData.value.forEach(row => {
    const sys = row[columnMapping.value.system]
    if (sys) systemsInFile.add(sys.trim())
  })

  const dbSystemNames = dbCodeSystems.value.map(s => s.name.toLowerCase())
  unmatchedSystems.value = Array.from(systemsInFile).filter(sys => {
    return !dbSystemNames.includes(sys.toLowerCase())
  })
}

const getColumnClass = (field) => {
  if (field === columnMapping.value.code) return 'text-primary font-bold'
  if (field === columnMapping.value.system) return 'text-blue-600 font-semibold'
  if (field === columnMapping.value.description) return 'text-green-600'
  return ''
}

const handleImport = () => {
  // ... (Your existing handleImport logic) ...
  isImporting.value = true

  // Transform data according to mappings
  const transformedData = parsedData.value.map(row => {
    const code = row[columnMapping.value.code]
    let system = columnMapping.value.system ? row[columnMapping.value.system] : null
    const description = columnMapping.value.description ? row[columnMapping.value.description] : null

    // Apply system mapping if exists
    if (system && systemMapping.value[system]) {
      system = systemMapping.value[system]
    }

    return {
      code: code?.trim(),
      system: system?.trim(),
      description: description?.trim()
    }
  }).filter(item => item.code)

  // In a real app, you would send transformedData to the backend.
  // emit('import', transformedData) // Assuming 'emit' is available or passed via prop

  // Reset after a delay
  setTimeout(() => {
    isImporting.value = false
    closeDialog()
  }, 500)
}

const resetDialog = () => {
  step.value = 1
  fileName.value = ''
  detectedFormat.value = ''
  parsedData.value = []
  availableColumns.value = []
  uploadError.value = ''
  columnMapping.value = { code: null, system: null, description: null }
  systemMapping.value = {}
  unmatchedSystems.value = []
  closeImportDialog() // Calls composable function to toggle external state
}

watch(() => columnMapping.value.system, () => {
  if (parsedData.value.length > 0) {
    checkSystemMatches()
  }
})
</script>

<template>
  <Dialog
    v-model:visible="showImportDialog"
    modal
    :closable="!isImporting"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :draggable="false"
    @update:visible="val => { if (!val) resetDialog() }"
  >
    <template #header>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-upload text-2xl"></i>
        <span class="font-bold text-xl">Import Codes</span>
      </div>
    </template>

    <Card class="mb-4 instruction-card">
      <template #content>
        <div class="instruction-content">
            <i class="pi pi-info-circle info-icon"></i>
            <div v-if="step === 1" class="text-sm">
                <strong>Step 1: Upload.</strong> Drag and drop or select your CSV/Excel file. We will automatically detect the column headers.
            </div>
             <div v-else class="text-sm">
                <strong>Step 2: Mapping.</strong> Match the columns from your file to the required data fields below. Ensure the Code System column (if present) is mapped correctly.
            </div>
        </div>
      </template>
    </Card>

    <div v-if="step === 1" class="upload-section">
      <div class="upload-zone" @drop.prevent="handleDrop" @dragover.prevent>
        <FileUpload
          mode="basic"
          accept=".csv,.txt,.xlsx,.xls"
          :maxFileSize="10000000"
          @select="handleFileSelect"
          chooseLabel="Choose File"
          class="upload-button"
        />
        <p class="text-sm text-color-secondary mt-3">
          Supported formats: CSV, TXT, Excel (.xlsx, .xls)
        </p>
        <p class="text-xs text-color-secondary">
          Maximum file size: 10MB
        </p>
      </div>

      <div v-if="uploadError" class="error-message mt-3">
        <Message severity="error" :closable="false">{{ uploadError }}</Message>
      </div>
    </div>

    <div v-if="step === 2" class="mapping-section">
      <div class="file-info mb-4">
        <Tag :value="`${detectedFormat.toUpperCase()} - ${parsedData.length} rows`" severity="info" />
        <Tag :value="fileName" class="ml-2" />
      </div>

      <div class="grid">

        <div class="mapping-column">
          <Panel header="Map Columns" class="mb-4">
            <div class="field-container">
              <div class="field mb-3">
                <label class="block mb-2 font-semibold">
                  Code Column <span class="text-red-500">*</span>
                </label>
                <Select
                  v-model="columnMapping.code"
                  :options="availableColumns"
                  placeholder="Select code column..."
                  class="w-full"
                />
              </div>
              </div>
          </Panel>

          <Panel header="Example Mapping Result" class="mb-4">
            <div class="preview-column">
              <div class="grid text-sm">
                <div class="col-12">
                  <strong>Code:</strong>
                  <Tag severity="success" :value="exampleMapping.code || 'N/A'" />
                </div>
                <div class="col-12">
                  <strong>System:</strong> {{ exampleMapping.system || 'N/A' }}
                </div>
                <div class="col-12">
                  <strong>Description:</strong> {{ exampleMapping.description || 'N/A' }}
                </div>
              </div>
            </div>
          </Panel>

          <Panel v-if="showSystemMapping" header="Map Code Systems" class="mb-4 validation-panel">
            <Message severity="info" :closable="false" class="mb-3 text-sm">
              {{ unmatchedSystems.length }} system(s) need to be mapped:
            </Message>
            <div v-for="(unmapped, index) in unmatchedSystems" :key="index" class="mb-3">
              <div class="flex align-items-center gap-2 mb-1">
                <InputText :value="unmapped" disabled class="w-10rem text-sm" />
                <i class="pi pi-arrow-right flex-shrink-0"></i>
                <Select
                  v-model="systemMapping[unmapped]"
                  :options="dbCodeSystems"
                  optionLabel="name"
                  optionValue="name"
                  placeholder="Select matching system..."
                  class="w-full"
                />
              </div>
            </div>
          </Panel>

          <div v-if="validationErrors.length > 0" class="validation-errors">
            <Message
              v-for="(error, index) in validationErrors"
              :key="index"
              severity="warn"
              :closable="false"
              class="mb-2 text-sm"
            >
              {{ error }}
            </Message>
          </div>
        </div>

        <div class="col-12 lg:col-8 order-lg-1">
          <Panel header="Data Preview (Max 10 rows/cols)" class="h-full">
            <DataTable
              :value="previewData"
              scrollable
              :scrollHeight="'calc(100vh - 420px)'"
              class="preview-table"
              :rows="MAX_PREVIEW_ROWS"
            >
              <Column
                v-for="col in previewColumns"
                :key="col.field"
                :field="col.field"
                :header="col.header"
                style="max-width: 200px"
              >
                <template #body="slotProps">
                  <span :class="getColumnClass(col.field)">
                    {{ slotProps.data[col.field] }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </Panel>
        </div>

      </div>
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
/* FIX 2: Custom Gray Instruction Card Styling */
.instruction-card {
    border: 1px solid var(--gray-400);
    background-color: var(--surface-100); /* Slightly darker gray background */
}
.instruction-content {
    display: flex;
    align-items: center;
    gap: 1rem;
}
.info-icon {
    font-size: 1.25rem;
    color: var(--text-color-secondary);
}

.grid {
  align-items: flex-start;
}

.col-12.lg\:col-8 {
  display: flex;
}

.col-12.lg\:col-8 > .p-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-table {
  flex: 1;
}

/* Base layout styling (preserving PrimeFlex structure) */
.upload-section {
  padding: 2rem;
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
  justify-content: flex-end; /* push the button down */
  align-items: center;       /* center horizontally */

  padding-bottom: 1.5rem;
  text-align: center;
}

.upload-button {
  margin: 0 auto;
}

.upload-zone p {
  margin-top: 1rem;
}

.mapping-section .grid {
  display: grid;
  grid-template-columns: 1fr;       /* mobile */
  gap: 1rem;
}

@media (min-width: 1024px) {
  .mapping-section .grid {
    grid-template-columns: 2fr 1fr; /* preview left, mapping right */
  }
}

/* LEFT area */
.preview-column {
  order: 1;
}

/* RIGHT area */
.mapping-column {
  order: 2;
}

/* ensure panels stretch vertically */
.preview-column .p-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}



.file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-table {
  font-size: 0.8rem;
}

.example-mapping {
  padding: 0.5rem;
  background: var(--surface-50);
  border-radius: 6px;
}



.validation-panel {
    border-color: var(--surface-border);
}

.footer-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
</style>