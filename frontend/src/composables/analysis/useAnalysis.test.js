import { describe, expect, it } from 'vitest'
import { useAnalysis } from './useAnalysis.js'
import { useCodeSelection } from '@/composables/selection/useCodeSelection.js'

// mock code selection to provide tableRows
vi.mock('@/composables/selection/useCodeSelection.js', () => ({
  useCodeSelection: () => ({
    tableRows: { value: [{ key: '1', selected: true }] }
  })
}))

describe('useAnalysis helpers', () => {
  it('metricTooltip returns descriptions', () => {
    const { metricTooltip } = useAnalysis()
    expect(metricTooltip('jaccard')).toMatch(/Jaccard/)
  })
})
