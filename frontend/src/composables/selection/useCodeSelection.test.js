import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

describe('useCodeSelection', () => {
  let upsertMock
  let rpcMock
  let phenotypeUpdate
  let storedFinalizedAt
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
    rpcMock = vi.fn().mockResolvedValue({ error: null })
    storedFinalizedAt = null
    phenotypeUpdate = vi.fn((values) => {
      storedFinalizedAt = values.finalized_at
      return { eq: vi.fn().mockResolvedValue({ error: null }) }
    })
    vi.doMock('@/composables/shared/useSupabase.js', () => {
      const supabaseMock = {
        from: vi.fn((table) => {
          if (table === 'phenotypes') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: [{ finalized_at: storedFinalizedAt }], error: null }))
              })),
              update: phenotypeUpdate
            }
          }
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
        rpc: rpcMock
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

  it('stores finalised state on the phenotype and clears it on unlock', async () => {
    const { saveConsensus, unlockConsensus, isFinalized } = useCodeSelection()

    await saveConsensus(true)
    expect(phenotypeUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ finalized_by: 'user-1', finalized_at: expect.any(String) })
    )
    expect(isFinalized.value).toBe(true)

    await unlockConsensus()
    expect(phenotypeUpdate).toHaveBeenLastCalledWith({ finalized_at: null, finalized_by: null })
    expect(isFinalized.value).toBe(false)
  })

  describe('canonical codes', () => {
    beforeEach(() => {
      treeState.nodes.value = [
        { key: '1', data: { code: 'A', description: 'a', system: 'ICD' }, children: [] },
        { key: '2', data: { code: 'B', description: 'b', system: 'ICD' }, children: [] },
        { key: '3', data: { code: 'C', description: 'c', system: 'OPCS' }, children: [] }
      ]
      treeState.searchNodeKeys.value = { '1': true, '2': true, '3': true }
    })

    const canonicalKeys = (rows) => rows.filter(r => r.consensus_canonical).map(r => r.key).sort()

    it('allows only one canonical code per system', () => {
      const { tableRows, updateConsensusSelection, updateCanonicalSelection } = useCodeSelection()
      ;['1', '2', '3'].forEach(k => updateConsensusSelection(k, true))

      updateCanonicalSelection('1', true)
      updateCanonicalSelection('3', true)
      expect(canonicalKeys(tableRows.value)).toEqual(['1', '3'])

      updateCanonicalSelection('2', true)
      expect(canonicalKeys(tableRows.value)).toEqual(['2', '3'])
    })

    it('clears canonical when the code leaves the consensus', () => {
      const { tableRows, updateConsensusSelection, updateCanonicalSelection } = useCodeSelection()
      updateConsensusSelection('1', true)
      updateCanonicalSelection('1', true)

      updateConsensusSelection('1', false)
      expect(canonicalKeys(tableRows.value)).toEqual([])
    })

    it('saves the whole consensus with canonical flags through the rpc', async () => {
      const { saveConsensus, updateConsensusSelection, updateCanonicalSelection } = useCodeSelection()
      updateConsensusSelection('1', true)
      updateConsensusSelection('3', true)
      updateCanonicalSelection('3', true)

      await saveConsensus(false)

      expect(upsertMock).not.toHaveBeenCalled()
      expect(rpcMock).toHaveBeenCalledWith('save_phenotype_consensus', {
        p_phenotype_id: 'ph1',
        p_codes: [
          expect.objectContaining({ code_type: 'standard', code_id: 1, system_name: 'ICD', is_canonical: false }),
          expect.objectContaining({ code_type: 'standard', code_id: 3, system_name: 'OPCS', is_canonical: true })
        ]
      })
    })
  })
})
