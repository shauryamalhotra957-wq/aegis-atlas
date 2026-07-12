import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from './cityData'
import { inferScenarioFromFieldNote, normalizeScenario, sanitizeFieldNote } from './security'

describe('field note safety', () => {
  it('removes markup and control characters before displaying notes', () => {
    expect(sanitizeFieldNote('<img src=x onerror=alert(1)> flood\u0000 near bridge')).toBe(
      'img src=x onerror=alert(1) flood near bridge',
    )
  })

  it('infers scenario changes from operational language', () => {
    const inference = inferScenarioFromFieldNote('Wildfire smoke with wind shift, cell tower down, 12 hours')

    expect(inference.scenarioPatch.hazard).toBe('wildfire')
    expect(inference.scenarioPatch.commsOutage).toBeGreaterThanOrEqual(60)
    expect(inference.scenarioPatch.horizonHours).toBe(12)
    expect(inference.reasons.length).toBeGreaterThan(2)
  })

  it('normalizes unsafe numeric values into bounded planning ranges', () => {
    const normalized = normalizeScenario({
      ...DEFAULT_SCENARIO,
      intensity: 999,
      horizonHours: -2,
      resourceBudget: 4,
      fieldNote: '<script>bad()</script>',
    })

    expect(normalized.intensity).toBe(100)
    expect(normalized.horizonHours).toBe(1)
    expect(normalized.resourceBudget).toBe(20)
    expect(normalized.fieldNote).not.toContain('<')
  })
})
