import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BrainCircuit,
  CircleGauge,
  ClipboardCheck,
  DatabaseZap,
  Download,
  FileText,
  Flame,
  Hospital,
  Info,
  Layers,
  MapPinned,
  Radio,
  RefreshCcw,
  Route,
  Satellite,
  ShieldCheck,
  Siren,
  ThermometerSun,
  Waves,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'
import './App.css'
import './experience.css'
import { CITY_ZONES, DEFAULT_SCENARIO } from './domain/cityData'
import { buildIncidentReport, buildPortableJson } from './domain/report'
import { clearScenario, loadScenario, saveScenario } from './domain/persistence'
import { inferScenarioFromFieldNote, normalizeScenario } from './domain/security'
import { simulateScenario } from './domain/simulation'
import type {
  AgentBrief,
  HazardKind,
  Inventory,
  MissionMetric,
  ResourceAllocation,
  Scenario,
  SimulationResult,
  ZoneImpact,
} from './domain/types'

const HAZARD_OPTIONS: Array<{
  id: HazardKind
  label: string
  icon: typeof Waves
}> = [
  { id: 'flood', label: 'Flood', icon: Waves },
  { id: 'wildfire', label: 'Fire', icon: Flame },
  { id: 'heatwave', label: 'Heat', icon: ThermometerSun },
  { id: 'earthquake', label: 'Quake', icon: Activity },
  { id: 'cyclone', label: 'Cyclone', icon: Radio },
]

const ROAD_LINES = CITY_ZONES.flatMap((zone) =>
  zone.neighbors
    .filter((neighborId) => zone.id < neighborId)
    .map((neighborId) => {
      const neighbor = CITY_ZONES.find((item) => item.id === neighborId)
      return neighbor ? { from: zone, to: neighbor, id: `${zone.id}-${neighbor.id}` } : null
    })
    .filter(Boolean),
) as Array<{ from: (typeof CITY_ZONES)[number]; to: (typeof CITY_ZONES)[number]; id: string }>

function formatNumber(value: number) {
  return Intl.NumberFormat('en', { notation: value > 99999 ? 'compact' : 'standard' }).format(value)
}

function riskClass(risk: number) {
  if (risk >= 82) return 'risk-critical'
  if (risk >= 68) return 'risk-high'
  if (risk >= 52) return 'risk-watch'
  return 'risk-low'
}

function statusIcon(status: AgentBrief['status']) {
  if (status === 'critical') return Siren
  if (status === 'warning') return AlertTriangle
  if (status === 'stable') return ShieldCheck
  return CircleGauge
}

