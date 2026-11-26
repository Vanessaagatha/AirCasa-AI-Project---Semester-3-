import { useState, type ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import {
  Bell,
  Calculator,
  CircleCheck,
  CircleOff,
  Database,
  Download,
  FlaskConical,
  Gauge,
  HardDrive,
  Home,
  Info,
  Loader2,
  Lock,
  Monitor,
  RotateCcw,
  Server,
  ShieldCheck,
  Trash2,
  Box,
} from 'lucide-react'
import type { AppSettings, DemoScenario, GuidanceThresholds, HomeInfo, SimulationAssumptions } from '@/types'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Select, Toggle } from '@/components/ui'
import { ThemeSwitch } from '@/components/ThemeToggle'
import { DEFAULT_SETTINGS, useSettings } from '@/context/SettingsContext'
import { useRooms } from '@/context/RoomsContext'
import { useHousehold } from '@/context/HouseholdContext'
import { useLatestReadings } from '@/features/environment/useEnvironment'
import { checkApiHealth } from '@/services/environmentService'
import { STORAGE_KEYS, removeKey } from '@/services/storage'
import { scenarioDescription, scenarioLabel } from '@/data/scenarios'
import { fmtRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'general', label: 'General', icon: Monitor, description: 'Appearance, region and refresh' },
  { id: 'home', label: 'Home', icon: Home, description: 'Address and building details' },
  { id: 'rooms', label: 'Rooms & sensors', icon: Box, description: 'Manage rooms and sensor status' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Which alerts you see' },
  { id: 'guidance', label: 'Guidance thresholds', icon: Gauge, description: 'When guidance rules fire' },
  { id: 'simulation', label: 'Simulation model', icon: Calculator, description: 'Physical assumptions' },
  { id: 'data', label: 'Data sources', icon: Database, description: 'Demo data or FastAPI' },
  { id: 'privacy', label: 'Privacy & data', icon: ShieldCheck, description: 'Storage, export and reset' },
  { id: 'about', label: 'About', icon: Info, description: 'Version and limitations' },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

function NumberSetting({
  id,
  label,
  hint,
  value,
  unit,
  step = 0.1,
  min,
  max,
  onChange,
  defaultValue,
  disabled,
}: {
  id: string
  label: string
  hint?: ReactNode
  value: number
  unit?: string
  step?: number
  min: number
  max: number
  onChange: (v: number) => void
  defaultValue: number
  disabled?: boolean
}) {
  const changed = value !== defaultValue
  return (
    <div className="grid gap-2 border-b border-line/70 py-3.5 last:border-0 sm:grid-cols-[1fr_170px] sm:items-center">
      <div>
        <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-medium text-ink">
          {label}
          {changed && <Badge tone="ochre" className="px-1.5 py-0 text-[10px]">Changed</Badge>}
        </label>
        {hint && <p className="mt-0.5 text-xs leading-5 text-ink-muted">{hint}</p>}
        <p className="text-[11px] text-ink-muted">
          Default {defaultValue}
          {unit ? ` ${unit}` : ''}, allowed {min} to {max}
        </p>
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (e.target.value !== '' && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
          }}
          className={cn('tabular text-right', unit && 'pr-16')}
        />
        {unit && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-muted">{unit}</span>}
      </div>
    </div>
  )
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <div className="p-5 pt-3">{children}</div>
    </Card>
  )
}

type Health = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; text: string } | { state: 'error'; text: string }

