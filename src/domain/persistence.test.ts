import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SCENARIO } from './cityData'
import { clearScenario, loadScenario, saveScenario } from './persistence'

describe('scenario persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('normalizes scenarios before saving and restores them', () => {
    saveScenario({
      ...DEFAULT_SCENARIO,
      intensity: 999,
      fieldNote: '<strong>river rising</strong>',
    })

    const restored = loadScenario()

    expect(restored.intensity).toBe(100)
    expect(restored.fieldNote).toBe('strongriver rising/strong')
  })

  it('falls back when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })

    expect(loadScenario()).toEqual(DEFAULT_SCENARIO)
  })

  it('keeps save and reset fail-soft when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exhausted', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })

    expect(() => saveScenario(DEFAULT_SCENARIO)).not.toThrow()
    expect(() => clearScenario()).not.toThrow()
  })
})
