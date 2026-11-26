/**
 * Natural ventilation estimate for one room using standard empirical
 * relations (CIBSE AM10 / BS 5925 style). These give order-of-magnitude
 * airflow, not the detailed flow field a CFD study would provide.
 *
 *   Cross ventilation (wind):   Q = Cd · A_eff · v · √ΔCp,   1/A_eff² = 1/A_in² + 1/A_out²
 *   Single-sided (wind):        Q = 0.025 · A · v
 *   Stack (buoyancy):           Q = Cd · A_eff · √(2 g Δh |ΔT| / T̄)   (single-sided: Cd·A/3·√(g h |ΔT| / T̄))
 *   Combined:                   Q = √(Q_wind² + Q_stack²)
 */
import type { CompassDirection, Opening, Room, SimulationAssumptions, WindowStyle } from '@/types'
import { compassDeg, openingBottom, wallFacing } from '@/features/rooms/roomGeometry'

/** Share of the frame area that is free to pass air when the window is fully open. */
export const OPEN_FRACTION: Record<WindowStyle, number> = { sliding: 0.45, casement: 0.85, louvre: 0.6, fixed: 0 }
const DOOR_OPEN_FRACTION = 0.9

export interface OpeningFlow {
  opening: Opening
  facing: CompassDirection
  /** wind pressure coefficient used for this opening */
  cp: number
  /** free area, m² */
  area: number
  role: 'inlet' | 'outlet' | 'both'
  /** volume flow through this opening, m³/s (positive) */
  flow: number
  /** mean air speed in the opening, m/s */
  speed: number
}

export interface VentilationResult {
  mode: 'closed' | 'single-sided' | 'cross'
  /** total outdoor-air flow including infiltration, m³/s */
  flow: number
  /** air changes per hour */
  ach: number
  windFlow: number
  stackFlow: number
  infiltrationFlow: number
  openings: OpeningFlow[]
  /** local wind speed used after urban sheltering, m/s */
  localWind: number
  /** includes a virtual outlet through open internal doors */
  usesInternalDoors: boolean
}

/** Wind pressure coefficient for a wall, from the angle between wind and the wall's outward normal. */
export function pressureCoefficient(windFromDeg: number, facing: CompassDirection): number {
  let d = Math.abs(((windFromDeg - compassDeg(facing)) % 360 + 540) % 360 - 180)
  d = Math.min(d, 180)
  const c = Math.cos((d * Math.PI) / 180)
  return d <= 90 ? 0.6 - 1.0 * (1 - c) : -0.4 + 0.1 * -c
}

export function freeArea(o: Opening): number {
  if (o.kind === 'door') return o.width * o.height * DOOR_OPEN_FRACTION
  return o.width * o.height * OPEN_FRACTION[o.style]
}

