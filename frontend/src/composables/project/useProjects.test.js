import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createSupabaseMock } from '../../../test/mocks/supabase.mock.js'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

vi.mock('@/composables/shared/useSupabase.js', () => {
  const supabaseMock = createSupabaseMock()
  return { supabase: supabaseMock }
})

vi.mock('../shared/useNotifications.js', () => {
  const notifications = createNotificationsMock()
  return notifications
})

// Re-import mocks for usage after hoisting
const supabaseModule = await import('@/composables/shared/useSupabase.js')
const notificationsModule = await import('../shared/useNotifications.js')

const authUser = ref(null)
vi.mock('@/composables/auth/useAuth.js', () => ({
  useAuth: () => ({ user: authUser, getUserId: vi.fn(async email => email && `id-${email}`) })
}))

import { useProjects } from './useProjects.js'

describe('useProjects', () => {
  beforeEach(() => {
    authUser.value = { id: 'user-1', email: 'me@test.com' }
    const profilesChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ user_id: 'id-friend@test.com', full_name: 'Friend', email: 'friend@test.com' }], error: null })
    }
    const projectsChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'p1', name: 'My Project', member_ids: [], member_data: [] }, error: null })
    }
    supabaseModule.supabase.from = vi.fn((table) => {
      if (table === 'user_profiles') return profilesChain
      if (table === 'projects') return projectsChain
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        update: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'Proj-updated' }], error: null }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'p1', name: 'Proj' }, error: null })
      }
    })
  })

  it('creates a project with owner/member data', async () => {
    const { projectForm, saveProject, projects, currentProject } = useProjects()
    projectForm.name = 'My Project'
    projectForm.member_emails = ['friend@test.com']

    // mock profile fetch for members
    supabaseModule.supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ user_id: 'id-friend@test.com', full_name: 'Friend', email: 'friend@test.com' }], error: null })
    })

    // insert response
    supabaseModule.supabase.from.mockReturnValueOnce(supabaseModule.supabase.from('projects'))

    const created = await saveProject(false)
    expect(created?.name).toBe('My Project')
    expect(projects.value[0].id).toBe('p1')
    expect(currentProject.value?.id).toBe('p1')
  })

  it('blocks saving without auth', async () => {
    authUser.value = null
    const { saveProject } = useProjects()
    const res = await saveProject()
    expect(res).toBeNull()
    expect(notificationsModule.emitted.errors.length).toBeGreaterThan(0)
  })
})
