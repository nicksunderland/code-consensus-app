<script setup>
import { ref, computed, watch } from 'vue';
import Menubar from 'primevue/menubar';
import Divider from 'primevue/divider';
import 'primeicons/primeicons.css';
import AuthDialogs from '@/AuthDialogs.vue';
import CreateProjectDialog from "@/CreateProjectDialog.vue";
import TreeSearch from "@/TreeSearch.vue";
import SelectedCodes from "@/SelectedCodes.vue";
import Analysis from "@/Analysis.vue";
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { useAuth } from '@/composables/useAuth.js'
import { useProjects } from "@/composables/useProjects.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";
import { useMenu } from '@/composables/useMenu.js';
import { useTreeSearch } from "@/composables/useTreeSearch.js";
import {useAnalysis} from "@/composables/useAnalysis.js";
import {useNotifications} from "@/composables/useNotifications.js";

// set up toast - need to load the .js globals with toast function
// however have to do in a component file (.vue). Load first so that
// everything can pull a copy of notifications and get access to toasting
const toast = useToast()
const notifications = useNotifications()
notifications.setErrorHandler((summary, error) => {
    toast.add({ severity: 'error', summary, detail: error?.message || String(error) })
})
notifications.setSuccessHandler((summary, detail) => {
    toast.add({ severity: 'success', summary, detail })
})

// THINGS FROM COMPOSABLES ---
const { user } = useAuth()
const { menuItems } = useMenu()
const { fetchProjects, emptyProjects } = useProjects()
const { fetchPhenotypes, emptyPhenotypes } = usePhenotypes()

// --- WATCH USER LOGIN ---
watch(
  user,
  async (newUser) => {
    console.log("watching user in App.vue")
    if (newUser) {
      console.log("user valid - fetching")
      await fetchProjects()
      await fetchPhenotypes()
    } else {
      console.log("user invalid - emptying")
      emptyProjects()
      emptyPhenotypes()
    }
  },
  { immediate: true } // also runs immediately if user is already logged in
)


</script>

<template>
  <!-- Toast messages -->
  <Toast position="bottom-right"/>
  <!-- Auth / login dialogs -->
  <AuthDialogs/>
  <CreateProjectDialog/>
  <!-- Top navigation -->
  <Menubar :model="menuItems" appendTo="body">
    <template #start>
      <div class="menubar-title flex align-items-center">
        <i class="pi pi-users title-icon"></i>
        <span class="title-text">Code Consensus</span>
      </div>
      <Divider layout="vertical" />
    </template>
    <template #end>

    </template>

  </Menubar>
  <!-- Main content -->
  <div class="app-container">
    <TreeSearch/>
    <SelectedCodes/>
    <Analysis/>
  </div>
</template>

<style scoped>
.app-container {
  padding: 1rem;
}
</style>


<!--<script setup>-->
<!--import { ref, onMounted, watch, reactive } from 'vue';-->

<!--import {useSupabase, supabaseAdmin} from "@/useSupabase.js";-->
<!--import CreateProjectDialog from '@/CreateProjectDialog.vue'-->
<!--import { useAuth } from '@/useAuth.js'-->
<!--import AuthDialogs from '@/AuthDialogs.vue'-->


<!--import axios from 'axios';-->
<!--import Menubar from 'primevue/menubar';-->
<!--import ToggleSwitch from 'primevue/toggleswitch';-->
<!--import MultiSelect from 'primevue/multiselect';-->
<!--import InputText from 'primevue/inputtext';-->
<!--import Textarea from 'primevue/textarea';-->
<!--import Tooltip from 'primevue/tooltip';-->
<!--import Card from 'primevue/card';-->
<!--import Panel from 'primevue/panel';-->
<!--import Chart from 'primevue/chart';-->
<!--import Divider from 'primevue/divider';-->
<!--import SplitButton from 'primevue/splitbutton';-->
<!--import Slider from 'primevue/slider';-->
<!--import Button from 'primevue/button';-->
<!--import Select from 'primevue/select';-->
<!--import Tree from 'primevue/tree';-->
<!--import DataTable from 'primevue/datatable';-->
<!--import Column from 'primevue/column';-->
<!--import { computed } from 'vue';-->
<!--import { useToast } from 'primevue/usetoast';-->
<!--import 'primeicons/primeicons.css';-->
<!--import { useConfirm } from 'primevue/useconfirm'-->
<!--import ConfirmPopup from 'primevue/confirmpopup';-->
<!--import ProgressSpinner from 'primevue/progressspinner';-->
<!--import Message from 'primevue/message';-->
<!--import VueApexCharts from "vue3-apexcharts"-->

<!--const BASE_URL = import.meta.env.DEV-->
<!--    ? 'http://localhost:8000'-->
<!--    : 'https://code-consensus.fly.dev';-->

<!--const apiClient = axios.create({ baseURL: BASE_URL });-->

<!--// sign-in & user details-->
<!--const { user, logout, loginGoogle, loginGitHub } = useAuth()-->
<!--const authDialogs = ref(null)-->
<!--const accountMenu = computed(() =>-->
<!--  !user.value-->
<!--    ? {-->
<!--        label: 'Login',-->
<!--        icon: 'pi pi-sign-in',-->
<!--        items: [-->
<!--          { label: 'Email / Password Login', icon: 'pi pi-envelope', command: () => authDialogs.value.showLogin = true },-->
<!--          { label: 'Magic Link Login', icon: 'pi pi-link', command: () => authDialogs.value.showLogin = true },-->
<!--          { label: 'Sign Up', icon: 'pi pi-user-plus', command: () => authDialogs.value.showSignup = true },-->
<!--          { separator: true },-->
<!--          { label: 'Google', icon: 'pi pi-google', command: loginGoogle },-->
<!--          { label: 'GitHub', icon: 'pi pi-github', command: loginGitHub }-->
<!--        ]-->
<!--      }-->
<!--    : {-->
<!--        label: user.value.user_metadata.full_name || user.value.email,-->
<!--        icon: 'pi pi-user',-->
<!--        items: [-->
<!--          { label: 'Logout', icon: 'pi pi-sign-out', command: logout }-->
<!--        ]-->
<!--      }-->
<!--)-->

