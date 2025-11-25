import { ref, reactive } from 'vue'
import { supabase } from '@/composables/useSupabase'
import { useAuth } from '@/composables/useAuth.js'
import { useNotifications } from './useNotifications'
import { useCodeSelection } from "@/composables/useCodeSelection.js";
import { useTreeSearch } from "@/composables/useTreeSearch.js";

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
        // console.log(projectForm)
        isEditing.value = true
        showProjectDialog.value = true
    }

    function closeDialog() {
        isEditing.value = false
        showProjectDialog.value = false
    }

    // ---------------------------------------
    // CREATE / UPDATE PROJECT
    // ---------------------------------------
    async function saveProject(update = false) {
        if (!auth.user.value) {
            emitError('Not Authenticated', 'Please log in to save projects.')
            return null
        }
        if (!projectForm.name.trim()) {
            emitError('Missing Project Name', 'Please enter a name.')
            return null
        }

        // resolve emails to IDs
        const emailList = projectForm.member_emails || [];
        const idPromises = emailList.map(email => auth.getUserId(email));
        const resolvedIds = await Promise.all(idPromises);
        const invalidEmails = emailList.filter((_, index) => !resolvedIds[index]);

        // stop if there are invalid emails
        if (invalidEmails.length > 0) {
            const errorMsg = `The following emails are not registered users: ${invalidEmails.join(', ')}. Remove them and try again.`;
            emitError('Member Lookup Failed', errorMsg);
            return null;
        }
        projectForm.member_ids = resolvedIds;

        try {
            let data
            // ---------------------------------------------------
            // UPDATE EXISTING PROJECT
            // ---------------------------------------------------
            if (update && currentProject.value) {

                // console.log('Updating project with form data:', projectForm);

                const res = await supabase
                    .from('projects')
                    .update({
                        name: projectForm.name,
                        description: projectForm.description || ''
                    })
                    .eq('id', currentProject.value.id)
                    .select()
                    .single()

                // console.log('Pre-save project:', res);

                if (res.error) return emitError('Failed to fetch project data', res.error)
                data = res.data

                // --- add/delete members ---
                const currentMemberIds = currentProject.value.project_members.map(m => m.user_id)
                // console.log('Current member IDs:', currentMemberIds)

                const formMemberIds = projectForm.member_ids;
                // console.log('Form member IDs:', formMemberIds)

                const toDelete = currentMemberIds.filter(id => !formMemberIds.includes(id))
                // console.log('Member IDs to delete:', toDelete)

                const toAdd = formMemberIds.filter(id => !currentMemberIds.includes(id))
                // console.log('Member IDs to add:', toAdd)

                if (toDelete.length) {
                    const { error: delError } = await supabase
                        .from('project_members')
                        .delete()
                        .eq('project_id', currentProject.value.id)
                        .in('user_id', toDelete)
                    if (delError) return emitError('Failed to remove members', delError)
                }

                if (toAdd.length) {
                    const insertData = toAdd.map(user_id => ({
                        project_id: currentProject.value.id,
                        user_id,
                        role: 'member'
                    }))
                    const { error: addError } = await supabase
                        .from('project_members')
                        .insert(insertData)
                    if (addError) return emitError('Failed to add members', 'ensure the emails are associated with user accounts.')
                }

                // Fetch updated members from DB so project_members is always present
                const { data: updatedProject, error: updatedProjectError } = await supabase
                    .from('projects')
                    .select(`
                        id,
                        name,
                        description,
                        owner,
                        project_members(
                            user_id, 
                            role, 
                            email:user_profiles(
                                email
                            )
                        )
                    `)
                    .eq('id', currentProject.value.id)
                    .single()

                // console.log('Fetched post-save project:', updatedProject);

                if (updatedProjectError) return emitError('Failed to fetch updated project', updatedProjectError)

                // flatten returned data for local project
                updatedProject.project_members = updatedProject.project_members.map(pm => {
                    const emailObj = pm.email;
                    return {
                        ...pm,
                        // Flatten 'user_profiles: { email: "..." }' to just 'email: "..."'
                        email: emailObj ? emailObj.email : null
                    };
                });

                data = updatedProject

                // --- update local state ---
                const index = projects.value.findIndex(p => p.id === data.id)
                if (index !== -1) projects.value[index] = data
                currentProject.value = data

                // console.log('Post-update local project:', currentProject.value);

                emitSuccess('Project Updated', `Project "${data.name}" updated.`)
                closeDialog()
                return data
            }

            // ---------------------------------------------------
            // CREATE NEW PROJECT
            // ---------------------------------------------------
            const res = await supabase
                .from('projects')
                .insert({
                    name: projectForm.name,
                    description: projectForm.description || '',
                    owner: auth.user.value.id
                })
                .select()
                .single()

            if (res.error) {
                if (res.error.code === '23505') {
                    return emitError('Project Name Taken', 'Please choose a different project name.')
                }
                return emitError('Failed to create project', res.error)
            }

            data = res.data
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

                if (!profiles.length) return emitError('No valid member emails', 'No user accounts matched the emails you entered.')

                const insertData = profiles.map(profile => ({
                    project_id: projectId,
                    user_id: profile.user_id,
                    role: 'member'
                }))
                await supabase.from('project_members').insert(insertData)
            }

            // Fetch full project with members after creation
            const { data: fullProject, error: fullProjectError } = await supabase
                .from('projects')
                .select(`
                    id,
                    name,
                    description,
                    owner,
                    project_members(user_id, role, email:user_profiles(email))
                `)
                .eq('id', projectId)
                .single()

            if (fullProjectError) return emitError('Failed to fetch new project', fullProjectError)

            // flatten returned data for local project
            fullProject.project_members = fullProject.project_members.map(pm => {
                const emailObj = pm.email;
                return {
                    ...pm,
                    // Flatten 'user_profiles: { email: "..." }' to just 'email: "..."'
                    email: emailObj ? emailObj.email : null
                };
            });

            // --- update client-side state NOW ---
            currentProject.value = fullProject;
            projects.value.push(fullProject);

            // console.log('Newly created project:', currentProject.value);

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
                project_members!inner(user_id, role)
            `)
            .eq('project_members.user_id', auth.user.value.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Raw Supabase error:', error);
            return emitError('Failed to load projects', error)
        } else {
            // console.log('User ID:', auth.user.value.id);
            // console.log('Raw Supabase fetchProjects:', data);
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
            // console.log('Raw Supabase fetchMembers:', memberRows);
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

    async function deleteProject() {
        if (!currentProject.value) return;
        if (currentProject.value.owner !== auth.user.value.id) {
            emitError('Unauthorized', 'You must be the project owner to delete this project.');
            return;
        }

        const projectId = currentProject.value.id;
        const projectName = currentProject.value.name;
        // console.log("Deleting project:", currentProject.value);

        try {
            // Delete project from DB (cascades to project_members if FK has ON DELETE CASCADE)
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) {
                emitError('Failed to delete project', error.message);
                return;
            }

            // Clear local state
            projects.value = projects.value.filter(p => p.id !== projectId); // remove just the deleted project
            if (currentProject.value?.id === projectId) {
                currentProject.value = projects.value[0] || null; // set first project or null
            }

            emitSuccess('Project Deleted', `Project "${projectName}" deleted.`);
            closeDialog();                   // close modal if open

        } catch (err) {
            emitError('Unexpected Error', err.message);
        }
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
        emptyProjects,
        deleteProject
    }
}