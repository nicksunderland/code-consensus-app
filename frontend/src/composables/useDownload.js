import { ref, computed } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useNotifications } from '@/composables/useNotifications.js'

// --- SHARED STATE (Singleton) ---
// Defined outside the function so it is shared across components
const isDownloadActive = ref(false)
const rawData = ref(null)
const isGenerating = ref(false)
const isPhenotypeFinalized = ref(false)

export function useDownload() {
    const { emitError } = useNotifications()

    // User preferences
    const selectedFormat = ref('json')
    const includeHeader = ref(true)
    // --- COMPUTED: STATE HELPERS ---
    const hasCodes = computed(() => {
        return rawData.value &&
               Array.isArray(rawData.value.codes) &&
               rawData.value.codes.length > 0
    })

    // --------------------------------------------------------
    // FETCH DATA
    // --------------------------------------------------------
    // --- FETCH DATA ---
    const fetchExportData = async (phenotypeId) => {
        if (!phenotypeId) return
        if (rawData.value?.metadata?.id === phenotypeId) return

        isGenerating.value = true
        rawData.value = null // Reset while loading

        try {
            // 1. Fetch Phenotype Metadata
            const { data: pheno, error: phenoError } = await supabase
                .from('phenotypes')
                .select(`
                    name, description, source, created_at,
                    project:projects(name, owner:user_profiles(email))
                `)
                .eq('id', phenotypeId)
                .single()

            if (phenoError) {
                emitError("Export Failed", "Could not retrieve phenotype metadata.")
                return
            }

            // 2. Fetch Selected Codes
            const { data: codes, error: codesError } = await supabase
                .from('phenotype_consensus')
                .select(`
                    finalized_at,
                    comments,
                    code:codes (
                        code, description,
                        system:code_systems(name, version, description, url)
                    )
                `)
                .eq('phenotype_id', phenotypeId)

            if (codesError) {
                emitError("Export Failed", "Could not retrieve phenotype codes.")
                return
            }

            // --- 3. EXTRACT UNIQUE CODE SYSTEMS ---
            // Create a Map to store unique system+version combinations
            const systemMap = new Map()

            codes.forEach(c => {
                const s = c.code?.system
                if (s) {
                    // Unique Key: Name + Version
                    const key = `${s.name}-${s.version}`

                    if (!systemMap.has(key)) {
                        systemMap.set(key, {
                            name: s.name,
                            version: s.version,
                            description: s.description || "", // <--- NEW
                            url: s.url || ""                  // <--- NEW
                        })
                    }
                }
            })

            const uniqueSystems = Array.from(systemMap.values())

            // --- 4. DETERMINE FINALIZED STATUS ---
            // Assuming bulk finalization: check the first code.
            // If no codes exist, it's technically not finalized.
            const finalizedDate = codes.length > 0 ? codes[0].finalized_at : null
            isPhenotypeFinalized.value = !!finalizedDate

            // --- 5. STRUCTURE DATA ---
            rawData.value = {
                metadata: {
                    id: phenotypeId,
                    name: pheno.name,
                    description: pheno.description || "No description provided.",
                    project: pheno.project?.name || "Private",
                    author: pheno.project?.owner?.email || "Unknown",
                    source: pheno.source || "N/A",
                    generated_at: new Date().toISOString(),
                    finalized_at: finalizedDate || "WARNING: Codes are PRE-FINALIZED (Draft Status)",
                    status: !!finalizedDate ? 'Finalized' : 'Draft'
                },
                code_systems: uniqueSystems,
                stats: {
                    total_codes: codes.length,
                    systems: [...new Set(codes.map(c => c.code?.system?.name))].join(', ')
                },
                codes: codes.map(item => ({
                    code: item.code?.code,
                    system: item.code?.system?.name,
                    description: item.code?.description,
                    consensus_comments: item.comments
                }))
            }

        } catch (err) {
            console.error("Export fetch failed", err)
            emitError("Export Failed", "Could not retrieve phenotype data.")
        } finally {
            isGenerating.value = false
        }
    }

    // --------------------------------------------------------
    // FORMATTERS
    // --------------------------------------------------------
    const getRichHeader = (commentChar) => {
        if (!includeHeader.value || !rawData.value) return ""
        const m = rawData.value.metadata
        const cs = rawData.value.code_systems
        let sysBlock = ""
        cs.forEach(s => {
            sysBlock += `${commentChar}   - ${s.name} (v${s.version})\n`
            if(s.url) sysBlock += `${commentChar}     Ref: ${s.url}\n`
        })

        return `${commentChar} ------------------------------------------------\n` +
               `${commentChar} PHENOTYPE:   ${m.name}\n` +
               `${commentChar} STATUS:      ${m.status.toUpperCase()}\n` +
               `${commentChar} ------------------------------------------------\n` +
               `${commentChar} Description: ${m.description}\n` +
               `${commentChar} Project:     ${m.project}\n` +
               `${commentChar} Author:      ${m.author}\n` +
               `${commentChar} Generated:   ${m.generated_at}\n` +
               `${commentChar} Finalized:   ${m.finalized_at}\n` +
               `${commentChar} ------------------------------------------------\n` +
               `${commentChar} SYSTEMS USED:\n` +
               sysBlock +
               `${commentChar} ------------------------------------------------\n\n`
    }

    const formatters = {
        json: (data) => JSON.stringify(data, null, 2),

        yaml: (data) => {
            const m = data.metadata
            const cs = data.code_systems

            // 1. Metadata Block
            let out = `metadata:\n`
            out += `  name: "${m.name}"\n`
            out += `  project: "${m.project}"\n`
            out += `  author: "${m.author}"\n`
            out += `  generated_at: "${m.generated_at}"\n`
            out += `  finalized_at: "${m.finalized_at}"\n`
            out += `  description: "${m.description}"\n`

            // 2. Stats Block
            out += `code_systems:\n`
            cs.forEach(sys => {
                out += `  - name: "${sys.name}"\n`
                out += `    version: "${sys.version}"\n`
                out += `    url: "${sys.url}"\n`
                out += `    description: "${sys.description}"\n`
            })

            // 3. Codes Block
            out += `codes:\n`
            data.codes.forEach(c => {
                out += `  - code: "${c.code}"\n`
                out += `    system: "${c.system}"\n`
                out += `    description: "${c.description}"\n`
                if (c.consensus_comments) out += `    consensus_comments: "${c.consensus_comments}"\n`
            })
            return out
        },

        text: (data) => {
            let out = getRichHeader('#')
            out += `CODE\tSYSTEM\tDESCRIPTION\tCOMMENTS\n`
            data.codes.forEach(c => {
                out += `${c.code}\t${c.system}\t${c.description}\t${c.consensus_comments}\n`
            })
            return out
        }
    }

    // --------------------------------------------------------
    // COMPUTED OUTPUTS
    // --------------------------------------------------------
    // 1. The actual text content to display/download
    const displayContent = computed(() => {
        if (!rawData.value) return ''

        const fmt = selectedFormat.value
        const formatter = formatters[fmt] || formatters.json

        // Only pass the header function if format is 'text'
        // JSON and YAML ignore the header toggle and output pure structure
        if (fmt === 'text') {
            return formatter(rawData.value, getRichHeader)
        } else {
            return formatter(rawData.value)
        }
    })

    // 2. The filename based on the phenotype name
    const fileName = computed(() => {
        if (!rawData.value) return 'download.txt'
        const name = rawData.value.metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        const ext = selectedFormat.value === 'text' ? 'txt' : selectedFormat.value
        return `${name}.${ext}`
    })

    // --------------------------------------------------------
    // ACTIONS
    // --------------------------------------------------------
    const triggerDownload = () => {
        if (!displayContent.value) return

        let mimeType = 'text/plain'
        if (selectedFormat.value === 'json') mimeType = 'application/json'
        if (selectedFormat.value === 'yaml') mimeType = 'text/yaml'

        const blob = new Blob([displayContent.value], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = fileName.value
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const resetDownloadCache = async (phenotypeId) => {
        // 1. Clear the cache
        rawData.value = null

        // 2. If the Download Accordion is currently open, fetch immediately
        if (isDownloadActive.value && phenotypeId) {
            await fetchExportData(phenotypeId)
        }
    }

    return {
        // State
        isDownloadActive,
        isPhenotypeFinalized,
        isGenerating,
        selectedFormat,
        includeHeader,
        hasCodes,

        // Computed
        displayContent,
        fileName,

        // Actions
        fetchExportData,
        triggerDownload,
        resetDownloadCache
    }
}