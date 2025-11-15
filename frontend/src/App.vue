<script setup>
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';
import Menubar from 'primevue/menubar';
import ToggleSwitch from 'primevue/toggleswitch';
import MultiSelect from 'primevue/multiselect';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Tooltip from 'primevue/tooltip';
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Chart from 'primevue/chart';
import Divider from 'primevue/divider';
import SplitButton from 'primevue/splitbutton';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Tree from 'primevue/tree';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import 'primeicons/primeicons.css';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import VueApexCharts from "vue3-apexcharts"

const BASE_URL = import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://code-consensus.fly.dev';

const apiClient = axios.create({ baseURL: BASE_URL });


//define save things
const saveOptions = [
  {
    label: 'Save',
    icon: 'pi pi-save',
    command: () => save('save')
  },
  {
    label: 'Update',
    icon: 'pi pi-refresh',
    command: () => save('update')
  }
];

function mainSaveClick(event) {
  // event is the PointerEvent, ignore it
  save('save');
}

function save(action) {
  console.log(`Action "${action}" is under development`);
  toast.add({
    severity: 'info',
    summary: 'Not implemented',
    detail: `"${action}" is under development`,
    life: 3000
  });
}

// Define the search things
const autoSelect = ref(false);
const searchInOptions = ref([
  { label: 'Codes', value: 'code' },
  { label: 'Description', value: 'description' }
]);
const searchSystemsOptions = ref([
  { name: 'ICD-10', id: 1 }
]);
const makeSearchInput = () => ({
  text: '',
  regex: false,
  system_ids: searchSystemsOptions.value.map(opt => opt.id),
  columns: searchInOptions.value.map(opt => opt.value)
})
const searchInputs = ref([makeSearchInput()]);


const addSearchTerm = () => searchInputs.value.push(makeSearchInput())
const removeSearchTerm = (index) => {
  if (searchInputs.value.length > 1) {
    searchInputs.value.splice(index, 1)
  }
}


const nodes = ref([]);
const selectedNodeKeys = ref({});
const expandedNodeKeys = ref({});
const descriptionSearch = ref('');
const searchExecuted = ref(false);
const loading = ref(false);
const errorMessage = ref('');

// Pop-out messages and warnings
const toast = useToast();

// menu
const menuItems = ref([
  {
    label: 'Examples',
    items: [
      { label: 'Heart failure', icon: 'pi pi-fw pi-heart' },
      { label: 'Coronary artery disease', icon: 'pi pi-heart-fill' }
    ]
  },
  {
    label: 'Help',
    items: [
      { label: 'Documentation', icon: 'pi pi-fw pi-book' },
      { label: 'About', icon: 'pi pi-fw pi-info-circle' }
    ]
  }
]);

// Lazy-loading children
const onNodeExpand = async (node) => {
  const isRoot = !node;
  const parentId = isRoot ? null : node.key;

  if (isRoot || !node.leaf) {
    if (node) node.loading = true;
    try {
      const res = await apiClient.get('/api/tree-nodes', { params: { parent_id: parentId } });
      const children = res.data.map(child => ({ ...child }));
      if (isRoot) {
        nodes.value = children;
        console.log('Root nodes loaded:', nodes.value);
      } else {
        node.children = children;
        console.log('Node after assigning children:', node);
      }
    } catch (err) {
      console.error('Failed to load children for node', node.key, err);
    } finally {
      if (node) node.loading = false;
    }
  }
};

// Ensures the root nodes load when page loads
onMounted(async () => {
  // 1. Wait for the root nodes (systems) to be fetched and loaded into 'nodes.value'
  await onNodeExpand(null);

  // 2. Now that 'nodes.value' has the data, map it for your MultiSelect
  searchSystemsOptions.value = nodes.value.map(systemNode => {
    // Assumes your API response (in 'systemNode.data') has id and code
    return {
      id: systemNode.data.system_id, // e.g., 1
      name: systemNode.data.code     // e.g., "ICD-10"
    };
  });

  console.log('Systems for MultiSelect:', searchSystemsOptions.value);
});

