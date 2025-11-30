import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// Mocks
const hoisted = vi.hoisted(() => ({
    mockApiClientGet: vi.fn()
}))

vi.mock('@/composables/shared/apiClient.js', () => ({
    apiClient: {
        get: hoisted.mockApiClientGet
    }
}))

vi.mock('@/composables/shared/useNotifications.js', () => ({
    useNotifications: () => ({
        emitError: vi.fn(),
        emitSuccess: vi.fn()
    })
}))

vi.mock('@/composables/shared/useCodeSystems.js', () => {
    const codeSystems = ref([])
    return {
        useCodeSystems: () => ({
            codeSystems,
            loadCodeSystems: vi.fn().mockResolvedValue()
        })
    }
})

vi.mock('@/composables/shared/useSupabase.js', () => ({
    supabase: {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockReturnThis(),
        auth: {
            onAuthStateChange: vi.fn(),
            signInWithOAuth: vi.fn(),
            signInWithPassword: vi.fn(),
            signOut: vi.fn()
        }
    }
}))

import { useTreeSearch } from './useTreeSearch.js'

describe('useTreeSearch - onNodeExpand', () => {
    beforeEach(() => {
        const { clearTreeState, nodes } = useTreeSearch()
        clearTreeState()
        nodes.value = []
        hoisted.mockApiClientGet.mockReset()
    })

    it('loads and sorts root nodes without throwing on null parent', async () => {
        hoisted.mockApiClientGet.mockResolvedValue({
            data: [
                { key: '2', label: 'B node', data: { code: 'B' }, children: [] },
                { key: '1', label: 'A node', data: { code: 'A' }, children: [] }
            ]
        })

        const { onNodeExpand, nodes } = useTreeSearch()

        await onNodeExpand(null)

        expect(hoisted.mockApiClientGet).toHaveBeenCalledWith('/api/tree-nodes', { params: { parent_id: null } })
        expect(nodes.value.map(n => n.key)).toEqual(['1', '2'])
    })
})
