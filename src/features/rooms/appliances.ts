/**
 * Appliance catalogue and helpers.
 *
 * Wattages are typical values for Indonesian households and are only defaults;
 * users should edit them to match the label on their appliance. Heat fractions
 * describe how much of the electrical (or gas) energy ends up as heat in the room.
 */
import type { Appliance, ApplianceType, RoomDimensions } from '@/types'
import { clamp, round, uid } from '@/lib/utils'

export interface ApplianceSpec {
  label: string
  /** default rated power, W */
  powerW: number
  /** share of input power released as heat inside the room (AC: 0, its heat is rejected outdoors) */
  heatFraction: number
  /** average share of rated power drawn while "on" (duty cycle, e.g. a fridge compressor) */
  dutyCycle: number
  /** footprint and height, metres */
  size: [number, number, number]
  /** mounting: floor, ceiling or high on a wall */
  mount: 'floor' | 'ceiling' | 'wall-high' | 'counter'
  defaultOn: [number, number]
  /** for air conditioners: nominal cooling capacity in W */
  coolingW?: number
  /** moves air (fans) */
  movesAir?: boolean
  color: string
}

export const APPLIANCE_CATALOG: Record<ApplianceType, ApplianceSpec> = {
  'ceiling-fan': { label: 'Ceiling fan', powerW: 60, heatFraction: 1, dutyCycle: 1, size: [1.2, 1.2, 0.35], mount: 'ceiling', defaultOn: [19, 7], movesAir: true, color: '#e9e4da' },
  'standing-fan': { label: 'Standing fan', powerW: 45, heatFraction: 1, dutyCycle: 1, size: [0.45, 0.45, 1.25], mount: 'floor', defaultOn: [12, 23], movesAir: true, color: '#f4f5f1' },
  'air-conditioner': { label: 'Air conditioner (1 PK)', powerW: 780, heatFraction: 0, dutyCycle: 0.7, size: [0.85, 0.22, 0.29], mount: 'wall-high', defaultOn: [21, 5], coolingW: 2600, color: '#f7f8f8' },
  refrigerator: { label: 'Refrigerator', powerW: 130, heatFraction: 1, dutyCycle: 0.45, size: [0.6, 0.65, 1.6], mount: 'floor', defaultOn: [0, 24], color: '#dfe5e8' },
  television: { label: 'Television', powerW: 90, heatFraction: 1, dutyCycle: 1, size: [1.0, 0.25, 0.62], mount: 'counter', defaultOn: [18, 23], color: '#22282b' },
  computer: { label: 'Computer and monitor', powerW: 160, heatFraction: 1, dutyCycle: 0.8, size: [0.6, 0.5, 0.45], mount: 'counter', defaultOn: [9, 17], color: '#3a4448' },
  lighting: { label: 'Lighting (LED)', powerW: 36, heatFraction: 1, dutyCycle: 1, size: [0.5, 0.5, 0.06], mount: 'ceiling', defaultOn: [18, 23], color: '#fff6dc' },
  'rice-cooker': { label: 'Rice cooker', powerW: 350, heatFraction: 1, dutyCycle: 0.2, size: [0.3, 0.3, 0.28], mount: 'counter', defaultOn: [5, 21], color: '#f1efe9' },
  'water-dispenser': { label: 'Water dispenser (hot/cold)', powerW: 420, heatFraction: 1, dutyCycle: 0.2, size: [0.32, 0.32, 1.05], mount: 'floor', defaultOn: [0, 24], color: '#e8eef0' },
  stove: { label: 'Gas stove', powerW: 3000, heatFraction: 0.6, dutyCycle: 0.5, size: [0.7, 0.45, 0.12], mount: 'counter', defaultOn: [17, 19], color: '#2f3538' },
  iron: { label: 'Clothes iron', powerW: 1000, heatFraction: 1, dutyCycle: 0.5, size: [0.28, 0.14, 0.15], mount: 'counter', defaultOn: [19, 20], color: '#9cb6c9' },
  other: { label: 'Other appliance', powerW: 100, heatFraction: 1, dutyCycle: 1, size: [0.5, 0.5, 0.6], mount: 'floor', defaultOn: [18, 22], color: '#c9cfd2' },
}

