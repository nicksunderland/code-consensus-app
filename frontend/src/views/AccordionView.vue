<script setup>
import { ref, watch } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import Footer from "@/components/Footer.vue";
import 'primeicons/primeicons.css';

// Import specific tab components
import TreeSearch from "@/components/TreeSearch.vue";
import SelectedCodes from "@/components/CodeSelection.vue";
import Analysis from "@/components/Analysis.vue";
import Download from "@/components/Download.vue";
import DerivedPhenotypes from "@/views/PhenoFlowView.vue";
import PhenotypeDefinition from "@/components/PhenotypeDefinition.vue";

// Import Composables specific to tab logic
import { useAnalysis } from "@/composables/analysis/useAnalysis.js";
import { useDownload } from "@/composables/selection/useDownload.js";

// --- TAB LOGIC ---
const { isAnalysisActive } = useAnalysis();
const { isDownloadActive } = useDownload();

const TAB_INDEXES = {
    PHENOTYPE_DEFINITION: '0',
    SEARCH: '1',
    DIAGNOSTICS: '2',
    REVIEW: '3',
    DOWNLOAD: '4'
};

const activeTabs = ref(['0', '1']);

watch(activeTabs, (newTabs) => {
  const currentTabs = newTabs || [];
  isAnalysisActive.value = currentTabs.includes(TAB_INDEXES.DIAGNOSTICS);
  isDownloadActive.value = currentTabs.includes(TAB_INDEXES.DOWNLOAD);
}, { immediate: true, deep: true });

</script>

<template>
  <div class="accordion-container">
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
    </Accordion>
    <Footer/>
  </div>
</template>

<style scoped>
.accordion-container {
  padding: 3rem 1.5rem 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 5rem;
  min-height: 85vh;
}
</style>