<!--//login things-->
<!--//const user = ref(null)-->
<!--watch(user, async (newUser) => {-->
<!--  if (newUser) {-->
<!--    await ensureProject({-->
<!--      name: 'Personal',-->
<!--      ownerId: user.value.id-->
<!--    })-->
<!--    await fetchSavedProjects()-->
<!--    await fetchSavedPhenotypes()-->
<!--  }-->
<!--})-->



<!--//define save things-->
<!--const saveOptions = [-->
<!--  {-->
<!--    label: 'Save',-->
<!--    icon: 'pi pi-save',-->
<!--    command: () => save('save')-->
<!--  },-->
<!--  {-->
<!--    label: 'Update',-->
<!--    icon: 'pi pi-refresh',-->
<!--    command: () => save('update')-->
<!--  }-->
<!--];-->
<!--const savedPhenotypes = ref([])-->
<!--const savedProjects = ref([])-->

<!--const fetchSavedProjects = async () => {-->
<!--  console.log('Saved projects:', savedProjects.value)-->
<!--  if (!user.value) return-->

<!--  const { data, error } = await useSupabase-->
<!--    .from('projects')-->
<!--    .select(`-->
<!--      id,-->
<!--      name,-->
<!--      created_at,-->
<!--      project_members!inner (-->
<!--        user_id,-->
<!--        role-->
<!--      )-->
<!--    `)-->
<!--    .eq('project_members.user_id', user.value.id)-->
<!--    .order('created_at', { ascending: false })-->

<!--  if (error) {-->
<!--    console.error('Error fetching projects:', error)-->
<!--    return-->
<!--  }-->

<!--  savedProjects.value = data-->
<!--  console.log('Saved projects:', savedProjects.value)-->
<!--}-->

<!--const fetchSavedPhenotypes = async () => {-->
<!--  if (!user.value || !project.value) return-->

<!--  try {-->
<!--    // Send request without user_id — Supabase infers user from session-->
<!--    const { data, error } = await useSupabase-->
<!--      .from('phenotypes')-->
<!--      .select('id, name')   // only rows matching RLS policy will be returned-->
<!--      .eq('project_id', project.value.id)-->
<!--      .order('created_at', { ascending: false })-->

<!--    savedPhenotypes.value = data-->
<!--    console.log('Saved phenotypes:', savedPhenotypes.value)-->

<!--  } catch (err) {-->
<!--    console.error('Fetching saved phenotypes failed', err)-->
<!--  }-->
<!--}-->

<!--const showDialog = ref(false)-->
<!--const handleProjectCreated = async (projectData) => {-->
<!--  // Map emails to user IDs if needed-->
<!--  console.log('New project data:', projectData)-->

<!--  const userIds = await resolveEmailsToUserIds(projectData.emails)-->

<!--  console.log('userIds:', userIds)-->
<!--  console.log('user id:', user.value.id)-->

<!--  const newProject = await ensureProject({-->
<!--    name: projectData.name,-->
<!--    ownerId: user.value.id,-->
<!--    memberIds: userIds.map(id => ({ user_id: id }))-->
<!--  })-->

<!--  if (newProject) {-->
<!--    savedProjects.value.push(newProject)-->
<!--    project.value = newProject-->
<!--  }-->

<!--}-->

<!--async function resolveEmailsToUserIds(emails) {-->
<!--  if (!emails || emails.length === 0) return []-->

<!--  // Remove blanks and duplicates-->
<!--  const cleaned = [...new Set(-->
<!--    emails.map(e => e.trim()).filter(e => e.length > 0)-->
<!--  )]-->

<!--  if (cleaned.length === 0) return []-->

<!--  // Query auth.users using the built-in view: auth.users-->
<!--  const { data, error } = await useSupabase-->
<!--    .from('user_profiles')          // 🔥 <- RECOMMENDED: a "public" view of users you create-->
<!--    .select('id, email')-->
<!--    .in('email', cleaned)-->

<!--  if (error) {-->
<!--    console.error("Error resolving emails:", error)-->
<!--    return []-->
<!--  }-->

<!--  // data will contain only users that exist-->
<!--  return data.map(row => row.id)-->
<!--}-->

<!--const nameError = ref(false)-->
<!--function flashNameError() {-->
<!--  nameError.value = true-->
<!--  setTimeout(() => {-->
<!--    nameError.value = false-->
<!--  }, 1200) // highlight for 1.2 seconds-->
<!--}-->
<!--const project = ref(null)-->
<!--const currentProjectLabel = computed(() => {-->
<!--  if (!user.value) return 'Projects'-->
<!--  if (!project.value) return 'Projects'-->
<!--  return `Projects (${project.value.name})`  // show loaded project name in brackets-->
<!--})-->

<!--async function ensureProject({ name, ownerId, memberIds = [] }) {-->
<!--  if (!ownerId) return null-->

<!--  // 1. Check if project exists-->
<!--  const { data: existingProject, error: fetchError } = await useSupabase-->
<!--    .from('projects')-->
<!--    .select('*')-->
<!--    .eq('owner', ownerId)-->
<!--    .eq('name', name)-->
<!--    .limit(1)-->
<!--    .maybeSingle()-->

<!--  if (fetchError && fetchError.code !== 'PGRST116') {-->
<!--    console.error('Error fetching project', fetchError)-->
<!--    return null-->
<!--  }-->

<!--  if (existingProject) return existingProject-->

<!--  // 2. Create project if it doesn’t exist-->
<!--  const { data: newProject, error: insertError } = await useSupabase-->
<!--    .from('projects')-->
<!--    .insert({ owner: ownerId, name })-->
<!--    .select()-->
<!--    .single()-->

<!--  if (insertError) {-->
<!--    console.error('Error creating project', insertError)-->
<!--    return null-->
<!--  }-->

<!--  // 3. Add owner-->
<!--  const membersToInsert = [-->
<!--    { project_id: newProject.id, user_id: ownerId, role: 'owner' },-->
<!--    // Add additional emails as 'member' if you want-->
<!--    ...memberIds.map(id => ({-->
<!--      project_id: newProject.id,-->
<!--      user_id: id,-->
<!--      role: 'member'-->
<!--    }))-->
<!--  ]-->

<!--  // Supabase expects user_id, so you may need to resolve emails to user IDs first-->
<!--  // Example: using a backend service or Supabase RPC to fetch IDs by email-->
<!--  // Here we assume emails are already mapped to user IDs: emails = [{user_id: ...}, ...]-->
<!--  const { error: memberError } = await useSupabase-->
<!--    .from('project_members')-->
<!--    .insert(membersToInsert)-->

<!--  if (memberError) console.error('Error adding project members', memberError)-->

<!--  return newProject-->
<!--}-->


