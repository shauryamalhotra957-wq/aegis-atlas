import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from './cityData'
import { buildIncidentReport, buildPortableJson } from './report'
import { simulateScenario } from './simulation'

describe('incident exports', () => {
  it('creates a markdown action plan with safety notes', () => {
    const report = buildIncidentReport(simulateScenario(DEFAULT_SCENARIO))

    expect(report).toContain('# Aegis Atlas Incident Action Plan')
    expect(report).toContain('## Resource Moves')
    expect(report).toContain('planning simulation')
  })

  it('creates portable JSON with priority zones and allocations', () => {
    const json = JSON.parse(buildPortableJson(simulateScenario(DEFAULT_SCENARIO)))

    expect(json.priorityZones.length).toBeGreaterThan(4)
    expect(json.allocations.length).toBeGreaterThan(4)
    expect(json.scenario.privacyMode).toBe(true)
  })
})
