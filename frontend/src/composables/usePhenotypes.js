// /src/composables/usePhenotypes.js
import { ref, computed, reactive } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useProjects } from "@/composables/useProjects.js";
import { useAuth } from "@/composables/useAuth.js";
import { useNotifications } from './useNotifications'

// globals - these are set once in memory
const phenotypes = ref([]);          // list for active project
const currentPhenotype = ref({id: '', user_id: '', name: '', description: '', project_id: '', source: '', isFresh: true});  // loaded full phenotype

// export
export function usePhenotypes() {
    // Get dependencies inside the composable function
    const { emitError, emitSuccess } = useNotifications()
    const auth = useAuth()
    const projects = useProjects()

    // ----------------------------
    // STATE
    // ----------------------------
    const loading = ref(false);
    const nameError = ref(false)
    function flashNameError() {nameError.value = true
        setTimeout(() => nameError.value = false, 1200)
    }

    // ----------------------------
    // HELPERS
    // ----------------------------
    // check if an ID exists in the phenotypes DB table
    async function phenotypeExists(id) {
        if (!auth.user.value) return;
        const { data, error } = await supabase
            .from('phenotypes')
            .select('id')
            .eq('id', id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return false; // not found
            }
            emitError("Error checking phenotype", error.message)
            return false;
        }

        return data !== null;
    }

    // Load phenotypes for the active project only
    async function fetchPhenotypes(projectId) {
        if (!auth.user.value) return;
        if (!projectId) return;
        console.log("projectID:", projectId)

        loading.value = true

        const { data, error } = await supabase
            .from("phenotypes")
            .select("id, name, description, source, created_at")
            .eq("project_id", projects.currentProject.value.id)
            .order("created_at", { ascending: false })

        loading.value = false

        if (error) return emitError("Load failed", error.message)

        phenotypes.value = data
    }

    // ----------------------------
    // LOAD ONE PHENOTYPE
    // ----------------------------
    async function loadPhenotype(id) {
        if (!id) return
        loading.value = true

        const { data, error } = await supabase
            .from('phenotypes')
            .select('*')
            .eq('id', id)
            .single()

        loading.value = false;

        if (error) return emitError("Load failed", error.message)

        currentPhenotype.value = data
    }

  // ----------------------------
  // CREATE NEW PHENOTYPE
  // ----------------------------
    async function savePhenotype() {
        if (!auth.user.value) return

        const phenoName = currentPhenotype.value.name?.trim()

        if (!phenoName) {
            flashNameError()
            return emitError("Missing name", "Please provide a name.")
        }

        const { data, error } = await supabase
            .from("phenotypes")
            .insert({
                user_id: auth.user.value.id,
                name: phenoName,
                description: currentPhenotype.value.description || '',
                source: currentPhenotype.value.source || '',
                project_id: projects.currentProject.value.id,
            })
            .select()
            .single()

        if (error) {
            if (error.code === "23505") {
                return emitError("Name exists", `"${phenoName}" already exists in this project.`)
            }
            return emitError("Save failed", error.message)
        }

        phenotypes.value.unshift(data)
        emitSuccess("Saved", `Phenotype "${data.name}" saved.`)

        return data;
    }

    // ----------------------------
    // DELETE
    // ----------------------------
    async function deletePhenotype() {
        if (!currentPhenotype.value) return

        const id = currentPhenotype.value.id;

        const { error } = await supabase
            .from("phenotypes")
            .delete()
            .eq("id", id)

        if (error) return emitError("Delete failed", error.message)

        phenotypes.value = phenotypes.value.filter(p => p.id !== id);

        currentPhenotype.value = {id: '', user_id: '', name: '', description: '', project_id: '', source: ''};

        emitSuccess("Deleted", "Phenotype removed.")
    }

    function emptyPhenotypes() {
        phenotypes.value = []
        currentPhenotype.value = {name: ''}
    }

    return {
        // state
        phenotypes,
        currentPhenotype,
        loading,
        nameError,

        // functions
        phenotypeExists,
        loadPhenotype,
        fetchPhenotypes,
        savePhenotype,
        deletePhenotype,
        emptyPhenotypes
    }
}