<!--const phenotype = reactive({-->
<!--  id: "",-->
<!--  name: "",-->
<!--  description: "",-->
<!--  selectedMetric: null,-->
<!--  filters: [],-->
<!--  config: {},-->
<!--  created_at: null,-->
<!--})-->

<!--const loadPhenotype = async (id) => {-->
<!--  if (!user.value) return-->

<!--  try {-->
<!--    const { data, error } = await useSupabase-->
<!--      .from('phenotypes')-->
<!--      .select('*')-->
<!--      .eq('id', id)-->
<!--      .single()-->

<!--    if (error) throw error-->

<!--    console.log(data)-->

<!--    phenotype.id = data.id-->
<!--    phenotype.name = data.name-->
<!--    phenotype.description = data.description ?? ""-->
<!--    phenotype.selectedMetric = data.metric ?? null-->
<!--    phenotype.filters = data.filters ?? []-->
<!--    phenotype.config = data.config ?? {}-->
<!--    phenotype.created_at = data.created_at-->

<!--    console.log("Loaded phenotype:", phenotype)-->

<!--  } catch (err) {-->
<!--    console.error("Failed to load phenotype", err)-->
<!--  }-->
<!--}-->

<!--const confirm = useConfirm();-->
<!--function confirmDelete(event) {-->
<!--  console.log("foo")-->
<!--  if (!phenotype?.name) return-->

<!--  confirm.require({-->
<!--    target: event.currentTarget,-->
<!--    message: `Are you sure you want to delete "${phenotype.name}"?`,-->
<!--    icon: 'pi pi-exclamation-triangle',-->
<!--    acceptLabel: 'Yes',-->
<!--    rejectLabel: 'No',-->
<!--    accept: async () => {-->
<!--      if (!phenotype?.id) {-->
<!--        toast.add({-->
<!--          severity: 'warn',-->
<!--          summary: 'Cannot delete',-->
<!--          detail: 'Phenotype has not been saved yet',-->
<!--          life: 3000-->
<!--        });-->
<!--        return;-->
<!--      }-->

<!--      try {-->
<!--        const { error } = await useSupabase-->
<!--          .from('phenotypes')-->
<!--          .delete()-->
<!--          .eq('id', phenotype.id);-->

<!--        if (error) throw error;-->

<!--        savedPhenotypes.value = savedPhenotypes.value.filter(-->
<!--          p => p.id !== phenotype.id-->
<!--        );-->

<!--        phenotype.id = ''-->
<!--        phenotype.name = ''-->
<!--        phenotype.description = ""-->
<!--        phenotype.selectedMetric = null-->
<!--        phenotype.filters = []-->
<!--        phenotype.config = {}-->
<!--        phenotype.created_at = null-->

<!--      } catch (err) {-->
<!--        console.error('Delete failed', err);-->
<!--        toast.add({-->
<!--          severity: 'error',-->
<!--          summary: 'Delete failed',-->
<!--          detail: err.message || err,-->
<!--          life: 3000-->
<!--        });-->
<!--      }-->
<!--    },-->
<!--    reject: () => {-->
<!--      console.log('Delete cancelled')-->
<!--    }-->
<!--  })-->
<!--}-->

<!--function mainSaveClick(event) {-->
<!--  // event is the PointerEvent, ignore it-->
<!--  save('save');-->
<!--}-->

<!--async function save() {-->
<!--  if (!user.value) {-->
<!--    toast.add({-->
<!--      severity: 'warn',-->
<!--      summary: 'Not logged in',-->
<!--      detail: 'Please log in to save a phenotype.',-->
<!--      life: 3000-->
<!--    })-->
<!--    return-->
<!--  }-->

<!--  // Check global phenotype name-->
<!--  console.log('phenotype name:', JSON.stringify(phenotype.name));-->
<!--  if (!phenotype.name || phenotype.name.trim() === '') {-->
<!--    flashNameError()-->
<!--    toast.add({-->
<!--      severity: 'warn',-->
<!--      summary: 'Missing name',-->
<!--      detail: 'Please give this phenotype a name before saving.',-->
<!--      life: 3000-->
<!--    })-->
<!--    return-->
<!--  }-->

<!--  try {-->
<!--    const payload = {-->
<!--      user_id: user.value.id,-->
<!--      project_id: project.value.id,-->
<!--      name: phenotype.name.trim(),-->
<!--      // Later: add full phenotype JSON here-->
<!--      // data: phenotype-->
<!--    }-->

<!--    const { data, error } = await useSupabase-->
<!--      .from('phenotypes')-->
<!--      .insert(payload)-->
<!--      .select()-->

<!--    if (error) {-->
<!--      if (error.code === '23505') {-->
<!--        flashNameError()-->
<!--        toast.add({-->
<!--          severity: 'error',-->
<!--          summary: 'Name taken',-->
<!--          detail: `A phenotype named "${phenotype.name}" already exists.`,-->
<!--          life: 3000-->
<!--        })-->
<!--        return-->
<!--      }-->
<!--      throw error-->
<!--    }-->

<!--    const row = data[0]-->
<!--    savedPhenotypes.value.push(row)-->
<!--    phenotype.id  = row.id-->

<!--    toast.add({-->
<!--      severity: 'success',-->
<!--      summary: 'Saved',-->
<!--      detail: `Phenotype "${row.name}" saved successfully.`,-->
<!--      life: 3000-->
<!--    })-->

<!--  } catch (err) {-->
<!--    console.error('Saving phenotype failed', err)-->
<!--    toast.add({-->
<!--      severity: 'error',-->
<!--      summary: 'Error',-->
<!--      detail: `Failed to save phenotype: ${err.message || err}`,-->
<!--      life: 4000-->
<!--    })-->
<!--  }-->
<!--}-->

