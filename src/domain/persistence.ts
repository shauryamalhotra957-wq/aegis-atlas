import { DEFAULT_SCENARIO } from './cityData'
import { normalizeScenario } from './security'
import type { Scenario } from './types'

const STORAGE_KEY = 'aegis-atlas-scenario-v1'

function isHazard(value: unknown): value is Scenario['hazard'] {
  return ['flood', 'wildfire', 'heatwave', 'earthquake', 'cyclone'].includes(String(value))
}

export function loadScenario(): Scenario {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_SCENARIO
    }

    const parsed = JSON.parse(raw) as Partial<Scenario>
    return normalizeScenario({
      ...DEFAULT_SCENARIO,
      ...parsed,
      hazard: isHazard(parsed.hazard) ? parsed.hazard : DEFAULT_SCENARIO.hazard,
      privacyMode: Boolean(parsed.privacyMode ?? DEFAULT_SCENARIO.privacyMode),
    })
  } catch {
    return DEFAULT_SCENARIO
  }
}

export function saveScenario(scenario: Scenario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeScenario(scenario)))
}

export function clearScenario() {
  localStorage.removeItem(STORAGE_KEY)
}
