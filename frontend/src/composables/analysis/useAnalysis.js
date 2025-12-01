import { ref, computed, watch, reactive } from "vue"
import { apiClient } from '@/composables/shared/apiClient.js'
import { useNotifications } from '../shared/useNotifications.js'
import { useCodeSelection } from "@/composables/selection/useCodeSelection.js";

// composables


// -----------------------------
// GLOBAL STATE
// -----------------------------
const isAnalysisActive = ref(false); // Default to OFF if accordion is shut - prevent API calls until user opens it
const selectedMetric = ref('ukb_person_count')  // default metric
const sliderRange = ref([0, 1]) // The actual handle positions
const sliderBounds = reactive({ min: 0, max: 1, step: 0.01 })
const boundsCache = ref({
    jaccard: { min: 0, max: 1 },
    lift: { min: 0, max: 10 },
    pair_count: { min: 0, max: 100 },
    ukb_person_count: { min: 0, max: 0 },
    ukb_event_count: { min: 0, max: 0 }
})
const metricOptions = [
  { label: 'Co-occurrence: Jaccard', value: 'jaccard' },
  { label: 'Co-occurrence: Lift', value: 'lift' },
  { label: 'Co-occurrence: Pair count', value: 'pair_count' },
  { label: 'UKB individual counts', value: 'ukb_person_count' },
  { label: 'UKB code counts', value: 'ukb_event_count' }
]
const cooccurrenceMetrics = ['jaccard', 'lift', 'pair_count']
const countMetrics = ['ukb_person_count', 'ukb_event_count']

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

            if (meta?.code_i_str) {
                return `
    <div style="padding:5px; font-size:13px;">
        <strong>${meta.code_i_str}</strong> (${meta.code_i_description})<br>
        <strong>${meta.code_j_str}</strong> (${meta.code_j_description})<br>
        ${meta.metric_name}: ${meta.y.toFixed(3)}
    </div>
    `
            }

            if (meta?.code_str) {
                return `
    <div style="padding:5px; font-size:13px;">
        <strong>${meta.code_str}</strong> (${meta.description || 'No description'})<br>
        System: ${meta.system || 'Unknown'}<br>
        Count: ${meta.value}
    </div>
    `
            }

            return ''
        }
    }
})

// const functions
function buildHeatmapSeries(results, metric) {
    if (!results.length) return {series: [], xCategories: []}

    // 1. Extract unique X and Y
    const allY = [...new Set(results.map(r => r.code_i_str).filter(Boolean))]
    const allX = [...new Set(results.map(r => r.code_j_str).filter(Boolean))]


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

    return {series, xCategories: allX}
}
function metricTooltip(metric) {
    switch (metric) {
        case "jaccard":
            return "Jaccard index: measures the proportion of shared individuals between two codes. Range: 0 (no overlap) to 1 (all individuals shared)."
        case "lift":
            return "Lift: measures how much more often two codes occur together than expected by chance. Values >1 indicate positive association."
        case "pair_count":
            return "Counts: number of individuals with both codes. Small counts may be suppressed; see suppression guidance."
        case "ukb_person_count":
            return "UKB individual counts: number of distinct participants with this code in the UKB dataset."
        case "ukb_event_count":
            return "UKB code counts: number of code occurrences (events) in the UKB dataset."
        default:
            return "Select a metric to see explanation."
    }
}

function buildBarSeries(results, metric) {
    const field = metric === 'ukb_event_count' ? 'event_count' : 'person_count'
    const filtered = results.filter(r => {
        const val = r[field] ?? 0
        return val >= sliderRange.value[0] && val <= sliderRange.value[1]
    })

    const data = filtered.map(r => ({
        x: r.code_str || String(r.code_id),
        y: r[field] ?? 0,
        meta: {
            code_str: r.code_str || String(r.code_id),
            description: r.code_description || '',
            system: r.system_name,
            value: r[field] ?? 0
        }
    }))

    return {
        series: [{
            name: metric === 'ukb_event_count' ? 'Code occurrences' : 'Individuals',
            data
        }],
        categories: data.map(d => d.x)
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
        const bounds = boundsCache.value[metric] || { min: 0, max: 1 }

        // 1. Set Track Limits
        sliderBounds.min = bounds.min
        sliderBounds.max = bounds.max
        const isCountMetric = countMetrics.includes(metric)
        sliderBounds.step = isCountMetric || metric === 'pair_count' ? 1 : (metric === 'jaccard' ? 0.01 : 0.1)

        // 2. Smart Lower Handle Calculation (Min + 50%)
        const totalRange = bounds.max - bounds.min
        let lowerHandle = countMetrics.includes(metric)
            ? bounds.min
            : bounds.min + (totalRange * 0.5)

        // Round to nearest step to avoid floating point jitter
        lowerHandle = Math.round(lowerHandle / sliderBounds.step) * sliderBounds.step

        // 3. Update the actual v-model
        sliderRange.value = [lowerHandle, bounds.max]
    }

    const fetchBounds = async () => {
        const ids = tableRows.value
            .filter(r => r.selected && !Number.isNaN(Number(r.key)))
            .map(r => Number(r.key))

        if (!ids.length) return

        try {
            const { data } = await apiClient.post("/api/get-metric-bounds", {
                code_ids: ids,
                dataset: 'ukb'
            })
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
            .filter(r => r.selected && !Number.isNaN(Number(r.key)))
            .map(r => Number(r.key))

        if (!ids.length) {
            emitError("No numeric codes selected"); return
        }

        try {
            if (cooccurrenceMetrics.includes(selectedMetric.value)) {
                const { data } = await apiClient.post("/api/get-cooccurrence", {
                    code_ids: ids,
                    min_threshold: sliderRange.value[0],
                    max_threshold: sliderRange.value[1],
                    metric: selectedMetric.value
                })

                const { series: newSeries, xCategories } = buildHeatmapSeries(data.results, selectedMetric.value)

                series.value = newSeries
                chartOptions.value = { ...chartOptions.value, chart: { ...chartOptions.value.chart, type: 'heatmap' }, xaxis: { categories: xCategories } }
            } else {
                const { data } = await apiClient.post("/api/get-code-counts", {
                    code_ids: ids,
                    dataset: 'ukb'
                })

                const { series: newSeries, categories } = buildBarSeries(data.results, selectedMetric.value)
                series.value = newSeries
                chartOptions.value = {
                    ...chartOptions.value,
                    chart: { ...chartOptions.value.chart, type: 'bar' },
                    plotOptions: { bar: { horizontal: false } },
                    xaxis: { categories }
                }
            }

        } catch (err) {
            console.error(err)
            const detail = err?.response?.data?.detail || err.message || 'Analysis failed.'
            emitError("Analysis Failed", detail)
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
