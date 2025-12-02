import { describe, expect, it, beforeEach, vi } from 'vitest'

const phenotypesMock = [{ id: 'p1', name: 'Hypertension' }]

vi.mock('@/composables/project/usePhenotypes.js', () => ({
  usePhenotypes: () => ({
    phenotypes: { value: phenotypesMock },
    fetchPhenotypes: vi.fn()
  })
}))

vi.mock('@vue-flow/core', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useVueFlow: () => ({
      screenToFlowPosition: ({ x, y }) => ({ x, y })
    })
  }
})

import { usePhenoFlow } from './usePhenoFlow.js'

const makeDropEvent = (type, data) => ({
  preventDefault: vi.fn(),
  clientX: 10,
  clientY: 20,
  dataTransfer: {
    getData: vi.fn((key) => {
      if (key === 'application/vueflow') {
        return JSON.stringify({ type, data })
      }
      return ''
    })
  }
})

describe('usePhenoFlow', () => {
  let flow

  beforeEach(() => {
    flow = usePhenoFlow()
    flow.nodes.value = []
    flow.edges.value = []
  })

  it('adds phenotype node when using helper', () => {
    flow.addPhenotypeNode({ id: 'p2', name: 'Test' }, { x: 10, y: 20 })
    expect(flow.nodes.value.length).toBe(1)
    expect(flow.nodes.value[0].data.type).toBe('phenotype')
  })

  it('adds operator node when using helper', () => {
    flow.addOperatorNode('AND', { x: 10, y: 20 })
    expect(flow.nodes.value[0].data.operator).toBe('AND')
  })

  it('adds edge on connect', () => {
    flow.onConnectHandler({ source: 'a', target: 'b' })
    expect(flow.edges.value.length).toBe(1)
    expect(flow.edges.value[0].source).toBe('a')
  })
})
