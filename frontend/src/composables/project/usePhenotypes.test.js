import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

vi.mock('../shared/useNotifications.js', () => createNotificationsMock())

vi.mock('@/composables/shared/useSupabase.js', () => {
  const supabaseMock = { from: vi.fn() }
  return { supabase: supabaseMock }
})

const supabaseModule = await import('@/composables/shared/useSupabase.js')

const authUser = ref(null)
vi.mock('@/composables/auth/useAuth.js', () => ({
  useAuth: () => ({ user: authUser })
}))

const currentProject = ref({ id: 'proj-1' })
vi.mock('@/composables/project/useProjects.js', () => ({
  useProjects: () => ({ currentProject })
}))

import { usePhenotypes } from './usePhenotypes.js'

describe('usePhenotypes', () => {
  beforeEach(() => {
    authUser.value = { id: 'user-1' }
    supabaseModule.supabase.from.mockReset()
  })

  it('saves a new phenotype', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'ph1', name: 'pheno', project_id: 'proj-1' }, error: null })
    }
    supabaseModule.supabase.from.mockReturnValue(insertChain)

    const { currentPhenotype, savePhenotype, phenotypes } = usePhenotypes()
    currentPhenotype.value.name = 'pheno'

    const res = await savePhenotype(false)
    expect(res?.id).toBe('ph1')
    expect(phenotypes.value[0].id).toBe('ph1')
  })
})
