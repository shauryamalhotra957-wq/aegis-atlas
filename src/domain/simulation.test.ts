import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from './cityData'
import { allocateResources, computeZoneImpacts, simulateScenario } from './simulation'
import type { Inventory } from './types'

const EMPTY_INVENTORY: Inventory = {
  rescueTeams: 0,
  medicalTeams: 0,
  buses: 0,
  drones: 0,
  pumps: 0,
  generators: 0,
  shelterKits: 0,
}

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

  it('reports zero coverage when no deployable inventory remains', () => {
    const impacts = computeZoneImpacts(DEFAULT_SCENARIO).slice(0, 1)
    const { allocations } = allocateResources(
      impacts,
      DEFAULT_SCENARIO,
      EMPTY_INVENTORY,
    )

    expect(allocations[0]?.coverage).toBe(0)
    expect(allocations[0]?.etaHours).toBeNull()
    expect(allocations[0]?.action).toContain('request mutual aid')
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
