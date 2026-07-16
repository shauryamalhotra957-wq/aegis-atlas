import { BASE_INVENTORY, CITY_ZONES } from './cityData'
import { clamp, normalizeScenario } from './security'
import type {
  AgentBrief,
  AssetKind,
  HazardKind,
  Inventory,
  MissionMetric,
  ResourceAllocation,
  Scenario,
  SimulationResult,
  Zone,
  ZoneImpact,
} from './types'

const HAZARD_LABEL: Record<HazardKind, string> = {
  flood: 'flood',
  wildfire: 'wildfire',
  heatwave: 'heatwave',
  earthquake: 'earthquake',
  cyclone: 'cyclone',
}

const EMPTY_INVENTORY: Inventory = {
  rescueTeams: 0,
  medicalTeams: 0,
  buses: 0,
  drones: 0,
  pumps: 0,
  generators: 0,
  shelterKits: 0,
}

function round(value: number) {
  return Math.round(value)
}

function scaleInventory(base: Inventory, budget: number): Inventory {
  const factor = budget / 100
  return {
    rescueTeams: Math.max(4, round(base.rescueTeams * factor)),
    medicalTeams: Math.max(3, round(base.medicalTeams * factor)),
    buses: Math.max(8, round(base.buses * factor)),
    drones: Math.max(3, round(base.drones * factor)),
    pumps: Math.max(2, round(base.pumps * factor)),
    generators: Math.max(2, round(base.generators * factor)),
    shelterKits: Math.max(8, round(base.shelterKits * factor)),
  }
}

function hazardExposure(zone: Zone, scenario: Scenario) {
  const intensity = scenario.intensity
  const road = scenario.roadDamage
  const hospital = scenario.hospitalLoad
  const comms = scenario.commsOutage

  switch (scenario.hazard) {
    case 'flood':
      return (
        zone.riverExposure * 0.48 +
        (100 - zone.elevation) * 0.26 +
        intensity * 0.2 +
        road * 0.06
      )
    case 'wildfire':
      return zone.vegetation * 0.44 + intensity * 0.28 + (100 - zone.roadAccess) * 0.18 + comms * 0.1
    case 'heatwave':
      return zone.concrete * 0.38 + zone.vulnerability * 0.28 + hospital * 0.22 + intensity * 0.12
    case 'earthquake':
      return intensity * 0.42 + zone.concrete * 0.2 + (100 - zone.roadAccess) * 0.22 + road * 0.16
    case 'cyclone':
      return (
        intensity * 0.34 +
        zone.riverExposure * 0.2 +
        (100 - zone.elevation) * 0.16 +
        comms * 0.16 +
        road * 0.14
      )
  }
}

function threatenedAssets(zone: Zone, risk: number, hazard: HazardKind): AssetKind[] {
  return zone.assets.filter((asset) => {
    if (risk > 78) {
      return true
    }
    if (hazard === 'flood' && (asset === 'waterPlant' || asset === 'substation')) {
      return risk > 58
    }
    if (hazard === 'heatwave' && (asset === 'clinic' || asset === 'substation')) {
      return risk > 54
    }
    if (hazard === 'wildfire' && (asset === 'school' || asset === 'warehouse')) {
      return risk > 62
    }
    return risk > 68 && asset !== 'school'
  })
}

function impactReasons(zone: Zone, scenario: Scenario, risk: number) {
  const reasons: string[] = []
  if (zone.vulnerability > 70) reasons.push('high social vulnerability')
  if (zone.riverExposure > 75 && ['flood', 'cyclone'].includes(scenario.hazard)) reasons.push('river exposure')
  if (zone.vegetation > 75 && scenario.hazard === 'wildfire') reasons.push('heavy vegetation')
  if (zone.concrete > 75 && scenario.hazard === 'heatwave') reasons.push('urban heat island')
  if (zone.roadAccess < 55 || scenario.roadDamage > 55) reasons.push('fragile evacuation routes')
  if (zone.hospitalBeds < 40 && scenario.hospitalLoad > 65) reasons.push('thin medical capacity')
  if (risk > 82) reasons.push('compound risk threshold crossed')
  return reasons.slice(0, 4)
}

