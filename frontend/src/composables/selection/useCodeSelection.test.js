import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

var treeState

vi.mock('@/composables/tree/useTreeSearch.js', () => {
  treeState = {
    nodes: { value: [{ key: '1', data: { code: 'A', description: 'desc', system: 'ICD' }, children: [] }] },
    selectedNodeKeys: { value: {} },
    searchNodeKeys: { value: {} }
  }
  return {
    useTreeSearch: () => ({
      ...treeState,
      fetchSpecificNodes: vi.fn(),
      fetchSearchStrategy: vi.fn(),
      saveSearchStrategy: vi.fn(),
      clearTreeState: vi.fn()
    })
  }
})

vi.mock('../shared/useNotifications.js', () => createNotificationsMock())
const notificationsModule = await import('../shared/useNotifications.js')

// Mock code import composable
var importedData = { value: [] }
vi.mock('@/composables/selection/useCodeImport.js', () => ({
  useCodeImport: () => ({ importedData })
}))

// Mock auth/phenotypes
const user = { value: { id: 'user-1' } }
vi.mock('@/composables/auth/useAuth.js', () => ({
  useAuth: () => ({ user })
}))
const currentPhenotype = { value: { id: 'ph1' } }
vi.mock('@/composables/project/usePhenotypes.js', () => ({
  usePhenotypes: () => ({ currentPhenotype })
}))
vi.mock('@/composables/selection/useDownload.js', () => ({
  useDownload: () => ({ resetDownloadCache: vi.fn() })
}))

// Supabase mock
vi.mock('@/composables/shared/useSupabase.js', () => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const supabaseMock = {
    from: vi.fn().mockReturnValue({
      upsert: upsertMock
    }),
    rpc: vi.fn().mockResolvedValue({ error: null })
  }
  return { supabase: supabaseMock }
})
const supabaseModule = await import('@/composables/shared/useSupabase.js')
const upsertMock = supabaseModule.supabase.from().upsert

import { useCodeSelection } from './useCodeSelection.js'

describe.skip('useCodeSelection saveSelections', () => {
  beforeEach(() => {
    treeState.selectedNodeKeys.value = { '1': true, 'ORPHAN:abc': true }
    importedData.value = [{ key: 'ORPHAN:abc', code: 'X', description: 'custom', system: 'Custom', imported: true }]
    upsertMock.mockClear()
  })

  it('upserts standard and orphan codes', async () => {
    const { saveSelections, tableRows } = useCodeSelection()
    await saveSelections()

    expect(supabaseModule.supabase.from().upsert).toHaveBeenCalledTimes(2)
    expect(tableRows.value.length).toBeGreaterThan(0)
  })
})
