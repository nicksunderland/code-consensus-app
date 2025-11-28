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
        rawData.value = null

        try {
            // -------------------------------
            // 1. Fetch phenotype metadata
            // -------------------------------
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

            // -------------------------------
            // 2. Fetch selected consensus codes
            // -------------------------------
            const { data: consensus, error: consensusError } = await supabase
                .from('phenotype_consensus')
                .select(`
                    id,
                    code_id,
                    orphan_id,
                    comments,
                    finalized_at,
                    code:codes (
                        code,
                        description,
                        system:code_systems(name, version, description, url)
                    )
                `)
                .eq('phenotype_id', phenotypeId)

            if (consensusError) {
                emitError("Export Failed", "Could not retrieve phenotype consensus codes.")
                return
            }

            // -------------------------------
            // 3. Gather orphan IDs
            // -------------------------------
            const orphanIds = consensus
                .filter(r => r.orphan_id)
                .map(r => r.orphan_id)

            let orphanMap = new Map()

            if (orphanIds.length > 0) {
                const { data: orphans, error: orphanError } = await supabase
                    .from('user_code_selections_orphan')
                    .select(`
                        orphan_id,
                        code,
                        description,
                        system_name,
                        comment
                    `)
                    .in('orphan_id', orphanIds)

                if (orphanError) {
                    emitError("Export Failed", "Unable to load orphan codes.")
                    return
                }

                orphans.forEach(o => orphanMap.set(o.orphan_id, o))
            }

            // --------------------------------------------
            // 4. Load all system metadata for orphan linking
            // --------------------------------------------
            const { data: allSystems } = await supabase
                .from("code_systems")
                .select("name, version, description, url")

            const systemLookup = new Map()
            allSystems?.forEach(sys => systemLookup.set(sys.name, sys))

            // --------------------------------------------
            // 5. Merge consensus rows into unified structure
            // --------------------------------------------
            const mergedCodes = consensus.map(row => {
                // Normal code
                if (row.code_id && row.code) {
                    return {
                        code: row.code.code,
                        description: row.code.description,
                        system: row.code.system?.name,
                        system_version: row.code.system?.version,
                        system_description: row.code.system?.description,
                        system_url: row.code.system?.url,
                        consensus_comments: row.comments,
                        finalized_at: row.finalized_at,
                        is_orphan: false
                    }
                }

                // Orphan code
                if (row.orphan_id) {
                    const o = orphanMap.get(row.orphan_id)
                    if (!o) return null

                    // Use real system if exists
                    const sys = systemLookup.get(o.system_name)

                    return {
                        code: o.code,
                        description: o.description,
                        system: o.system_name || "Custom",
                        system_version: sys?.version || "N/A",
                        system_description:
                            sys?.description || "User-submitted custom code",
                        system_url: sys?.url || "",
                        consensus_comments: o.comment || row.comments,
                        finalized_at: row.finalized_at,
                        is_orphan: true
                    }
                }

                return null
            }).filter(Boolean)

            // --------------------------------------------
            // 6. Extract unique system definitions
            // --------------------------------------------
            const systemMap = new Map()

            mergedCodes.forEach(c => {
                const name = c.system || "Custom"
                const version = c.system_version || "N/A"
                const key = `${name}-${version}`

                if (!systemMap.has(key)) {
                    systemMap.set(key, {
                        name,
                        version,
                        description: c.system_description || "",
                        url: c.system_url || ""
                    })
                }
            })

            const uniqueSystems = Array.from(systemMap.values())

            // --------------------------------------------
            // 7. Determine finalized status
            // --------------------------------------------
            const finalizedDate =
                mergedCodes.length > 0 ? mergedCodes[0].finalized_at : null

            isPhenotypeFinalized.value = !!finalizedDate

            // --------------------------------------------
            // 8. Build export data object
            // --------------------------------------------
            rawData.value = {
                metadata: {
                    id: phenotypeId,
                    name: pheno.name,
                    description: pheno.description || "No description provided.",
                    project: pheno.project?.name || "Private",
                    author: pheno.project?.owner?.email || "Unknown",
                    source: pheno.source || "N/A",
                    generated_at: new Date().toISOString(),
                    finalized_at:
                        finalizedDate ||
                        "WARNING: Codes are PRE-FINALIZED (Draft Status)",
                    status: !!finalizedDate ? "Finalized" : "Draft"
                },
                code_systems: uniqueSystems,
                stats: {
                    total_codes: mergedCodes.length,
                    systems: [...new Set(mergedCodes.map(c => c.system))].join(", ")
                },
                codes: mergedCodes
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