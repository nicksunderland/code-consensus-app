import { ref, computed, watch, reactive } from "vue"
import { apiClient } from '@/composables/apiClient.js'
import { useNotifications } from './useNotifications'
import {useTreeSearch} from "@/composables/useTreeSearch.js";

// required composables
const { emitError, emitSuccess } = useNotifications()
const treeSearch = useTreeSearch()

// -----------------------------
// GLOBAL STATE
// -----------------------------
const sliderMin = computed(() => selectedMetric.value === 'jaccard' ? 0 : 0)
const sliderMax = computed(() => selectedMetric.value === 'jaccard' ? 1 : 1000)
const sliderStep = computed(() => selectedMetric.value === 'jaccard' ? 0.01 : 0.1)
const sliderRange = ref([0.05, 1])

watch(
  sliderRange,
  (val) => {
    sliderRange.min = Math.min(val.min, val.max)
    sliderRange.max = Math.max(val.min, val.max)
  },
  { deep: true }
)

const selectedMetric = ref('jaccard')  // default metric
const metricOptions = [
  { label: 'Jaccard', value: 'jaccard' },
  { label: 'Lift', value: 'lift' }
]
const analysisResults = ref([])
const series = ref([])
watch(selectedMetric, (newMetric) => {
  if (newMetric === 'jaccard') {
    sliderRange.value = [0.05, 1]
  } else if (newMetric === 'lift') {
    sliderRange.value = [5, 1000]
  }
})

export function useAnalysis( ) {

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
        chart: {height: 350, type: "heatmap"},
        dataLabels: {enabled: false},
        colors: ["#008FFB"],
        xaxis: {categories: []},
        tooltip: {
            enabled: true,
            shared: false,
            custom: function ({series, seriesIndex, dataPointIndex, w}) {
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


    function buildHeatmapSeries(results, metric) {
        if (!results.length) return {series: [], xCategories: []}

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

            return {name: yLabel, data: row}
        })

        console.log(series)
        return {series, xCategories: allX}
    }

    async function runAnalysis() {
        const selectedCodeIds = treeSearch.selectedNodes.value.map(n => n.id)

        if (!selectedCodeIds.length) {
            emitError("No codes selected", "Select at least one code to analyze");
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
            const {series: builtSeries, xCategories} =
                buildHeatmapSeries(analysisResults.value, selectedMetric.value)

            series.value = builtSeries

            chartOptions.value = {
                ...chartOptions.value,
                xaxis: {categories: xCategories}
            }

            console.log("Analysis results:", analysisResults.value)
        } catch (err) {
            console.error("Error running analysis:", err)
            alert("Failed to fetch co-occurrence data.")
        }
    }

    return {
        sliderRange,
        sliderMin,
        sliderMax,
        sliderStep,
        selectedMetric,
        chartOptions,
        series,
        metricOptions,
        runAnalysis,
        metricTooltip
    }
}