<!--// Define the search things-->
<!--const autoSelect = ref(false);-->
<!--const searchInOptions = ref([-->
<!--  { label: 'Codes', value: 'code' },-->
<!--  { label: 'Description', value: 'description' }-->
<!--]);-->
<!--const searchSystemsOptions = ref([-->
<!--  { name: 'ICD-10', id: 1 }-->
<!--]);-->
<!--const makeSearchInput = () => ({-->
<!--  text: '',-->
<!--  regex: false,-->
<!--  system_ids: searchSystemsOptions.value.map(opt => opt.id),-->
<!--  columns: searchInOptions.value.map(opt => opt.value)-->
<!--})-->
<!--const searchInputs = ref([makeSearchInput()]);-->

<!--const addSearchTerm = () => searchInputs.value.push(makeSearchInput())-->
<!--const removeSearchTerm = (index) => {-->
<!--  if (searchInputs.value.length > 1) {-->
<!--    searchInputs.value.splice(index, 1)-->
<!--  }-->
<!--}-->


<!--const nodes = ref([]);-->
<!--const selectedNodeKeys = ref({});-->
<!--const expandedNodeKeys = ref({});-->
<!--const loading = ref(false);-->
<!--const errorMessage = ref('');-->

<!--// Pop-out messages and warnings-->
<!--const toast = useToast();-->

<!--// menu-->
<!--const menuItems = computed(() => [-->
<!--  {-->
<!--    label: currentProjectLabel.value,-->
<!--    icon: 'pi pi-briefcase',-->
<!--    items: !user.value-->
<!--    ? [-->
<!--        { label: 'Please login', icon: 'pi pi-exclamation-triangle' }-->
<!--      ]-->
<!--    : [-->
<!--        // Always show the Create button first-->
<!--        {-->
<!--          label: 'Create Project',-->
<!--          icon: 'pi pi-plus',-->
<!--          command: () => { showDialog.value = true }-->
<!--        },-->
<!--        // Then either "No projects" or the project list-->
<!--        ...(savedProjects.value.length === 0-->
<!--          ? [{ label: 'No projects found', icon: 'pi pi-info-circle', disabled: true }]-->
<!--          : savedProjects.value.map(p => ({-->
<!--              label: p.name,-->
<!--              icon: project.value && project.value.id === p.id-->
<!--                ? 'pi pi-folder-open'   // currently loaded project-->
<!--                : 'pi pi-folder',       // closed / not loaded-->
<!--              command: () => {-->
<!--                project.value = p-->
<!--                fetchSavedPhenotypes()-->
<!--              }-->
<!--            }))-->
<!--        )-->
<!--      ]-->
<!--  },-->
<!--  {-->
<!--    label: 'Phenotypes',-->
<!--    icon: 'pi pi-save',-->
<!--    items: !user.value-->
<!--      ? [-->
<!--          { label: 'Please login', icon: 'pi pi-exclamation-triangle' }-->
<!--        ]-->
<!--      : savedPhenotypes.value.length === 0-->
<!--      ? [-->
<!--          { label: 'No saved phenotypes', icon: 'pi pi-info-circle' }-->
<!--        ]-->
<!--      : savedPhenotypes.value.map(pheno => ({-->
<!--          label: pheno.name,-->
<!--          icon: 'pi pi-file',-->
<!--          command: () => loadPhenotype(pheno.id)-->
<!--        }))-->
<!--  },-->
<!--  {-->
<!--    label: 'Examples',-->
<!--    icon: 'pi pi-book',-->
<!--    items: [-->
<!--      { label: 'Heart failure', icon: 'pi pi-fw pi-heart' },-->
<!--      { label: 'Coronary artery disease', icon: 'pi pi-fw pi-heart-fill' }-->
<!--    ]-->
<!--  },-->
<!--  accountMenu.value-->
<!--])-->

<!--// Lazy-loading children-->
<!--const onNodeExpand = async (node) => {-->
<!--  const isRoot = !node;-->
<!--  const parentId = isRoot ? null : node.key;-->

<!--  if (isRoot || !node.leaf) {-->
<!--    if (node) node.loading = true;-->
<!--    try {-->
<!--      const res = await apiClient.get('/api/tree-nodes', { params: { parent_id: parentId } });-->
<!--      const children = res.data.map(child => ({ ...child }));-->
<!--      if (isRoot) {-->
<!--        nodes.value = children;-->
<!--        console.log('Root nodes loaded:', nodes.value);-->
<!--      } else {-->
<!--        node.children = children;-->
<!--        console.log('Node after assigning children:', node);-->
<!--      }-->
<!--    } catch (err) {-->
<!--      console.error('Failed to load children for node', node.key, err);-->
<!--    } finally {-->
<!--      if (node) node.loading = false;-->
<!--    }-->
<!--  }-->
<!--};-->

<!--// Ensures the root nodes load when page loads-->

