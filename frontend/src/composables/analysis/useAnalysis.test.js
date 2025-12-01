import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('@/composables/shared/apiClient.js', () => {
  const postMock = vi.fn()
  return {
    apiClient: { post: postMock },
    __postMock: postMock
  }
})

vi.mock('../shared/useNotifications.js', () => {
  const emitError = vi.fn()
  const emitSuccess = vi.fn()
  return {
    useNotifications: () => ({
      emitError,
      emitSuccess
    }),
    __emitError: emitError,
    __emitSuccess: emitSuccess
  }
})

vi.mock('@/composables/selection/useCodeSelection.js', () => {
  const tableRows = ref([])
  return {
    useCodeSelection: () => ({
      tableRows
    }),
    __tableRows: tableRows
  }
})

import { useAnalysis } from './useAnalysis.js'
import { __postMock } from '@/composables/shared/apiClient.js'
import { __emitError } from '../shared/useNotifications.js'
import { __tableRows } from '@/composables/selection/useCodeSelection.js'

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __tableRows.value = []
  })

  it('builds heatmap series with ordered axes', async () => {
    const { runAnalysis, series, selectedMetric } = useAnalysis()
    selectedMetric.value = 'jaccard'
    __tableRows.value = [{ key: 1, selected: true }]

    __postMock.mockResolvedValue({
      data: {
        results: [
          {
            code_i: 1, code_i_str: 'A', code_i_description: 'Alpha',
            code_j: 2, code_j_str: 'B', code_j_description: 'Beta',
            jaccard: 0.5
          }
        ]
      }
    })

    await runAnalysis()
    expect(series.value[0].data[0].y).toBe(0.5)
  })

  it('handles empty selection gracefully', async () => {
    const { runAnalysis } = useAnalysis()
    await runAnalysis()
    expect(__emitError).toHaveBeenCalled()
  })
})