const runSearch = async () => {
  // Build payload for the simplified backend
  const payload = {
    searches: searchInputs.value
      .filter(input => input.text.trim()) // ignore completely empty inputs
      .map(input => ({
        text: input.text.trim(),
        regex: input.regex,
        columns: input.columns,        // e.g., ["code", "description"]
        system_ids: input.system_ids   // e.g., [1, 2]
      })),
    limit: 100
  };

  console.log('Payload:', payload);

  if (payload.searches.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'No Search Input',
      detail: 'Please enter at least one search term.',
      life: 4000
    });
    return;
  }

  // Format a user-friendly string for toast
  const getSystemNames = (ids) =>
    ids.map(id => searchSystemsOptions.value.find(s => s.id === id)?.name || id).join(', ');

  const getColumnLabels = (values) =>
    values.map(val => searchInOptions.value.find(c => c.value === val)?.label || val).join(', ');

  const formattedTerms = payload.searches
    .map((input, i) => {
      const regex = input.regex ? ' [regex]' : '';
      const systems = input.system_ids.length ? ` [systems: ${getSystemNames(input.system_ids)}]` : '';
      const columns = input.columns.length ? ` [columns: ${getColumnLabels(input.columns)}]` : '';
      return `${i + 1}: "${input.text}"${regex}${systems}${columns}`;
    })
    .join('\n');

  toast.add({
    severity: 'info',
    summary: 'Search in Progress',
    detail: formattedTerms,
    life: 5000
  });

  try {
    // Send payload in POST body
    const res = await apiClient.post('/api/search-nodes', payload);
    console.log('Search results:', res.data);

    mergeSearchNodesIntoTree({
      results: res.data.results,
      ancestor_map: res.data.ancestor_map,
      treeNodes: nodes.value,
      expandedKeys: expandedNodeKeys
    });

    toast.add({
      severity: 'success',
      summary: 'Search Successful',
      detail: `${res.data.results.length} items retrieved from server.`,
      life: 5000,
    });

  } catch (err) {
    console.error('Search failed', err);
    toast.add({
      severity: 'error',
      summary: 'Search Failed',
      detail: err?.response?.data?.detail || 'Server error occurred.',
      life: 5000,
    });
  }
};

function clearSearchFlags(nodes) {
  if (!Array.isArray(nodes)) return;
  nodes.forEach(node => {
    if (node.data) {
      node.data.found_in_search = false;
    }
    if (Array.isArray(node.children) && node.children.length) {
      clearSearchFlags(node.children);
    }
  });
}



function mergeSearchNodesIntoTree({ results, ancestor_map }) {
  console.log("=== mergeSearchNodesIntoTree ===");
  console.log("Results array length:", results.length);
  console.log("Initial nodes.value:", nodes.value);

   // 🔹 Reset all existing found_in_search flags before applying new search results
  clearSearchFlags(nodes.value);

  const searchResultIds = new Set(results.map(r => r.key));

  results.forEach((result, resultIndex) => {

    const pathIds = result.data.materialized_path.split('/').filter(Boolean);

    let currentLevel = nodes.value; // assuming nodes is a ref
    console.log(`\nProcessing result #${resultIndex}, pathIds:`, pathIds);

    pathIds.forEach((id, index) => {
      console.log(`  At path index ${index}, id: ${id}`);
      console.log("  currentLevel before find:", currentLevel);

      if (!Array.isArray(currentLevel)) {
        console.error('currentLevel is not an array!', currentLevel);
        currentLevel = [];
      }

      let node = currentLevel.find(n => n.key === id);
      console.log("  Found node:", node);

      if (!node) {
        // Use ancestor_map if available, otherwise fallback to result
        const source = ancestor_map[id] || result;
        node = {
          key: id.toString(),
          label: source.label,           // label for display
          children: [],
          leaf: index === pathIds.length - 1,
          selectable: source.data.is_selectable,
          data: {                        // preserve the original data object
            ...source.data,
            found_in_search: searchResultIds.has(id)
          }
        };

        currentLevel.push(node);
        console.log("  Created new node:", node);

      } else {
        // Node already exists, update search hit if applicable
        if (searchResultIds.has(id)) {
          node.data = { ...node.data, found_in_search: true };
          console.log("  Updated existing node as search hit:", node);
        }
      }

      // Mark ancestors as expanded
      if (index < pathIds.length - 1) {
        expandedNodeKeys.value[id] = true;
      }

      currentLevel = node.children = node.children || [];
      console.log("  currentLevel after update:", currentLevel);
    });
  });
}

const flattenedNodes = (nodeList) => {
  const result = [];

  const traverse = (nodes) => {
    if (!Array.isArray(nodes)) return;

    nodes.forEach((node) => {
      result.push(node);

      if (Array.isArray(node.children) && node.children.length) {
        traverse(node.children);
      }
    });
  };

  traverse(nodeList);
  return result;
};

const selectedNodes = computed(() => {
  const flat = flattenedNodes(nodes.value);
  return flat
    .filter(node => selectedNodeKeys.value[node.key?.toString()])
    .map(node => ({
      key: node.key,
      leaf: node.leaf,
      selectable: node.selectable,
      ...node.data,
      found_in_search: node.data.found_in_search ? 'Yes' : 'No',
    }));
});


