import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

describe('useCodeSelection saveSelections', () => {
  let upsertMock
  let useCodeSelection
  let treeState
  let importedData
  let currentPhenotype
  let user
  let notificationsModule

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    treeState = {
      nodes: { value: [{ key: '1', data: { code: 'A', description: 'desc', system: 'ICD' }, children: [] }] },
      selectedNodeKeys: { value: {} },
      searchNodeKeys: { value: {} }
    }
    importedData = { value: [] }
    currentPhenotype = { value: { id: 'ph1' } }
    user = { value: { id: 'user-1' } }

    vi.doMock('@/composables/tree/useTreeSearch.js', () => ({
      useTreeSearch: () => ({
        ...treeState,
        fetchSpecificNodes: vi.fn(),
        fetchSearchStrategy: vi.fn(),
        saveSearchStrategy: vi.fn(),
        clearTreeState: vi.fn()
      })
    }))

    vi.doMock('../shared/useNotifications.js', () => createNotificationsMock())
    notificationsModule = await import('../shared/useNotifications.js')

    vi.doMock('@/composables/selection/useCodeImport.js', () => ({
      useCodeImport: () => ({ importedData })
    }))

    vi.doMock('@/composables/auth/useAuth.js', () => ({
      useAuth: () => ({ user })
    }))
    vi.doMock('@/composables/project/usePhenotypes.js', () => ({
      usePhenotypes: () => ({ currentPhenotype })
    }))
    vi.doMock('@/composables/selection/useDownload.js', () => ({
      useDownload: () => ({ resetDownloadCache: vi.fn() })
    }))

    const upsert = vi.fn().mockResolvedValue({ error: null })
    upsertMock = upsert
    vi.doMock('@/composables/shared/useSupabase.js', () => {
      const supabaseMock = {
        from: vi.fn((table) => {
          if (table === 'user_code_selections') {
            return {
              upsert,
              delete: vi.fn().mockReturnThis(),
              select: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({
                  data: [
                    {
                      code_type: 'standard',
                      code_id: 1,
                      is_selected: true,
                      comment: '',
                      found_in_search: false,
                      imported: false,
                      user_id: user.value.id,
                      code: {
                        code: 'A',
                        description: 'desc',
                        system_id: null,
                        system: { name: 'ICD' }
                      }
                    },
                    {
                      code_type: 'orphan',
                      orphan_id: 'ORPHAN:abc',
                      is_selected: true,
                      comment: '',
                      found_in_search: false,
                      imported: true,
                      user_id: user.value.id,
                      code_text: 'X',
                      code_description: 'custom',
                      system_name: 'Custom'
                    }
                  ],
                  error: null
                }))
              })),
              eq: vi.fn().mockResolvedValue({ error: null })
            }
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
              in: vi.fn(() => Promise.resolve({ data: [], error: null }))
            })),
            upsert,
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }
        }),
        rpc: vi.fn().mockResolvedValue({ error: null })
      }
      return { supabase: supabaseMock }
    })

    useCodeSelection = (await import('./useCodeSelection.js')).useCodeSelection
  })

  it('upserts standard and orphan codes', async () => {
    const { saveSelections, tableRows } = useCodeSelection()
    // Force selections after initialization
    treeState.selectedNodeKeys.value = { '1': true, 'ORPHAN:abc': true }
    importedData.value = [{ key: 'ORPHAN:abc', code: 'X', description: 'custom', system: 'Custom', imported: true }]
    currentPhenotype.value = { id: 'ph1' }

    await saveSelections()
    expect(upsertMock).toHaveBeenCalledTimes(2)
    expect(tableRows.value.length).toBeGreaterThan(0)
  })
})
