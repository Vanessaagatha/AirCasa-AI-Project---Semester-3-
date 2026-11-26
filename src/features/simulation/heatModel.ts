/**
 * Simplified single-zone heat balance for one room ("lumped capacitance").
 *
 *   C · dT/dt = Q_solar + Q_walls + Q_roof + Q_windows + Q_internal + Q_ventilation − Q_ac
 *
 * - Q_solar: SHGC × glass area × irradiance on each window's wall (× shading factor)
 * - Q_walls, Q_roof: U × A × (T_sol-air − T), with T_sol-air = T_out + α·I / h_o
 * - Q_windows: U_window × A × (T_out − T)
 * - Q_internal: appliances (by schedule and duty cycle) + occupants (≈ 75 W sensible each)
 * - Q_ventilation: ρ·c_p·Q·(T_out − T), Q from ventilation.ts or infiltration
 * - Q_ac: limited by the air conditioner's nominal capacity, holding the set point
 *
 * The model is explicit-Euler with 5-minute steps. Each scenario is run three
 * times with low / central / high assumptions so results can be shown as a range.
 * It has not been calibrated or validated against measurements.
 */
import type { HourlyOutlook, Room, SimulationAssumptions, WallSide, WeatherCondition } from '@/types'
import { WALLS, wallFacing, wallLength } from '@/features/rooms/roomGeometry'
import { APPLIANCE_CATALOG, heatGainAt } from '@/features/rooms/appliances'
import { irradiance, sunPosition, verticalIrradiance } from './solar'
import { estimateVentilation } from './ventilation'

const RHO_CP = 1.2 * 1005 // J/(m³·K)
const H_OUT = 20 // external surface coefficient, W/(m²·K)
const WALL_ABSORPTANCE = 0.5
const ROOF_ABSORPTANCE = 0.75
const OCCUPANT_W = 75
const GLASS_FRACTION = 0.8
const STEP_S = 300

export type VentPolicy = 'closed' | 'open' | 'when-cooler'

export interface Scenario {
  id: string
  label: string
  description: string
  policy: VentPolicy
  openIds: Set<string>
  internalDoorsOpen: boolean
  acOn: boolean
  acSetpoint: number
}

export interface SimulationInput {
  room: Room
  assumptions: SimulationAssumptions
  start: Date
  hours: number
  initialIndoorC: number
  /** hourly outdoor conditions starting at or before `start` */
  outlook: HourlyOutlook[]
  windSpeed: number
  windFromDeg: number
  latitude: number
  longitude: number
  isTopFloor: boolean
}

export interface GainBreakdown {
  solar: number
  walls: number
  roof: number
  windows: number
  internal: number
  ventilation: number
  ac: number
}

export interface SimPoint {
  t: number
  indoor: number
  outdoor: number
  ach: number
  windowsOpen: boolean
}

export interface ScenarioResult {
  scenario: Scenario
  central: SimPoint[]
  low: number[]
  high: number[]
  /** central-case gains at the first step, W (positive = heating the room) */
  gainsNow: GainBreakdown
  /** hourly central-case gains */
  hourlyGains: (GainBreakdown & { t: number })[]
}

interface Variant {
  u: number
  shgc: number
  mass: number
  wind: number
  internal: number
}

export const VARIANTS: Record<'low' | 'central' | 'high', Variant> = {
  low: { u: 0.8, shgc: 0.75, mass: 1.25, wind: 1.3, internal: 0.85 },
  central: { u: 1, shgc: 1, mass: 1, wind: 1, internal: 1 },
  high: { u: 1.2, shgc: 1.25, mass: 0.8, wind: 0.7, internal: 1.15 },
}

/** Walls treated as exterior: those with windows or outdoor doors (front wall if none). */
export function exteriorWalls(room: Room): WallSide[] {
  const set = new Set<WallSide>()
  room.windows.forEach((w) => set.add(w.wall))
  room.doors.filter((d) => d.leadsTo === 'outdoor').forEach((d) => set.add(d.wall))
  if (!set.size) set.add('front')
  return WALLS.filter((w) => set.has(w))
}