function downloadFile(name: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

function SliderControl({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '%',
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="slider-control">
      <span>
        {label}
        <strong>
          {value}
          {unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function MetricRibbon({ metrics }: { metrics: MissionMetric[] }) {
  const icons = [Siren, Route, ShieldCheck, Zap]

  return (
    <section className="metric-ribbon" aria-label="Mission metrics">
      {metrics.map((metric, index) => {
        const Icon = icons[index] ?? Activity
        return (
          <article className={clsx('metric-tile', `tone-${metric.tone}`)} key={metric.label}>
            <Icon size={20} aria-hidden="true" />
            <div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.delta}</small>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function ScenarioControls({
  scenario,
  inferenceReasons,
  onScenarioChange,
  onApplyIntel,
  onReset,
  onExportMarkdown,
  onExportJson,
}: {
  scenario: Scenario
  inferenceReasons: string[]
  onScenarioChange: (scenario: Scenario) => void
  onApplyIntel: () => void
  onReset: () => void
  onExportMarkdown: () => void
  onExportJson: () => void
}) {
  const update = <K extends keyof Scenario>(key: K, value: Scenario[K]) => {
    onScenarioChange(normalizeScenario({ ...scenario, [key]: value }))
  }

  return (
    <aside className="control-panel" aria-label="Scenario controls">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Aegis Atlas</span>
          <h1>Disaster Response Command</h1>
        </div>
        <img src={`${import.meta.env.BASE_URL}aegis.svg`} width="44" height="44" alt="Aegis Atlas" />
      </div>

      <div className="hazard-selector" role="group" aria-label="Hazard type">
        {HAZARD_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <button
              className={clsx('hazard-button', scenario.hazard === option.id && 'is-active')}
              key={option.id}
              type="button"
              onClick={() => update('hazard', option.id)}
              title={`${option.label} scenario`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>

      <div className="control-grid">
        <SliderControl
          label="Hazard intensity"
          value={scenario.intensity}
          onChange={(value) => update('intensity', value)}
        />
        <SliderControl
          label="Forecast horizon"
          value={scenario.horizonHours}
          min={1}
          max={72}
          unit="h"
          onChange={(value) => update('horizonHours', value)}
        />
        <SliderControl
          label="Comms outage"
          value={scenario.commsOutage}
          onChange={(value) => update('commsOutage', value)}
        />
        <SliderControl
          label="Road disruption"
          value={scenario.roadDamage}
          onChange={(value) => update('roadDamage', value)}
        />
        <SliderControl
          label="Hospital load"
          value={scenario.hospitalLoad}
          onChange={(value) => update('hospitalLoad', value)}
        />
        <SliderControl
          label="Response budget"
          value={scenario.resourceBudget}
          min={20}
          max={120}
          onChange={(value) => update('resourceBudget', value)}
        />
        <SliderControl
          label="Equity weight"
          value={scenario.equityWeight}
          onChange={(value) => update('equityWeight', value)}
        />
      </div>

      <label className="note-field">
        <span>Field intel</span>
        <textarea
          value={scenario.fieldNote}
          rows={5}
          maxLength={600}
          onChange={(event) => update('fieldNote', event.target.value)}
        />
      </label>

      {inferenceReasons.length > 0 && (
        <div className="inference-list" aria-live="polite">
          {inferenceReasons.slice(0, 3).map((reason) => (
            <span key={reason}>
              <Info size={14} aria-hidden="true" />
              {reason}
            </span>
          ))}
        </div>
      )}

      <div className="switch-row">
        <label className="switch">
          <input
            type="checkbox"
            checked={scenario.privacyMode}
            onChange={(event) => update('privacyMode', event.target.checked)}
          />
          <span aria-hidden="true" />
          <strong>{scenario.privacyMode ? 'Privacy on' : 'Ops sharing'}</strong>
        </label>
        <span>{scenario.privacyMode ? 'local-only notes' : 'portable exports'}</span>
      </div>

      <div className="command-row">
        <button type="button" className="primary-command" onClick={onApplyIntel}>
          <BrainCircuit size={18} aria-hidden="true" />
          Apply intel
        </button>
        <button type="button" className="icon-command" onClick={onReset} title="Reset scenario">
          <RefreshCcw size={18} aria-hidden="true" />
        </button>
        <button type="button" className="icon-command" onClick={onExportMarkdown} title="Export action plan">
          <FileText size={18} aria-hidden="true" />
        </button>
        <button type="button" className="icon-command" onClick={onExportJson} title="Export JSON">
          <Download size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}

function CommandMap({
  result,
  selectedZoneId,
  onSelectZone,
}: {
  result: SimulationResult
  selectedZoneId: string
  onSelectZone: (zoneId: string) => void
}) {
  const zones = result.impacts
  const routes = result.allocations.slice(0, 7).map((allocation) => {
    const impact = zones.find((item) => item.zone.id === allocation.zoneId)
    return impact ? { allocation, impact } : null
  })

  return (
    <section className="map-panel" aria-label="Crisis map">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Live synthetic twin</span>
          <h2>Risk, roads, routes</h2>
        </div>
        <span className="scenario-chip">
          <Satellite size={15} aria-hidden="true" />
          {result.scenario.hazard}
        </span>
      </div>

      <div className="map-shell">
        <svg viewBox="0 0 100 100" role="img" aria-label="City risk map">
          <rect x="0" y="0" width="100" height="100" rx="4" className="map-base" />
          <path
            d="M4 77 C18 69 25 90 39 82 C55 72 63 91 76 79 C86 69 91 76 97 70"
            className="river-path"
          />
          {ROAD_LINES.map((line) => (
            <line
              key={line.id}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              className="road-line"
            />
          ))}
          {routes.map(
            (route) =>
              route && (
                <line
                  key={`route-${route.allocation.zoneId}`}
                  x1="50"
                  y1="51"
                  x2={route.impact.zone.x}
                  y2={route.impact.zone.y}
                  className={clsx('response-route', route.allocation.coverage > 62 && 'is-strong')}
                />
              ),
          )}
          <g>
            <circle cx="50" cy="51" r="4.2" className="command-node" />
            <text x="50" y="44" textAnchor="middle" className="map-label">
              EOC
            </text>
          </g>
          {zones.map((impact) => (
            <g
              key={impact.zone.id}
              role="button"
              tabIndex={0}
              aria-label={`${impact.zone.name}, risk ${impact.risk}`}
              onClick={() => onSelectZone(impact.zone.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelectZone(impact.zone.id)
                }
              }}
              className={clsx('zone-node', selectedZoneId === impact.zone.id && 'is-selected')}
            >
              <circle
                cx={impact.zone.x}
                cy={impact.zone.y}
                r={10}
                className="zone-hit-target"
                aria-hidden="true"
              />
              <circle
                cx={impact.zone.x}
                cy={impact.zone.y}
                r={Math.max(4.4, Math.min(8.6, impact.affected / 7600))}
                className={riskClass(impact.risk)}
              />
              <text x={impact.zone.x} y={impact.zone.y + 13} textAnchor="middle" className="map-label">
                {impact.zone.name.split(' ')[0]}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  )
}

function ZoneFocus({
  impact,
  allocation,
}: {
  impact: ZoneImpact
  allocation?: ResourceAllocation
}) {
  return (
    <section className="focus-panel" aria-label="Selected zone">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{impact.zone.district}</span>
          <h2>{impact.zone.name}</h2>
        </div>
        <span className={clsx('risk-badge', riskClass(impact.risk))}>Risk {impact.risk}</span>
      </div>
      <div className="focus-grid">
        <div>
          <span>Population</span>
          <strong>{impact.zone.population.toLocaleString()}</strong>
        </div>
        <div>
          <span>Affected</span>
          <strong>{impact.affected.toLocaleString()}</strong>
        </div>
        <div>
          <span>Evacuation</span>
          <strong>{impact.evacuationDemand.toLocaleString()}</strong>
        </div>
        <div>
          <span>Medical</span>
          <strong>{impact.medicalDemand.toLocaleString()}</strong>
        </div>
      </div>
      <div className="allocation-strip">
        <span>
          <Route size={16} aria-hidden="true" />
          ETA {allocation?.etaHours == null ? '--' : `${allocation.etaHours}h`}
        </span>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          Coverage {allocation?.coverage ?? 0}%
        </span>
        <span>
          <Hospital size={16} aria-hidden="true" />
          Beds {impact.zone.hospitalBeds}
        </span>
      </div>
      <p className="action-copy">{allocation?.action}</p>
      <div className="reason-cloud">
        {impact.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
        {impact.infrastructureThreats.map((asset) => (
          <span key={asset}>{asset}</span>
        ))}
      </div>
    </section>
  )
}

function AgentBoard({ agents }: { agents: AgentBrief[] }) {
  return (
    <section className="agent-panel" aria-label="Agent briefs">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Human-supervised agents</span>
          <h2>Decision swarm</h2>
        </div>
        <span className="scenario-chip">
          <DatabaseZap size={15} aria-hidden="true" />
          local model
        </span>
      </div>
      <div className="agent-grid">
        {agents.map((agent) => {
          const Icon = statusIcon(agent.status)
          return (
            <article className={clsx('agent-card', `agent-${agent.status}`)} key={agent.id}>
              <div className="agent-title">
                <Icon size={18} aria-hidden="true" />
                <strong>{agent.title}</strong>
                <span>{Math.round(agent.confidence)}%</span>
              </div>
              <p>{agent.summary}</p>
              <div className="evidence-list">
                {agent.evidence.slice(0, 2).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PriorityTable({
  impacts,
  allocations,
}: {
  impacts: ZoneImpact[]
  allocations: ResourceAllocation[]
}) {
  return (
    <section className="table-panel" aria-label="Priority table">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Triage queue</span>
          <h2>First six moves</h2>
        </div>
      </div>
      <div className="priority-table">
        <div className="table-head">
          <span>Zone</span>
          <span>Risk</span>
          <span>Affected</span>
          <span>Coverage</span>
        </div>
        {impacts.slice(0, 6).map((impact) => {
          const allocation = allocations.find((item) => item.zoneId === impact.zone.id)
          return (
            <div className="table-row" key={impact.zone.id}>
              <span>{impact.zone.name}</span>
              <strong>{impact.risk}</strong>
              <span>{formatNumber(impact.affected)}</span>
              <span>{allocation?.coverage ?? 0}%</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InventoryPanel({ inventory, remaining }: { inventory: Inventory; remaining: Inventory }) {
  const entries = Object.keys(inventory) as Array<keyof Inventory>

  return (
    <section className="inventory-panel" aria-label="Inventory">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Resource posture</span>
          <h2>Inventory burn-down</h2>
        </div>
      </div>
      <div className="inventory-list">
        {entries.map((key) => {
          const used = inventory[key] - remaining[key]
          const pct = Math.round((used / Math.max(1, inventory[key])) * 100)
          return (
            <div className="inventory-item" key={key}>
              <span>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</span>
              <strong>
                {used}/{inventory[key]}
              </strong>
              <div className="bar-track" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ActionPlan({ actions }: { actions: string[] }) {
  return (
    <section className="action-panel" aria-label="Action plan">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Incident command</span>
          <h2>Action sequence</h2>
        </div>
        <ClipboardCheck size={20} aria-hidden="true" />
      </div>
      <ol className="action-list">
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ol>
    </section>
  )
}

function ReportDrawer({
  isOpen,
  report,
  onClose,
  onDownload,
}: {
  isOpen: boolean
  report: string
  onClose: () => void
  onDownload: () => void
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="report-drawer" role="dialog" aria-modal="true" aria-label="Incident action report">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Export preview</span>
            <h2>Incident Action Plan</h2>
          </div>
          <button type="button" className="icon-command" onClick={onClose} title="Close report">
            <ArrowDownToLine size={18} aria-hidden="true" />
          </button>
        </div>
        <textarea readOnly value={report} rows={22} />
        <button type="button" className="primary-command" onClick={onDownload}>
          <Download size={18} aria-hidden="true" />
          Download Markdown
        </button>
      </aside>
    </div>
  )
}

function App() {
  const [scenario, setScenario] = useState<Scenario>(() => loadScenario())
  const [selectedZoneId, setSelectedZoneId] = useState('dock-ward')
  const [inferenceReasons, setInferenceReasons] = useState<string[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const result = useMemo(() => simulateScenario(scenario), [scenario])
  const selectedImpact = result.impacts.find((impact) => impact.zone.id === selectedZoneId) ?? result.impacts[0]
  const selectedAllocation = result.allocations.find((allocation) => allocation.zoneId === selectedImpact.zone.id)
  const incidentReport = useMemo(() => buildIncidentReport(result), [result])

  useEffect(() => {
    saveScenario(scenario)
  }, [scenario])

  useEffect(() => {
    if (!result.impacts.some((impact) => impact.zone.id === selectedZoneId)) {
      setSelectedZoneId(result.impacts[0].zone.id)
    }
  }, [result.impacts, selectedZoneId])

  const applyFieldIntel = () => {
    const inference = inferScenarioFromFieldNote(scenario.fieldNote)
    setScenario((current) => normalizeScenario({ ...current, ...inference.scenarioPatch, fieldNote: inference.sanitizedNote }))
    setInferenceReasons(inference.reasons.length ? inference.reasons : ['Field note normalized; no scenario shift detected.'])
  }

  const resetScenario = () => {
    clearScenario()
    setScenario(DEFAULT_SCENARIO)
    setInferenceReasons([])
    setSelectedZoneId('dock-ward')
  }

  const exportMarkdown = () => {
    setReportOpen(true)
  }

  const downloadMarkdown = () => {
    downloadFile('aegis-incident-action-plan.md', incidentReport, 'text/markdown')
  }

  const exportJson = () => {
    downloadFile('aegis-scenario-export.json', buildPortableJson(result), 'application/json')
  }

  return (
    <main className="app-shell">
      <div className="atlas-entry" aria-hidden="true">
        <div>
          <span>Aegis Atlas</span>
          <strong>Command floor syncing</strong>
        </div>
      </div>
      <ScenarioControls
        scenario={scenario}
        inferenceReasons={inferenceReasons}
        onScenarioChange={setScenario}
        onApplyIntel={applyFieldIntel}
        onReset={resetScenario}
        onExportMarkdown={exportMarkdown}
        onExportJson={exportJson}
      />

      <div className="mission-space">
        <header className="top-bar">
          <div>
            <span className="eyebrow">Offline-first civic resilience</span>
            <h2>From field chaos to defensible action in {result.optimizedEtaHours.toFixed(1)} hours</h2>
          </div>
          <div className="readiness-dial" aria-label={`Readiness ${result.responseReadiness}%`}>
            <span>{result.responseReadiness}</span>
            <small>readiness</small>
          </div>
        </header>

        <section className="mission-prologue" aria-label="Decision snapshot">
          <article>
            <span>Active hazard</span>
            <strong>{result.scenario.hazard}</strong>
          </article>
          <article>
            <span>Priority zone</span>
            <strong>{selectedImpact.zone.name}</strong>
          </article>
          <article>
            <span>First wave</span>
            <strong>{result.allocations.length} moves</strong>
          </article>
          <article>
            <span>Export state</span>
            <strong>{scenario.privacyMode ? 'Local only' : 'Portable'}</strong>
          </article>
        </section>

        <MetricRibbon metrics={result.metrics} />

        <div className="dashboard-grid">
          <CommandMap result={result} selectedZoneId={selectedImpact.zone.id} onSelectZone={setSelectedZoneId} />
          <ZoneFocus impact={selectedImpact} allocation={selectedAllocation} />
          <AgentBoard agents={result.agents} />
          <PriorityTable impacts={result.impacts} allocations={result.allocations} />
          <InventoryPanel inventory={result.inventory} remaining={result.remainingInventory} />
          <ActionPlan actions={result.topActions} />
        </div>

        <footer className="app-footer">
          <div>
            <strong>Aegis Atlas</strong>
            <small>Offline-first disaster response cockpit for field teams, planners, and tabletop drills.</small>
          </div>
          <nav aria-label="System status">
            <span>
              <Layers size={16} aria-hidden="true" />
              Simulation mode
            </span>
            <span>
              <MapPinned size={16} aria-hidden="true" />
              Synthetic civic twin
            </span>
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              Local field notes
            </span>
          </nav>
        </footer>
      </div>

      <ReportDrawer
        isOpen={reportOpen}
        report={incidentReport}
        onClose={() => setReportOpen(false)}
        onDownload={downloadMarkdown}
      />
    </main>
  )
}

export default App