export function computeZoneImpacts(scenarioInput: Scenario, zones = CITY_ZONES): ZoneImpact[] {
  const scenario = normalizeScenario(scenarioInput)

  return zones
    .map((zone) => {
      const equityBoost = zone.vulnerability * (scenario.equityWeight / 100) * 0.22
      const exposure = hazardExposure(zone, scenario)
      const risk = clamp(exposure * 0.82 + equityBoost + scenario.horizonHours * 0.08)
      const affectedRatio = clamp((risk / 100) * (0.32 + scenario.intensity / 260), 0.02, 0.82)
      const affected = round(zone.population * affectedRatio)
      const evacuationDemand = round(affected * clamp(0.28 + risk / 190, 0.16, 0.72))
      const medicalDemand = round(
        affected * clamp(0.025 + scenario.hospitalLoad / 1700 + zone.vulnerability / 2600, 0.02, 0.13),
      )
      const shelterGap = Math.max(0, evacuationDemand - zone.shelterCapacity)
      const infrastructureThreats = threatenedAssets(zone, risk, scenario.hazard)
      const priority = clamp(
        risk * 0.42 +
          (affected / Math.max(zone.population, 1)) * 24 +
          zone.vulnerability * (0.16 + scenario.equityWeight / 520) +
          shelterGap / 900 +
          infrastructureThreats.length * 4,
      )

      return {
        zone,
        risk: round(risk),
        affected,
        evacuationDemand,
        medicalDemand,
        shelterGap,
        infrastructureThreats,
        priority: round(priority),
        reasons: impactReasons(zone, scenario, risk),
      }
    })
    .sort((a, b) => b.priority - a.priority)
}

function allocateUnits(demand: number, unitSize: number, available: number, maxPerZone: number) {
  return Math.min(maxPerZone, Math.max(0, available), Math.ceil(Math.max(0, demand) / unitSize))
}

function subtractInventory(remaining: Inventory, allocation: Inventory) {
  for (const key of Object.keys(remaining) as Array<keyof Inventory>) {
    remaining[key] = Math.max(0, remaining[key] - allocation[key])
  }
}

function actionForImpact(impact: ZoneImpact, scenario: Scenario, allocation: Inventory) {
  const lead = impact.zone.name
  if (Object.values(allocation).every((units) => units === 0)) {
    return `No deployable units remain for ${lead}; request mutual aid and keep the zone in the unserved queue.`
  }
  if (scenario.hazard === 'flood' && allocation.pumps > 0) {
    return `Stage pumps and high-water rescue at ${lead}; open shelter overflow before peak river crest.`
  }
  if (scenario.hazard === 'wildfire' && allocation.buses > 0) {
    return `Create outbound evacuation lanes for ${lead}; use drones to verify ember spread and road safety.`
  }
  if (scenario.hazard === 'heatwave' && allocation.generators > 0) {
    return `Power cooling shelters in ${lead}; route medics toward heat illness clusters.`
  }
  if (scenario.hazard === 'earthquake') {
    return `Search damaged blocks in ${lead}; pair rescue teams with mobile triage and generator support.`
  }
  return `Stabilize ${lead}; combine evacuation transport, medical triage, and infrastructure protection.`
}

export function allocateResources(
  impacts: ZoneImpact[],
  scenarioInput: Scenario,
  inventoryInput = scaleInventory(BASE_INVENTORY, scenarioInput.resourceBudget),
): { allocations: ResourceAllocation[]; remainingInventory: Inventory } {
  const scenario = normalizeScenario(scenarioInput)
  const remainingInventory = { ...inventoryInput }
  const allocations: ResourceAllocation[] = []

  for (const impact of impacts) {
    const rescueTeams = allocateUnits(impact.affected, 5200, remainingInventory.rescueTeams, 5)
    const medicalTeams = allocateUnits(impact.medicalDemand, 85, remainingInventory.medicalTeams, 4)
    const buses = allocateUnits(impact.evacuationDemand, 420, remainingInventory.buses, 8)
    const drones = allocateUnits(
      impact.priority + scenario.commsOutage,
      58,
      remainingInventory.drones,
      scenario.commsOutage > 38 || impact.zone.roadAccess < 55 ? 3 : 1,
    )
    const pumps =
      scenario.hazard === 'flood' || scenario.hazard === 'cyclone'
        ? allocateUnits(impact.zone.riverExposure * impact.risk, 1900, remainingInventory.pumps, 4)
        : 0
    const generators = allocateUnits(
      impact.infrastructureThreats.length * 34 + scenario.hospitalLoad,
      78,
      remainingInventory.generators,
      3,
    )
    const shelterKits = allocateUnits(impact.shelterGap, 520, remainingInventory.shelterKits, 10)
    const allocation = {
      ...EMPTY_INVENTORY,
      rescueTeams,
      medicalTeams,
      buses,
      drones,
      pumps,
      generators,
      shelterKits,
    }

    subtractInventory(remainingInventory, allocation)

    const responsePower =
      rescueTeams * 0.14 +
      medicalTeams * 0.13 +
      buses * 0.07 +
      drones * 0.06 +
      pumps * 0.08 +
      generators * 0.08 +
      shelterKits * 0.025
    const routePenalty = (scenario.roadDamage + scenario.commsOutage + (100 - impact.zone.roadAccess)) / 450
    const hasDeployableUnits = Object.values(allocation).some((units) => units > 0)
    const coverage = hasDeployableUnits ? clamp(responsePower - routePenalty, 0.08, 0.96) : 0
    const etaHours = hasDeployableUnits
      ? clamp(3 + impact.priority / 11 + routePenalty * 9 - coverage * 5, 1.5, 24)
      : null

    allocations.push({
      zoneId: impact.zone.id,
      rescueTeams,
      medicalTeams,
      buses,
      drones,
      pumps,
      generators,
      shelterKits,
      coverage: Math.round(coverage * 100),
      etaHours: etaHours === null ? null : Math.round(etaHours * 10) / 10,
      action: actionForImpact(impact, scenario, allocation),
    })
  }

  return { allocations, remainingInventory }
}