function outdoorAt(outlook: HourlyOutlook[], t: number): { temp: number; condition: WeatherCondition } {
  if (!outlook.length) return { temp: 30, condition: 'partly-cloudy' }
  const times = outlook.map((o) => new Date(o.timestamp).getTime())
  if (t <= times[0]) return { temp: outlook[0].temperatureC, condition: outlook[0].condition }
  for (let i = 0; i < times.length - 1; i++) {
    if (t >= times[i] && t <= times[i + 1]) {
      const f = (t - times[i]) / (times[i + 1] - times[i])
      return { temp: outlook[i].temperatureC + f * (outlook[i + 1].temperatureC - outlook[i].temperatureC), condition: f < 0.5 ? outlook[i].condition : outlook[i + 1].condition }
    }
  }
  const last = outlook[outlook.length - 1]
  return { temp: last.temperatureC, condition: last.condition }
}

function run(input: SimulationInput, sc: Scenario, v: Variant, record: boolean) {
  const { room, assumptions: a } = input
  const d = room.dimensions
  const volume = d.length * d.width * d.height
  const floorArea = d.length * d.width
  const C = RHO_CP * volume + a.thermalMassKJPerM2K * 1000 * floorArea * v.mass
  const extWalls = exteriorWalls(room)
  const openings = [...room.windows, ...room.doors]
  const appliances = room.appliances ?? []
  const acCapacity = appliances
    .filter((x) => x.type === 'air-conditioner')
    .reduce((s, x) => s + (APPLIANCE_CATALOG[x.type].coolingW ?? 0), 0) || (room.hasAirConditioner ? 2600 : 0)

  const wallNet = new Map<WallSide, number>()
  for (const w of extWalls) {
    const opArea = openings.filter((o) => o.wall === w).reduce((s, o) => s + o.width * o.height, 0)
    wallNet.set(w, Math.max(0, wallLength(w, d) * d.height - opArea))
  }

  let T = input.initialIndoorC
  const t0 = input.start.getTime()
  const steps = Math.round((input.hours * 3600) / STEP_S)
  const points: SimPoint[] = []
  const temps: number[] = []
  const hourly: (GainBreakdown & { t: number })[] = []
  let acc: GainBreakdown = { solar: 0, walls: 0, roof: 0, windows: 0, internal: 0, ventilation: 0, ac: 0 }
  let accN = 0
  let gainsNow: GainBreakdown | null = null

  for (let i = 0; i <= steps; i++) {
    const t = t0 + i * STEP_S * 1000
    const date = new Date(t)
    const hour = date.getHours() + date.getMinutes() / 60
    const out = outdoorAt(input.outlook, t)
    const sun = sunPosition(date, input.latitude, input.longitude)
    const irr = irradiance(sun, out.condition)

    let solar = 0
    let windows = 0
    for (const w of room.windows) {
      const facing = wallFacing(w.wall, room.orientation)
      const I = verticalIrradiance(sun, irr, facing)
      solar += a.windowSHGC * v.shgc * GLASS_FRACTION * w.width * w.height * I * (w.hasShading ? a.shadingFactor : 1)
      windows += a.windowUValue * v.u * w.width * w.height * (out.temp - T)
    }
    let walls = 0
    for (const w of extWalls) {
      const I = verticalIrradiance(sun, irr, wallFacing(w, room.orientation))
      const tsa = out.temp + (WALL_ABSORPTANCE * I) / H_OUT
      walls += a.wallUValue * v.u * (wallNet.get(w) ?? 0) * (tsa - T)
    }
    const roof = input.isTopFloor ? a.roofUValue * v.u * floorArea * (out.temp + (ROOF_ABSORPTANCE * irr.ghi) / H_OUT - T) : 0
    const internal = (appliances.reduce((s, x) => s + heatGainAt(x, hour), 0) + a.occupants * OCCUPANT_W) * v.internal

    const open = sc.policy === 'open' || (sc.policy === 'when-cooler' && out.temp < T - 0.5)
    const vent = estimateVentilation(room, open ? sc.openIds : new Set(), {
      windSpeed: input.windSpeed,
      windFromDeg: input.windFromDeg,
      indoorC: T,
      outdoorC: out.temp,
      internalDoorsOpen: open && sc.internalDoorsOpen,
      assumptions: a,
      windScale: v.wind,
    })
    const ventilation = RHO_CP * vent.flow * (out.temp - T)

    const net = solar + walls + roof + windows + internal + ventilation
    let Tnext = T + (net * STEP_S) / C
    let ac = 0
    const acRunning = sc.acOn && acCapacity > 0 && !open
    if (acRunning && Tnext > sc.acSetpoint) {
      const needed = ((Tnext - sc.acSetpoint) * C) / STEP_S
      ac = Math.min(acCapacity, needed)
      Tnext -= (ac * STEP_S) / C
    }

    const g: GainBreakdown = { solar, walls, roof, windows, internal, ventilation, ac: -ac }
    if (!gainsNow) gainsNow = g
    if (record) {
      points.push({ t, indoor: T, outdoor: out.temp, ach: vent.ach, windowsOpen: open })
      ;(Object.keys(acc) as (keyof GainBreakdown)[]).forEach((k) => (acc[k] += g[k]))
      accN++
      if (i % 12 === 11 || i === steps) {
        const avg = Object.fromEntries(Object.entries(acc).map(([k, val]) => [k, val / accN])) as unknown as GainBreakdown
        hourly.push({ ...avg, t })
        acc = { solar: 0, walls: 0, roof: 0, windows: 0, internal: 0, ventilation: 0, ac: 0 }
        accN = 0
      }
    }
    temps.push(T)
    T = Tnext
  }
  return { points, temps, gainsNow: gainsNow!, hourly }
}

