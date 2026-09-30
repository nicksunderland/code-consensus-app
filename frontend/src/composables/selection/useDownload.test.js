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

const mockTables = (pheno = {}) => {
    supabaseModule.supabase.from.mockImplementation((table) => {
      if (table === 'phenotypes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { name: 'Ph', description: '', project: { name: 'Proj', owner: { email: 'a' } }, source: '', ...pheno }, error: null })
        }
      }
      if (table === 'phenotype_consensus_codes') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { code_type: 'standard', code_id: 1, code_text: 'A', code_description: 'Desc', system_name: 'ICD', consensus_comments: '', is_canonical: true },
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
      if (table === 'user_code_selections') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { code_id: 1, orphan_id: null, is_selected: true, user_id: 'u1' },
                { code_id: 1, orphan_id: null, is_selected: true, user_id: 'u2' },
              ],
              error: null
            })
          })
        }
      }
      return { select: () => Promise.resolve({ data: null, error: null }) }
    })
}

describe('useDownload', () => {
  it('merges consensus codes with systems', async () => {
    mockTables()
    const { fetchExportData, hasCodes, displayContent, isPhenotypeFinalized } = useDownload()
    await fetchExportData('ph1')
    expect(hasCodes.value).toBe(true)
    expect(displayContent.value.length).toBeGreaterThan(0)
    expect(isPhenotypeFinalized.value).toBe(false)
  })

  it('reports the stored finalised date', async () => {
    mockTables({ finalized_at: '2026-09-29T10:00:00Z' })
    const { fetchExportData, isPhenotypeFinalized, displayContent } = useDownload()
    await fetchExportData('ph2')
    expect(isPhenotypeFinalized.value).toBe(true)
    expect(displayContent.value).toContain('2026-09-29T10:00:00Z')
  })

  it('includes is_canonical in every format', async () => {
    mockTables()
    const { fetchExportData, selectedFormat, displayContent } = useDownload()
    await fetchExportData('ph3')

    const codes = JSON.parse(displayContent.value).codes
    expect(codes.map(c => c.is_canonical)).toEqual([true, false])

    selectedFormat.value = 'yaml'
    expect(displayContent.value).toContain('is_canonical: true')
    expect(displayContent.value).toContain('is_canonical: false')

    selectedFormat.value = 'text'
    expect(displayContent.value).toContain('CODE\tSYSTEM\tIS_CANONICAL')
    expect(displayContent.value).toContain('A\tICD\ttrue\t')
  })
})
