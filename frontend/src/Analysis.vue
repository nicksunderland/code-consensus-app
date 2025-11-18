<script setup>
import { toRefs } from "vue"
import apexchart from "vue3-apexcharts"
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Divider from 'primevue/divider';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import Select from 'primevue/select';
import 'primeicons/primeicons.css';
import { useAnalysis } from "@/composables/useAnalysis.js";

// keep reactivity
const analysis = useAnalysis();

</script>

<template>

  <!-- Diagnostics Section -->
  <Card class="diagnostic-card-wrapper">
    <template #title>Diagnostics</template>
    <template #content>
      <div class="diagnostic-card-panel">

        <div class="diagnostic-card-panel-left">
          <apexchart
            type="heatmap"
            height="350"
            :options="analysis.chartOptions.value"
            :series="analysis.series.value"
            width="100%" />
        </div>

        <Panel header="Controls" class="diagnostic-card-panel-right">
          <div class="control-group">
            <label for="metric">Metric</label>
            <Select
                v-tooltip.top="analysis.metricTooltip(analysis.selectedMetric)"
                v-model="analysis.selectedMetric"
                :options="analysis.metricOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select metric"
            />
            <label for="threshold" class="control-label">Threshold</label>
            <div class="slider-wrapper">
              <Slider
                v-model="analysis.sliderRange.value"
                range
                :min="analysis.sliderMin.value"
                :max="analysis.sliderMax.value"
                :step="analysis.sliderStep.value"
                id="threshold"
              />
            </div>
            <div class="control-value">
              Selected: {{ analysis.sliderRange.value[0] }} to {{ analysis.sliderRange.value[1] }}
            </div>
            <Divider />
            <Button
                icon="pi pi-play"
                label="Run analysis"
                @click="analysis.runAnalysis"
            />
          </div>
        </Panel>

      </div>
    </template>
  </Card>

</template>
