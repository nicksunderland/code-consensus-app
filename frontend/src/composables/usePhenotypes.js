// /src/composables/usePhenotypes.js
import { ref, computed } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import {useProjects} from "@/composables/useProjects.js";
import {useAuth} from "@/composables/useAuth.js";
import { useNotifications } from './useNotifications'

// required composables
const { emitError, emitSuccess } = useNotifications()
const auth = useAuth()
const projects= useProjects()

// globals - these are set once in memory
const phenotypes = ref([]);          // list for active project
const currentPhenotype = ref({name: ''});  // loaded full phenotype

// export
export function usePhenotypes() {
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
    function guardProject() {
        if (!auth.user.value) {
            emitError("Not logged in")
            return false
        }
        if (!projects.currentProject.value) {
            emitError("No project selected")
            return false
        }
        return true;
    }

  // Load phenotypes for the active project only
    async function fetchPhenotypes() {
        if (!guardProject()) return;
        loading.value = true

        const { data, error } = await supabase
            .from("phenotypes")
            .select("id, name, description, created_at")
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
    async function savePhenotype(newName) {
        if (!guardProject()) return
        if (!newName?.trim()) {
            flashNameError()
            return emitError("Missing name", "Please provide a name.")
        }

        const { data, error } = await supabase
            .from("phenotypes")
            .insert({
                user_id: auth.user.value.id,
                project_id: projects.currentProject.value.id,
                name: newName.trim(),
            })
            .select()
            .single()

        if (error) {
            if (error.code === "23505") {
                return emitError("Name exists", `"${newName}" already exists in this project.`)
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
    async function deletePhenotype(id) {
        if (!id) return

        const { error } = await supabase
            .from("phenotypes")
            .delete()
            .eq("id", id)

        if (error) return emitError("Delete failed", error.message)

        phenotypes.value = phenotypes.value.filter(p => p.id !== id);

        if (currentPhenotype.value?.id === id) {
            currentPhenotype.value = null;
        }

        emitSuccess("Deleted", "Phenotype removed.")
    }

    function emptyPhenotypes() {
        phenotypes.value = []
        currentPhenotype.value = null
    }

    return {
        // state
        phenotypes,
        currentPhenotype,
        loading,
        nameError,

        // functions
        fetchPhenotypes,
        savePhenotype,
        deletePhenotype,
        emptyPhenotypes
    }
}
