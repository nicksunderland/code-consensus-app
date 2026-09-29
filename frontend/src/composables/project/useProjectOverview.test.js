import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

vi.mock('@/composables/shared/useSupabase.js', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('../shared/useNotifications.js', () => createNotificationsMock())

const { supabase } = await import('@/composables/shared/useSupabase.js')
const { emitted } = await import('../shared/useNotifications.js')
const { useProjectOverview } = await import('./useProjectOverview.js')

describe('useProjectOverview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the summary and works out the totals', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { phenotype_id: 'a', name: 'Brugada', consensus_codes: '3', raters: '2', finalized_at: '2026-09-29T10:00:00Z' },
        { phenotype_id: 'b', name: 'Long QT', consensus_codes: '0', raters: '0', finalized_at: null },
      ],
      error: null,
    })

    const { rows, stats, fetchSummary } = useProjectOverview()
    await fetchSummary('p1')

    expect(supabase.rpc).toHaveBeenCalledWith('get_project_summary', { p_project_id: 'p1' })
    expect(rows.value.map(r => r.status)).toEqual(['Finalised', 'Draft'])
    expect(rows.value[0].consensus_codes).toBe(3)
    expect(stats.value).toEqual({ phenotypes: 2, finalized: 1, consensusCodes: 3 })
  })

  it('reports errors and clears the rows', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { rows, fetchSummary } = useProjectOverview()
    await fetchSummary('p1')

    expect(rows.value).toEqual([])
    expect(emitted.errors.at(-1).t).toBe('Could not load project summary')
  })
})