function buildAgents(
  scenario: Scenario,
  impacts: ZoneImpact[],
  allocations: ResourceAllocation[],
  peopleProtected: number,
  unservedPeople: number,
): AgentBrief[] {
  const highest = impacts[0]
  const shelterGap = impacts.reduce((sum, impact) => sum + impact.shelterGap, 0)
  const averageCoverage =
    allocations.reduce((sum, allocation) => sum + allocation.coverage, 0) / Math.max(1, allocations.length)
  const criticalInfra = impacts.reduce((sum, impact) => sum + impact.infrastructureThreats.length, 0)
  const confidence = clamp(92 - scenario.commsOutage * 0.22 - scenario.roadDamage * 0.15)

  return [
    {
      id: 'risk',
      title: 'Risk Model',
      status: highest.risk > 82 ? 'critical' : highest.risk > 68 ? 'warning' : 'monitoring',
      confidence,
      summary: `${highest.zone.name} is the leading ${HAZARD_LABEL[scenario.hazard]} priority at risk ${highest.risk}.`,
      evidence: highest.reasons.length ? highest.reasons : ['highest population-weighted exposure'],
    },
    {
      id: 'logistics',
      title: 'Logistics Planner',
      status: averageCoverage > 62 ? 'stable' : 'warning',
      confidence: clamp(confidence - scenario.roadDamage * 0.12),
      summary: `Current allocation covers ${Math.round(averageCoverage)}% of requested response load.`,
      evidence: [
        `${allocations.reduce((sum, item) => sum + item.buses, 0)} buses assigned`,
        `${allocations.reduce((sum, item) => sum + item.rescueTeams, 0)} rescue teams assigned`,
      ],
    },
    {
      id: 'medical',
      title: 'Medical Surge',
      status: scenario.hospitalLoad > 74 ? 'critical' : scenario.hospitalLoad > 58 ? 'warning' : 'monitoring',
      confidence: clamp(confidence - scenario.hospitalLoad * 0.06),
      summary: `${impacts.reduce((sum, item) => sum + item.medicalDemand, 0).toLocaleString()} residents may need triage support.`,
      evidence: [
        `${scenario.hospitalLoad}% baseline hospital load`,
        `${allocations.reduce((sum, item) => sum + item.medicalTeams, 0)} medical teams deployed`,
      ],
    },
    {
      id: 'equity',
      title: 'Equity Guardrail',
      status: unservedPeople < peopleProtected * 0.36 ? 'stable' : 'warning',
      confidence: clamp(88 - Math.abs(70 - scenario.equityWeight) * 0.12),
      summary: `Priority weighting favors high-vulnerability zones before lower-need assets.`,
      evidence: [
        `${scenario.equityWeight}% equity weight`,
        `${shelterGap.toLocaleString()} person shelter overflow gap`,
      ],
    },
    {
      id: 'infrastructure',
      title: 'Infrastructure Watch',
      status: criticalInfra > 17 ? 'critical' : criticalInfra > 9 ? 'warning' : 'monitoring',
      confidence: clamp(confidence - criticalInfra * 0.9),
      summary: `${criticalInfra} critical assets have plausible exposure in this scenario.`,
      evidence: ['clinics, substations, water, schools, and warehouses are tracked locally'],
    },
  ]
}