<!--const runSearch = async () => {-->
<!--  // Build payload for the simplified backend-->
<!--  const payload = {-->
<!--    searches: searchInputs.value-->
<!--      .filter(input => input.text.trim()) // ignore completely empty inputs-->
<!--      .map(input => ({-->
<!--        text: input.text.trim(),-->
<!--        regex: input.regex,-->
<!--        columns: input.columns,        // e.g., ["code", "description"]-->
<!--        system_ids: input.system_ids   // e.g., [1, 2]-->
<!--      })),-->
<!--    limit: 100-->
<!--  };-->

<!--  console.log('Payload:', payload);-->

<!--  if (payload.searches.length === 0) {-->
<!--    toast.add({-->
<!--      severity: 'warn',-->
<!--      summary: 'No Search Input',-->
<!--      detail: 'Please enter at least one search term.',-->
<!--      life: 4000-->
<!--    });-->
<!--    return;-->
<!--  }-->

<!--  // Format a user-friendly string for toast-->
<!--  const getSystemNames = (ids) =>-->
<!--    ids.map(id => searchSystemsOptions.value.find(s => s.id === id)?.name || id).join(', ');-->

<!--  const getColumnLabels = (values) =>-->
<!--    values.map(val => searchInOptions.value.find(c => c.value === val)?.label || val).join(', ');-->

<!--  const formattedTerms = payload.searches-->
<!--    .map((input, i) => {-->
<!--      const regex = input.regex ? ' [regex]' : '';-->
<!--      const systems = input.system_ids.length ? ` [systems: ${getSystemNames(input.system_ids)}]` : '';-->
<!--      const columns = input.columns.length ? ` [columns: ${getColumnLabels(input.columns)}]` : '';-->
<!--      return `${i + 1}: "${input.text}"${regex}${systems}${columns}`;-->
<!--    })-->
<!--    .join('\n');-->

<!--  toast.add({-->
<!--    severity: 'info',-->
<!--    summary: 'Search in Progress',-->
<!--    detail: formattedTerms,-->
<!--    life: 5000-->
<!--  });-->

<!--  try {-->
<!--    // Send payload in POST body-->
<!--    const res = await apiClient.post('/api/search-nodes', payload);-->
<!--    console.log('Search results:', res.data);-->

<!--    mergeSearchNodesIntoTree({-->
<!--      results: res.data.results,-->
<!--      ancestor_map: res.data.ancestor_map,-->
<!--      treeNodes: nodes.value,-->
<!--      expandedKeys: expandedNodeKeys-->
<!--    });-->

<!--    toast.add({-->
<!--      severity: 'success',-->
<!--      summary: 'Search Successful',-->
<!--      detail: `${res.data.results.length} items retrieved from server.`,-->
<!--      life: 5000,-->
<!--    });-->

<!--  } catch (err) {-->
<!--    console.error('Search failed', err);-->
<!--    toast.add({-->
<!--      severity: 'error',-->
<!--      summary: 'Search Failed',-->
<!--      detail: err?.response?.data?.detail || 'Server error occurred.',-->
<!--      life: 5000,-->
<!--    });-->
<!--  }-->
<!--};-->

<!--function clearSearchFlags(nodes) {-->
<!--  if (!Array.isArray(nodes)) return;-->
<!--  nodes.forEach(node => {-->
<!--    if (node.data) {-->
<!--      node.data.found_in_search = false;-->
<!--    }-->
<!--    if (Array.isArray(node.children) && node.children.length) {-->
<!--      clearSearchFlags(node.children);-->
<!--    }-->
<!--  });-->
<!--}-->



<!--function mergeSearchNodesIntoTree({ results, ancestor_map }) {-->
<!--  console.log("=== mergeSearchNodesIntoTree ===");-->
<!--  console.log("Results array length:", results.length);-->
<!--  console.log("Initial nodes.value:", nodes.value);-->

<!--   // 🔹 Reset all existing found_in_search flags before applying new search results-->
<!--  clearSearchFlags(nodes.value);-->

<!--  const searchResultIds = new Set(results.map(r => r.key));-->

<!--  results.forEach((result, resultIndex) => {-->

<!--    const pathIds = result.data.materialized_path.split('/').filter(Boolean);-->

<!--    let currentLevel = nodes.value; // assuming nodes is a ref-->
<!--    console.log(`\nProcessing result #${resultIndex}, pathIds:`, pathIds);-->

<!--    pathIds.forEach((id, index) => {-->
<!--      console.log(`  At path index ${index}, id: ${id}`);-->
<!--      console.log("  currentLevel before find:", currentLevel);-->

<!--      if (!Array.isArray(currentLevel)) {-->
<!--        console.error('currentLevel is not an array!', currentLevel);-->
<!--        currentLevel = [];-->
<!--      }-->

<!--      let node = currentLevel.find(n => n.key === id);-->
<!--      console.log("  Found node:", node);-->

<!--      if (!node) {-->
<!--        // Use ancestor_map if available, otherwise fallback to result-->
<!--        const source = ancestor_map[id] || result;-->
<!--        node = {-->
<!--          key: id.toString(),-->
<!--          label: source.label,           // label for display-->
<!--          children: [],-->
<!--          leaf: index === pathIds.length - 1,-->
<!--          selectable: source.data.is_selectable,-->
<!--          data: {                        // preserve the original data object-->
<!--            ...source.data,-->
<!--            found_in_search: searchResultIds.has(id)-->
<!--          }-->
<!--        };-->

<!--        currentLevel.push(node);-->
<!--        console.log("  Created new node:", node);-->

<!--      } else {-->
<!--        // Node already exists, update search hit if applicable-->
<!--        if (searchResultIds.has(id)) {-->
<!--          node.data = { ...node.data, found_in_search: true };-->
<!--          console.log("  Updated existing node as search hit:", node);-->
<!--        }-->
<!--      }-->

<!--      // Mark ancestors as expanded-->
<!--      if (index < pathIds.length - 1) {-->
<!--        expandedNodeKeys.value[id] = true;-->
<!--      }-->

<!--      currentLevel = node.children = node.children || [];-->
<!--      console.log("  currentLevel after update:", currentLevel);-->
<!--    });-->
<!--  });-->
<!--}-->

<!--const flattenedNodes = (nodeList) => {-->
<!--  const result = [];-->

<!--  const traverse = (nodes) => {-->
<!--    if (!Array.isArray(nodes)) return;-->

<!--    nodes.forEach((node) => {-->
<!--      result.push(node);-->

<!--      if (Array.isArray(node.children) && node.children.length) {-->
<!--        traverse(node.children);-->
<!--      }-->
<!--    });-->
<!--  };-->

<!--  traverse(nodeList);-->
<!--  return result;-->
<!--};-->

