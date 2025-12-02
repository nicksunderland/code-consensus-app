import { ref, watch } from 'vue';
import { supabase } from '@/composables/shared/useSupabase.js';
import { useProjects } from '../project/useProjects.js';
import { useNotifications } from '@/composables/shared/useNotifications.js';

export function usePhenoflows() {
  const { currentProject } = useProjects();
  const { emitError, emitSuccess } = useNotifications();

  const flows = ref([]);
  const selectedFlow = ref(null);
  const loading = ref(false);
  const saving = ref(false);

  const fetchFlows = async () => {
    if (!currentProject.value?.id) {
      flows.value = [];
      selectedFlow.value = null;
      return;
    }
    loading.value = true;
    const { data, error } = await supabase
      .from('phenoflows')
      .select('*')
      .eq('project_id', currentProject.value.id)
      .order('updated_at', { ascending: false });
    loading.value = false;
    if (error) {
      emitError('Unable to load phenoflows', error.message || error);
      return;
    }
    flows.value = data || [];
    if (flows.value.length && !selectedFlow.value) {
      selectedFlow.value = flows.value[0];
    } else if (
      selectedFlow.value &&
      !flows.value.find((f) => f.id === selectedFlow.value.id)
    ) {
      selectedFlow.value = null;
    }
  };

  const createFlow = async ({ name, description, graphJson, viewport }) => {
    if (!currentProject.value?.id) {
      emitError('No project selected', 'Please select a project first.');
      return null;
    }
    saving.value = true;
    const { data, error } = await supabase
      .from('phenoflows')
      .insert({
        name,
        description,
        project_id: currentProject.value.id,
        graph_json: graphJson || {},
        viewport: viewport || null
      })
      .select()
      .single();
    saving.value = false;
    if (error) {
      emitError('Unable to create phenoflow', error.message || error);
      return null;
    }
    flows.value = [data, ...flows.value];
    selectedFlow.value = data;
    emitSuccess('Phenoflow created');
    return data;
  };

  const updateFlow = async ({ id, name, description, graphJson, viewport }) => {
    if (!id) return null;
    saving.value = true;
    const { data, error } = await supabase
      .from('phenoflows')
      .update({
        name,
        description,
        graph_json: graphJson || {},
        viewport: viewport || null
      })
      .eq('id', id)
      .select()
      .single();
    saving.value = false;
    if (error) {
      emitError('Unable to save phenoflow', error.message || error);
      return null;
    }
    flows.value = flows.value.map((f) => (f.id === id ? data : f));
    selectedFlow.value = data;
    emitSuccess('Phenoflow saved');
    return data;
  };

  const deleteFlow = async (id) => {
    if (!id) return;
    saving.value = true;
    const { error } = await supabase.from('phenoflows').delete().eq('id', id);
    saving.value = false;
    if (error) {
      emitError('Unable to delete phenoflow', error.message || error);
      return;
    }
    flows.value = flows.value.filter((f) => f.id !== id);
    if (selectedFlow.value?.id === id) {
      selectedFlow.value = flows.value[0] || null;
    }
    emitSuccess('Phenoflow deleted');
  };

  watch(
    () => currentProject.value?.id,
    () => fetchFlows(),
    { immediate: true }
  );

  return {
    flows,
    selectedFlow,
    loading,
    saving,
    fetchFlows,
    createFlow,
    updateFlow,
    deleteFlow
  };
}