export function estimateVentilation(
  room: Room,
  openIds: Set<string>,
  opts: {
    windSpeed: number
    windFromDeg: number
    indoorC: number
    outdoorC: number
    internalDoorsOpen: boolean
    assumptions: SimulationAssumptions
    /** scale factor on wind for sensitivity runs */
    windScale?: number
  },
): VentilationResult {
  const { assumptions: a } = opts
  const volume = room.dimensions.length * room.dimensions.width * room.dimensions.height
  const infiltrationFlow = (a.infiltrationACH * volume) / 3600
  const Cd = a.dischargeCoefficient
  const v = Math.max(0, opts.windSpeed * a.urbanWindFactor * (opts.windScale ?? 1))
  const dT = Math.abs(opts.indoorC - opts.outdoorC)
  const Tmean = (opts.indoorC + opts.outdoorC) / 2 + 273.15

  const open = [...room.windows, ...room.doors.filter((d) => d.leadsTo === 'outdoor')].filter(
    (o) => openIds.has(o.id) && freeArea(o) > 0,
  )

  const items = open.map((o) => {
    const facing = wallFacing(o.wall, room.orientation)
    return { opening: o, facing, cp: pressureCoefficient(opts.windFromDeg, facing), area: freeArea(o), mid: openingBottom(o) + o.height / 2 }
  })

  // internal doors act as an extra outlet into the rest of the (leeward-ish) house
  const internal = opts.internalDoorsOpen ? room.doors.filter((d) => d.leadsTo === 'indoor') : []
  const internalArea = internal.reduce((s, d) => s + d.width * d.height * 0.5, 0)

  if (!items.length) {
    return { mode: 'closed', flow: infiltrationFlow, ach: a.infiltrationACH, windFlow: 0, stackFlow: 0, infiltrationFlow, openings: [], localWind: v, usesInternalDoors: false }
  }

  const walls = new Set(items.map((i) => i.facing))
  const cps = items.map((i) => i.cp)
  const spread = Math.max(...cps) - Math.min(...cps)
  const cross = (walls.size > 1 && spread > 0.15) || internalArea > 0

  let windFlow: number
  let stackFlow: number
  let flows: OpeningFlow[]

  if (cross) {
    const meanCp = cps.reduce((s, c) => s + c, 0) / cps.length
    let inlets = items.filter((i) => i.cp >= meanCp)
    let outlets = items.filter((i) => i.cp < meanCp)
    if (!outlets.length && internalArea > 0) outlets = []
    if (!inlets.length) inlets = items
    const Ain = inlets.reduce((s, i) => s + i.area, 0)
    const AoutReal = outlets.reduce((s, i) => s + i.area, 0)
    const Aout = AoutReal + internalArea
    const Aeff = Ain > 0 && Aout > 0 ? 1 / Math.sqrt(1 / (Ain * Ain) + 1 / (Aout * Aout)) : 0
    const cpIn = inlets.reduce((s, i) => s + i.cp * i.area, 0) / Math.max(Ain, 1e-6)
    const cpOut = AoutReal > 0 ? outlets.reduce((s, i) => s + i.cp * i.area, 0) / AoutReal : -0.2
    const dCp = Math.max(0, cpIn - Math.min(cpOut, internalArea > 0 ? -0.2 : cpOut))
    windFlow = Cd * Aeff * v * Math.sqrt(dCp)
    const mids = items.map((i) => i.mid)
    const dh = Math.max(0.3, Math.max(...mids) - Math.min(...mids))
    stackFlow = Cd * Aeff * Math.sqrt((2 * 9.81 * dh * dT) / Tmean)
    const total = Math.sqrt(windFlow ** 2 + stackFlow ** 2)
    flows = items.map((i) => {
      const isIn = inlets.includes(i)
      const share = isIn ? i.area / Math.max(Ain, 1e-6) : i.area / Math.max(Aout, 1e-6)
      const f = total * share
      return { opening: i.opening, facing: i.facing, cp: i.cp, area: i.area, role: isIn ? 'inlet' : 'outlet', flow: f, speed: f / i.area }
    })
  } else {
    const A = items.reduce((s, i) => s + i.area, 0)
    const h = Math.max(...items.map((i) => i.opening.height))
    windFlow = 0.025 * A * v
    stackFlow = ((Cd * A) / 3) * Math.sqrt((9.81 * h * dT) / Tmean)
    const total = Math.sqrt(windFlow ** 2 + stackFlow ** 2)
    flows = items.map((i) => {
      const f = total * (i.area / A)
      return { opening: i.opening, facing: i.facing, cp: i.cp, area: i.area, role: 'both', flow: f, speed: (2 * f) / i.area }
    })
  }

  const flow = Math.sqrt(windFlow ** 2 + stackFlow ** 2) + infiltrationFlow
  return {
    mode: cross ? 'cross' : 'single-sided',
    flow,
    ach: (flow * 3600) / volume,
    windFlow,
    stackFlow,
    infiltrationFlow,
    openings: flows,
    localWind: v,
    usesInternalDoors: internalArea > 0,
  }
}
