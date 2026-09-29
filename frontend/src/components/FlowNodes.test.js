import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const removeNodes = vi.fn()
vi.mock('@vue-flow/core', () => ({
  Handle: { template: '<div />' },
  useVueFlow: () => ({ removeNodes }),
}))

const PhenotypeNode = (await import('./PhenotypeNode.vue')).default
const OperatorNode = (await import('./OperatorNode.vue')).default

describe('flow node remove buttons', () => {
  beforeEach(() => removeNodes.mockClear())

  it('removes a phenotype node from the canvas', async () => {
    const wrapper = mount(PhenotypeNode, {
      props: { id: 'ph-1', data: { name: 'Brugada' } },
      global: { stubs: { Textarea: true, FloatLabel: true } },
    })
    await wrapper.find('.node-delete').trigger('click')
    expect(removeNodes).toHaveBeenCalledWith(['ph-1'])
  })

  it('removes an operator node from the canvas', async () => {
    const wrapper = mount(OperatorNode, { props: { id: 'op-1', data: { operator: 'AND' } } })
    await wrapper.find('.node-delete').trigger('click')
    expect(removeNodes).toHaveBeenCalledWith(['op-1'])
  })

  it('has no remove button on the palette chips', () => {
    const wrapper = mount(OperatorNode, { props: { data: { operator: 'AND' }, showHandles: false } })
    expect(wrapper.find('.node-delete').exists()).toBe(false)
  })
})
