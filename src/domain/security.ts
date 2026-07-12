import type { FieldNoteInference, HazardKind, Scenario } from './types'

const KEYWORD_RULES: Array<{
  pattern: RegExp
  hazard?: HazardKind
  patch: Partial<Scenario>
  reason: string
}> = [
  {
    pattern: /flood|river|levee|storm surge|water rising|inundat/i,
    hazard: 'flood',
    patch: { intensity: 78 },
    reason: 'Hydrology terms indicate flood response should lead.',
  },
  {
    pattern: /fire|wildfire|smoke|ember|wind shift|red flag/i,
    hazard: 'wildfire',
    patch: { intensity: 82, roadDamage: 45 },
    reason: 'Fire behavior terms indicate wildfire spread risk.',
  },
  {
    pattern: /heat|temperature|cooling|dehydration|heatstroke/i,
    hazard: 'heatwave',
    patch: { hospitalLoad: 74, intensity: 80 },
    reason: 'Heat-health terms indicate medical surge pressure.',
  },
  {
    pattern: /quake|aftershock|building crack|collapsed|seismic/i,
    hazard: 'earthquake',
    patch: { roadDamage: 66, commsOutage: 46 },
    reason: 'Seismic terms indicate road and communications disruption.',
  },
  {
    pattern: /cyclone|hurricane|typhoon|storm wall|landfall/i,
    hazard: 'cyclone',
    patch: { intensity: 84, commsOutage: 42 },
    reason: 'Cyclone terms indicate compound wind, water, and outage risk.',
  },
  {
    pattern: /bridge|road closed|one lane|debris|landslide/i,
    patch: { roadDamage: 58 },
    reason: 'Mobility terms increase road damage assumptions.',
  },
  {
    pattern: /offline|no signal|radio only|tower down|cell down/i,
    patch: { commsOutage: 62 },
    reason: 'Connectivity terms increase communications outage assumptions.',
  },
  {
    pattern: /clinic|hospital|ambulance|icu|triage/i,
    patch: { hospitalLoad: 78 },
    reason: 'Medical terms increase hospital surge assumptions.',
  },
]

export function clamp(value: number, min = 0, max = 100) {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

export function sanitizeFieldNote(input: string) {
  const withoutControlChars = Array.from(input)
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : char
    })
    .join('')

  return withoutControlChars
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

export function normalizeScenario(input: Scenario): Scenario {
  return {
    ...input,
    intensity: Math.round(clamp(input.intensity)),
    horizonHours: Math.round(clamp(input.horizonHours, 1, 96)),
    commsOutage: Math.round(clamp(input.commsOutage)),
    roadDamage: Math.round(clamp(input.roadDamage)),
    hospitalLoad: Math.round(clamp(input.hospitalLoad)),
    resourceBudget: Math.round(clamp(input.resourceBudget, 20, 120)),
    equityWeight: Math.round(clamp(input.equityWeight)),
    fieldNote: sanitizeFieldNote(input.fieldNote),
  }
}

export function inferScenarioFromFieldNote(note: string): FieldNoteInference {
  const sanitizedNote = sanitizeFieldNote(note)
  const scenarioPatch: Partial<Scenario> = {}
  const reasons: string[] = []

  for (const rule of KEYWORD_RULES) {
    if (!rule.pattern.test(sanitizedNote)) {
      continue
    }

    Object.assign(scenarioPatch, rule.patch)
    if (rule.hazard) {
      scenarioPatch.hazard = rule.hazard
    }
    reasons.push(rule.reason)
  }

  const hourMatch = sanitizedNote.match(/(\d{1,2})\s*(hr|hrs|hour|hours)/i)
  if (hourMatch?.[1]) {
    scenarioPatch.horizonHours = clamp(Number(hourMatch[1]), 1, 96)
    reasons.push('Time horizon extracted from field note.')
  }

  return {
    scenarioPatch,
    reasons: [...new Set(reasons)],
    sanitizedNote,
  }
}
