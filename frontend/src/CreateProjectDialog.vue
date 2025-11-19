<script setup>
import { useProjects } from '@/composables/useProjects.js'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import FloatLabel from "primevue/floatlabel";

// --- use composable ---
const {
  showProjectDialog,
  isEditing,
  projectForm,
  closeDialog,
  saveProject
} = useProjects()

</script>

<template>
  <Dialog
    :header="isEditing ? 'Edit Project' : 'Create Project'"
    v-model:visible="showProjectDialog"
    modal
    :closable="true"
    appendTo="self"
    style="width: 500px"
  >
    <FloatLabel variant="on" class="label-input-div">
      <InputText v-model="projectForm.name" inputId="project_name" fluid/>
      <label for="project_name">Project Name</label>
    </FloatLabel>

    <FloatLabel variant="on" class="label-input-div">
      <Textarea v-model="projectForm.description" rows="5" inputId="project_desc" fluid/>
      <label for="project_desc">Description</label>
    </FloatLabel>

    <div class="label-input-div">
      <label class="project-dialog-label">Members</label>
      <div v-for="(email, index) in projectForm.member_emails" :key="index" class="email-row">
        <InputText
            v-model="projectForm.member_emails[index]"
            :disabled="projectForm.member_ids[index] === projectForm.owner"
            placeholder="user@example.com"
            class="email-input"
            fluid
        />
        <Button
            icon="pi pi-times"
            severity="danger"
            rounded variant="outlined"
            :disabled="projectForm.member_ids[index] === projectForm.owner"
            size="small"
            @click="
                projectForm.member_emails.splice(index, 1);
                projectForm.member_ids.splice(index, 1);
                projectForm.member_roles.splice(index, 1)
            "
        />
      </div>
      <Button
          label="Add Email"
          icon="pi pi-plus"
          class="p-button-text"
          @click="
              projectForm.member_emails.push('');
              projectForm.member_ids.push(null);
              projectForm.member_roles.push('member')
          "
          style="margin-top: 0.5rem"
      />
    </div>

    <div class="dialog-footer flex justify-center w-full gap-2">
      <Button
          label="Cancel"
          icon="pi pi-times"
          class="p-button-text"
          @click="closeDialog()"/>
      <Button
        :label="isEditing ? 'Update' : 'Create'"
        icon="pi pi-check"
        @click="saveProject()"
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
  margin-top: 0.5rem;
}

.email-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.1rem;
}

.email-input {
  flex: 1;        /* <-- makes input expand automatically */
  min-width: 0;   /* <-- prevents overflow on small screens */
}

.dialog-footer {
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
  gap: 1rem;
  margin-top: 1rem;
}
</style>