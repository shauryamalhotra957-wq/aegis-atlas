export type HazardKind = 'flood' | 'wildfire' | 'heatwave' | 'earthquake' | 'cyclone'

export type AssetKind = 'clinic' | 'school' | 'substation' | 'waterPlant' | 'warehouse'

export interface Zone {
  id: string
  name: string
  district: string
  x: number
  y: number
  population: number
  vulnerability: number
  elevation: number
  vegetation: number
  concrete: number
  riverExposure: number
  roadAccess: number
  shelterCapacity: number
  hospitalBeds: number
  assets: AssetKind[]
  neighbors: string[]
}

export interface Scenario {
  hazard: HazardKind
  intensity: number
  horizonHours: number
  commsOutage: number
  roadDamage: number
  hospitalLoad: number
  resourceBudget: number
  equityWeight: number
  privacyMode: boolean
  fieldNote: string
}

export interface Inventory {
  rescueTeams: number
  medicalTeams: number
  buses: number
  drones: number
  pumps: number
  generators: number
  shelterKits: number
}

export interface ZoneImpact {
  zone: Zone
  risk: number
  affected: number
  evacuationDemand: number
  medicalDemand: number
  shelterGap: number
  infrastructureThreats: AssetKind[]
  priority: number
  reasons: string[]
}

export interface ResourceAllocation {
  zoneId: string
  rescueTeams: number
  medicalTeams: number
  buses: number
  drones: number
  pumps: number
  generators: number
  shelterKits: number
  coverage: number
  etaHours: number | null
  action: string
}

export interface AgentBrief {
  id: string
  title: string
  status: 'monitoring' | 'warning' | 'critical' | 'stable'
  confidence: number
  summary: string
  evidence: string[]
}

export interface MissionMetric {
  label: string
  value: string
  delta: string
  tone: 'good' | 'watch' | 'risk'
}

export interface SimulationResult {
  scenario: Scenario
  generatedAt: string
  impacts: ZoneImpact[]
  allocations: ResourceAllocation[]
  agents: AgentBrief[]
  metrics: MissionMetric[]
  inventory: Inventory
  remainingInventory: Inventory
  peopleAtRisk: number
  peopleProtected: number
  unservedPeople: number
  equityScore: number
  responseReadiness: number
  topActions: string[]
  baselineEtaHours: number
  optimizedEtaHours: number
}

export interface FieldNoteInference {
  scenarioPatch: Partial<Scenario>
  reasons: string[]
  sanitizedNote: string
}
