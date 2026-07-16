import type { SimulationResult } from './types'

function line(label: string, value: string | number) {
  return `- ${label}: ${value}`
}

export function buildIncidentReport(result: SimulationResult) {
  const scenario = result.scenario
  const topZones = result.impacts.slice(0, 5)

  return [
    '# Aegis Atlas Incident Action Plan',
    '',
    `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
    '',
    '## Mission Snapshot',
    line('Hazard', scenario.hazard),
    line('Forecast horizon', `${scenario.horizonHours} hours`),
    line('People at risk', result.peopleAtRisk.toLocaleString()),
    line('People protected by first-pass plan', result.peopleProtected.toLocaleString()),
    line('Response readiness', `${result.responseReadiness}%`),
    line('Equity score', `${result.equityScore}%`),
    '',
    '## Priority Zones',
    ...topZones.map(
      (impact, index) =>
        `${index + 1}. ${impact.zone.name}: risk ${impact.risk}, ${impact.affected.toLocaleString()} affected, ${impact.reasons.join(', ') || 'population-weighted exposure'}.`,
    ),
    '',
    '## Resource Moves',
    ...result.allocations.slice(0, 7).map((allocation, index) => {
      const zone = result.impacts.find((impact) => impact.zone.id === allocation.zoneId)?.zone.name ?? allocation.zoneId
      const eta = allocation.etaHours === null ? 'unavailable' : `${allocation.etaHours}h`
      return `${index + 1}. ${zone}: ${allocation.action} Coverage ${allocation.coverage}%, ETA ${eta}.`
    }),
    '',
    '## Agent Briefs',
    ...result.agents.map(
      (agent) =>
        `- ${agent.title} (${agent.status}, ${Math.round(agent.confidence)}% confidence): ${agent.summary}`,
    ),
    '',
    '## Safety Notes',
    '- This is a planning simulation, not a live emergency command authority.',
    '- Field notes are sanitized and processed locally in the browser.',
    '- Validate every action with local officials, verified sensors, and field teams.',
    '',
  ].join('\n')
}

export function buildPortableJson(result: SimulationResult) {
  return JSON.stringify(
    {
      generatedAt: result.generatedAt,
      scenario: result.scenario,
      metrics: result.metrics,
      topActions: result.topActions,
      priorityZones: result.impacts.slice(0, 8).map((impact) => ({
        id: impact.zone.id,
        name: impact.zone.name,
        risk: impact.risk,
        affected: impact.affected,
        evacuationDemand: impact.evacuationDemand,
        medicalDemand: impact.medicalDemand,
        reasons: impact.reasons,
      })),
      allocations: result.allocations,
    },
    null,
    2,
  )
}
