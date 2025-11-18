<script setup>
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { useToast } from "primevue/usetoast";
import { useAuth } from '@/composables/useAuth.js'

// --- composables ---
const auth = useAuth()


// Forms
const loginForm = ref({
  email: '',
  password: ''
})

const signupForm = ref({
  email: '',
  password: ''
})

const magicForm = ref({
  email: ''
})

// --- Computed dialog visibility ---
const loginVisible = computed({
  get: () => auth.currentDialog.value === 'login',
  set: val => { if (!val) auth.closeDialog() }
})
const magicVisible = computed({
  get: () => auth.currentDialog.value === 'magic',
  set: val => { if (!val) auth.closeDialog() }
})
const signupVisible = computed({
  get: () => auth.currentDialog.value === 'signup',
  set: val => { if (!val) auth.closeDialog() }
})

// --- Actions ---
const login = async () => {
  const { email, password } = loginForm.value
  if (!email || !password) return
  const success = await auth.loginEmailPassword(email, password)
  if (success) {
    loginForm.value = { email: '', password: '' }
    auth.closeDialog()
  }
}

const signup = async () => {
  const { email, password } = signupForm.value
  if (!email || !password) return
  const success = await auth.signupEmail(email, password)
  if (success) {
    signupForm.value = { email: '', password: '' }
    auth.closeDialog()
  }
}

const magicLogin = async () => {
  const { email } = magicForm.value
  if (!email) return
  const success = await auth.loginMagicLink(email)
  if (success) {
    magicForm.value = { email: '' }
    auth.closeDialog()
  }
}
</script>

<template>
  <!-- LOGIN DIALOG -->
  <Dialog v-model:visible="loginVisible" header="Login" modal :style="{ width: '450px', maxWidth: '90%' }">
    <div class="p-fluid flex flex-col gap-3">
      <div class="field">
        <label>Email</label>
        <InputText v-model="loginForm.email" class="w-full"/>
      </div>
      <div class="field">
        <label>Password</label>
        <Password v-model="loginForm.password" toggleMask :style="{ width: '100%' }" :inputStyle="{ width: '100%' }" />
      </div>

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Cancel" class="p-button-text" @click="auth.closeDialog" />
        <Button label="Login" @click="login" />
      </div>

      <Divider />

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Magic Link" icon="pi pi-link" @click="magicLogin" class="p-button-text" />
        <Button label="Google" icon="pi pi-google" @click="auth.loginGoogle" class="p-button-text" />
        <Button label="GitHub" icon="pi pi-github" @click="auth.loginGitHub" class="p-button-text" />
      </div>
    </div>
  </Dialog>

  <!-- MAGIC LINK DIALOG -->
  <Dialog v-model:visible="magicVisible" header="Magic Link" modal :style="{ width: '450px', maxWidth: '90%' }">
    <div class="p-fluid flex flex-col gap-3">
      <div class="field">
        <label>Email</label>
        <InputText v-model="magicForm.email" />
      </div>
      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Cancel" class="p-button-text" @click="auth.closeDialog" />
        <Button label="Send Magic Link" icon="pi pi-link" @click="magicLogin" class="p-button-text" />
      </div>

      <Divider />

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Google" icon="pi pi-google" @click="auth.loginGoogle" class="p-button-text" />
        <Button label="GitHub" icon="pi pi-github" @click="auth.loginGitHub" class="p-button-text" />
      </div>
    </div>
  </Dialog>

  <!-- SIGNUP DIALOG -->
  <Dialog v-model:visible="signupVisible" header="Sign Up" modal :style="{ width: '450px', maxWidth: '90%' }">
    <div class="p-fluid flex flex-col gap-3">
      <div class="field">
        <label>Email</label>
        <InputText v-model="signupForm.email" />
      </div>
      <div class="field">
        <label>Password</label>
        <Password v-model="signupForm.password" toggleMask :style="{ width: '100%' }" :inputStyle="{ width: '100%' }" />
      </div>

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Cancel" class="p-button-text" @click="auth.closeDialog" />
        <Button label="Create Account" @click="signup" />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
}

.dialog-footer {
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>