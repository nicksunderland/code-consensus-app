import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createNotificationsMock } from '../../../test/mocks/notifications.mock.js'

vi.mock('../shared/useNotifications.js', () => createNotificationsMock())

vi.mock('@/composables/shared/useSupabase.js', () => {
  const supabaseAuth = {
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn()
  }
  return { supabase: { auth: supabaseAuth } }
})

const supabaseModule = await import('@/composables/shared/useSupabase.js')
import { useAuth } from './useAuth.js'

describe('useAuth', () => {
  beforeEach(() => {
    Object.values(supabaseModule.supabase.auth).forEach(fn => fn.mockReset?.())
  })

  it('returns false on failed email login', async () => {
    supabaseModule.supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'bad' } })
    const { loginEmailPassword } = useAuth()
    const ok = await loginEmailPassword('a', 'b')
    expect(ok).toBe(false)
  })

  it('returns true on successful signup/login', async () => {
    supabaseModule.supabase.auth.signUp.mockResolvedValueOnce({ error: null })
    const { signupEmail } = useAuth()
    const ok = await signupEmail('a', 'b')
    expect(ok).toBe(true)
  })
})
