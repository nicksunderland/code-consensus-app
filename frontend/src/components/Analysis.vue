<script setup>
import { ref, watch } from "vue"
import apexchart from "vue3-apexcharts"
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Divider from 'primevue/divider';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import Select from 'primevue/select';
import 'primeicons/primeicons.css';
import { useAnalysis } from "@/composables/analysis/useAnalysis.js";
import {useCodeSelection} from "@/composables/selection/useCodeSelection.js";
import Tooltip from 'primevue/tooltip';
import Popover from 'primevue/popover';

// Destructure composable to get auto-unwrapped refs
const {
  isAnalysisActive,
  selectedMetric,
  sliderRange,   // The actual handle values [min, max]
  sliderBounds,  // The track limits { min, max, step }
  chartOptions,
  series,
  metricOptions,
  runAnalysis,
  metricTooltip
} = useAnalysis();

const suppressionRef = ref();
const showSuppression = (event) => {
  if (suppressionRef.value) {
    suppressionRef.value.toggle(event);
  }
};

</script>

<template>

  <!-- Diagnostics Section -->
  <Card class="diagnostic-card-wrapper">
    <template #content>
      <div class="diagnostic-card-panel">

        <div class="diagnostic-card-panel-left">
          <apexchart
            v-if="isAnalysisActive && series.length > 0"
            :type="chartOptions.chart?.type || 'heatmap'"
            height="350"
            :options="chartOptions"
            :series="series"
            width="100%" />

          <div v-if="isAnalysisActive && series.length === 0" class="empty-chart-placeholder">
              <i class="pi pi-chart-bar" style="font-size: 2rem; color: #ccc;"></i>
              <p>Run analysis to view heatmap</p>
          </div>
        </div>

        <Panel header="Controls" class="diagnostic-card-panel-right">
          <div class="control-group">
            <label for="metric">Metric</label>
            <Select
                v-tooltip.top="metricTooltip(selectedMetric)"
                v-model="selectedMetric"
                :options="metricOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select metric"
            />
            <label for="threshold" class="control-label">Threshold</label>
            <div class="slider-wrapper">
              <Slider
                v-model="sliderRange"
                range
                :min="sliderBounds.min"
                :max="sliderBounds.max"
                :step="sliderBounds.step"
                id="threshold"
              />
            </div>
            <div class="control-value">
              Selected: {{ sliderRange[0] }} to {{ sliderRange[1] }}
            </div>
            <Divider />
            <Button
                icon="pi pi-play"
                label="Run analysis"
                @click="runAnalysis"
                severity="contrast"
            />
            <div class="suppression-note">
              <Button text size="small" icon="pi pi-info-circle" @click="showSuppression" aria-label="Suppression info" />
              <span>Counts under 100 are suppressed across metrics.</span>
              <Popover ref="suppressionRef">
                <div class="suppression-content">
                  <p><strong>Low-number suppression</strong></p>
                  <p>Counts below 100 are hidden to protect privacy. This applies to all diagnostics and may show gaps or zeros in the heatmap.</p>
                  <a href="https://community.ukbiobank.ac.uk/hc/en-gb/articles/24842092764061-Reporting-small-numbers-in-results-in-research-outputs-using-UK-Biobank-data" target="_blank" rel="noreferrer">UK Biobank guidance</a>
                </div>
              </Popover>
            </div>
          </div>
        </Panel>

      </div>
    </template>
  </Card>

</template>

<style scoped>
.diagnostic-card-wrapper {
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 70%);
}

.diagnostic-card-panel {
  display: flex;
  gap: 0.75rem;
}

.diagnostic-card-panel-left {
  flex: 1 1 auto;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem;
  min-height: 400px;
  background: #fff;
}

.diagnostic-card-panel-right {
  flex: 0 0 320px;
  background: #fff;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.control-group label {
  font-weight: 600;
  color: #0f172a;
}

.slider-wrapper {
  padding: 0.25rem 0.25rem 0.5rem 0.25rem;
}

.control-label {
  margin-top: 0.5rem;
}

.control-value {
  font-size: 0.9rem;
  color: #475569;
}

.empty-chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  color: #94a3b8;
}

.suppression-note {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #475569;
}

.suppression-content {
  max-width: 280px;
  font-size: 0.9rem;
  color: #0f172a;
}

.suppression-content p {
  margin: 0.25rem 0;
}

.suppression-content a {
  color: #0ea5e9;
  text-decoration: none;
}

.suppression-content a:hover {
  text-decoration: underline;
}

@media (max-width: 960px) {
  .diagnostic-card-panel {
    grid-template-columns: 1fr;
  }
}
</style>
