import { ref, computed } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useNotifications } from './useNotifications'

// required composables
const { emitError, emitSuccess } = useNotifications()

// globals - these are set once in memory
const user = ref(null)
const currentDialog = ref(null)

// Keep session in sync after redirect login
supabase.auth.onAuthStateChange(async (event, session) => {
    user.value = session?.user || null
})

// export
export function useAuth() {

    // Helper functions to manipulate dialog
    function openLogin() {
        currentDialog.value = 'login'
    }

    function openSignup() {
        currentDialog.value = 'signup'
    }

    function openMagic() {
        currentDialog.value = 'magic'
    }

    function closeDialog() {
        currentDialog.value = null
    }

    // Auth methods
    async function loginGoogle() {
        const {error} = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {redirectTo: window.location.origin}
        })
        if (error) emitError('Google Login Failed', error)
    }

    async function loginGitHub() {
        const {error} = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {redirectTo: window.location.origin}
        })
        if (error) emitError('GitHub Login Failed', error)
    }

    async function loginEmailPassword(email, password) {
        const {error} = await supabase.auth.signInWithPassword({email, password})
        if (error) {
            emitError('Login Failed', error)
            return false
        }
        return true
    }

    async function signupEmail(email, password) {
        const {error} = await supabase.auth.signUp({email, password})
        if (error) {
            emitError('Signup Failed', error)
            return false
        }
        emitSuccess('Check your email', 'Please verify your email address to complete the signup process.')
        return true

    }

    async function loginMagicLink(email) {
        const {error} = await supabase.auth.signInWithOtp({
            email,
            options: {emailRedirectTo: window.location.origin}
        })
        if (error) {
            emitError('Magic Link Failed', error)
            return false
        }
        return true
    }

    async function logout() {
        const {error} = await supabase.auth.signOut()
        if (error) emitError('Logout Failed', error)
    }

    async function getUserId(email) {
        const trimmedEmail = email.trim();
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('email', trimmedEmail)
            .single();

        if (error) {
            console.error('Error fetching user ID:', error);
            return null;
        }

        return data.user_id;
    }

    return {
        // state
        user,
        currentDialog,

        // functions
        openLogin,
        openSignup,
        openMagic,
        closeDialog,
        signupEmail,
        loginGoogle,
        loginGitHub,
        loginEmailPassword,
        loginMagicLink,
        logout,
        getUserId
    }
}
