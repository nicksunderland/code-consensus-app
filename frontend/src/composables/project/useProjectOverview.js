import { ref, computed } from 'vue'
import { supabase } from '@/composables/shared/useSupabase.js'
import { useNotifications } from '../shared/useNotifications.js'

// per-phenotype summary for the project overview page, see get_project_summary() in
// backend/db/migrations/2026-09-29_project_summary.sql
export function useProjectOverview() {
    const { emitError } = useNotifications()

    const rows = ref([])
    const loading = ref(false)

    const stats = computed(() => ({
        phenotypes: rows.value.length,
        finalized: rows.value.filter(r => r.finalized_at).length,
        consensusCodes: rows.value.reduce((n, r) => n + Number(r.consensus_codes || 0), 0),
    }))

    async function fetchSummary(projectId) {
        if (!projectId) {
            rows.value = []
            return
        }
        loading.value = true
        const { data, error } = await supabase.rpc('get_project_summary', { p_project_id: projectId })
        loading.value = false

        if (error) {
            rows.value = []
            return emitError('Could not load project summary', error)
        }

        rows.value = (data || []).map(r => ({
            ...r,
            consensus_codes: Number(r.consensus_codes || 0),
            raters: Number(r.raters || 0),
            status: r.finalized_at ? 'Finalised' : 'Draft',
        }))
    }

    return {
        rows,
        loading,
        stats,
        fetchSummary,
    }
}
