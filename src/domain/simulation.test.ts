import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from './cityData'
import { computeZoneImpacts, simulateScenario } from './simulation'

describe('crisis simulation', () => {
  it('produces a complete deterministic plan for the default scenario', () => {
    const result = simulateScenario(DEFAULT_SCENARIO)

    expect(result.peopleAtRisk).toBeGreaterThan(100000)
    expect(result.peopleProtected).toBeGreaterThan(50000)
    expect(result.allocations).toHaveLength(result.impacts.length)
    expect(result.topActions).toHaveLength(6)
    expect(result.responseReadiness).toBeGreaterThan(0)
  })

  it('keeps remaining inventory non-negative after allocation', () => {
    const result = simulateScenario({ ...DEFAULT_SCENARIO, resourceBudget: 20, intensity: 100 })
    const remaining = Object.values(result.remainingInventory)

    expect(remaining.every((value) => value >= 0)).toBe(true)
  })

  it('makes hazard-specific zones rise when scenario changes', () => {
    const flood = computeZoneImpacts({ ...DEFAULT_SCENARIO, hazard: 'flood', intensity: 88 })
    const fire = computeZoneImpacts({ ...DEFAULT_SCENARIO, hazard: 'wildfire', intensity: 88 })

    expect(flood[0].zone.riverExposure).toBeGreaterThan(60)
    expect(fire[0].zone.vegetation).toBeGreaterThan(70)
  })

  it('increases high-vulnerability priority when equity weight rises', () => {
    const lowEquity = computeZoneImpacts({ ...DEFAULT_SCENARIO, equityWeight: 5 })
    const highEquity = computeZoneImpacts({ ...DEFAULT_SCENARIO, equityWeight: 100 })
    const dockLow = lowEquity.find((impact) => impact.zone.id === 'dock-ward')
    const dockHigh = highEquity.find((impact) => impact.zone.id === 'dock-ward')

    expect(dockHigh?.priority).toBeGreaterThan(dockLow?.priority ?? 0)
  })
})
