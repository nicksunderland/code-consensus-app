import { ref, computed, watch, onMounted } from 'vue'
import {useCodeSystems} from "@/composables/useCodeSystems.js";
import {supabase} from "@/composables/useSupabase.js";

// --- GLOBAL STATE (Singleton) ---
const showImportDialog = ref(false)
const importedData = ref([])

// --- CONSTANTS ---



export function useCodeImport() {
    const { codeSystems, loadCodeSystems } = useCodeSystems()
    // Initialize on first use
    onMounted(async () => {
        await loadCodeSystems()
    })

    // --- LOCAL STATE ---
    const step = ref(1)
    const fileName = ref('')
    const useFileProvidedSystem = ref({})
    const detectedFormat = ref('')
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
    const rawImportedData = ref([])

    // --- COMPUTED PROPERTIES ---
    const previewData = computed(() => {
        if (rawImportedData.value.length === 0) return []
        return rawImportedData.value.slice(0, 10)
    })

    const exampleMapping = computed(() => {
        if (!rawImportedData.value.length) return {}
        const firstRow = rawImportedData.value[0]
        return {
            code: columnMapping.value.code ? firstRow[columnMapping.value.code] : null,
            system: columnMapping.value.system ? firstRow[columnMapping.value.system] : null,
            description: columnMapping.value.description ? firstRow[columnMapping.value.description] : null
        }
    })

    const showSystemMapping = computed(() => unmatchedSystems.value.length > 0)

    const remainingUnmappedCount = computed(() => {
        return unmatchedSystems.value.filter(sys => {
            const isMapped = !!systemMapping.value[sys]
            const isFileOverride = !!useFileProvidedSystem.value[sys]

            // It is "remaining" (unresolved) only if it is NEITHER mapped NOR overridden
            return !isMapped && !isFileOverride
        }).length
    })

    const validationErrors = computed(() => {
        const errors = []
        if (!columnMapping.value.code) {
            errors.push('Code column is required')
        }
        if (showSystemMapping.value) {
            if (remainingUnmappedCount.value > 0) {
                errors.push(`${remainingUnmappedCount.value} code system(s) need to be mapped`)
            }
        }
        return errors
    })

    const canImport = computed(() => {
        return columnMapping.value.code && validationErrors.value.length === 0
    })

    // --- HELPER FUNCTIONS (Internal) ---
    // 1. CSV Parsing Logic
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

                    // Remove quotes and trim
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
                    rawImportedData.value = rows
                    resolve()
                } catch (error) {
                    reject(new Error('Failed to parse CSV: ' + error.message))
                }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }

    // 2. Excel Parsing Logic
    const parseExcel = async (file) => {
        try {
            // Dynamically import xlsx to keep bundle size small
            const XLSX = await import('xlsx')

            // Read file as ArrayBuffer
            const data = await file.arrayBuffer()

            // Parse workbook
            const workbook = XLSX.read(data, { type: 'array' })

            // Get first sheet name
            const firstSheetName = workbook.SheetNames[0]
            if (!firstSheetName) throw new Error('Excel file has no sheets')

            const worksheet = workbook.Sheets[firstSheetName]

            // Convert to JSON
            // raw: false ensures all data is treated as text (avoids date parsing issues)
            // defval: '' ensures empty cells are empty strings, not undefined
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                raw: false,
                defval: ''
            })

            if (jsonData.length === 0) throw new Error('Sheet appears to be empty')

            // Extract headers from the keys of the first row
            const headers = Object.keys(jsonData[0])

            availableColumns.value = headers
            rawImportedData.value = jsonData

        } catch (error) {
            console.error(error)
            throw new Error('Failed to parse Excel file: ' + (error.message || 'Unknown error'))
        }
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
        if (!columnMapping.value.system) {
            unmatchedSystems.value = []
            return
        }

        const systemsInFile = new Set()
        rawImportedData.value.forEach(row => {
            const sys = row[columnMapping.value.system]
            if (sys) systemsInFile.add(sys.trim())
        })

        const dbSystemNames = codeSystems.value.map(s => s.name.toLowerCase())

        const foundUnmatched = Array.from(systemsInFile).filter(sys => {
            return !dbSystemNames.includes(sys.toLowerCase())
        })

        const currentFlags = { ...useFileProvidedSystem.value }
        // 2. Ensure every unmatched system has a key initialized to false (if not already set)
        foundUnmatched.forEach(sys => {
            if (currentFlags[sys] === undefined) {
                currentFlags[sys] = false
            }
        })

        // 3. Update the refs
        useFileProvidedSystem.value = currentFlags
        unmatchedSystems.value = foundUnmatched
    }

    // --- PUBLIC ACTIONS ---
    const openImportDialog = () => {
        showImportDialog.value = true
    }

    const closeImportDialog = () => {
        showImportDialog.value = false
    }

    const resetDialog = () => {
        step.value = 1
        fileName.value = ''
        detectedFormat.value = ''
        rawImportedData.value = []
        availableColumns.value = []
        uploadError.value = ''
        columnMapping.value = { code: null, system: null, description: null }
        systemMapping.value = {}
        unmatchedSystems.value = []
        useFileProvidedSystem.value = {}
        closeImportDialog()
    }

    // Main entry point for parsing
    const parseFile = async (file) => {
        const extension = file.name.split('.').pop().toLowerCase()
        fileName.value = file.name
        uploadError.value = ''

        try {
            if (extension === 'csv' || extension === 'txt' || extension === 'tsv') {
                detectedFormat.value = 'csv'
                await parseCSV(file)
            } else if (extension === 'xlsx' || extension === 'xls') {
                detectedFormat.value = 'excel'
                await parseExcel(file)
            } else {
                throw new Error('Unsupported file format. Please upload CSV or Excel.')
            }

            autoMapColumns()
            checkSystemMatches()

            console.log('File parsed successfully')
            step.value = 2
        } catch (error) {
            console.error('Parse error:', error)
            uploadError.value = error.message
        }
    }

   const handleImport = async () => {
        isImporting.value = true

        try {
            // Build a lookup of DB code systems
            const systemMap = {}
            codeSystems.value.forEach(s => {
                systemMap[s.name.toLowerCase()] = s
            })

            const uniqueCodesToFetch = new Set()
            const rowsToProcess = []

            for (const row of rawImportedData.value) {
                const code = row[columnMapping.value.code]?.toString().trim()
                if (!code) continue // Skip empty codes

                let systemName = columnMapping.value.system ? row[columnMapping.value.system]?.toString().trim() : null

                // Apply mappings
                if (systemName && systemMapping.value[systemName]) {
                    systemName = systemMapping.value[systemName]
                }

                // Determine DB System ID
                const isUnmappable = systemName && unmatchedSystems.value.includes(systemName)
                const dbSystem = !isUnmappable ? systemMap[systemName?.toLowerCase()] || null : null
                const system_id = dbSystem?.id || null

                // If we have a valid system_id, we need to check if this code exists in DB
                if (system_id) {
                    uniqueCodesToFetch.add(code)
                }

                // Store pre-calculated data to avoid re-doing logic in step 4
                rowsToProcess.push({
                    rawRow: row,
                    code,
                    description: columnMapping.value.description ? row[columnMapping.value.description] : null,
                    systemName,
                    dbSystem,
                    system_id
                })
            }

            // 3. BATCH FETCH: Get all relevant codes from DB in one go
            // We fetch any code string that appeared in the file.
            // We will filter by system_id in memory later.
            const dbCodeLookup = new Map() // Key: "system_id:code", Value: database_id

            if (uniqueCodesToFetch.size > 0) {
                const allCodes = Array.from(uniqueCodesToFetch)

                // Chunking: Supabase URL limit might fail if checking 5000+ codes at once.
                // We split into chunks of 1000 to be safe.
                const chunkSize = 1000
                for (let i = 0; i < allCodes.length; i += chunkSize) {
                    const chunk = allCodes.slice(i, i + chunkSize)

                    const { data, error } = await supabase
                        .from('codes')
                        .select('id, system_id, code')
                        .in('code', chunk) // Fetch all matching codes

                    if (error) throw error

                    if (data) {
                        data.forEach(dbRow => {
                            // Create a composite key to ensure uniqueness across systems
                            // e.g. "123:A01" (System 123, Code A01)
                            const key = `${dbRow.system_id}:${dbRow.code}`
                            dbCodeLookup.set(key, dbRow.id)
                        })
                    }
                }
            }

            // 4. Map final data using in-memory lookup (Instant)
            const mappedData = rowsToProcess.map(item => {
                let code_id = null

                // Perform O(1) lookup
                if (item.system_id) {
                    const key = `${item.system_id}:${item.code}`
                    code_id = dbCodeLookup.get(key) || null
                }

                return {
                    key: code_id ? code_id : `ORPHAN:${item.systemName}:${item.code}`,
                    code: item.code,
                    description: item.description,
                    system: item.dbSystem?.name || item.systemName,
                    system_id: item.system_id
                }
            })

            importedData.value = mappedData

        } catch (err) {
            console.error("Import failed:", err)
            uploadError.value = err.message || "Unknown import error"
        } finally {
            setTimeout(() => {
                isImporting.value = false
                resetDialog()
            }, 500)
        }
    }


    // --- WATCHERS ---
    watch(() => columnMapping.value.system, () => {
        if (rawImportedData.value.length > 0) {
            checkSystemMatches()
        }
    })

    return {
        // State
        showImportDialog,
        step,
        fileName,
        detectedFormat,
        rawImportedData,
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
        openImportDialog,
        closeImportDialog,
        resetDialog,
        parseFile,
        handleImport
    }
}