export default function SettingsPage() {
  const { section } = useParams()
  const active: SectionId = (SECTIONS.find((s) => s.id === section)?.id ?? 'general') as SectionId
  const current = SECTIONS.find((s) => s.id === active)!

  return (
    <div>
      <PageHeader title="Settings" description="Preferences for you and this household. Changes save automatically." />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Settings sections" className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:p-0">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              to={`/app/settings/${s.id}`}
              className={() =>
                cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors',
                  s.id === active ? 'bg-breeze-100 font-medium text-breeze-700' : 'text-ink-soft hover:bg-breeze-50 hover:text-ink',
                )
              }
            >
              <s.icon className="size-4" />
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          <h2 className="sr-only">{current.label}</h2>
          {active === 'general' && <GeneralSection />}
          {active === 'home' && <HomeSection />}
          {active === 'rooms' && <RoomsSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'guidance' && <GuidanceSection />}
          {active === 'simulation' && <SimulationSection />}
          {active === 'data' && <DataSection />}
          {active === 'privacy' && <PrivacySection />}
          {active === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- General

function GeneralSection() {
  const { settings, updateSettings, updateSection, resolvedTheme } = useSettings()
  return (
    <>
      <Section title="Appearance">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">Theme</p>
              <p className="text-xs text-ink-muted">Currently showing the {resolvedTheme} theme.</p>
            </div>
            <ThemeSwitch />
          </div>
          <Toggle id="reduce-motion" label="Reduce motion" description="Stops auto-rotation and shortens animations, including airflow particles on the landing page." checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
          <Toggle id="compact" label="Compact layout" description="Slightly smaller text and spacing to fit more on screen." checked={settings.compactLayout} onChange={(v) => updateSettings({ compactLayout: v })} />
        </div>
      </Section>
      <Section title="Region and time">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Time format" htmlFor="tf">
            <Segmented<'24h' | '12h'>
              ariaLabel="Time format"
              value={settings.region.timeFormat}
              onChange={(v) => updateSection('region', { timeFormat: v })}
              options={[
                { value: '24h', label: '24-hour (14:00)' },
                { value: '12h', label: '12-hour (2:00 pm)' },
              ]}
            />
          </Field>
          <Field label="Automatic refresh" htmlFor="refresh" hint="How often readings and forecasts reload while the app is open.">
            <Select id="refresh" value={settings.autoRefreshSec} onChange={(e) => updateSettings({ autoRefreshSec: Number(e.target.value) })}>
              <option value={0}>Off (refresh manually)</option>
              <option value={60}>Every minute</option>
              <option value={300}>Every 5 minutes</option>
              <option value={900}>Every 15 minutes</option>
            </Select>
          </Field>
          <Field label="Latitude" htmlFor="lat" hint="Used for sun position in the simulation.">
            <Input id="lat" type="number" step={0.01} min={-11} max={6} value={settings.region.latitude} onChange={(e) => updateSection('region', { latitude: Number(e.target.value) })} />
          </Field>
          <Field label="Longitude" htmlFor="lon">
            <Input id="lon" type="number" step={0.01} min={94} max={141} value={settings.region.longitude} onChange={(e) => updateSection('region', { longitude: Number(e.target.value) })} />
          </Field>
          <Field label="Time zone" htmlFor="tz">
            <Select id="tz" value={settings.region.utcOffsetHours} onChange={(e) => updateSection('region', { utcOffsetHours: Number(e.target.value) })}>
              <option value={7}>WIB (UTC+7), Western Indonesia</option>
              <option value={8}>WITA (UTC+8), Central Indonesia</option>
              <option value={9}>WIT (UTC+9), Eastern Indonesia</option>
            </Select>
          </Field>
          <Field label="Units" htmlFor="units" hint="Metric units are used throughout.">
            <Input id="units" value="°C, metres, µg/m³, W" disabled />
          </Field>
        </div>
      </Section>
    </>
  )
}

// ----------------------------------------------------------------- Home

function HomeSection() {
  const { settings, updateHome } = useSettings()
  const { household, can } = useHousehold()
  const editable = can('manage-members')
  return (
    <Section title="Home information" description={editable ? 'Shown across the app and used by the simulation.' : 'Only the household owner can edit these details.'}>
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 disabled:opacity-80">
        <div className="sm:col-span-2">
          <Field label="Home name" htmlFor="home-name">
            <Input id="home-name" value={settings.home.homeName} onChange={(e) => updateHome({ homeName: e.target.value })} />
          </Field>
        </div>
        <Field label="City" htmlFor="home-city">
          <Input id="home-city" value={settings.home.city} onChange={(e) => updateHome({ city: e.target.value })} />
        </Field>
        <Field label="District" htmlFor="home-district">
          <Input id="home-district" value={settings.home.district} onChange={(e) => updateHome({ district: e.target.value })} />
        </Field>
        <Field label="Home type" htmlFor="home-type">
          <Select id="home-type" value={settings.home.homeType} onChange={(e) => updateHome({ homeType: e.target.value as HomeInfo['homeType'] })}>
            <option value="landed-house">Landed house</option>
            <option value="townhouse">Townhouse / row house</option>
            <option value="apartment">Apartment</option>
            <option value="kos">Boarding room (kos)</option>
          </Select>
        </Field>
        <Field label="Number of floors" htmlFor="home-floors" hint="Rooms on the top floor are modelled with a sun-exposed roof.">
          <Select id="home-floors" value={settings.home.floors} onChange={(e) => updateHome({ floors: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>
      <p className="mt-4 text-xs text-ink-muted">
        Household: <span className="font-medium text-ink">{household.name}</span>.{' '}
        <Link to="/app/household" className="font-medium text-breeze-700 hover:underline">
          Manage members
        </Link>
      </p>
    </Section>
  )
}

// ----------------------------------------------------------------- Rooms & sensors

function RoomsSection() {
  const { rooms, selectRoom, deleteRoom, restoreDemoRooms } = useRooms()
  const { can } = useHousehold()
  const { settings } = useSettings()
  const readings = useLatestReadings(rooms)
  const demo = settings.dataMode === 'demo'
  const editable = can('edit-rooms')

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), rooms }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'coolnest-rooms.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <Section
        title="Rooms"
        action={
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={exportAll} disabled={!rooms.length}>
            Export all
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{r.name}</p>
                <p className="text-xs text-ink-muted">
                  {r.dimensions.length} × {r.dimensions.width} m, {r.windows.length} windows, {(r.appliances ?? []).length} appliances, updated {fmtRelative(r.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Link to="/app/rooms" onClick={() => selectRoom(r.id)}>
                  <Button size="sm" variant="ghost">
                    {editable ? 'Edit' : 'View'}
                  </Button>
                </Link>
                {editable && (
                  <Button size="sm" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => window.confirm(`Delete “${r.name}”?`) && deleteRoom(r.id)}>
                    <Trash2 className="size-3.5 text-clay-700" />
                  </Button>
                )}
              </div>
            </li>
          ))}
          {!rooms.length && <li className="py-4 text-[13px] text-ink-muted">No rooms saved.</li>}
        </ul>
        {editable && (
          <Button className="mt-3" size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={restoreDemoRooms}>
            Restore demo rooms
          </Button>
        )}
      </Section>
      <Section title="Sensor connection status" description="Physical sensor pairing is not implemented in this prototype; sensors would post readings to the FastAPI backend.">
        <ul className="divide-y divide-line">
          {rooms.map((r) => {
            const rd = readings.data?.[r.id]
            const ok = rd?.status === 'ok'
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="font-mono text-[11px] text-ink-muted">{rd?.sensorId ?? 'no sensor id'}</p>
                </div>
                {readings.loading ? (
                  <span className="text-xs text-ink-muted">Checking…</span>
                ) : (
                  <Badge tone={ok ? 'sage' : 'ochre'} icon={ok ? <CircleCheck className="size-3" /> : <CircleOff className="size-3" />}>
                    {ok ? (demo ? 'Demo sensor reporting' : 'Reporting') : 'Not reporting'}
                  </Badge>
                )}
              </li>
            )
          })}
        </ul>
      </Section>
    </>
  )
}

