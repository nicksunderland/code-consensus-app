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

  it('only lets the creator or the project owner delete', () => {
    const { currentPhenotype, canDeletePhenotype } = usePhenotypes()
    currentProject.value = { id: 'proj-1', owner: 'owner-1' }

    // unsaved phenotype
    currentPhenotype.value = { id: '', user_id: '', name: 'new' }
    expect(canDeletePhenotype.value).toBe(false)

    // someone else's phenotype, in someone else's project
    currentPhenotype.value = { id: 'ph1', user_id: 'other', name: 'Cholera' }
    expect(canDeletePhenotype.value).toBe(false)

    // creator
    currentPhenotype.value = { id: 'ph1', user_id: 'user-1', name: 'Cholera' }
    expect(canDeletePhenotype.value).toBe(true)

    // project owner
    authUser.value = { id: 'owner-1' }
    currentPhenotype.value = { id: 'ph1', user_id: 'other', name: 'Cholera' }
    expect(canDeletePhenotype.value).toBe(true)

    // logged out
    authUser.value = null
    expect(canDeletePhenotype.value).toBe(false)
  })
})
