<script setup>
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import FloatLabel from 'primevue/floatlabel'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { useAuth } from '@/composables/auth/useAuth.js'

// --- composables ---
const {
  currentDialog,
  closeDialog,
  loginEmailPassword,
  signupEmail,
  loginMagicLink,
  loginGoogle,
  loginGitHub
} = useAuth()

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
  get: () => currentDialog.value === 'login',
  set: val => { if (!val) closeDialog() }
})
const magicVisible = computed({
  get: () => currentDialog.value === 'magic',
  set: val => { if (!val) closeDialog() }
})
const signupVisible = computed({
  get: () => currentDialog.value === 'signup',
  set: val => { if (!val) closeDialog() }
})

// --- Actions ---
const login = async () => {
  const { email, password } = loginForm.value
  if (!email || !password) return
  const success = await loginEmailPassword(email, password)
  if (success) {
    loginForm.value = { email: '', password: '' }
    closeDialog()
  }
}

const signup = async () => {
  const { email, password } = signupForm.value
  if (!email || !password) return
  const success = await signupEmail(email, password)
  if (success) {
    signupForm.value = { email: '', password: '' }
    closeDialog()
  }
}

const magicLogin = async () => {
  const { email } = magicForm.value
  if (!email) return
  const success = await loginMagicLink(email)
  if (success) {
    magicForm.value = { email: '' }
    closeDialog()
  }
}
</script>

<template>
  <!-- LOGIN DIALOG -->
  <Dialog v-model:visible="loginVisible" header="Login" modal :style="{ width: '450px', maxWidth: '90%' }">
    <div class="p-fluid flex flex-col gap-3">
      <div class="field">
        <FloatLabel variant="on">
          <InputText v-model="loginForm.email" inputId="email_login" fluid/>
          <label for="email_login">Email</label>
        </FloatLabel>
      </div>
      <div class="field">
        <FloatLabel variant="on">
          <Password v-model="loginForm.password" inputId="password_login" toggleMask showClear fluid :feedback="false"/>
          <label for="password_login">Password</label>
        </FloatLabel>
      </div>

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Cancel" class="p-button-text" @click="closeDialog" />
        <Button label="Login" @click="login" />
      </div>

      <Divider />

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Magic Link" icon="pi pi-link" @click="magicLogin" class="p-button-text" />
        <Button label="Google" icon="pi pi-google" @click="loginGoogle" class="p-button-text" />
        <Button label="GitHub" icon="pi pi-github" @click="loginGitHub" class="p-button-text" />
      </div>
    </div>
  </Dialog>

  <!-- MAGIC LINK DIALOG -->
  <Dialog v-model:visible="magicVisible" header="Magic Link" modal :style="{ width: '450px', maxWidth: '90%' }">
    <div class="p-fluid flex flex-col gap-3">
      <div class="field">
        <FloatLabel variant="on">
          <InputText v-model="magicForm.email" inputId="email_magic" fluid/>
          <label for="email_magic">Email</label>
        </FloatLabel>
      </div>
      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Cancel" class="p-button-text" @click="closeDialog" />
        <Button label="Send Magic Link" icon="pi pi-link" @click="magicLogin" class="p-button-text" />
      </div>

      <Divider />

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Google" icon="pi pi-google" @click="loginGoogle" class="p-button-text" />
        <Button label="GitHub" icon="pi pi-github" @click="loginGitHub" class="p-button-text" />
      </div>
    </div>
  </Dialog>

  <!-- SIGNUP DIALOG -->
  <Dialog v-model:visible="signupVisible" header="Sign Up" modal :style="{ width: '450px', maxWidth: '90%' }">
    <div class="p-fluid flex flex-col gap-3">
      <div class="field">
        <FloatLabel variant="on">
          <InputText v-model="signupForm.email" inputId="email" fluid/>
          <label for="email">Email</label>
        </FloatLabel>
      </div>
      <div class="field">
        <FloatLabel variant="on">
          <Password v-model="signupForm.password" inputId="password" toggleMask showClear fluid :feedback="false"/>
          <label for="password">Password</label>
        </FloatLabel>
      </div>

      <div class="dialog-footer flex justify-center w-full gap-2">
        <Button label="Cancel" class="p-button-text" @click="closeDialog" />
        <Button label="Create Account" @click="signup" />
      </div>
    </div>

  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5rem;
  gap: 1rem;
  margin-top: 0.5rem;
}

.dialog-footer {
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  gap: 1rem;
  margin-top: 1rem;
}
</style>