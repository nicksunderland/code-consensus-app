// /src/composables/usePhenotypes.js
import { ref, computed, reactive } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useProjects } from "@/composables/useProjects.js";
import { useAuth } from "@/composables/useAuth.js";
import { useNotifications } from './useNotifications'

// globals - these are set once in memory
const phenotypes = ref([]);          // list for active project
const emptyPhenotype = {id: '', user_id: '', name: '', description: '', project_id: '', source: ''};
const currentPhenotype = ref(emptyPhenotype);

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

        if (!id || typeof id !== "string" || id.trim() === "") {
            return false;
        }

        const { data, error } = await supabase
            .from('phenotypes')
            .select('id')
            .eq('id', id)
            .maybeSingle()

        if (error) {
            emitError("Error checking phenotype", error.message);
            return false;
        }

        return !!data;
    }

    // Load phenotypes for the active project only
    async function fetchPhenotypes() {
        if (!auth.user.value) return;
        if (!projects.currentProject.value) {
            console.log("No active project found. Clearing global phenotypes list.");
            phenotypes.value = [];
            return;
        }
        const projectId = projects.currentProject.value.id
        console.log("fetchPhenotypes for projectId:", projectId)
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
  // CREATE OR UPDATE PHENOTYPE
  // ----------------------------
    async function savePhenotype(update = false) {
        if (!auth.user.value) return

        const pheno = currentPhenotype.value;
        const phenoName = typeof pheno.name === "string"
            ? pheno.name.trim()
            : String(pheno.name || "").trim();

        console.log("savePhenotype:", pheno, "update:", update)

        if (!phenoName) {
            flashNameError()
            return emitError("Missing name", "Please provide a name.")
        }

        // ----------------------------
        // UPDATE EXISTING PHENOTYPE
        // ----------------------------
        if (update === true && pheno.id) {
            const {data, error} = await supabase
                .from("phenotypes")
                .update({
                    name: phenoName,
                    description: pheno.description || "",
                    source: pheno.source || "",
                    project_id: projects.currentProject.value.id
                })
                .eq("id", pheno.id)
                .select()
                .single();

            if (error) {
                return emitError("Update failed", error.message);
            }

            // Replace existing phenotype in local list
            const idx = phenotypes.value.findIndex(p => p.name === pheno.name);
            if (idx !== -1) phenotypes.value[idx] = data;

            emitSuccess("Updated", `Phenotype "${data.name}" updated.`);
            return data;
        }

        // ----------------------------
        // CREATE NEW PHENOTYPE
        // ----------------------------
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

        console.log("savePhenotype data:", data, "error:", error)

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
        currentPhenotype.value = emptyPhenotype
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
