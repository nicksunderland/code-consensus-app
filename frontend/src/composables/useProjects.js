import { ref, reactive } from 'vue'
import { supabase } from '@/composables/useSupabase'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '@/composables/useAuth'

// ----------------------------
// GLOBAL STATE
// ----------------------------
const projects = ref([])
const currentProject = ref(null)
const members = ref([])           // members of current project
const showProjectDialog = ref(false)
const isEditing = ref(false)
const projectForm = reactive({
  name: '',
  description: '',
  emails: []
})


export function useProjects() {
  const toast = useToast()
  const { user } = useAuth()

  // ---------------------------------------
  //  HELPERS
  // ---------------------------------------
  function showError(summary, error) {
    toast.add({
      severity: 'error',
      summary,
      detail: error?.message || String(error)
    })
  }

  function resetForm() {
    projectForm.name = ''
    projectForm.description = ''
    projectForm.emails = []
  }

  function openCreateDialog() {
      resetForm()
      isEditing.value = false
      showProjectDialog.value = true
  }
  function openEditDialog(project) {
    if (!project) return
    projectForm.name = project.name
    projectForm.description = project.description || ''
    projectForm.emails = [...(project.emails || [])]
    isEditing.value = true
    currentProject.value = project
    showProjectDialog.value = true
  }

  function closeDialog() {
      showProjectDialog.value = false
      console.log("showCreateDialog", showProjectDialog.value)
  }

// ---------------------------------------
  // CREATE / UPDATE PROJECT
  // ---------------------------------------
  async function saveProject() {

    if (!projectForm.name.trim()) {
      toast.add({ severity: 'warn', summary: 'Missing Project Name', detail: 'Please enter a name.' })
      return null
    }
    if (!user.value) return null

    if (isEditing.value && currentProject.value) {
      // -----------------------
      // UPDATE EXISTING PROJECT
      // -----------------------
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: projectForm.name,
          description: projectForm.description || ''
        })
        .eq('id', currentProject.value.id)
        .select()
        .single()

      if (error) {
        showError('Failed to update project', error)
        return null
      }

      // Optionally handle updating emails / members here...

      // Update local state
      const index = projects.value.findIndex(p => p.id === data.id)
      if (index !== -1) projects.value[index] = data
      currentProject.value = data

      toast.add({
        severity: 'success',
        summary: 'Project Updated',
        detail: `Project "${data.name}" updated successfully.`
      })

      closeDialog()
      return data

    } else {
      // -----------------------
      // CREATE NEW PROJECT
      // -----------------------
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectForm.name,
          description: projectForm.description || '',
          owner: user.value.id
        })
        .select()
        .single()

      if (error) {
        showError('Failed to create project', error)
        return null
      }

      // Add owner as member
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user.value.id,
        role: 'owner'
      })

      // Add extra emails
      if (projectForm.emails?.length) {
        const insertData = projectForm.emails.map(email => ({
          project_id: data.id,
          user_id: email, // adjust mapping to actual user_id
          role: 'member'
        }))
        await supabase.from('project_members').insert(insertData)
      }

      // Update local state
      projects.value.push(data)
      currentProject.value = data
      members.value = [{ user_id: user.value.id, role: 'owner' }]

      toast.add({
        severity: 'success',
        summary: 'Project Created',
        detail: `Project "${data.name}" created successfully.`
      })

      closeDialog()
      return data
    }
  }

  // ---------------------------------------
  // FETCH PROJECTS / MEMBERS
  // ---------------------------------------
  async function fetchProjects() {
    if (!user.value) return

    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        created_at,
        owner,
        project_members!inner (user_id, role)
      `)
      .eq('project_members.user_id', user.value.id)
      .order('created_at', { ascending: true })

    if (error) {
      showError('Failed to load projects', error)
      return
    }

    projects.value = data

    if (!currentProject.value && data.length > 0) {
      currentProject.value = data[0]
      await fetchMembers(data[0].id)
    }
  }

  async function fetchMembers(projectId) {
    if (!projectId) return

    const { data, error } = await supabase
      .from('project_members')
      .select(`
        user_id,
        role
      `)
      .eq('project_id', projectId)

    if (error) {
      showError('Failed to load members', error)
      return
    }

    members.value = data
      console.log("fetchMembers():", data)
  }

  async function selectProject(project) {
      if (!project) return
      currentProject.value = project
      await fetchMembers(project.id)
  }

  return {
    // state
    projects,
    currentProject,
    members,
    showProjectDialog,
    isEditing,
    projectForm,

    // actions
    openCreateDialog,
    openEditDialog,
    closeDialog,
    saveProject,
    fetchProjects,
    fetchMembers,
    selectProject
  }
}