// /src/composables/usePhenotypes.js
import { ref, computed } from 'vue'
import { supabase } from '@/composables/useSupabase.js'


export function usePhenotypes({toast, auth, projects}) {
  // ----------------------------
  // STATE
  // ----------------------------
  const phenotypes = ref([]);          // list for active project
  const currentPhenotype = ref({name: ''});  // loaded full phenotype
  const loading = ref(false);
  const nameError = ref(false)
  function flashNameError() {
      nameError.value = true
      setTimeout(() => {
        nameError.value = false
      }, 1200) // highlight for 1.2 seconds
  }


  // ----------------------------
  // HELPERS
  // ----------------------------
  function guardProject() {
    if (!auth.user.value) {
      toast.add({ severity: "warn", summary: "Not logged in" });
      return false;
    }
    if (!projects.currentProject.value) {
      toast.add({ severity: "warn", summary: "No project selected" });
      return false;
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

    if (error) {
      toast.add({ severity: "error", summary: "Load failed", detail: error.message });
      return;
    }

    phenotypes.value = data
  }

  // ----------------------------
  // LOAD ONE PHENOTYPE
  // ----------------------------
  async function loadPhenotype(id) {

    loading.value = true;

    const { data, error } = await supabase
      .from('phenotypes')
      .select('*')
      .eq('id', id)
      .single()

    loading.value = false;

    if (error) {
      toast.add({ severity: "error", summary: "Load failed", detail: error.message });
      return;
    }

    currentPhenotype.value = data;
  }

  // ----------------------------
  // CREATE NEW PHENOTYPE
  // ----------------------------
  async function savePhenotype(newName) {
    if (!guardProject()) return;

    if (!newName || !newName.trim()) {
      toast.add({
        severity: "warn",
        summary: "Missing name",
        detail: "Please provide a name.",
      });
      return;
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
        toast.add({
          severity: "warn",
          summary: "Name exists",
          detail: `"${name}" already exists in this project.`,
        });
        return;
      }
      toast.add({ severity: "error", summary: "Save failed", detail: error.message });
      return;
    }

    phenotypes.value.unshift(data)

    toast.add({
      severity: "success",
      summary: "Saved",
      detail: `Phenotype "${data.name}" saved.`,
    })

    return data;
  }

  // ----------------------------
  // DELETE
  // ----------------------------
  async function deletePhenotype(id) {

    const { error } = await supabase
      .from("phenotypes")
      .delete()
      .eq("id", id)

    if (error) {
      toast.add({ severity: "error", summary: "Delete failed", detail: error.message });
      return;
    }

    phenotypes.value = phenotypes.value.filter(p => p.id !== id);

    if (currentPhenotype.value?.id === id) {
      currentPhenotype.value = null;
    }

    toast.add({
      severity: "success",
      summary: "Deleted",
      detail: "Phenotype removed.",
    });
  }

  return {
    phenotypes,
    currentPhenotype,
    loading,
    nameError,
    fetchPhenotypes,
    savePhenotype,
    deletePhenotype,
  }
}
