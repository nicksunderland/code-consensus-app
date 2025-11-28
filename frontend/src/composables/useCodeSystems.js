// useCodeSystems.js
import { ref } from 'vue'
import { supabase } from "@/composables/useSupabase.js";

const codeSystems = ref([])
const isLoaded = ref(false)

export function useCodeSystems() {

  const loadCodeSystems = async () => {
    // 2. Prevent re-fetching if we already have data
    if (isLoaded.value) return

    const { data, error } = await supabase
      .from('code_systems')
      .select('*')
      .order('name')

    if (!error) {
        codeSystems.value = data
        isLoaded.value = true
    }
  }

  return { codeSystems, loadCodeSystems }
}
