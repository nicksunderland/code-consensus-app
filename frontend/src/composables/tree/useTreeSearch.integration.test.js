import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiClientMock } from '../../../test/mocks/apiClient.mock.js'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

vi.mock('@/composables/shared/apiClient.js', () => {
  const apiMock = createApiClientMock()
  return { apiClient: apiMock }
})

vi.mock('../shared/useNotifications.js', () => {
  const notifications = createNotificationsMock()
  return notifications
})

const apiModule = await import('@/composables/shared/apiClient.js')
const notificationsModule = await import('../shared/useNotifications.js')

vi.mock('@/composables/shared/useCodeSystems.js', () => ({
  useCodeSystems: () => ({
    codeSystems: { value: [] },
    loadCodeSystems: vi.fn().mockResolvedValue()
  })
}))

vi.mock('@/composables/shared/useSupabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    in: vi.fn().mockReturnThis(),
    auth: {
      onAuthStateChange: vi.fn(),
      signOut: vi.fn()
    }
  }
}))

import { useTreeSearch } from './useTreeSearch.js'

describe('useTreeSearch integration happy path', () => {
  beforeEach(() => {
    apiModule.apiClient.get.mockReset()
    notificationsModule.emitted.errors.length = 0
    notificationsModule.emitted.successes.length = 0
  })

  it('runSearch merges results and sets search flags', async () => {
    const { searchInputs, runSearch, nodes, searchNodeKeys, autoSelect } = useTreeSearch()

    searchInputs.value = [{ text: 'abc', regex: false, columns: ['code'], system_ids: [] }]
    apiModule.apiClient.post = vi.fn().mockResolvedValue({
      data: {
        results: [
          { key: '10', data: { code: 'A1', description: 'desc', found_in_search: true, materialized_path: '10' }, label: 'A1' }
        ],
        ancestor_map: {}
      }
    })

    await runSearch()

    expect(apiModule.apiClient.post).toHaveBeenCalled()
    expect(nodes.value.length).toBe(1)
    expect(searchNodeKeys.value['10']).toBe(true)

    // auto select path
    autoSelect.value = true
    await runSearch()
  })
})
