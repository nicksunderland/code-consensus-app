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
const members = ref([])
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
        projectForm.member_emails = currentProject.value.members.map(m => m.email)
        projectForm.member_ids = currentProject.value.members.map(m => m.user_id)
        projectForm.member_roles = currentProject.value.members.map(m => m.role)
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
            if (isEditing.value && currentProject.value) {
                // Update existing project
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

                // handle updating emails / members here...
                const currentMemberIds = currentProject.value.members.map(m => m.user_id);
                const formMemberIds = projectForm.member_ids;
                const toDelete = currentMemberIds.filter(id => !formMemberIds.includes(id));
                if (toDelete.length) {
                    const { error: delError } = await supabase
                        .from('project_members')
                        .delete()
                        .in('user_id', toDelete)
                        .eq('project_id', currentProject.value.id);

                    if (delError) return emitError('Failed to remove members', delError);
                }

                // Update local state
                const index = projects.value.findIndex(p => p.id === data.id)
                if (index !== -1) projects.value[index] = data
                currentProject.value = data

                emitSuccess('Project Updated', `Project "${data.name}" updated successfully.`)
                closeDialog()
                return data

            } else {
                // Create new project
                const { data, error } = await supabase
                    .from('projects')
                    .insert({
                        name: projectForm.name,
                        description: projectForm.description || '',
                        owner: auth.user.value.id
                    })
                    .select()
                    .single()

                if (error) return emitError('Failed to create project', error)

                // Add owner as member
                await supabase.from('project_members').insert({
                    project_id: data.id,
                    user_id: auth.user.value.id,
                    role: 'owner'
                })

                // // Add extra emails
                // if (projectForm.emails?.length) {
                //     const insertData = projectForm.emails.map(email => ({
                //         project_id: data.id,
                //         user_id: email, // adjust mapping to actual user_id
                //         role: 'member'
                //     }))
                //     await supabase.from('project_members').insert(insertData)
                // }

                // Update local state
                projects.value.push(data)
                currentProject.value = data
                members.value = [{ user_id: auth.user.value.id, role: 'owner' }]

                emitSuccess('Project Created', `Project "${data.name}" created successfully.`)
                closeDialog()
                return data
            }
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
                project_members!inner (user_id, role)
            `)
            .eq('project_members.user_id', auth.user.value.id)
            .order('created_at', { ascending: true })

        if (error) return emitError('Failed to load projects', error)

        projects.value = data

        if (!currentProject.value && data.length > 0) {
            currentProject.value = data[0]
            await fetchMembers(data[0].id)
        }
    }

    async function fetchMembers(projectId) {
        if (!projectId) return

        // 1. Fetch raw members (user_id + role)
        const { data: memberRows, error: memberError } = await supabase
            .from('project_members')
            .select(`
                user_id,
                role
            `)
            .eq('project_id', projectId)

        if (memberError) return emitError('Failed to load members', memberError)

        // If no members found
        if (!memberRows || memberRows.length === 0) {
            currentProject.value.members = []
            return
        }

        // 2. Fetch user profiles for all member IDs
        const userIds = memberRows.map(m => m.user_id)

        const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select(`user_id, email, created_at`)
            .in('user_id', userIds)

        if (profileError)
            return emitError('Failed to load member profiles', profileError)

        // 3. Merge profile info into memberRows & attach to project
        currentProject.value.members = memberRows.map(m => ({
            ...m,
            ...profiles.find(p => p.user_id === m.user_id)   // attach email + created_at
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
        selectProject,
        emptyProjects
    }
}