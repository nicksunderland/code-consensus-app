import { ref, computed } from 'vue'
import { supabase } from '@/composables/shared/useSupabase.js'
import { useNotifications } from '@/composables/shared/useNotifications.js'

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
                .from('phenotype_consensus_codes')
                .select('code_type, code_id, orphan_id, code_text, code_description, system_name, consensus_comments')
                .eq('phenotype_id', phenotypeId)

            if (consensusError) {
                emitError("Export Failed", "Could not retrieve phenotype consensus codes.")
                return
            }

            const consensusList = consensus || []

            const standardIds = consensusList
                .filter(r => r.code_type === 'standard' && r.code_id)
                .map(r => r.code_id)

            let codeMap = new Map()

            if (standardIds.length > 0) {
                const { data: codesData, error: codeError } = await supabase
                    .from('codes')
                    .select('id, code, description, code_systems(name, version, description, url)')
                    .in('id', standardIds)

                if (codeError) {
                    emitError("Export Failed", "Unable to load code metadata.")
                    return
                }

                codesData.forEach(c => codeMap.set(c.id, c))
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
            // 4. Compute agreement stats across user selections
            // --------------------------------------------
            let selectionRows = [];
            try {
                const { data: selectionData, error: selectionError } = await supabase
                    .from('user_code_selections')
                    .select('code_id, orphan_id, is_selected, user_id')
                    .eq('phenotype_id', phenotypeId);
                if (selectionError) throw selectionError;
                selectionRows = selectionData || [];
            } catch (err) {
                // Non-fatal for examples/non-members; skip agreement if RLS blocks
                selectionRows = [];
            }

            let totalRatings = 0;
            let totalSelected = 0;
            let pSum = 0;
            let items = 0;
            let pBar = 0;
            let kappa = 0;

            if (selectionRows.length) {
                const agreeMap = new Map();
                (selectionRows || []).forEach((row) => {
                    const key = String(row.code_id ?? row.orphan_id);
                    if (!agreeMap.has(key)) agreeMap.set(key, []);
                    agreeMap.get(key).push(!!row.is_selected);
                });

                agreeMap.forEach((votes) => {
                    const n = votes.length;
                    if (n < 2) return; // need at least two raters
                    const nSel = votes.filter(Boolean).length;
                    const nNot = n - nSel;
                    const p_i = ((nSel * (nSel - 1)) + (nNot * (nNot - 1))) / (n * (n - 1));
                    pSum += p_i;
                    items += 1;
                    totalRatings += n;
                    totalSelected += nSel;
                });

                pBar = items ? pSum / items : 0;
                const pYes = totalRatings ? totalSelected / totalRatings : 0;
                const pNo = 1 - pYes;
                const pE = (pYes * pYes) + (pNo * pNo);
                const denom = 1 - pE;
                kappa = denom ? (pBar - pE) / denom : 0;
            }

            // --------------------------------------------
            // 5. Merge consensus rows into unified structure
            // --------------------------------------------
            const mergedCodes = consensusList.map(row => {
                const isOrphan = row.code_type === 'orphan' || !!row.orphan_id;

                if (!isOrphan) {
                    const detail = codeMap.get(row.code_id);
                    return {
                        code: detail?.code || row.code_text,
                        description: detail?.description || row.code_description,
                        system: detail?.code_systems?.name || row.system_name,
                        system_version: detail?.code_systems?.version || "N/A",
                        system_description: detail?.code_systems?.description || "",
                        system_url: detail?.code_systems?.url || "",
                        consensus_comments: row.consensus_comments || "",
                        finalized_at: null,
                        is_orphan: false
                    }
                }

                const sys = systemLookup.get(row.system_name);
                return {
                    code: row.code_text,
                    description: row.code_description,
                    system: row.system_name || "Custom",
                    system_version: sys?.version || "N/A",
                    system_description:
                        sys?.description || "User-submitted custom code",
                    system_url: sys?.url || "",
                    consensus_comments: row.consensus_comments || "",
                    finalized_at: null,
                    is_orphan: true
                }
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
            const finalizedDate = null

            isPhenotypeFinalized.value = false

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
                    status: !!finalizedDate ? "Finalized" : "Draft",
                    agreement_percent: Math.round(pBar * 100),
                    kappa: Number.isFinite(kappa) ? kappa.toFixed(3) : '0.000',
                    agreement_items: items,
                    agreement_raters: selectionRows.length ? new Set(selectionRows.map(r => r.user_id)).size : 0
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