function buildMetrics(result: {
  peopleAtRisk: number
  peopleProtected: number
  unservedPeople: number
  equityScore: number
  responseReadiness: number
  optimizedEtaHours: number
  baselineEtaHours: number
}): MissionMetric[] {
  return [
    {
      label: 'People at risk',
      value: result.peopleAtRisk.toLocaleString(),
      delta: `${result.peopleProtected.toLocaleString()} protected by plan`,
      tone: result.peopleAtRisk > 140000 ? 'risk' : 'watch',
    },
    {
      label: 'Response readiness',
      value: `${result.responseReadiness}%`,
      delta: `${Math.max(0, result.baselineEtaHours - result.optimizedEtaHours).toFixed(1)}h faster than baseline`,
      tone: result.responseReadiness > 68 ? 'good' : 'watch',
    },
    {
      label: 'Equity score',
      value: `${result.equityScore}%`,
      delta: `${result.unservedPeople.toLocaleString()} unserved after first pass`,
      tone: result.equityScore > 72 ? 'good' : 'watch',
    },
    {
      label: 'Optimized ETA',
      value: `${result.optimizedEtaHours.toFixed(1)}h`,
      delta: `baseline ${result.baselineEtaHours.toFixed(1)}h`,
      tone: result.optimizedEtaHours < 8 ? 'good' : 'risk',
    },
  ]
}

export function simulateScenario(scenarioInput: Scenario): SimulationResult {
  const scenario = normalizeScenario(scenarioInput)
  const inventory = scaleInventory(BASE_INVENTORY, scenario.resourceBudget)
  const impacts = computeZoneImpacts(scenario)
  const { allocations, remainingInventory } = allocateResources(impacts, scenario, inventory)
  const peopleAtRisk = impacts.reduce((sum, impact) => sum + impact.affected, 0)
  const peopleProtected = Math.round(
    impacts.reduce((sum, impact) => {
      const allocation = allocations.find((item) => item.zoneId === impact.zone.id)
      const coverage = (allocation?.coverage ?? 0) / 100
      return sum + impact.affected * clamp(0.18 + coverage * 0.62, 0, 0.86)
    }, 0),
  )
  const unservedPeople = Math.max(0, peopleAtRisk - peopleProtected)
  const vulnerabilityServed = impacts.reduce((sum, impact) => {
    const allocation = allocations.find((item) => item.zoneId === impact.zone.id)
    return sum + impact.zone.vulnerability * impact.affected * ((allocation?.coverage ?? 0) / 100)
  }, 0)
  const vulnerabilityTotal = impacts.reduce(
    (sum, impact) => sum + impact.zone.vulnerability * Math.max(1, impact.affected),
    0,
  )
  const equityScore = Math.round(clamp((vulnerabilityServed / Math.max(1, vulnerabilityTotal)) * 118))
  const responseReadiness = Math.round(
    clamp(
      (peopleProtected / Math.max(1, peopleAtRisk)) * 64 +
        equityScore * 0.24 +
        (100 - scenario.commsOutage) * 0.07 +
        (100 - scenario.roadDamage) * 0.05,
    ),
  )
  const baselineEtaHours = clamp(10 + scenario.roadDamage / 10 + scenario.commsOutage / 13, 8, 26)
  const dispatchEtas = allocations.flatMap((allocation) =>
    allocation.etaHours === null ? [] : [allocation.etaHours],
  )
  const optimizedEtaHours = dispatchEtas.length
    ? dispatchEtas.reduce((sum, etaHours) => sum + etaHours, 0) / dispatchEtas.length
    : baselineEtaHours
  const agents = buildAgents(scenario, impacts, allocations, peopleProtected, unservedPeople)
  const metrics = buildMetrics({
    peopleAtRisk,
    peopleProtected,
    unservedPeople,
    equityScore,
    responseReadiness,
    optimizedEtaHours,
    baselineEtaHours,
  })

  return {
    scenario,
    generatedAt: new Date().toISOString(),
    impacts,
    allocations,
    agents,
    metrics,
    inventory,
    remainingInventory,
    peopleAtRisk,
    peopleProtected,
    unservedPeople,
    equityScore,
    responseReadiness,
    topActions: allocations
      .slice(0, 6)
      .map((allocation) => allocation.action),
    baselineEtaHours: Math.round(baselineEtaHours * 10) / 10,
    optimizedEtaHours: Math.round(optimizedEtaHours * 10) / 10,
  }
}
