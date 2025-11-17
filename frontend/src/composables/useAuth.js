import { ref, computed } from 'vue'
import { supabase } from '@/composables/useSupabase.js'


// globals
const user = ref(null)
const currentDialog = ref(null)


// Keep session in sync after redirect login
supabase.auth.onAuthStateChange(async (event, session) => {
  user.value = session?.user || null
})


export function useAuth({ toast }) {

  // Helper for error notifications
  function showError(summary, error) {
    toast.add({
      severity: 'error',
      summary,
      detail: error?.message || String(error)
    })
  }

  // Auth state checking
  const isLoggedIn = computed(() => !!user.value)

  // Helper functions to manipulate dialog
  function openLogin() { currentDialog.value = 'login' }
  function openSignup() { currentDialog.value = 'signup' }
  function openMagic() { currentDialog.value = 'magic' }
  function closeDialog() { currentDialog.value = null }

  // Auth methods
  async function loginGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) showError('Google Login Failed', error)
  }

  async function loginGitHub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin }
    })
    if (error) showError('GitHub Login Failed', error)
  }

  async function loginEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      showError('Login Failed', error)
      return false
    }
    return true
  }

  async function signupEmail(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      showError('Signup Failed', error)
      return false
    }
    toast.add({
      severity: 'success',
      summary: 'Check your inbox',
      detail: 'Please confirm your email before logging in.'
    })
    return true
  }

  async function loginMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) {
      showError('Magic Link Failed', error)
      return false
    }
    toast.add({
      severity: 'info',
      summary: 'Magic link sent!',
      detail: `Check ${email} for your login link`
    })
    return true
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) showError('Logout Failed', error)
  }

  return {
    user,
    isLoggedIn,
    currentDialog,
    openLogin,
    openSignup,
    openMagic,
    closeDialog,
    signupEmail,
    loginGoogle,
    loginGitHub,
    loginEmailPassword,
    loginMagicLink,
    logout
  }
}
