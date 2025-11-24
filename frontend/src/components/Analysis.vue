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
import { useAnalysis } from "@/composables/useAnalysis.js";
import {useCodeSelection} from "@/composables/useCodeSelection.js";

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


</script>

<template>

  <!-- Diagnostics Section -->
  <Card class="diagnostic-card-wrapper">
    <template #content>
      <div class="diagnostic-card-panel">

        <div class="diagnostic-card-panel-left">
          <apexchart
            v-if="isAnalysisActive && series.length > 0"
            type="heatmap"
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
          </div>
        </Panel>

      </div>
    </template>
  </Card>

</template>