// ----------------------------------------------------------------- Notifications

function NotificationsSection() {
  const { settings, updateSection } = useSettings()
  const n = settings.notifications
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

  const enableBrowser = async (v: boolean) => {
    if (!v) return updateSection('notifications', { browserNotifications: false })
    if (typeof Notification === 'undefined') return setPerm('unsupported')
    const p = await Notification.requestPermission()
    setPerm(p)
    updateSection('notifications', { browserNotifications: p === 'granted' })
  }

  return (
    <>
      <Section title="In-app alerts" description="Alerts appear on the dashboard when the matching guidance rule fires for the selected room.">
        <div className="space-y-4">
          <Toggle id="n-heat" label="Indoor heat" description={`When a room reaches ${settings.thresholds.warmIndoorC}°C or the heat index is high.`} checked={n.heatAlerts} onChange={(v) => updateSection('notifications', { heatAlerts: v })} />
          <Toggle id="n-rain" label="Rain with windows that can be open" description={`When rain probability reaches ${settings.thresholds.rainProbabilityPct}%.`} checked={n.rainAlerts} onChange={(v) => updateSection('notifications', { rainAlerts: v })} />
          <Toggle id="n-air" label="Outdoor air quality" description={`When regional PM2.5 is above ${settings.thresholds.pm25CautionUgm3} µg/m³.`} checked={n.airQualityAlerts} onChange={(v) => updateSection('notifications', { airQualityAlerts: v })} />
          <Toggle id="n-data" label="Missing data" description="When a sensor stops reporting or the forecast is unavailable." checked={n.dataAlerts} onChange={(v) => updateSection('notifications', { dataAlerts: v })} />
        </div>
      </Section>
      <Section title="Browser notifications" description="Show a system notification while CoolNest is open in a tab. No push service is used.">
        <Toggle id="n-browser" label="Allow browser notifications" description={perm === 'denied' ? 'Blocked in your browser settings. Allow notifications for this site to use them.' : perm === 'unsupported' ? 'Not supported in this browser.' : 'You will be asked for permission.'} checked={n.browserNotifications && perm === 'granted'} onChange={(v) => void enableBrowser(v)} />
        {n.browserNotifications && perm === 'granted' && (
          <Button className="mt-4" size="sm" onClick={() => new Notification('CoolNest test', { body: 'Notifications are working.' })}>
            Send a test notification
          </Button>
        )}
      </Section>
    </>
  )
}