<!--const selectedNodes = computed(() => {-->
<!--  const flat = flattenedNodes(nodes.value);-->
<!--  return flat-->
<!--    .filter(node => selectedNodeKeys.value[node.key?.toString()])-->
<!--    .map(node => ({-->
<!--      key: node.key,-->
<!--      leaf: node.leaf,-->
<!--      selectable: node.selectable,-->
<!--      ...node.data,-->
<!--      found_in_search: node.data.found_in_search ? 'Yes' : 'No',-->
<!--    }));-->
<!--});-->


<!--const sliderMin = computed(() => selectedMetric.value === 'jaccard' ? 0 : 0)-->
<!--const sliderMax = computed(() => selectedMetric.value === 'jaccard' ? 1 : 1000)-->
<!--const sliderStep = computed(() => selectedMetric.value === 'jaccard' ? 0.01 : 0.1)-->
<!--const sliderRange = ref([0.05,1])-->
<!--watch(sliderRange, (val, oldVal) => {-->
<!--  if (val[0] > val[1]) {-->
<!--    // Always keep left <= right-->
<!--    sliderRange.value = [Math.min(...val), Math.max(...val)]-->
<!--  }-->
<!--}, { deep: true })-->
<!--const selectedMetric = ref('jaccard')  // default metric-->
<!--const metricOptions = [-->
<!--  { label: 'Jaccard', value: 'jaccard' },-->
<!--  { label: 'Lift', value: 'lift' }-->
<!--]-->
<!--watch(selectedMetric, (newMetric) => {-->
<!--  if (newMetric === 'jaccard') {-->
<!--    sliderRange.value = [0.05, 1]-->
<!--  } else if (newMetric === 'lift') {-->
<!--    sliderRange.value = [5, 1000]-->
<!--  }-->
<!--})-->
<!--function metricTooltip(metric) {-->
<!--  switch (metric) {-->
<!--    case "jaccard":-->
<!--      return "Jaccard index: measures the proportion of shared individuals between two codes. Range: 0 (no overlap) to 1 (all individuals shared)."-->
<!--    case "lift":-->
<!--      return "Lift: measures how much more often two codes occur together than expected by chance. Values >1 indicate positive association."-->
<!--    default:-->
<!--      return "Select a metric to see explanation."-->
<!--  }-->
<!--}-->

<!--// Heatmap chart options-->
<!--const chartOptions = ref({-->
<!--  chart: { height: 350, type: "heatmap" },-->
<!--  dataLabels: { enabled: false },-->
<!--  colors: ["#008FFB"],-->
<!--  xaxis: { categories: [] },-->
<!--  tooltip: {-->
<!--    enabled: true,-->
<!--    shared: false,-->
<!--    custom: function({ series, seriesIndex, dataPointIndex, w }) {-->
<!--      const dataPoint = w.config.series[seriesIndex].data[dataPointIndex]-->
<!--      const meta = dataPoint.meta-->

<!--      if (meta?.message) {-->
<!--        return `-->
<!--          <div style="padding:5px; font-size:13px;">-->
<!--            <strong>${meta.code_i_str}</strong> (${meta.code_i_description})<br>-->
<!--            <strong>${meta.code_j_str}</strong> (${meta.code_j_description})<br>-->
<!--            ${meta.message}-->
<!--          </div>-->
<!--        `-->
<!--      }-->

<!--      return `-->
<!--        <div style="padding:5px; font-size:13px;">-->
<!--          <strong>${meta.code_i_str}</strong> (${meta.code_i_description})<br>-->
<!--          <strong>${meta.code_j_str}</strong> (${meta.code_j_description})<br>-->
<!--          ${meta.metric_name}: ${meta.y.toFixed(3)}-->
<!--        </div>-->
<!--      `-->
<!--    }-->
<!--  }-->
<!--})-->
<!--const analysisResults = ref([])-->
<!--const series = ref([])-->
<!--function buildHeatmapSeries(results, metric) {-->
<!--  if (!results.length) return { series: [], xCategories: [] }-->

<!--  // 1. Extract unique X and Y-->
<!--  const allY = [...new Set(results.map(r => r.code_i_str).filter(Boolean))]-->
<!--  const allX = [...new Set(results.map(r => r.code_j_str).filter(Boolean))]-->

<!--  console.log("Y:", allY)-->
<!--  console.log("X:", allX)-->

<!--  // 2. Build lookup table-->
<!--  const lookup = {}-->
<!--  const descriptions = {}-->
<!--  results.forEach(r => {-->
<!--    const key = `${r.code_i_str}||${r.code_j_str}`-->
<!--    lookup[key] = r-->
<!--    if (r.code_i_str) descriptions[r.code_i_str] = r.code_i_description-->
<!--    if (r.code_j_str) descriptions[r.code_j_str] = r.code_j_description-->
<!--  })-->

<!--  // 3. Build complete heatmap series-->
<!--  const series = allY.map(yLabel => {-->
<!--    const row = allX.map(xLabel => {-->
<!--      const key = `${yLabel}||${xLabel}`-->
<!--      const r = lookup[key]-->

<!--      if (r) {-->
<!--        return {-->
<!--          x: xLabel,-->
<!--          y: r[metric],-->
<!--          meta: {-->
<!--            code_i_str: r.code_i_str,-->
<!--            code_i_description: r.code_i_description,-->
<!--            code_j_str: r.code_j_str,-->
<!--            code_j_description: r.code_j_description,-->
<!--            metric_name: metric,-->
<!--            y: r[metric]-->
<!--          }-->
<!--        }-->
<!--      }-->

<!--      // Missing cell → fill with placeholder, but include descriptions if available-->
<!--      return {-->
<!--        x: xLabel,-->
<!--        y: 0,-->
<!--        meta: {-->
<!--          code_i_str: yLabel,-->
<!--          code_i_description: descriptions[yLabel] ?? "",-->
<!--          code_j_str: xLabel,-->
<!--          code_j_description: descriptions[xLabel] ?? "",-->
<!--          metric_name: metric,-->
<!--          y: 0,-->
<!--          message: "No co-occurrence for this pair - likely low number suppression"-->
<!--        }-->
<!--      }-->
<!--    })-->

<!--    return { name: yLabel, data: row }-->
<!--  })-->

<!--  console.log(series)-->
<!--  return { series, xCategories: allX }-->
<!--}-->
<!--async function runAnalysis() {-->
<!--  const selectedCodeIds = selectedNodes.value.map(n => n.id)-->

<!--  if (!selectedCodeIds.length) {-->
<!--    toast.add({-->
<!--      severity: 'warn',-->
<!--      summary: 'No codes selected',-->
<!--      detail: "Select at least one code to analyze",-->
<!--      life: 3000-->
<!--    });-->
<!--    return-->
<!--  }-->

<!--  try {-->
<!--    const response = await apiClient.post("/api/get-cooccurrence", {-->
<!--      code_ids: selectedCodeIds,-->
<!--      min_threshold: sliderRange.value[0],-->
<!--      max_threshold: sliderRange.value[1],-->
<!--      metric: selectedMetric.value-->
<!--    })-->

<!--    analysisResults.value = response.data.results-->

<!--    // Rebuild heatmap series-->
<!--    const { series: builtSeries, xCategories } =-->
<!--      buildHeatmapSeries(analysisResults.value, selectedMetric.value)-->

<!--    series.value = builtSeries-->

<!--    chartOptions.value = {-->
<!--      ...chartOptions.value,-->
<!--      xaxis: { categories: xCategories }-->
<!--    }-->

<!--    console.log("Analysis results:", analysisResults.value)-->
<!--  } catch (err) {-->
<!--    console.error("Error running analysis:", err)-->
<!--    alert("Failed to fetch co-occurrence data.")-->
<!--  }-->
<!--}-->