export function simulateScenario(input: SimulationInput, sc: Scenario): ScenarioResult {
  const c = run(input, sc, VARIANTS.central, true)
  const lo = run(input, sc, VARIANTS.low, false)
  const hi = run(input, sc, VARIANTS.high, false)
  return {
    scenario: sc,
    central: c.points,
    low: lo.temps.map((x, i) => Math.min(x, hi.temps[i], c.temps[i])),
    high: hi.temps.map((x, i) => Math.max(x, lo.temps[i], c.temps[i])),
    gainsNow: c.gainsNow,
    hourlyGains: c.hourly,
  }
}

export interface ScenarioSummary {
  peak: number
  end: number
  mean: number
  hoursAbove: number
  /** min..max difference from the reference scenario across the run, °C (negative = cooler) */
  diffRange: [number, number] | null
  meanDiff: [number, number] | null
}

export function summarize(r: ScenarioResult, threshold: number, ref?: ScenarioResult): ScenarioSummary {
  const temps = r.central.map((p) => p.indoor)
  const stepH = STEP_S / 3600
  const res: ScenarioSummary = {
    peak: Math.max(...temps),
    end: temps[temps.length - 1],
    mean: temps.reduce((s, x) => s + x, 0) / temps.length,
    hoursAbove: temps.filter((x) => x >= threshold).length * stepH,
    diffRange: null,
    meanDiff: null,
  }
  if (ref && ref !== r) {
    // compare like with like: low with low, high with high, then take the envelope
    const dl = r.low.map((x, i) => x - ref.low[i])
    const dh = r.high.map((x, i) => x - ref.high[i])
    const dc = temps.map((x, i) => x - ref.central[i].indoor)
    const meanOf = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const means = [meanOf(dl), meanOf(dh), meanOf(dc)]
    res.meanDiff = [Math.min(...means), Math.max(...means)]
    const ends = [dl[dl.length - 1], dh[dh.length - 1], dc[dc.length - 1]]
    res.diffRange = [Math.min(...ends), Math.max(...ends)]
  }
  return res
}

/** Openings that can be opened for ventilation, in a stable order. */
export function ventilationOpenings(room: Room) {
  return [...room.windows.filter((w) => w.operable && w.style !== 'fixed'), ...room.doors.filter((d) => d.leadsTo === 'outdoor')]
}

