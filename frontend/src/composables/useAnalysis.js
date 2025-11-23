import { ref, computed, watch, reactive } from "vue"
import { apiClient } from '@/composables/apiClient.js'
import { useNotifications } from './useNotifications'
import { useCodeSelection } from "@/composables/useCodeSelection.js";

// composables


// -----------------------------
// GLOBAL STATE
// -----------------------------
const isAnalysisActive = ref(false); // Default to OFF if accordion is shut - prevent API calls until user opens it
const selectedMetric = ref('jaccard')  // default metric
const sliderRange = ref([0, 1]) // The actual handle positions
const sliderBounds = reactive({ min: 0, max: 1, step: 0.01 })
const boundsCache = ref({
    jaccard: { min: 0, max: 1 },
    lift: { min: 0, max: 10 }
})
const metricOptions = [
  { label: 'Jaccard', value: 'jaccard' },
  { label: 'Lift', value: 'lift' }
]

// data
const statsMap = ref({});
const series = ref([])
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

// const functions
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

// Flag to ensure we don't create duplicate watchers
let watchersInitialized = false;

export function useAnalysis() {
    // Get dependencies inside the composable function
    const { emitError, emitSuccess } = useNotifications()
    const { tableRows} = useCodeSelection()

    // ------------------------------------------
    // HELPER: Apply Bounds to Slider
    // ------------------------------------------
    // We call this when API returns OR when Metric changes
    const applySliderSettings = (metric) => {
        const bounds = boundsCache.value[metric]

        // 1. Set Track Limits
        sliderBounds.min = bounds.min
        sliderBounds.max = bounds.max
        sliderBounds.step = metric === 'jaccard' ? 0.01 : 0.1

        // 2. Smart Lower Handle Calculation (Min + 50%)
        const totalRange = bounds.max - bounds.min
        let lowerHandle = bounds.min + (totalRange * 0.5)

        // Round to nearest step to avoid floating point jitter
        lowerHandle = Math.round(lowerHandle / sliderBounds.step) * sliderBounds.step

        // 3. Update the actual v-model
        sliderRange.value = [lowerHandle, bounds.max]
    }

    const fetchBounds = async () => {
        console.log("Fetching bounds for metric:", selectedMetric.value)
        const ids = tableRows.value
            .filter(r => r.selected)
            .map(r => r.key)

        if (!ids.length) return

        try {
            const { data } = await apiClient.post("/api/get-metric-bounds", {
                code_ids: ids
            })
            console.log("Received bounds:", data)

            // Save both to cache
            boundsCache.value = data

            // Apply the currently selected metric immediately
            applySliderSettings(selectedMetric.value)

        } catch (e) {
            console.error("Failed to fetch bounds", e)
        }
    }

    async function runAnalysis() {
        const ids = tableRows.value
            .filter(r => r.selected)
            .map(r => r.key)

        if (!ids.length) {
            emitError("No codes selected"); return
        }

        try {
            const { data } = await apiClient.post("/api/get-cooccurrence", {
                code_ids: ids,
                min_threshold: sliderRange.value[0],
                max_threshold: sliderRange.value[1],
                metric: selectedMetric.value
            })

            const { series: newSeries, xCategories } = buildHeatmapSeries(data.results, selectedMetric.value)

            series.value = newSeries
            chartOptions.value = { ...chartOptions.value, xaxis: { categories: xCategories } }

        } catch (err) {
            console.error(err)
            emitError("Analysis Failed")
        }
    }

    // ------------------------------------------------------
    // SINGLETON WATCHER
    // ------------------------------------------------------
    if (!watchersInitialized) {
        watch(
            [
                () => tableRows.value.filter(r => r.selected).map(r => r.key).join(','),
                isAnalysisActive
            ],
            async ([newSelectionStr, isActive]) => {
                if (!isActive) return;
                if (newSelectionStr.length > 0) {
                    await fetchBounds();
                }
            },
            { immediate: true }
        );

        watch(selectedMetric, (newMetric) => {
            if (isAnalysisActive.value) applySliderSettings(newMetric)
        });

        watchersInitialized = true;
    }


    return {
        // state
        isAnalysisActive,
        selectedMetric,
        metricOptions,
        sliderRange,
        sliderBounds,
        chartOptions,
        series,

        // functions
        runAnalysis,
        metricTooltip,
        fetchBounds
    }
}