<!--onMounted(async () => {-->
<!--  // -&#45;&#45; Your existing logic -&#45;&#45;-->
<!--  await onNodeExpand(null);-->

<!--  searchSystemsOptions.value = nodes.value.map(systemNode => ({-->
<!--    id: systemNode.data.system_id,-->
<!--    name: systemNode.data.code-->
<!--  }));-->

<!--  console.log('Systems for MultiSelect:', searchSystemsOptions.value);-->

<!--  // -&#45;&#45; Supabase auth setup -&#45;&#45;-->
<!--  // 1. Restore session on page load-->
<!--  const { data: { session } } = await useSupabase.auth.getSession()-->
<!--  user.value = session?.user ?? null-->
<!--  // 2. Listen for future login/logout events-->
<!--  useSupabase.auth.onAuthStateChange((_event, session) => {-->
<!--    user.value = session?.user ?? null-->
<!--  })-->
<!--})-->
<!--</script>-->


<!--<template>-->
<!--  &lt;!&ndash; Toasts - messages &ndash;&gt;-->
<!--  <Toast position="bottom-right"/>-->
<!--  <CreateProjectDialog-->
<!--    v-model="showDialog"-->
<!--    @created="handleProjectCreated"-->
<!--  />-->
<!--  <AuthDialogs ref="authDialogs" />-->
<!--  <Button label="Login" @click="authDialogs.showLogin = true" />-->
<!--  <Button label="Sign Up" @click="authDialogs.showSignup = true" />-->

<!--  <div class="app-container">-->
<!--    &lt;!&ndash; Top bar with title and menu &ndash;&gt;-->
<!--    <Menubar :model="menuItems" appendTo="body">-->
<!--      &lt;!&ndash; Title on the left &ndash;&gt;-->
<!--      <template #start>-->
<!--        <div class="menubar-title flex align-items-center">-->
<!--          <i class="pi pi-users title-icon"></i>-->
<!--          <span class="title-text">Code Consensus</span>-->
<!--        </div>-->
<!--        <Divider layout="vertical" />-->
<!--      </template>-->
<!--    </Menubar>-->


<!--    &lt;!&ndash; Configuration Card &ndash;&gt;-->
<!--    <Card>-->
<!--      <template #title>-->
<!--        <div class="regex-header">-->
<!--          <span>Search</span>-->
<!--          <span v-tooltip.top="{ value: 'Add search term', showDelay: 300 }">-->
<!--            <Button-->
<!--              icon="pi pi-plus"-->
<!--              severity="success"-->
<!--              rounded-->
<!--              variant="outlined"-->
<!--              size="small"-->
<!--              @click="addSearchTerm"-->
<!--              aria-label="Add search input"-->
<!--            />-->
<!--          </span>-->
<!--        </div>-->
<!--      </template>-->
<!--      <template #content>-->
<!--        &lt;!&ndash; Search Panel &ndash;&gt;-->
<!--        <div class="panel regex-panel">-->
<!--          <div class="regex-list">-->
<!--            <div v-for="(input, index) in searchInputs" :key="index" class="regex-row">-->
<!--              <InputText-->
<!--                v-tooltip.top="{value: 'Enter search term or regular expression', showDelay: 300}"-->
<!--                type="text"-->
<!--                v-model="input.text"-->
<!--                placeholder="Enter search term"-->
<!--                class="search-line-input"-->
<!--              />-->
<!--              <span v-tooltip.top="{value: 'Regex search', showDelay: 300}">-->
<!--                <ToggleSwitch-->
<!--                    v-model="input.regex"-->
<!--                    class="search-use-regex"-->
<!--                />-->
<!--              </span>-->
<!--              <span v-tooltip.top="{value: 'Apply search to...', showDelay: 300}">-->
<!--                <MultiSelect-->
<!--                    v-model="input.columns"-->
<!--                    :options="searchInOptions"-->
<!--                    optionLabel="label"-->
<!--                    optionValue="value"-->
<!--                    class="search-column"-->
<!--                />-->
<!--              </span>-->
<!--              <span v-tooltip.top="{value: 'Coding systems', showDelay: 300}">-->
<!--                <MultiSelect-->
<!--                    v-model="input.system_ids"-->
<!--                    :options="searchSystemsOptions"-->
<!--                    optionLabel="name"-->
<!--                    optionValue="id"-->
<!--                    class="search-systems" />-->
<!--              </span>-->
<!--              <span v-tooltip.top="{value: 'Remove', showDelay: 300}">-->
<!--                <Button-->
<!--                  icon="pi pi-times"-->
<!--                  severity="danger"-->
<!--                  rounded variant="outlined"-->
<!--                  size="small"-->
<!--                  :disabled="searchInputs.length === 1"-->
<!--                  @click="removeSearchTerm(index)"-->
<!--                  aria-label="Remove search input"-->
<!--                />-->
<!--              </span>-->
<!--            </div>-->
<!--          </div>-->
<!--        </div>-->
<!--      </template>-->
<!--    </Card>-->