// ----------------------------------------------------------------- Guidance thresholds

const THRESHOLD_FIELDS: { key: keyof GuidanceThresholds; label: string; unit: string; min: number; max: number; step?: number; hint: string }[] = [
  { key: 'warmIndoorC', label: 'Warm room', unit: '°C', min: 24, max: 36, hint: 'Overheating guidance starts here.' },
  { key: 'hotIndoorC', label: 'Hot room (caution)', unit: '°C', min: 26, max: 40, hint: 'Overheating guidance becomes a caution.' },
  { key: 'heatIndexExtremeCautionC', label: 'Heat index, extreme caution', unit: '°C', min: 27, max: 45, hint: 'US NWS band starts at 32°C.' },
  { key: 'heatIndexDangerC', label: 'Heat index, danger', unit: '°C', min: 32, max: 55, hint: 'US NWS band starts at 39°C.' },
  { key: 'ventilationCoolerByC', label: 'Outdoor cooler by at least', unit: '°C', min: 0, max: 5, hint: 'Before ventilation is suggested for cooling.' },
  { key: 'pm25CautionUgm3', label: 'PM2.5 caution', unit: 'µg/m³', min: 5, max: 150, step: 0.1, hint: 'US EPA “sensitive groups” starts at 35.4.' },
  { key: 'pm25UnhealthyUgm3', label: 'PM2.5 unhealthy', unit: 'µg/m³', min: 10, max: 250, step: 0.1, hint: 'US EPA “unhealthy” starts at 55.4.' },
  { key: 'rainProbabilityPct', label: 'Rain reminder', unit: '%', min: 10, max: 100, step: 5, hint: 'Probability within the next 3 hours.' },
  { key: 'highHumidityPct', label: 'High indoor humidity', unit: '%', min: 40, max: 95, step: 1, hint: 'Above this, humidity guidance appears.' },
  { key: 'fanUsefulFromC', label: 'Suggest a fan from', unit: '°C', min: 22, max: 34, hint: 'Fan guidance for rooms that have one.' },
]

