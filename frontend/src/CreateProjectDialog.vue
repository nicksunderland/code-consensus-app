<script setup>
import { ref, computed, watch } from 'vue';
import { useProjects } from '@/composables/useProjects.js'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'

// --- use composable ---
const projects = useProjects()

// --- Computed dialog visibility ---
const projectDialogVisible = computed({
  get: () => projects.showProjectDialog.value,
  set: (val) => projects.showProjectDialog.value = val
})

</script>

<template>
  <Dialog
    header="Create Project"
    v-model:visible="projectDialogVisible"
    modal
    :closable="true"
    appendTo="self"
    style="width: 500px"
  >
    <div class="label-input-div">
      <label class="project-dialog-label">Project Name</label>
      <InputText v-model="projects.projectForm.name" placeholder="Enter project name"/>
    </div>

    <div class="label-input-div">
      <label class="project-dialog-label">Description</label>
      <Textarea v-model="projects.projectForm.description" rows="5" placeholder="Enter description"/>
    </div>

    <div class="label-input-div">
      <label class="project-dialog-label">Invite Members (emails)</label>
      <div v-for="(email, index) in projects.projectForm.member_emails" :key="index" class="email-row">
        <InputText
            v-model="projects.projectForm.member_emails[index]"
            :disabled="projects.projectForm.member_ids[index] === projects.projectForm.owner"
            placeholder="user@example.com"
            class="email-input"
        />
        <Button
            icon="pi pi-times"
            severity="danger"
            rounded variant="outlined"
            :disabled="projects.projectForm.member_ids[index] === projects.projectForm.owner"
            size="small"
            @click="
                projects.projectForm.member_emails.splice(index, 1);
                projects.projectForm.member_ids.splice(index, 1);
                projects.projectForm.member_roles.splice(index, 1)
            "
        />
      </div>
      <Button
          label="Add Email"
          icon="pi pi-plus"
          class="p-button-text"
          @click="
              projects.projectForm.member_emails.push('');
              projects.projectForm.member_ids.push(null);
              projects.projectForm.member_roles.push('member')
          "
      />
    </div>

    <div class="dialog-footer flex justify-center w-full gap-2">
      <Button
          label="Cancel"
          icon="pi pi-times"
          class="p-button-text"
          @click="projects.closeDialog()"/>
      <Button
        :label="projects.isEditing ? 'Update' : 'Create'"
        icon="pi pi-check"
        @click="projects.saveProject()"
      />
    </div>
  </Dialog>
</template>

<style scoped>
.project-dialog-label {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.2rem;
}

.label-input-div {
  flex-direction: column;
  display: flex;
  margin-bottom: 1rem;
}

.email-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.email-input {
  flex: 1;        /* <-- makes input expand automatically */
  min-width: 0;   /* <-- prevents overflow on small screens */
}

.dialog-footer {
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>