<!--    &lt;!&ndash; Run Search Card &ndash;&gt;-->
<!--    <Card>-->
<!--      <template #content>-->
<!--        <div class="search-button-container">-->
<!--          <Button-->
<!--            label="Run Search"-->
<!--            @click="runSearch"-->
<!--          />-->
<!--          <span v-tooltip.top="{value: 'Auto-select search results', showDelay: 300}">-->
<!--            <ToggleSwitch-->
<!--                v-model="autoSelect"-->
<!--                class="auto-select-search"-->
<!--            />-->
<!--          </span>-->
<!--          <Divider layout="vertical" />-->
<!--          <InputText-->
<!--            v-tooltip.top="{value: 'Phenotype name', showDelay: 300}"-->
<!--            type="text"-->
<!--            v-model="phenotype.name"-->
<!--            :invalid="nameError"-->
<!--            placeholder="Enter phenotype name"-->
<!--          />-->
<!--          <SplitButton-->
<!--            label="Save"-->
<!--            @click="mainSaveClick"-->
<!--            :model="saveOptions"-->
<!--          />-->
<!--          <ConfirmPopup></ConfirmPopup>-->
<!--          <Button-->
<!--            @click="confirmDelete($event)"-->
<!--            label="Delete"-->
<!--            severity="danger"-->
<!--            :disabled="!phenotype?.id"-->
<!--          />-->
<!--        </div>-->
<!--      </template>-->
<!--    </Card>-->

<!--    &lt;!&ndash; Trees Section &ndash;&gt;-->
<!--    <Card>-->
<!--      <template #title>Codes</template>-->
<!--      <template #content>-->
<!--        <Tree-->
<!--          v-if="!loading && !errorMessage"-->
<!--          :value="nodes"-->
<!--          selectionMode="multiple"-->
<!--          v-model:selectionKeys="selectedNodeKeys"-->
<!--          v-model:expandedKeys="expandedNodeKeys"-->
<!--          @node-expand="onNodeExpand"-->
<!--          loadingMode="icon"-->
<!--          :lazy="true"-->
<!--        >-->
<!--          <template #default="{ node }">-->
<!--            <span :class="{ 'search-hit': node.data.found_in_search }">-->
<!--              {{ node.label }}-->
<!--            </span>-->
<!--          </template>-->
<!--        </Tree>-->
<!--      </template>-->
<!--    </Card>-->

<!--    &lt;!&ndash; Selected Codes Section &ndash;&gt;-->
<!--    <Card>-->
<!--      <template #title>Selected Codes</template>-->
<!--      <template #content>-->
<!--        <DataTable-->
<!--          :value="selectedNodes"-->
<!--          :emptyMessage="'No nodes selected.'"-->
<!--          responsiveLayout="scroll"-->
<!--          scrollable-->
<!--          scrollHeight="600px"-->
<!--        >-->
<!--          <template #header>-->
<!--            <div class="text-end pb-4">-->
<!--              <Button-->
<!--                  icon="pi pi-trash"-->
<!--                  label="Clear"-->
<!--                  @click="selectedNodeKeys = {}"-->
<!--              />-->
<!--            </div>-->
<!--          </template>-->
<!--          <Column field="code" header="Code" />-->
<!--          <Column field="description" header="Description" />-->
<!--          <Column field="system" header="System" />-->
<!--          <Column field="found_in_search" header="Found in Search"/>-->
<!--        </DataTable>-->
<!--      </template>-->
<!--    </Card>-->

<!--    &lt;!&ndash; Diagnostics Section &ndash;&gt;-->
<!--    <Card class="diagnostic-card-wrapper">-->
<!--      <template #title>Diagnostics</template>-->
<!--      <template #content>-->
<!--        <div class="diagnostic-card-panel">-->

<!--          <div class="diagnostic-card-panel-left">-->
<!--            <apexchart-->
<!--              type="heatmap"-->
<!--              height="350"-->
<!--              :options="chartOptions"-->
<!--              :series="series"-->
<!--              width="100%" />-->
<!--          </div>-->

<!--          <Panel header="Controls" class="diagnostic-card-panel-right">-->
<!--            <div class="control-group">-->
<!--              <label for="metric">Metric</label>-->
<!--              <Select-->
<!--                  v-tooltip.top="metricTooltip(selectedMetric)"-->
<!--                  v-model="selectedMetric"-->
<!--                  :options="metricOptions"-->
<!--                  optionLabel="label"-->
<!--                  optionValue="value"-->
<!--                  placeholder="Select metric"-->
<!--              />-->
<!--              <label for="threshold" class="control-label">Threshold</label>-->
<!--              <div class="slider-wrapper">-->
<!--                <Slider-->
<!--                  v-model="sliderRange"-->
<!--                  range-->
<!--                  :min="sliderMin"-->
<!--                  :max="sliderMax"-->
<!--                  :step="sliderStep"-->
<!--                  id="threshold"-->
<!--                />-->
<!--              </div>-->
<!--              <div class="control-value">Selected: {{ sliderRange[0] }} to {{ sliderRange[1] }}</div>-->
<!--              <Divider />-->
<!--              <Button-->
<!--                  icon="pi pi-play"-->
<!--                  label="Run analysis"-->
<!--                  @click="runAnalysis"-->
<!--              />-->
<!--            </div>-->
<!--          </Panel>-->

<!--        </div>-->
<!--      </template>-->
<!--    </Card>-->

<!--  </div>-->
<!--</template>-->


