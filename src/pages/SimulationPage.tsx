import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppWindow, Box, DoorOpen, FlaskConical, Info, RotateCcw, Settings2, Sun, TriangleAlert, Wind } from 'lucide-react'
import type { HourlyOutlook } from '@/types'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Segmented, Select, Skeleton, Toggle } from '@/components/ui'
import { ChartTooltip, SeriesLegend, axisPropsFor, timeTick, useChartTheme } from '@/components/charts/chartTheme'
import { useRooms } from '@/context/RoomsContext'
import { useSettings } from '@/context/SettingsContext'
import { useCurrentWeather, useLatestReading, useOutlook } from '@/features/environment/useEnvironment'
import { LazyRoomViewer } from '@/features/rooms/LazyRoomViewer'
import { ApplianceMeshes } from '@/features/rooms/ApplianceMeshes'
import { AirflowLayer, SolarOverlay } from '@/features/simulation/AirflowLayer'
import { estimateVentilation } from '@/features/simulation/ventilation'
import { exteriorWalls, simulateScenario, summarize, ventilationOpenings, type GainBreakdown, type Scenario } from '@/features/simulation/heatModel'
import { irradiance, sunPosition, verticalIrradiance } from '@/features/simulation/solar'
import { APPLIANCE_CATALOG } from '@/features/rooms/appliances'
import { compassLabel, wallFacing, wallLabel } from '@/features/rooms/roomGeometry'
import { fmtDelta, fmtTemp, windDirectionLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

type ScenarioId = 'closed' | 'open' | 'cooler' | 'ac'
type Overlay = 'airflow' | 'solar' | 'both'

const SCENARIO_COLOR: Record<ScenarioId, keyof ReturnType<typeof useChartTheme>['series']> = {
  closed: 'pm25',
  open: 'humidity',
  cooler: 'indoor',
  ac: 'forecast',
}

const GAIN_LABEL: Record<keyof GainBreakdown, string> = {
  solar: 'Sun through windows',
  walls: 'Exterior walls',
  roof: 'Roof',
  windows: 'Window glass (conduction)',
  internal: 'Appliances and people',
  ventilation: 'Outdoor air exchange',
  ac: 'Air conditioner',
}

export default function SimulationPage() {
  const { selectedRoom: room } = useRooms()
  const { settings } = useSettings()
  const C = useChartTheme()
  const reading = useLatestReading(room)
  const weather = useCurrentWeather()
  const outlook = useOutlook(26)

  const candidates = useMemo(() => (room ? ventilationOpenings(room) : []), [room])
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [internalDoors, setInternalDoors] = useState(false)
  const [hours, setHours] = useState<'6' | '12' | '24'>('12')
  const [windOverride, setWindOverride] = useState<{ speed: number; dir: number } | null>(null)
  const [occupants, setOccupants] = useState(settings.simulation.occupants)
  const [setpoint, setSetpoint] = useState(26)
  const [focus, setFocus] = useState<ScenarioId>('open')
  const [overlay, setOverlay] = useState<Overlay>('both')

  useEffect(() => {
    setOpenIds(new Set(candidates.map((o) => o.id)))
  }, [candidates])

  const w = weather.data
  const indoorNow = reading.data?.temperatureC ?? null
  const outdoorNow = w?.temperatureC ?? null
  const wind = windOverride ?? { speed: w?.windSpeedMs ?? 2, dir: w?.windDirectionDeg ?? 225 }
  const assumptions = useMemo(() => ({ ...settings.simulation, occupants }), [settings.simulation, occupants])
  const acCapacity = (room?.appliances ?? []).filter((a) => a.type === 'air-conditioner').reduce((s, a) => s + (APPLIANCE_CATALOG[a.type].coolingW ?? 0), 0) || (room?.hasAirConditioner ? 2600 : 0)

  const ready = !!room && indoorNow != null && outdoorNow != null && !!outlook.data
  const startDate = useMemo(() => new Date(), [weather.data, reading.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const fullOutlook: HourlyOutlook[] = useMemo(() => {
    if (!w || !outlook.data) return []
    return [{ timestamp: startDate.toISOString(), temperatureC: w.temperatureC ?? 30, rainProbabilityPct: w.rainProbabilityPct ?? 0, condition: w.condition }, ...outlook.data]
  }, [w, outlook.data, startDate])

  const results = useMemo(() => {
    if (!ready || !room) return null
    const input = {
      room,
      assumptions,
      start: startDate,
      hours: Number(hours),
      initialIndoorC: indoorNow!,
      outlook: fullOutlook,
      windSpeed: wind.speed,
      windFromDeg: wind.dir,
      latitude: settings.region.latitude,
      longitude: settings.region.longitude,
      isTopFloor: room.floorLevel >= settings.home.floors,
    }
    const base = { openIds, internalDoorsOpen: internalDoors, acOn: false, acSetpoint: setpoint }
    const list: Scenario[] = [
      { ...base, id: 'closed', label: 'Windows closed', description: 'All openings closed; only background infiltration.', policy: 'closed' },
      { ...base, id: 'open', label: 'Selected openings open', description: 'Selected windows and doors stay open the whole time.', policy: 'open' },
      { ...base, id: 'cooler', label: 'Open only when cooler outside', description: 'Openings open whenever outdoor air is at least 0.5°C cooler than indoors.', policy: 'when-cooler' },
    ]
    if (acCapacity > 0) list.push({ ...base, id: 'ac', label: `Air conditioner at ${setpoint}°C`, description: 'Windows closed, air conditioner holding the set point within its capacity.', policy: 'closed', acOn: true })
    const res = list.map((sc) => simulateScenario(input, sc))
    const ref = res[0]
    return res.map((r) => ({ r, s: summarize(r, settings.thresholds.warmIndoorC, ref) }))
  }, [ready, room, assumptions, startDate, hours, indoorNow, fullOutlook, wind.speed, wind.dir, settings.region, settings.home.floors, openIds, internalDoors, setpoint, acCapacity, settings.thresholds.warmIndoorC])

  const vent = useMemo(() => {
    if (!room || indoorNow == null || outdoorNow == null) return null
    const opts = { windSpeed: wind.speed, windFromDeg: wind.dir, indoorC: indoorNow, outdoorC: outdoorNow, internalDoorsOpen: internalDoors, assumptions }
    return {
      central: estimateVentilation(room, openIds, opts),
      low: estimateVentilation(room, openIds, { ...opts, windScale: 0.7 }),
      high: estimateVentilation(room, openIds, { ...opts, windScale: 1.3 }),
    }
  }, [room, indoorNow, outdoorNow, wind.speed, wind.dir, internalDoors, assumptions, openIds])

  const solarByWindow = useMemo(() => {
    const m = new Map<string, number>()
    if (!room || !w) return m
    const sun = sunPosition(startDate, settings.region.latitude, settings.region.longitude)
    const irr = irradiance(sun, w.condition)
    room.windows.forEach((win) => m.set(win.id, verticalIrradiance(sun, irr, wallFacing(win.wall, room.orientation))))
    return m
  }, [room, w, startDate, settings.region])

  if (!room) {
    return (
      <div>
        <PageHeader title="Airflow & Heat" />
        <Card>
          <EmptyState
            icon={<Box className="size-5" />}
            title="Select or create a room first"
            action={
              <Link to="/app/rooms">
                <Button variant="primary">Go to My Rooms</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const chartRows = results
    ? results[0].r.central.filter((_, i) => i % 3 === 0).map((p, k) => {
        const i = k * 3
        const row: Record<string, number | [number, number] | null> = { t: p.t, outdoor: Math.round(p.outdoor * 10) / 10 }
        for (const { r } of results) row[r.scenario.id] = Math.round(r.central[i].indoor * 100) / 100
        const f = results.find((x) => x.r.scenario.id === focus)?.r
        if (f) row.band = [Math.round(f.low[i] * 100) / 100, Math.round(f.high[i] * 100) / 100]
        return row
      })
    : []
  const focusResult = results?.find((x) => x.r.scenario.id === focus)?.r ?? results?.[0]?.r
  const gains = focusResult?.gainsNow
  const maxGain = gains ? Math.max(...Object.values(gains).map((v) => Math.abs(v)), 1) : 1
  const dataDemo = w?.source === 'demo'

  return (
    <div>
      <PageHeader
        title="Airflow & Heat"
        description={`What-if simulation for ${room.name.toLowerCase()}: how air may move through its openings, where heat comes from, and how the room temperature could develop over the next hours.`}
        actions={
          <Link to="/app/settings/simulation">
            <Button size="sm" icon={<Settings2 className="size-3.5" />}>
              Model assumptions
            </Button>
          </Link>
        }
      />

      <div role="note" className="mb-6 flex gap-3 rounded-2xl border border-ochre-300 bg-ochre-50 px-5 py-4 text-[13px] leading-5 text-ochre-700">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">Simplified physics estimate, not a validated simulation.</span> Heat uses a single-zone energy balance and
          airflow uses standard empirical ventilation formulas, not computational fluid dynamics. Results are shown as ranges for comparing options; they
          are not a promise of how many degrees a room will cool.{dataDemo ? ' Inputs are demo data.' : ''}
        </p>
      </div>

      {(reading.error || weather.error || outlook.error) && (
        <div className="mb-4">
          <ErrorState error={(reading.error ?? weather.error ?? outlook.error)!} onRetry={() => (reading.reload(), weather.reload(), outlook.reload())} />
        </div>
      )}
      {!reading.loading && indoorNow == null && (
        <div className="mb-4 rounded-2xl border border-ochre-100 bg-ochre-50 p-4 text-[13px] text-ochre-700">
          No current indoor reading for this room, so the simulation has no starting temperature. Check the sensor or switch the demo scenario in Settings.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* 3D */}
        <Card className="relative h-[460px] overflow-hidden sm:h-[540px]">
          <LazyRoomViewer
            room={room}
            defaultLabels={false}
            hideCaptions
            sceneChildren={
              <>
                <ApplianceMeshes room={room} />
                {vent && overlay !== 'solar' && <AirflowLayer room={room} vent={vent.central} indoorC={indoorNow ?? 28} outdoorC={outdoorNow ?? 28} />}
                {overlay !== 'airflow' && <SolarOverlay room={room} irradianceByWindow={solarByWindow} />}
              </>
            }
          />
          <div className="absolute top-14 left-3 space-y-2 sm:top-3">
            <Segmented<Overlay>
              ariaLabel="3D overlay"
              size="sm"
              value={overlay}
              onChange={setOverlay}
              options={[
                { value: 'airflow', label: 'Airflow' },
                { value: 'solar', label: 'Sun on windows' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-wrap items-end justify-between gap-2">
            <div className="hidden rounded-xl bg-surface/95 px-3 py-2 text-[11px] text-ink-muted shadow-card ring-1 ring-line backdrop-blur sm:block">
              <p className="mb-1 font-medium text-ink">Legend</p>
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#3fa7d6]" /> Incoming air cooler than the room
              </p>
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#e08a3c]" /> Incoming air warmer than the room
              </p>
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#9fb0b6]" /> Outflow or fan-moved room air
              </p>
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[#f2a33a]" /> Direct sun on glass now
              </p>
            </div>
            <p className="rounded-lg bg-surface/90 px-2.5 py-1.5 text-[11px] text-ink-muted shadow-sm ring-1 ring-line backdrop-blur">Schematic paths, not a CFD flow field</p>
          </div>
        </Card>

        {/* Controls + ventilation */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Scenario inputs" description="Change these to compare options." />
            <div className="space-y-4 p-5 pt-4">
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-soft">Openings to open</p>
                {candidates.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">This room has no openable windows or outdoor doors. Add them in My Rooms.</p>
                ) : (
                  <div className="space-y-1.5">
                    {candidates.map((o) => {
                      const facing = wallFacing(o.wall, room.orientation)
                      const checked = openIds.has(o.id)
                      return (
                        <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-[13px]', checked ? 'border-breeze-300 bg-breeze-50' : 'border-line')}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setOpenIds((s) => {
                                const n = new Set(s)
                                if (e.target.checked) n.add(o.id)
                                else n.delete(o.id)
                                return n
                              })
                            }
                            className="size-4 accent-[var(--color-breeze-600)]"
                          />
                          {o.kind === 'window' ? <AppWindow className="size-4 text-mist-500" /> : <DoorOpen className="size-4 text-breeze-600" />}
                          <span className="flex-1">{o.label}</span>
                          <span className="text-xs text-ink-muted">
                            {wallLabel[o.wall]}, {compassLabel[facing].toLowerCase()}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
              <Toggle id="int-doors" label="Internal doors open" description="Lets air leave through the rest of the house." checked={internalDoors} onChange={setInternalDoors} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Wind speed" htmlFor="wind-speed" hint={windOverride ? 'Manual' : 'From weather data'}>
                  <div className="relative">
                    <Input id="wind-speed" type="number" step={0.5} min={0} max={20} value={wind.speed.toFixed(1)} onChange={(e) => setWindOverride({ speed: Number(e.target.value) || 0, dir: wind.dir })} className="tabular pr-10 text-right" />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-muted">m/s</span>
                  </div>
                </Field>
                <Field label="Wind from" htmlFor="wind-dir">
                  <Select id="wind-dir" value={Math.round(wind.dir / 45) * 45 % 360} onChange={(e) => setWindOverride({ speed: wind.speed, dir: Number(e.target.value) })}>
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                      <option key={d} value={d}>
                        {windDirectionLabel(d)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="People in the room" htmlFor="occ">
                  <Select id="occ" value={occupants} onChange={(e) => setOccupants(Number(e.target.value))}>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="AC set point" htmlFor="setpoint" hint={acCapacity ? `${(acCapacity / 1000).toFixed(1)} kW capacity` : 'No AC in this room'}>
                  <Select id="setpoint" value={setpoint} onChange={(e) => setSetpoint(Number(e.target.value))} disabled={!acCapacity}>
                    {[22, 23, 24, 25, 26, 27, 28].map((n) => (
                      <option key={n} value={n}>
                        {n}°C
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {windOverride && (
                <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setWindOverride(null)}>
                  Use wind from weather data
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Estimated airflow now" icon={<Wind className="size-4" />} action={vent && <Badge tone={vent.central.mode === 'cross' ? 'sage' : vent.central.mode === 'single-sided' ? 'mist' : 'neutral'}>{vent.central.mode === 'cross' ? 'Cross ventilation' : vent.central.mode === 'single-sided' ? 'Single-sided' : 'Closed'}</Badge>} />
            {vent ? (
              <div className="p-5 pt-4">
                <dl className="grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-xs text-ink-muted">Air changes per hour</dt>
                    <dd className="tabular text-xl font-semibold">
                      {vent.low.ach.toFixed(0)}–{vent.high.ach.toFixed(0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Outdoor air</dt>
                    <dd className="tabular text-xl font-semibold">
                      {Math.round(vent.low.flow * 1000)}–{Math.round(vent.high.flow * 1000)}
                      <span className="ml-0.5 text-xs font-normal text-ink-muted">L/s</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Local wind</dt>
                    <dd className="tabular text-xl font-semibold">
                      {vent.central.localWind.toFixed(1)}
                      <span className="ml-0.5 text-xs font-normal text-ink-muted">m/s</span>
                    </dd>
                  </div>
                </dl>
                {vent.central.openings.length > 0 && (
                  <table className="mt-4 w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-ink-muted">
                        <th className="py-1.5 font-medium">Opening</th>
                        <th className="py-1.5 font-medium">Role</th>
                        <th className="py-1.5 text-right font-medium">Free area</th>
                        <th className="py-1.5 text-right font-medium">Air speed</th>
                      </tr>
                    </thead>
                    <tbody className="tabular">
                      {vent.central.openings.map((o) => (
                        <tr key={o.opening.id} className="border-b border-line/60 last:border-0">
                          <td className="py-1.5">{o.opening.label}</td>
                          <td className="py-1.5 text-ink-soft">{o.role === 'inlet' ? 'Air in' : o.role === 'outlet' ? 'Air out' : 'In and out'}</td>
                          <td className="py-1.5 text-right">{o.area.toFixed(2)} m²</td>
                          <td className="py-1.5 text-right">≈ {o.speed.toFixed(2)} m/s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-3 text-xs leading-5 text-ink-muted">
                  {vent.central.mode === 'closed'
                    ? 'With everything closed only background leakage exchanges air.'
                    : vent.central.mode === 'cross'
                      ? 'Openings on differently exposed walls let wind push air through the room.'
                      : 'All open openings face the same way, so air mostly enters and leaves through the same gaps, driven by turbulence and temperature difference.'}{' '}
                  Range reflects ±30 % uncertainty in local wind after sheltering by nearby buildings.
                </p>
              </div>
            ) : (
              <div className="p-5">
                <Skeleton className="h-28 w-full" />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Temperature projection */}
      <Card className="mt-4">
        <CardHeader
          title="Projected room temperature"
          description={`Starting from the current reading (${fmtTemp(indoorNow)}). The shaded band shows the low-to-high assumption range for the highlighted scenario.`}
          action={
            <Segmented
              ariaLabel="Projection length"
              size="sm"
              value={hours}
              onChange={setHours}
              options={[
                { value: '6', label: '6 h' },
                { value: '12', label: '12 h' },
                { value: '24', label: '24 h' },
              ]}
            />
          }
        />
        <div className="p-5">
          {!results ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <>
              <div className="mb-3">
                <SeriesLegend
                  items={[
                    ...results.map(({ r }) => ({ key: r.scenario.id, label: r.scenario.label, color: C.series[SCENARIO_COLOR[r.scenario.id as ScenarioId]] })),
                    { key: 'outdoor', label: 'Outdoor (forecast)', color: C.series.outdoor, dashed: true },
                  ]}
                />
              </div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => timeTick(v, Number(hours))} minTickGap={40} {...axisPropsFor(C)} />
                    <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => `${v.toFixed(0)}°`} width={48} {...axisPropsFor(C)} />
                    <Tooltip content={<ChartTooltip unit="°C" />} cursor={{ stroke: C.cursor }} />
                    <ReferenceLine y={settings.thresholds.warmIndoorC} stroke={C.refLine} strokeDasharray="3 3" label={{ value: `${settings.thresholds.warmIndoorC}°C guidance threshold`, position: 'insideTopLeft', fill: C.refLabel, fontSize: 10 }} />
                    <Area dataKey="band" name="Assumption range" stroke="none" fill={C.series[SCENARIO_COLOR[focus]]} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
                    <Line dataKey="outdoor" name="Outdoor" stroke={C.series.outdoor} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    {results.map(({ r }) => (
                      <Line
                        key={r.scenario.id}
                        dataKey={r.scenario.id}
                        name={r.scenario.label}
                        stroke={C.series[SCENARIO_COLOR[r.scenario.id as ScenarioId]]}
                        strokeWidth={r.scenario.id === focus ? 2.5 : 1.5}
                        strokeOpacity={r.scenario.id === focus ? 1 : 0.65}
                        dot={false}
                        activeDot={{ r: 4, stroke: C.dotRing, strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Comparison + gains */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Scenario comparison" description="Select a row to highlight it in the chart and heat breakdown." />
          <div className="scrollbar-thin overflow-x-auto p-5 pt-3">
            {results ? (
              <table className="w-full min-w-[620px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th className="py-2 font-medium">Scenario</th>
                    <th className="py-2 text-right font-medium">Peak</th>
                    <th className="py-2 text-right font-medium">After {hours} h</th>
                    <th className="py-2 text-right font-medium">Time ≥ {settings.thresholds.warmIndoorC}°C</th>
                    <th className="py-2 text-right font-medium">Average vs closed</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {results.map(({ r, s }) => (
                    <tr
                      key={r.scenario.id}
                      onClick={() => setFocus(r.scenario.id as ScenarioId)}
                      className={cn('cursor-pointer border-b border-line/70 last:border-0 hover:bg-breeze-50', focus === r.scenario.id && 'bg-breeze-50')}
                    >
                      <td className="py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: C.series[SCENARIO_COLOR[r.scenario.id as ScenarioId]] }} />
                          {r.scenario.label}
                        </span>
                        <span className="block pl-[18px] text-xs font-normal text-ink-muted">{r.scenario.description}</span>
                      </td>
                      <td className="py-2.5 text-right">{fmtTemp(s.peak)}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {r.low[r.low.length - 1].toFixed(1)}–{r.high[r.high.length - 1].toFixed(1)}°C
                      </td>
                      <td className="py-2.5 text-right">{s.hoursAbove.toFixed(1)} h</td>
                      <td className="py-2.5 text-right">
                        {s.meanDiff ? (
                          <span className={cn('whitespace-nowrap', s.meanDiff[1] < 0 ? 'text-mist-700' : s.meanDiff[0] > 0 ? 'text-ochre-700' : '')}>
                            {fmtDelta(s.meanDiff[0])} to {fmtDelta(s.meanDiff[1])}
                          </span>
                        ) : (
                          <span className="text-ink-muted">reference</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              Differences are model estimates under the stated assumptions and may not match what a thermometer would show. Use them to rank options, not to
              expect an exact number of degrees.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Where the heat comes from now" description={focusResult ? focusResult.scenario.label : ''} icon={<Sun className="size-4" />} />
          <div className="space-y-2.5 p-5 pt-4">
            {gains ? (
              (Object.keys(GAIN_LABEL) as (keyof GainBreakdown)[])
                .filter((k) => k !== 'roof' || room.floorLevel >= settings.home.floors)
                .filter((k) => k !== 'ac' || acCapacity > 0)
                .map((k) => {
                  const v = gains[k]
                  const pct = (Math.abs(v) / maxGain) * 50
                  return (
                    <div key={k} className="grid grid-cols-[150px_1fr_64px] items-center gap-2 text-xs">
                      <span className="text-ink-soft">{GAIN_LABEL[k]}</span>
                      <span className="relative h-3 rounded-full bg-canvas">
                        <span className="absolute top-0 bottom-0 left-1/2 w-px bg-line-strong" />
                        <span
                          className={cn('absolute top-0.5 bottom-0.5 rounded-full', v >= 0 ? 'bg-ochre-500' : 'bg-mist-500')}
                          style={v >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                        />
                      </span>
                      <span className="tabular text-right font-medium">{v >= 0 ? '+' : '−'}{Math.abs(Math.round(v))} W</span>
                    </div>
                  )
                })
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
            <p className="pt-2 text-xs leading-5 text-ink-muted">
              Positive values add heat to the room, negative values remove it. Exterior walls assumed:{' '}
              {exteriorWalls(room).map((x) => wallLabel[x].toLowerCase()).join(', ')}
              {room.floorLevel >= settings.home.floors ? ', plus the roof (top floor)' : ''}.
            </p>
          </div>
        </Card>
      </div>

      {/* Method */}
      <Card className="mt-4">
        <CardHeader title="Method and assumptions" icon={<Info className="size-4" />} action={<Link to="/app/settings/simulation" className="text-xs font-medium text-breeze-700 hover:underline">Edit assumptions</Link>} />
        <div className="grid gap-6 p-5 pt-4 lg:grid-cols-2">
          <div className="space-y-2 text-[13px] leading-6 text-ink-soft">
            <p>
              <span className="font-medium text-ink">Heat balance.</span> The room is one well-mixed air volume with lumped thermal mass. Every 5 minutes it adds sun
              through glass, conduction through exterior walls, roof and windows (using sol-air temperatures), heat from appliances and people, and outdoor air
              exchange, then removes air-conditioner cooling up to its capacity.
            </p>
            <p>
              <span className="font-medium text-ink">Airflow.</span> Cross ventilation uses Q = C<sub>d</sub>·A<sub>eff</sub>·v·√ΔC<sub>p</sub>; single-sided uses Q =
              0.025·A·v; buoyancy adds a stack term. Wind pressure coefficients come from the angle between the wind and each wall.
            </p>
            <p>
              <span className="font-medium text-ink">Uncertainty.</span> Each scenario is run with low, central and high assumptions (U-values ±20 %, solar gain ±25 %,
              thermal mass ±20 %, wind ±30 %, internal gains ±15 %).
            </p>
            <p>
              <span className="font-medium text-ink">Not modelled.</span> Neighbouring buildings and trees shading the room, heat exchange with adjacent rooms,
              humidity and latent loads, ceiling fan comfort effects, real wind gusts, and detailed air movement inside the room.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            {[
              ['Wall U-value', `${assumptions.wallUValue} W/m²K`],
              ['Roof U-value', `${assumptions.roofUValue} W/m²K`],
              ['Window U-value', `${assumptions.windowUValue} W/m²K`],
              ['Window solar gain (SHGC)', assumptions.windowSHGC],
              ['Shading factor', assumptions.shadingFactor],
              ['Infiltration', `${assumptions.infiltrationACH} ACH`],
              ['Thermal mass', `${assumptions.thermalMassKJPerM2K} kJ/m²K`],
              ['Urban wind factor', assumptions.urbanWindFactor],
              ['Discharge coefficient', assumptions.dischargeCoefficient],
              ['Location', `${settings.region.latitude.toFixed(2)}, ${settings.region.longitude.toFixed(2)}`],
              ['Outdoor data', w ? w.sourceLabel : '…'],
              ['Wind', `${wind.speed.toFixed(1)} m/s from ${windDirectionLabel(wind.dir)}`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3 border-b border-line/60 py-1">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="tabular font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {dataDemo && (
          <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ochre-700">
            <FlaskConical className="size-3.5" /> Weather and indoor inputs are synthetic demo data.
          </p>
        )}
      </Card>
    </div>
  )
}
