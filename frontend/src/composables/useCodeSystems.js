// useCodeSystems.js
import { ref } from 'vue'
import { supabase } from "@/composables/useSupabase.js";

export function useCodeSystems() {
  const codeSystems = ref([])

  const loadCodeSystems = async () => {
    const { data, error } = await supabase
      .from('code_systems')
      .select('*')
      .order('name')

    if (!error) codeSystems.value = data
  }

  return { codeSystems, loadCodeSystems }
}
