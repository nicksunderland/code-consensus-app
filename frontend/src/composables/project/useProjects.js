import { ref, reactive } from 'vue'
import { supabase } from '@/composables/shared/useSupabase.js'
import { useAuth } from '@/composables/auth/useAuth.js'
import { useNotifications } from '../shared/useNotifications.js'

// the structure of a project object
/**
 * @typedef {Object} ProjectMember
 * @property {string} user_id
 * @property {string} name
 * @property {string} role
 * @property {string} email
 * @property {string} added_at
 */
/**
 * @typedef {Object} currentProject
 * @property {string} id
 * @property {string} owner
 * @property {string} name
 * @property {string|null} [description]
 * @property {string[]} [member_ids]
 * @property {ProjectMember[]} [member_data]
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

    // ---------------------------------------
    // PROJECT DIALOG HANDLERS
    // ---------------------------------------
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
        projectForm.member_ids = [...(currentProject.value.member_ids || [])]
        projectForm.member_emails = currentProject.value.member_data?.map(m => m.email).filter(Boolean) || []
        projectForm.member_roles = currentProject.value.member_data?.map(m => m.role) || []
        isEditing.value = true
        showProjectDialog.value = true
    }

    function closeDialog() {
        isEditing.value = false
        showProjectDialog.value = false
    }

    // ---------------------------------------
    // FETCH PROJECTS
    // ---------------------------------------
    async function fetchProjects() {
        if (!auth.user.value) return

        const { data, error } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            return emitError('Failed to load projects', error)
        }

        projects.value = data

        if (!currentProject.value && data.length > 0) {
            currentProject.value = data[0]
        }

    }

    // ---------------------------------------
    // CREATE / UPDATE PROJECT
    // ---------------------------------------
    async function saveProject(update = false) {
        if (!auth.user.value) {
            emitError('Not Authenticated', 'Please log in to save projects.');
            return null;
        }

        if (!projectForm.name.trim()) {
            emitError('Missing Project Name', 'Please enter a project name.');
            return null;
        }

        // ------------------------------------
        // Resolve emails → user_ids
        // ------------------------------------
        const emailList = projectForm.member_emails || [];
        const idPromises = emailList.map(email => auth.getUserId(email));
        const resolvedIds = await Promise.all(idPromises);

        const invalidEmails = emailList.filter((_, i) => !resolvedIds[i]);
        if (invalidEmails.length > 0) {
            emitError(
                'Member Lookup Failed',
                `These emails are not registered users: ${invalidEmails.join(', ')}`
            );
            return null;
        }

        projectForm.member_ids = resolvedIds;

        try {

            // =====================================================
            // UPDATE PROJECT
            // =====================================================
            if (update && currentProject.value) {
                const projectId = currentProject.value.id;

                const ownerId = auth.user.value.id;
                const memberSet = new Set(projectForm.member_ids);
                memberSet.add(ownerId);

                const { data: memberProfiles, error: profileErr } = await supabase
                    .from('user_profiles')
                    .select('user_id, full_name, email')
                    .in('user_id', Array.from(memberSet));

                if (profileErr) {
                    emitError('Failed to resolve member profiles', profileErr);
                    return null;
                }

                const memberData = Array.from(memberSet).map(id => {
                    const profile = memberProfiles?.find(p => p.user_id === id);
                    const existing = currentProject.value.member_data?.find(m => m.user_id === id);
                    return {
                        user_id: id,
                        name: profile?.full_name || existing?.name || '',
                        email: profile?.email || existing?.email || '',
                        role: id === ownerId ? 'owner' : (existing?.role || 'member'),
                        added_at: existing?.added_at || new Date().toISOString()
                    };
                });

                const { data: updated, error: updateErr } = await supabase
                    .from('projects')
                    .update({
                        name: projectForm.name,
                        description: projectForm.description || '',
                        member_ids: Array.from(memberSet),
                        member_data: memberData
                    })
                    .eq('id', projectId)
                    .select()
                    .single();

                if (updateErr) {
                    emitError('Failed to update project', updateErr);
                    return null;
                }

                const index = projects.value.findIndex(p => p.id === updated.id);
                if (index !== -1) projects.value[index] = updated;

                currentProject.value = updated;

                emitSuccess('Project Updated', `Project "${updated.name}" updated.`);
                closeDialog();
                return updated;
            }

            // =====================================================
            // CREATE PROJECT
            // =====================================================
            const ownerId = auth.user.value.id;
            const memberSet = new Set(projectForm.member_ids);
            memberSet.add(ownerId);

            const { data: memberProfiles, error: profileErr } = await supabase
                .from('user_profiles')
                .select('user_id, full_name, email')
                .in('user_id', Array.from(memberSet));

            if (profileErr) {
                emitError('Failed to resolve member profiles', profileErr);
                return null;
            }

            const memberData = Array.from(memberSet).map(id => {
                const profile = memberProfiles?.find(p => p.user_id === id);
                return {
                    user_id: id,
                    name: profile?.full_name || '',
                    email: profile?.email || '',
                    role: id === ownerId ? 'owner' : 'member',
                    added_at: new Date().toISOString()
                };
            });

            const { data: created, error: insertErr } = await supabase
                .from('projects')
                .insert({
                    name: projectForm.name,
                    description: projectForm.description || '',
                    owner: ownerId,
                    member_ids: Array.from(memberSet),
                    member_data: memberData
                })
                .select()
                .single();

            if (insertErr) {
                if (insertErr.code === '23505') {
                    emitError('Project Name Taken', 'Please choose a different project name.');
                    return null;
                }
                emitError('Failed to create project', insertErr);
                return null;
            }

            currentProject.value = created;
            projects.value.push(created);

            emitSuccess('Project Created', `Project "${created.name}" created.`);
            closeDialog();
            return created;

        } catch (err) {
            emitError('Unexpected Error', err);
            return null;
        }
    }



    async function selectProject(project) {
        if (!project) return
        currentProject.value = project
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
            // Delete project from DB
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
        selectProject,
        emptyProjects,
        deleteProject
    }
}
