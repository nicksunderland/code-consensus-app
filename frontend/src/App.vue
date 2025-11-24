<script setup>
import { ref, computed, watch } from 'vue';
import Menubar from 'primevue/menubar';
import Divider from 'primevue/divider';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import Card from "primevue/card";
import 'primeicons/primeicons.css';
import AuthDialogs from '@/AuthDialogs.vue';
import CreateProjectDialog from "@/CreateProjectDialog.vue";
import TreeSearch from "@/TreeSearch.vue";
import SelectedCodes from "@/CodeSelection.vue";
import Analysis from "@/Analysis.vue";
import Download from "@/Download.vue";
import DerivedPhenotypes from "@/DerivedPhenotypes.vue";
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { useAuth } from '@/composables/useAuth.js'
import { useProjects } from "@/composables/useProjects.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";
import { useMenu } from '@/composables/useMenu.js';
import { useTreeSearch } from "@/composables/useTreeSearch.js";
import {useAnalysis} from "@/composables/useAnalysis.js";
import {useNotifications} from "@/composables/useNotifications.js";
import PhenotypeDefinition from "@/PhenotypeDefinition.vue";
import {useCodeSelection} from "@/composables/useCodeSelection.js";
import {useDownload} from "@/composables/useDownload.js";

// set up toast - need to load the .js globals with toast function
// however have to do in a component file (.vue). Load first so that
// everything can pull a copy of notifications and get access to toasting
const toast = useToast()
const notifications = useNotifications()
notifications.setErrorHandler((summary, error) => {
    toast.add({ severity: 'error', summary, detail: error?.message || String(error), life: 20000 })
})
notifications.setSuccessHandler((summary, detail) => {
    toast.add({ severity: 'success', summary, detail, life: 20000 })
})

//testing delete later
const phenotypes = usePhenotypes()
const projects = useProjects()
const tree = useTreeSearch()
const selection = useCodeSelection()
//

// THINGS FROM COMPOSABLES ---
const { user } = useAuth()
const { menuItems } = useMenu()
const { fetchProjects, emptyProjects } = useProjects()
const { fetchPhenotypes, emptyPhenotypes } = usePhenotypes()
const { isAnalysisActive } = useAnalysis();
const { isDownloadActive } = useDownload();
const { clearTreeState } = useTreeSearch();
const { clearSelectionState } = useCodeSelection();

// --- WATCH USER LOGIN ---
watch(
  user,
  async (newUser) => {
    // console.log("watching user in App.vue")
    if (newUser) {
      // console.log("user valid - fetching")
      await fetchProjects()
      await fetchPhenotypes()
    } else {
      // console.log("user invalid - emptying")
      emptyProjects()
      emptyPhenotypes()
      clearTreeState()
      clearSelectionState()
    }
  },
  { immediate: true } // also runs immediately if user is already logged in
)

const TAB_INDEXES = {
    PHENOTYPE_DEFINITION: '0',
    SEARCH: '1',
    DIAGNOSTICS: '2',
    REVIEW: '3',
    DOWNLOAD: '4'
};
const activeTabs = ref(['5']);//['0', '1']

// --- WATCH TABS ---
watch(activeTabs, (newTabs) => {
  const currentTabs = newTabs || [];
  isAnalysisActive.value = currentTabs.includes(TAB_INDEXES.DIAGNOSTICS);
  isDownloadActive.value = currentTabs.includes(TAB_INDEXES.DOWNLOAD);
}, { immediate: true, deep: true });

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
  </Menubar>
  <!-- Main content -->
  <div class="app-container">
    <Accordion v-model:value="activeTabs" multiple>
      <AccordionPanel value="0">
          <AccordionHeader>Define</AccordionHeader>
          <AccordionContent>
            <PhenotypeDefinition/>
          </AccordionContent>
      </AccordionPanel>
      <AccordionPanel value="1">
          <AccordionHeader>Search</AccordionHeader>
          <AccordionContent>
            <TreeSearch/>
          </AccordionContent>
      </AccordionPanel>
      <AccordionPanel value="2">
          <AccordionHeader>Diagnostics</AccordionHeader>
          <AccordionContent>
            <Analysis/>
          </AccordionContent>
      </AccordionPanel>
      <AccordionPanel value="3">
          <AccordionHeader>Review</AccordionHeader>
          <AccordionContent>
            <SelectedCodes/>
          </AccordionContent>
      </AccordionPanel>
      <AccordionPanel value="4">
          <AccordionHeader>Download</AccordionHeader>
          <AccordionContent>
            <Download/>
          </AccordionContent>
      </AccordionPanel>
      <AccordionPanel value="5">
          <AccordionHeader>Flow</AccordionHeader>
          <AccordionContent>
            <DerivedPhenotypes/>
          </AccordionContent>
      </AccordionPanel>
    </Accordion>



  </div>

</template>

<style scoped>
.app-container {
  padding: 1rem;
}
</style>
