import { describe, expect, it } from 'vitest'
import { useCodeImport } from './useCodeImport.js'

describe('useCodeImport validation', () => {
  it('reports validation errors when required columns missing', () => {
    const { columnMapping, validationErrors, remainingUnmappedCount, unmatchedSystems, systemMapping, useFileProvidedSystem } = useCodeImport()
    columnMapping.value.code = null
    unmatchedSystems.value = ['SYS1']
    systemMapping.value = {}
    useFileProvidedSystem.value = {}

    expect(validationErrors.value.length).toBeGreaterThan(0)
    expect(remainingUnmappedCount.value).toBe(1)
  })
})
