import { describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/shared/useSupabase.js', () => {
  const supabaseMock = { from: vi.fn() }
  return { supabase: supabaseMock }
})
const supabaseModule = await import('@/composables/shared/useSupabase.js')
vi.mock('@/composables/shared/useNotifications.js', () => ({
  useNotifications: () => ({ emitError: vi.fn() })
}))

import { useDownload } from './useDownload.js'

describe('useDownload', () => {
  it('merges consensus codes with systems', async () => {
    supabaseModule.supabase.from.mockImplementation((table) => {
      if (table === 'phenotypes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { name: 'Ph', description: '', project: { name: 'Proj', owner: { email: 'a' } }, source: '' }, error: null })
        }
      }
      if (table === 'phenotype_consensus_codes') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { code_type: 'standard', code_id: 1, code_text: 'A', code_description: 'Desc', system_name: 'ICD', consensus_comments: '' },
                { code_type: 'orphan', orphan_id: 'O1', code_text: 'X', code_description: 'Cust', system_name: 'Custom', consensus_comments: '' }
              ], error: null
            })
          })
        }
      }
      if (table === 'codes') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [{ id: 1, code: 'A', description: 'Desc', code_systems: { name: 'ICD', version: '1', description: '', url: '' } }], error: null })
          })
        }
      }
      if (table === 'code_systems') {
        return {
          select: () => Promise.resolve({ data: [], error: null })
        }
      }
      return { select: () => Promise.resolve({ data: null, error: null }) }
    })

    const { fetchExportData, hasCodes, displayContent } = useDownload()
    await fetchExportData('ph1')
    expect(hasCodes.value).toBe(true)
    expect(displayContent.value.length).toBeGreaterThan(0)
  })
})