const sliderMin = computed(() => selectedMetric.value === 'jaccard' ? 0 : 0)
const sliderMax = computed(() => selectedMetric.value === 'jaccard' ? 1 : 1000)
const sliderStep = computed(() => selectedMetric.value === 'jaccard' ? 0.01 : 0.1)
const sliderRange = ref([0.05,1])
watch(sliderRange, (val, oldVal) => {
  if (val[0] > val[1]) {
    // Always keep left <= right
    sliderRange.value = [Math.min(...val), Math.max(...val)]
  }
}, { deep: true })
const selectedMetric = ref('jaccard')  // default metric
const metricOptions = [
  { label: 'Jaccard', value: 'jaccard' },
  { label: 'Lift', value: 'lift' }
]
watch(selectedMetric, (newMetric) => {
  if (newMetric === 'jaccard') {
    sliderRange.value = [0.05, 1]
  } else if (newMetric === 'lift') {
    sliderRange.value = [5, 1000]
  }
})
function metricTooltip(metric) {
  switch (metric) {
    case "jaccard":
      return "Jaccard index: measures the proportion of shared individuals between two codes. Range: 0 (no overlap) to 1 (all individuals shared)."
    case "lift":
      return "Lift: measures how much more often two codes occur together than expected by chance. Values >1 indicate positive association."
    default:
      return "Select a metric to see explanation."
  }
}

// Heatmap chart options
const chartOptions = ref({
  chart: { height: 350, type: "heatmap" },
  dataLabels: { enabled: false },
  colors: ["#008FFB"],
  xaxis: { categories: [] },
  tooltip: {
    enabled: true,
    shared: false,
    custom: function({ series, seriesIndex, dataPointIndex, w }) {
      const dataPoint = w.config.series[seriesIndex].data[dataPointIndex]
      const meta = dataPoint.meta

      if (meta?.message) {
        return `
          <div style="padding:5px; font-size:13px;">
            <strong>${meta.code_i_str}</strong> (${meta.code_i_description})<br>
            <strong>${meta.code_j_str}</strong> (${meta.code_j_description})<br>
            ${meta.message}
          </div>
        `
      }

      return `
        <div style="padding:5px; font-size:13px;">
          <strong>${meta.code_i_str}</strong> (${meta.code_i_description})<br>
          <strong>${meta.code_j_str}</strong> (${meta.code_j_description})<br>
          ${meta.metric_name}: ${meta.y.toFixed(3)}
        </div>
      `
    }
  }
})
const analysisResults = ref([])
const series = ref([])
function buildHeatmapSeries(results, metric) {
  if (!results.length) return { series: [], xCategories: [] }

  // 1. Extract unique X and Y
  const allY = [...new Set(results.map(r => r.code_i_str).filter(Boolean))]
  const allX = [...new Set(results.map(r => r.code_j_str).filter(Boolean))]

  console.log("Y:", allY)
  console.log("X:", allX)

  // 2. Build lookup table
  const lookup = {}
  const descriptions = {}
  results.forEach(r => {
    const key = `${r.code_i_str}||${r.code_j_str}`
    lookup[key] = r
    if (r.code_i_str) descriptions[r.code_i_str] = r.code_i_description
    if (r.code_j_str) descriptions[r.code_j_str] = r.code_j_description
  })

  // 3. Build complete heatmap series
  const series = allY.map(yLabel => {
    const row = allX.map(xLabel => {
      const key = `${yLabel}||${xLabel}`
      const r = lookup[key]

      if (r) {
        return {
          x: xLabel,
          y: r[metric],
          meta: {
            code_i_str: r.code_i_str,
            code_i_description: r.code_i_description,
            code_j_str: r.code_j_str,
            code_j_description: r.code_j_description,
            metric_name: metric,
            y: r[metric]
          }
        }
      }

      // Missing cell → fill with placeholder, but include descriptions if available
      return {
        x: xLabel,
        y: 0,
        meta: {
          code_i_str: yLabel,
          code_i_description: descriptions[yLabel] ?? "",
          code_j_str: xLabel,
          code_j_description: descriptions[xLabel] ?? "",
          metric_name: metric,
          y: 0,
          message: "No co-occurrence for this pair - likely low number suppression"
        }
      }
    })

    return { name: yLabel, data: row }
  })

  console.log(series)
  return { series, xCategories: allX }
}
async function runAnalysis() {
  const selectedCodeIds = selectedNodes.value.map(n => n.id)

  if (!selectedCodeIds.length) {
    toast.add({
      severity: 'warn',
      summary: 'No codes selected',
      detail: "Select at least one code to analyze",
      life: 3000
    });
    return
  }

  try {
    const response = await apiClient.post("/api/get-cooccurrence", {
      code_ids: selectedCodeIds,
      min_threshold: sliderRange.value[0],
      max_threshold: sliderRange.value[1],
      metric: selectedMetric.value
    })

    analysisResults.value = response.data.results

    // Rebuild heatmap series
    const { series: builtSeries, xCategories } =
      buildHeatmapSeries(analysisResults.value, selectedMetric.value)

    series.value = builtSeries

    chartOptions.value = {
      ...chartOptions.value,
      xaxis: { categories: xCategories }
    }

    console.log("Analysis results:", analysisResults.value)
  } catch (err) {
    console.error("Error running analysis:", err)
    alert("Failed to fetch co-occurrence data.")
  }
}


