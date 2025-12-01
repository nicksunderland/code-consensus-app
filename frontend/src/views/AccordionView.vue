<script setup>
import { ref, watch, onMounted } from 'vue';
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
import { useCodeSelection } from "@/composables/selection/useCodeSelection.js";

// Import Composables specific to tab logic
import { useAnalysis } from "@/composables/analysis/useAnalysis.js";
import { useDownload } from "@/composables/selection/useDownload.js";
import { usePhenotypes } from "@/composables/project/usePhenotypes.js";

// --- TAB LOGIC ---
const { isAnalysisActive } = useAnalysis();
const { isDownloadActive } = useDownload();
const { rehydrateCurrentPhenotype } = useCodeSelection();
const { currentPhenotype } = usePhenotypes();

const TAB_INDEXES = {
    PHENOTYPE_DEFINITION: '0',
    SEARCH: '1',
    DIAGNOSTICS: '2',
    REVIEW: '3',
    DOWNLOAD: '4'
};

const DEFAULT_OPEN = [TAB_INDEXES.PHENOTYPE_DEFINITION, TAB_INDEXES.SEARCH];
const panels = [
    {
        value: TAB_INDEXES.PHENOTYPE_DEFINITION,
        title: 'Define',
        eyebrow: 'Step 1',
        subtitle: 'Capture phenotype summary, scope, and owners.',
        icon: 'pi-pencil',
        component: PhenotypeDefinition
    },
    {
        value: TAB_INDEXES.SEARCH,
        title: 'Search',
        eyebrow: 'Step 2',
        subtitle: 'Build search terms and pull candidate codes.',
        icon: 'pi-search',
        component: TreeSearch
    },
    {
        value: TAB_INDEXES.DIAGNOSTICS,
        title: 'Diagnostics',
        eyebrow: 'Step 3',
        subtitle: 'Inspect co-occurrence patterns and metrics.',
        icon: 'pi-chart-line',
        component: Analysis
    },
    {
        value: TAB_INDEXES.REVIEW,
        title: 'Review',
        eyebrow: 'Step 4',
        subtitle: 'Select and finalize consensus codes.',
        icon: 'pi-check-circle',
        component: SelectedCodes
    },
    {
        value: TAB_INDEXES.DOWNLOAD,
        title: 'Download',
        eyebrow: 'Step 5',
        subtitle: 'Export phenotype codes and meta-data.',
        icon: 'pi-download',
        component: Download
    }
];

const activeTabs = ref([...DEFAULT_OPEN]);

onMounted(() => {
  rehydrateCurrentPhenotype();
});

watch(activeTabs, (newTabs) => {
  const currentTabs = newTabs || [];
  isAnalysisActive.value = currentTabs.includes(TAB_INDEXES.DIAGNOSTICS);
  isDownloadActive.value = currentTabs.includes(TAB_INDEXES.DOWNLOAD);
}, { immediate: true, deep: true });

</script>

<template>
  <div class="accordion-container">
    <div class="active-phenotype" v-if="currentPhenotype?.name">
      <p class="eyebrow">Active phenotype</p>
      <h2>{{ currentPhenotype.name }}</h2>
    </div>
    <Accordion v-model:value="activeTabs" multiple>
      <AccordionPanel v-for="panel in panels" :key="panel.value" :value="panel.value">
          <AccordionHeader>
            <div class="panel-header">
              <div class="icon-pill">
                <i class="pi" :class="panel.icon"></i>
              </div>
              <div class="panel-copy">
                <div class="panel-top">
                  <span class="eyebrow">{{ panel.eyebrow }}</span>
                  <span class="panel-title">{{ panel.title }}</span>
                </div>
                <span class="subtext muted">{{ panel.subtitle }}</span>
              </div>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <component :is="panel.component" />
          </AccordionContent>
      </AccordionPanel>
    </Accordion>
    <Footer/>
  </div>
</template>

<style scoped>
.accordion-container {
  padding: 2rem 1.5rem 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  min-height: 85vh;
}

:deep(.active-phenotype h2) {
  margin: 0.2rem 0 0;
}

.active-phenotype {
  max-width: 1200px;
  margin: 0 auto 0.25rem auto;
  text-align: center;
}

:deep(.p-accordion-panel) {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  margin-bottom: 1rem;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 75%);
  box-shadow: 0 10px 30px -20px rgba(15, 23, 42, 0.25);
}

:deep(.p-accordion-header-action) {
  padding: 0.85rem 1rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.icon-pill {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #ecfeff;
  display: grid;
  place-items: center;
  color: #0ea5e9;
  border: 1px solid #bae6fd;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

.panel-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.panel-top {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 1.08rem;
  font-weight: 700;
  color: #0f172a;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
  color: #0ea5e9;
  font-weight: 700;
}

.muted {
  color: #94a3b8;
  font-style: italic;
}

.subtext {
  font-size: 0.9rem;
  line-height: 1.2;
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 400;
}

:deep(.p-accordion-content) {
  background: #fff;
  border-top: 1px solid #e2e8f0;
  padding: 1.25rem;
}

@media (max-width: 768px) {
  .accordion-container {
    padding: 2rem 1rem 0 1rem;
  }
  .panel-title {
    font-size: 1rem;
  }
  :deep(.p-accordion-header-action) {
    padding: 0.75rem 0.85rem;
  }
}
</style>
