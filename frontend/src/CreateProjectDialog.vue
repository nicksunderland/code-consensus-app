<script setup>
import { useProjects } from '@/composables/useProjects.js'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'

// --- Directly use the composables ---
const { projects } = defineProps({
  projects: { type: Object, required: true },
})

// destructure top-level refs for v-model:visible to prevent warning on type
const { showProjectDialog } = projects

</script>

<template>
  <Dialog
    header="Create Project"
    v-model:visible="showProjectDialog"
    modal
    :closable="true"
    appendTo="self"
    style="width: 500px"
  >
    <div class="field">
      <label>Project Name</label>
      <InputText v-model="projects.projectForm.name" placeholder="Enter project name"/>
    </div>

    <div class="field mt-3">
      <label>Description</label>
      <Textarea v-model="projects.projectForm.description" rows="3" placeholder="Enter description"/>
    </div>

    <div class="field mt-3">
      <label>Invite Members (emails)</label>
      <div v-for="(email, index) in projects.projectForm.emails" :key="index" class="flex gap-2 mb-2">
        <InputText v-model="projects.projectForm.emails[index]" placeholder="user@example.com"/>
        <Button icon="pi pi-times" class="p-button-danger p-button-text" @click="projects.projectForm.emails.splice(index, 1)"/>
      </div>
      <Button label="Add Email" icon="pi pi-plus" class="p-button-text" @click="projects.projectForm.emails.push('')"/>
    </div>

    <div class="dialog-footer flex justify-center w-full gap-2">
      <Button label="Cancel" icon="pi pi-times" class="p-button-text" @click="projects.closeDialog()"/>
      <Button
        label="Create"
        icon="pi pi-check"
        @click="projects.saveProject()"
      />
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