function GuidanceSection() {
  const { settings, updateSection, resetSection } = useSettings()
  const { can } = useHousehold()
  return (
    <Section
      title="Guidance thresholds"
      description="Illustrative defaults from US NWS and US EPA scales. Adjust them for your household; they apply to guidance, alerts and charts."
      action={
        <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => resetSection('thresholds')}>
          Reset defaults
        </Button>
      }
    >
      {!can('edit-rooms') && <p className="mb-3 flex items-center gap-2 text-xs text-ink-muted"><Lock className="size-3.5" /> Thresholds are personal to this browser.</p>}
      {THRESHOLD_FIELDS.map((f) => (
        <NumberSetting
          key={f.key}
          id={`th-${f.key}`}
          label={f.label}
          hint={f.hint}
          unit={f.unit}
          min={f.min}
          max={f.max}
          step={f.step ?? 0.5}
          value={settings.thresholds[f.key]}
          defaultValue={DEFAULT_SETTINGS.thresholds[f.key]}
          onChange={(v) => updateSection('thresholds', { [f.key]: v } as Partial<GuidanceThresholds>)}
        />
      ))}
    </Section>
  )
}

// ----------------------------------------------------------------- Simulation

const SIM_FIELDS: { key: keyof SimulationAssumptions; label: string; unit?: string; min: number; max: number; step?: number; hint: string }[] = [
  { key: 'wallUValue', label: 'Wall U-value', unit: 'W/m²K', min: 0.3, max: 4, hint: 'Single brick with plaster ≈ 2.0–2.6; insulated walls < 1.' },
  { key: 'roofUValue', label: 'Roof U-value', unit: 'W/m²K', min: 0.3, max: 6, hint: 'Clay tile with ceiling ≈ 1.5–2.5; metal sheet without insulation ≈ 5.' },
  { key: 'windowUValue', label: 'Window U-value', unit: 'W/m²K', min: 1, max: 7, hint: 'Single glazing ≈ 5.8; double glazing ≈ 2.8.' },
  { key: 'windowSHGC', label: 'Window solar heat gain coefficient', min: 0.1, max: 0.9, step: 0.05, hint: 'Clear glass ≈ 0.7–0.8; tinted or film ≈ 0.4.' },
  { key: 'shadingFactor', label: 'Shading factor for shaded windows', min: 0.05, max: 1, step: 0.05, hint: 'Fraction of sun still entering when curtains or awnings are present.' },
  { key: 'infiltrationACH', label: 'Background infiltration', unit: 'ACH', min: 0.1, max: 5, hint: 'Air leakage with everything closed; louvres and gaps raise it.' },
  { key: 'thermalMassKJPerM2K', label: 'Effective thermal mass', unit: 'kJ/m²K', min: 20, max: 300, step: 5, hint: 'Per m² of floor. Heavy masonry ≈ 100–150; light construction ≈ 40.' },
  { key: 'urbanWindFactor', label: 'Urban wind factor', min: 0.1, max: 1, step: 0.05, hint: 'Share of weather-station wind reaching the window in a dense neighbourhood.' },
  { key: 'dischargeCoefficient', label: 'Opening discharge coefficient', min: 0.3, max: 0.9, step: 0.01, hint: 'Sharp-edged openings ≈ 0.61.' },
  { key: 'occupants', label: 'Default people per room', min: 0, max: 8, step: 1, hint: 'Each adds ≈ 75 W of sensible heat.' },
]