</script>


<template>
  <!-- Toasts - messages -->
  <Toast position="bottom-right"/>

  <div class="app-container">
    <!-- Top bar with title and menu -->
    <Menubar>
      <!-- Title on the left -->
      <template #start>
        <div class="menubar-title flex align-items-center">
          <i class="pi pi-users title-icon"></i>
          <span class="title-text">Code Consensus</span>
        </div>
      </template>

      <!-- Menu items on the right -->
      <template #end>
        <Menubar :model="menuItems" />
      </template>
    </Menubar>


    <!-- Configuration Card -->
    <Card>
      <template #title>
        <div class="regex-header">
          <span>Search</span>
          <span v-tooltip.top="{ value: 'Add search term', showDelay: 300 }">
            <Button
              icon="pi pi-plus"
              severity="success"
              rounded
              variant="outlined"
              size="small"
              @click="addSearchTerm"
              aria-label="Add search input"
            />
          </span>
        </div>
      </template>
      <template #content>
        <!-- Search Panel -->
        <div class="panel regex-panel">
          <div class="regex-list">
            <div v-for="(input, index) in searchInputs" :key="index" class="regex-row">
              <InputText
                v-tooltip.top="{value: 'Enter search term or regular expression', showDelay: 300}"
                type="text"
                v-model="input.text"
                placeholder="Enter search term"
                class="search-line-input"
              />
              <span v-tooltip.top="{value: 'Regex search', showDelay: 300}">
                <ToggleSwitch
                    v-model="input.regex"
                    class="search-use-regex"
                />
              </span>
              <span v-tooltip.top="{value: 'Apply search to...', showDelay: 300}">
                <MultiSelect
                    v-model="input.columns"
                    :options="searchInOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="search-column"
                />
              </span>
              <span v-tooltip.top="{value: 'Coding systems', showDelay: 300}">
                <MultiSelect
                    v-model="input.system_ids"
                    :options="searchSystemsOptions"
                    optionLabel="name"
                    optionValue="id"
                    class="search-systems" />
              </span>
              <span v-tooltip.top="{value: 'Remove', showDelay: 300}">
                <Button
                  icon="pi pi-times"
                  severity="danger"
                  rounded variant="outlined"
                  size="small"
                  :disabled="searchInputs.length === 1"
                  @click="removeSearchTerm(index)"
                  aria-label="Remove search input"
                />
              </span>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Run Search Card -->
    <Card>
      <template #content>
        <div class="search-button-container">
          <Button
            label="Run Search"
            @click="runSearch"
          />
          <span v-tooltip.top="{value: 'Auto-select search results', showDelay: 300}">
            <ToggleSwitch
                v-model="autoSelect"
                class="auto-select-search"
            />
          </span>
          <SplitButton
            label="Save"
            @click="mainSaveClick"
            :model="saveOptions"
          />
        </div>
      </template>
    </Card>

    <!-- Trees Section -->
    <Card>
      <template #title>Codes</template>
      <template #content>
        <Tree
          v-if="!loading && !errorMessage"
          :value="nodes"
          selectionMode="multiple"
          v-model:selectionKeys="selectedNodeKeys"
          v-model:expandedKeys="expandedNodeKeys"
          @node-expand="onNodeExpand"
          loadingMode="icon"
          :lazy="true"
        >
          <template #default="{ node }">
            <span :class="{ 'search-hit': node.data.found_in_search }">
              {{ node.label }}
            </span>
          </template>
        </Tree>
      </template>
    </Card>

    <!-- Selected Codes Section -->
    <Card>
      <template #title>Selected Codes</template>
      <template #content>
        <DataTable
          :value="selectedNodes"
          :emptyMessage="'No nodes selected.'"
          responsiveLayout="scroll"
          scrollable
          scrollHeight="600px"
        >
          <template #header>
            <div class="text-end pb-4">
              <Button
                  icon="pi pi-trash"
                  label="Clear"
                  @click="selectedNodeKeys = {}"
              />
            </div>
          </template>
          <Column field="code" header="Code" />
          <Column field="description" header="Description" />
          <Column field="system" header="System" />
          <Column field="found_in_search" header="Found in Search"/>
        </DataTable>
      </template>
    </Card>

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

  </div>
</template>