export const APPLIANCE_TYPES = Object.keys(APPLIANCE_CATALOG) as ApplianceType[]

/** Counter-mounted items sit on an implied 75 cm surface. */
export const COUNTER_HEIGHT = 0.75

export function isOnAt(a: Appliance, hour: number): boolean {
  const h = ((hour % 24) + 24) % 24
  if (a.onFrom === a.onTo) return false
  if (a.onFrom === 0 && a.onTo === 24) return true
  return a.onFrom < a.onTo ? h >= a.onFrom && h < a.onTo : h >= a.onFrom || h < a.onTo
}

export function hoursPerDay(a: Appliance): number {
  if (a.onFrom === 0 && a.onTo === 24) return 24
  return a.onFrom <= a.onTo ? a.onTo - a.onFrom : 24 - a.onFrom + a.onTo
}

/** Average heat released into the room at a given hour, W. */
export function heatGainAt(a: Appliance, hour: number): number {
  if (!isOnAt(a, hour)) return 0
  const s = APPLIANCE_CATALOG[a.type]
  return a.powerW * s.dutyCycle * s.heatFraction
}

/** Approximate daily energy use, kWh. */
export function dailyKWh(a: Appliance): number {
  return (a.powerW * APPLIANCE_CATALOG[a.type].dutyCycle * hoursPerDay(a)) / 1000
}

export function fitAppliance(a: Appliance, d: RoomDimensions): Appliance {
  const [w, dep] = APPLIANCE_CATALOG[a.type].size
  const r = ((a.rotationDeg % 360) + 360) % 360
  const swap = Math.round(r / 90) % 2 === 1
  const hx = (swap ? dep : w) / 2
  const hz = (swap ? w : dep) / 2
  return {
    ...a,
    powerW: clamp(Math.round(a.powerW), 0, 10000),
    onFrom: clamp(Math.round(a.onFrom), 0, 24),
    onTo: clamp(Math.round(a.onTo), 0, 24),
    x: round(clamp(a.x, -d.length / 2 + hx + 0.02, d.length / 2 - hx - 0.02), 2),
    z: round(clamp(a.z, -d.width / 2 + hz + 0.02, d.width / 2 - hz - 0.02), 2),
  }
}

export function createAppliance(type: ApplianceType, d: RoomDimensions, existing: Appliance[]): Appliance {
  const s = APPLIANCE_CATALOG[type]
  const n = existing.filter((a) => a.type === type).length
  // sensible default spots: AC high on the back wall, others spread along the back
  let x = 0
  let z = 0
  if (s.mount === 'wall-high') z = -d.width / 2 + s.size[1] / 2 + 0.02
  else if (s.mount !== 'ceiling') {
    x = -d.length / 2 + 0.6 + ((existing.length * 0.8) % Math.max(0.8, d.length - 1.2))
    z = -d.width / 2 + s.size[1] / 2 + 0.15
  }
  return fitAppliance(
    {
      id: uid('appl'),
      type,
      label: n ? `${s.label} ${n + 1}` : s.label,
      powerW: s.powerW,
      onFrom: s.defaultOn[0],
      onTo: s.defaultOn[1],
      x,
      z,
      rotationDeg: 0,
    },
    d,
  )
}

/** Height of the appliance's base above the floor. */
export function applianceBaseY(a: Appliance, roomHeight: number): number {
  const s = APPLIANCE_CATALOG[a.type]
  if (s.mount === 'ceiling') return roomHeight - s.size[2]
  if (s.mount === 'wall-high') return Math.min(2.2, roomHeight - s.size[2] - 0.1)
  if (s.mount === 'counter') return COUNTER_HEIGHT
  return 0
}

export function totalHeatNow(appliances: Appliance[], hour: number): number {
  return appliances.reduce((sum, a) => sum + heatGainAt(a, hour), 0)
}