function SimulationSection() {
  const { settings, updateSection, resetSection } = useSettings()
  return (
    <Section
      title="Simulation assumptions"
      description="Inputs for the simplified heat balance and ventilation estimates on the Airflow & Heat page. They are typical values, not measurements of your home."
      action={
        <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => resetSection('simulation')}>
          Reset defaults
        </Button>
      }
    >
      {SIM_FIELDS.map((f) => (
        <NumberSetting
          key={f.key}
          id={`sim-${f.key}`}
          label={f.label}
          hint={f.hint}
          unit={f.unit}
          min={f.min}
          max={f.max}
          step={f.step ?? 0.1}
          value={settings.simulation[f.key]}
          defaultValue={DEFAULT_SETTINGS.simulation[f.key]}
          onChange={(v) => updateSection('simulation', { [f.key]: v } as Partial<SimulationAssumptions>)}
        />
      ))}
      <p className="mt-3 text-xs text-ink-muted">
        Changes apply immediately on the{' '}
        <Link to="/app/simulation" className="font-medium text-breeze-700 hover:underline">
          Airflow & Heat
        </Link>{' '}
        page.
      </p>
    </Section>
  )
}

// ----------------------------------------------------------------- Data sources

function DataSection() {
  const { settings, updateSettings } = useSettings()
  const { can } = useHousehold()
  const editable = can('change-data-settings')
  const [url, setUrl] = useState(settings.apiBaseUrl)
  const [health, setHealth] = useState<Health>({ state: 'idle' })
  const demo = settings.dataMode === 'demo'

  const test = async () => {
    setHealth({ state: 'checking' })
    try {
      const h = await checkApiHealth(url)
      setHealth({ state: 'ok', text: `Connected. Status “${h.status}”, model ${h.modelLoaded ? `loaded (${h.modelVersion ?? 'unknown version'})` : 'not loaded'}.` })
    } catch (e) {
      setHealth({ state: 'error', text: (e as Error).message })
    }
  }

  return (
    <>
      <div className={cn('flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between', demo ? 'border-ochre-300 bg-ochre-50' : 'border-mist-200 bg-mist-50')}>
        <div className="flex items-start gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', demo ? 'bg-ochre-100 text-ochre-700' : 'bg-mist-100 text-mist-700')}>
            {demo ? <FlaskConical className="size-5" /> : <Server className="size-5" />}
          </span>
          <div>
            <p className={cn('text-[15px] font-semibold', demo ? 'text-ochre-700' : 'text-mist-700')}>{demo ? 'Demo mode is on' : 'Using the FastAPI backend'}</p>
            <p className={cn('text-[13px] leading-5', demo ? 'text-ochre-700/90' : 'text-mist-700/90')}>
              {demo ? 'All readings, weather and forecasts are synthetic. Nothing is measured and no model is running.' : `Data is requested from ${settings.apiBaseUrl}.`}
            </p>
          </div>
        </div>
        <Segmented<AppSettings['dataMode']>
          ariaLabel="Data mode"
          value={settings.dataMode}
          onChange={(m) => editable && updateSettings({ dataMode: m })}
          options={[
            { value: 'demo', label: 'Demo data' },
            { value: 'api', label: 'FastAPI' },
          ]}
        />
      </div>
      {!editable && <p className="flex items-center gap-2 text-xs text-ink-muted"><Lock className="size-3.5" /> Only the household owner can change data sources.</p>}
      <Section title="FastAPI connection">
        <div className="space-y-4">
          <Field label="Base URL" htmlFor="api-url" hint="For example http://localhost:8000. See docs/API_CONTRACT.md for the endpoints.">
            <div className="flex gap-2">
              <Input id="api-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!editable} />
              <Button onClick={() => updateSettings({ apiBaseUrl: url.trim() })} disabled={!editable || url.trim() === settings.apiBaseUrl}>
                Save
              </Button>
            </div>
          </Field>
          <Button size="sm" icon={health.state === 'checking' ? <Loader2 className="size-3.5 animate-spin" /> : <Server className="size-3.5" />} onClick={test} disabled={health.state === 'checking' || !url.trim()}>
            Test connection
          </Button>
          {health.state === 'ok' && <p className="flex items-start gap-1.5 text-xs text-breeze-700"><CircleCheck className="mt-0.5 size-3.5 shrink-0" /> {health.text}</p>}
          {health.state === 'error' && <p className="flex items-start gap-1.5 text-xs text-clay-700"><CircleOff className="mt-0.5 size-3.5 shrink-0" /> {health.text}</p>}
        </div>
      </Section>
      <Section title="Demo scenario" description="Use scenarios to demonstrate guidance rules and missing-data states during a presentation.">
        <Field label="Scenario" htmlFor="scenario" hint={scenarioDescription[settings.scenario]}>
          <Select id="scenario" value={settings.scenario} onChange={(e) => updateSettings({ scenario: e.target.value as DemoScenario })} disabled={!demo}>
            {(Object.keys(scenarioLabel) as DemoScenario[]).map((s) => (
              <option key={s} value={s}>
                {scenarioLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
      </Section>
      <Section title="Source labels">
        <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
          {[
            ['Indoor temperature and humidity', demo ? 'Demo sensor generator' : 'Room sensors via API'],
            ['Outdoor weather and rain', demo ? 'Demo weather generator' : 'Weather provider via API'],
            ['PM2.5', demo ? 'Demo regional estimate' : 'Regional air-quality provider via API'],
            ['60-minute forecast', demo ? 'Demo heuristic, not a trained model' : 'Model served by FastAPI'],
            ['Airflow and heat', 'Simplified physics in the browser'],
            ['Guidance', 'Transparent rules in the browser'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas p-3">
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  )
}

// ----------------------------------------------------------------- Privacy

function PrivacySection() {
  const { resetSettings } = useSettings()
  const { can } = useHousehold()

  const exportEverything = () => {
    const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), note: 'CoolNest local data export. Password hashes are excluded.' }
    for (const [k, key] of Object.entries(STORAGE_KEYS)) {
      if (k === 'session' || k === 'presence') continue
      try {
        const raw = localStorage.getItem(key)
        let value = raw ? JSON.parse(raw) : null
        if (k === 'users' && Array.isArray(value)) value = value.map(({ passwordHash: _p, salt: _s, ...rest }: Record<string, unknown>) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
        data[k] = value
      } catch {
        data[k] = null
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'coolnest-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const clearAll = () => {
    if (!window.confirm('Remove all accounts, rooms, comments and settings stored in this browser? Demo data will be restored on reload.')) return
    Object.values(STORAGE_KEYS).forEach(removeKey)
    try {
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
    window.location.href = '/login'
  }

  return (
    <>
      <Section title="How your data is handled">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: HardDrive, title: 'Stored in this browser', body: 'Accounts, household, rooms, comments and settings live in local storage on this device. Nothing is uploaded in demo mode.' },
            { icon: Lock, title: 'Passwords are hashed', body: 'Passwords are salted and hashed (PBKDF2) before storage. This is still prototype-grade: anyone using this browser profile can clear the data.' },
            { icon: Server, title: 'Sent only to your backend', body: 'In FastAPI mode, room geometry is sent to the URL you configure to request forecasts. No third-party analytics are included.' },
          ].map((x) => (
            <div key={x.title}>
              <x.icon className="size-5 text-breeze-600" />
              <p className="mt-2 text-[13px] font-semibold">{x.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-ink-muted">{x.body}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Your data">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={exportEverything}>
            Export all local data
          </Button>
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={resetSettings}>
            Reset settings
          </Button>
          {can('manage-members') && (
            <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={clearAll}>
              Clear all local data
            </Button>
          )}
        </div>
      </Section>
    </>
  )
}

// ----------------------------------------------------------------- About

function AboutSection() {
  return (
    <Section title="CoolNest 3D">
      <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        {[
          ['Version', '0.2.0 (prototype)'],
          ['Project', 'BINUS University, Computer Science – Artificial Intelligence'],
          ['Forecast model', 'Demo heuristic until a trained model is served by FastAPI'],
          ['Simulation', 'Simplified single-zone heat balance and empirical ventilation formulas'],
          ['Guidance', 'Transparent rules, see docs/GUIDANCE_RULES.md'],
          ['Collaboration', 'Local to this browser; multi-device sync needs a backend'],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs leading-5 text-ink-muted">
        CoolNest is a decision aid, not a certified monitoring or medical device. It does not guarantee cooling outcomes and does not claim to reduce
        urban heat island intensity.
      </p>
    </Section>
  )
}
