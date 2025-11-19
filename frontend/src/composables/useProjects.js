import { ref, reactive } from 'vue'
import { supabase } from '@/composables/useSupabase'
import { useAuth } from '@/composables/useAuth.js'
import { useNotifications } from './useNotifications'

// globals - these are set once in memory
/**
 * @typedef {Object} currentProject
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} [owner]
 * @property {string} [created_at]
 * @property {string[]} [members]
 */
/** @type {import('vue').Ref<Project|null>} */
const currentProject = ref(null)
const projects = ref([])
const showProjectDialog = ref(false)
const isEditing = ref(false)
const projectForm = reactive({
    name: '',
    description: '',
    owner: '',
    member_emails: [],
    member_ids: [],
    member_roles: []
})


export function useProjects() {
    // Get dependencies inside the composable function
    const auth = useAuth()
    const { emitError, emitSuccess } = useNotifications()

    function resetForm() {
        projectForm.name = ''
        projectForm.description = ''
        projectForm.owner = ''
        projectForm.member_emails = []
        projectForm.member_ids = []
        projectForm.member_roles = []
    }

    function openCreateDialog() {
        resetForm()
        isEditing.value = false
        showProjectDialog.value = true
    }

    function openEditDialog() {
        if (!currentProject.value) return
        if (currentProject.value.owner !== auth.user.value.id) {
            emitError('Unable to edit', 'You do not own this project.')
            return
        }
        projectForm.name = currentProject.value.name
        projectForm.description = currentProject.value.description || ''
        projectForm.owner = currentProject.value.owner
        projectForm.member_emails = currentProject.value.project_members.map(m => m.email)
        projectForm.member_ids = currentProject.value.project_members.map(m => m.user_id)
        projectForm.member_roles = currentProject.value.project_members.map(m => m.role)
        console.log(projectForm)
        isEditing.value = true
        showProjectDialog.value = true
    }

    function closeDialog() {
        showProjectDialog.value = false
    }

    // ---------------------------------------
    // CREATE / UPDATE PROJECT
    // ---------------------------------------
    async function saveProject() {
        if (!projectForm.name.trim()) {
            emitError('Missing Project Name', 'Please enter a name.')
            return null
        }
        if (!auth.user.value) return null

        try {
            // ---------------------------------------------------
            // UPDATE EXISTING PROJECT
            // ---------------------------------------------------
            if (isEditing.value && currentProject.value) {

                const { data, error } = await supabase
                    .from('projects')
                    .update({
                        name: projectForm.name,
                        description: projectForm.description || ''
                    })
                    .eq('id', currentProject.value.id)
                    .select()
                    .single()

                if (error) return emitError('Failed to update project', error)

                // --- delete removed members ---
                const currentMemberIds = currentProject.value.members.map(m => m.user_id)
                const formMemberIds = projectForm.member_ids
                const toDelete = currentMemberIds.filter(id => !formMemberIds.includes(id))

                if (toDelete.length) {
                    const { error: delError } = await supabase
                        .from('project_members')
                        .delete()
                        .eq('project_id', currentProject.value.id)
                        .in('user_id', toDelete)

                    if (delError) return emitError('Failed to remove members', delError)
                }

                // --- update local state ---
                const index = projects.value.findIndex(p => p.id === data.id)
                if (index !== -1) projects.value[index] = data
                currentProject.value = data

                emitSuccess('Project Updated', `Project "${data.name}" updated.`)
                closeDialog()
                return data
            }

            // ---------------------------------------------------
            // CREATE NEW PROJECT
            // ---------------------------------------------------
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name: projectForm.name,
                    description: projectForm.description || '',
                    owner: auth.user.value.id
                })
                .select()
                .single()

            if (error) {
                if (error.code === '23505') {
                    return emitError('Project Name Taken', 'Please choose a different project name.')
                }
                return emitError('Failed to create project', error)
            }

            const projectId = data.id

            // --- Add owner as member ---
            await supabase.from('project_members').insert({
                project_id: projectId,
                user_id: auth.user.value.id,
                role: 'owner'
            })

            // --- Add additional member emails ---
            const trimmedEmails = projectForm.member_emails
                .map(e => e.trim())
                .filter(e => e !== '' && e !== auth.user.value.email)

            if (trimmedEmails.length) {

                const { data: profiles, error: profileErr } = await supabase
                    .from('user_profiles')
                    .select('user_id, email')
                    .in('email', trimmedEmails)

                if (profileErr) {
                    return emitError('Failed to fetch user IDs for emails', profileErr)
                }

                if (!profiles.length) {
                    return emitError(
                        'No valid member emails',
                        'No user accounts matched the emails you entered.'
                    )
                }

                const insertData = profiles.map(profile => ({
                    project_id: projectId,
                    user_id: profile.user_id,
                    role: 'member'
                }))

                await supabase.from('project_members').insert(insertData)
            }

            // --- update client-side state NOW ---
            projects.value.push(data)
            currentProject.value = data

            emitSuccess("Project Created", `Project "${data.name}" created.`)
            closeDialog()
            return data

        } catch (err) {
            emitError('Unexpected Error', err)
            return null
        }
    }


    // ---------------------------------------
    // FETCH PROJECTS / MEMBERS
    // ---------------------------------------
    async function fetchProjects() {
        if (!auth.user.value) return

        const { data, error } = await supabase
            .from('projects')
            .select(`
                id,
                name,
                created_at,
                owner,
                project_members(user_id, role)
            `)
            .eq('project_members.user_id', auth.user.value.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Raw Supabase error:', error);
            return emitError('Failed to load projects', error)
        } else {
            console.log('Raw Supabase fetchProjects:', data);
        }

        projects.value = data

        if (!currentProject.value && data.length > 0) {
            currentProject.value = data[0]
            await fetchMembers(data[0].id)
        }
    }

    async function fetchMembers() {
        if (!currentProject.value) return

        const projectId = currentProject.value.id

        // 1. Fetch raw members (user_id + role)
        const { data: memberRows, error: memberError } = await supabase
            .from('project_members')
            .select(`
                user_id,
                role, 
                user_profiles(email)
            `)
            .eq('project_id', projectId)

        if (memberError) {
            return emitError('Failed to load members', memberError)
        } else {
            console.log('Raw Supabase fetchMembers:', memberRows);
        }

        // If no members found
        if (!memberRows || memberRows.length === 0) {
            currentProject.value.project_members = []
            return
        }

        // 2. Merge member profiles into project
        currentProject.value.project_members = memberRows.map(m => ({
          user_id: m.user_id,
          role: m.role,
          email: m.user_profiles?.email ?? null
        }))
    }

    async function selectProject(project) {
        if (!project) return
        currentProject.value = project
        await fetchMembers(project.id)
    }

    function emptyProjects() {
        projects.value = []
        currentProject.value = null
    }

    return {
        // state
        projects,
        currentProject,
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
        selectProject,
        emptyProjects
    }
}