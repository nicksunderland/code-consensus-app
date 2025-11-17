<script setup>

import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Divider from 'primevue/divider';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import Select from 'primevue/select';
import 'primeicons/primeicons.css';


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
            :options="chartOptions"
            :series="series"
            width="100%" />
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
                :min="sliderMin"
                :max="sliderMax"
                :step="sliderStep"
                id="threshold"
              />
            </div>
            <div class="control-value">Selected: {{ sliderRange[0] }} to {{ sliderRange[1] }}</div>
            <Divider />
            <Button
                icon="pi pi-play"
                label="Run analysis"
                @click="runAnalysis"
            />
          </div>
        </Panel>

      </div>
    </template>
  </Card>

</template>

<style scoped>

</style>