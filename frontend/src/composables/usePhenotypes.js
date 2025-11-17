// /src/composables/usePhenotypes.js
import { ref, computed } from 'vue'
import { supabase } from '@/composables/useSupabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useProjects } from '@/composables/useProjects.js'
import { useToast } from 'primevue/usetoast'

const phenotypes = ref([])
const currentPhenotype = ref(null)
const loading = ref(false)

export function usePhenotypes() {
  const { user } = useAuth()
  const { currentProject } = useProjects()
  const toast = useToast()

  // Load phenotypes for the active project only
  async function fetchPhenotypes() {
    if (!user.value || !currentProject.value) return

    loading.value = true

    const { data, error } = await supabase
      .from("phenotypes")
      .select("id, name, description, created_at")
      .eq("project_id", currentProject.value.id)
      .order("created_at", { ascending: false })

    loading.value = false

    if (error) {
      console.error("Fetch phenotypes failed", error)
      return
    }

    phenotypes.value = data
  }

  async function loadPhenotype(id) {
    const { data, error } = await supabase
      .from('phenotypes')
      .select('*')
      .eq('id', id)
      .single()
    if (!error) currentPhenotype.value = data
  }

  // Save a phenotype (always requires project_id)
  async function savePhenotype(newName) {
    if (!user.value || !currentProject.value) return

    if (!newName || newName.trim() === "") {
      toast.add({
        severity: "warn",
        summary: "Missing name",
        detail: "Please give this phenotype a name.",
      })
      return
    }

    const { data, error } = await supabase
      .from("phenotypes")
      .insert({
        user_id: user.value.id,
        project_id: currentProject.value.id,
        name: newName.trim(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        toast.add({
          severity: "error",
          summary: "Name taken",
          detail: `A phenotype named "${newName}" already exists in this project.`,
        })
        return
      }
      console.error("Saving phenotype failed", error)
      return
    }

    phenotypes.value.unshift(data)
    toast.add({
      severity: "success",
      summary: "Saved",
      detail: `Phenotype "${data.name}" saved.`,
    })
  }

  // Delete phenotype
  async function deletePhenotype(id) {
    const { error } = await supabase
      .from("phenotypes")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Delete failed", error)
      return
    }

    phenotypes.value = phenotypes.value.filter(p => p.id !== id)
  }

  return {
    phenotypes,
    currentPhenotype,
    loading,
    fetchPhenotypes,
    savePhenotype,
    deletePhenotype,
  }
}
