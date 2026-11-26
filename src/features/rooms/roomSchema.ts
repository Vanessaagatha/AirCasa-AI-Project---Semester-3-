import type { Appliance, ApplianceType, CompassDirection, DoorOpening, Room, RoomType, WallSide, WindowOpening, WindowStyle } from '@/types'
import { APPLIANCE_CATALOG } from './appliances'
import { uid } from '@/lib/utils'
import { COMPASS, DIMENSION_LIMITS, WALLS, refitRoom } from './roomGeometry'

/**
 * Validation for room JSON files (import/export).
 * Hand-written to avoid an extra dependency; mirrors the `Room` interface.
 */

export type ParseResult = { ok: true; room: Room; warnings: string[] } | { ok: false; errors: string[] }

const ROOM_TYPES: RoomType[] = ['bedroom', 'living', 'kitchen', 'office', 'other']
const WINDOW_STYLES: WindowStyle[] = ['sliding', 'casement', 'louvre', 'fixed']

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function serializeRoom(room: Room): string {
  return JSON.stringify(room, null, 2)
}

export function parseRoomJson(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  return validateRoom(raw)
}

export function validateRoom(raw: unknown): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObj(raw)) return { ok: false, errors: ['Expected a JSON object describing one room.'] }

  if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push('"name" must be a non-empty string.')

  const dims = raw.dimensions
  if (!isObj(dims)) {
    errors.push('"dimensions" must be an object with length, width and height.')
  } else {
    for (const key of ['length', 'width', 'height'] as const) {
      const v = dims[key]
      const lim = DIMENSION_LIMITS[key]
      if (!isNum(v)) errors.push(`"dimensions.${key}" must be a number (metres).`)
      else if (v < lim.min || v > lim.max) errors.push(`"dimensions.${key}" must be between ${lim.min} and ${lim.max} m.`)
    }
  }

  const orientation = raw.orientation
  if (!COMPASS.includes(orientation as CompassDirection)) {
    errors.push(`"orientation" must be one of ${COMPASS.join(', ')}.`)
  }

  const windowsRaw = raw.windows ?? []
  const doorsRaw = raw.doors ?? []
  if (!Array.isArray(windowsRaw)) errors.push('"windows" must be an array.')
  if (!Array.isArray(doorsRaw)) errors.push('"doors" must be an array.')

  const windows: WindowOpening[] = []
  const doors: DoorOpening[] = []

  if (Array.isArray(windowsRaw)) {
    windowsRaw.forEach((w, i) => {
      if (!isObj(w)) return errors.push(`windows[${i}] must be an object.`)
      if (!WALLS.includes(w.wall as WallSide)) errors.push(`windows[${i}].wall must be one of ${WALLS.join(', ')}.`)
      for (const k of ['offset', 'width', 'height', 'sillHeight']) {
        if (!isNum(w[k])) errors.push(`windows[${i}].${k} must be a number.`)
      }
      windows.push({
        id: typeof w.id === 'string' ? w.id : uid('win'),
        kind: 'window',
        label: typeof w.label === 'string' ? w.label : `Window ${i + 1}`,
        wall: w.wall as WallSide,
        offset: Number(w.offset),
        width: Number(w.width),
        height: Number(w.height),
        sillHeight: Number(w.sillHeight),
        style: WINDOW_STYLES.includes(w.style as WindowStyle) ? (w.style as WindowStyle) : 'sliding',
        operable: w.operable !== false,
        hasShading: w.hasShading === true,
        hasScreen: w.hasScreen === true,
      })
    })
  }

  if (Array.isArray(doorsRaw)) {
    doorsRaw.forEach((d, i) => {
      if (!isObj(d)) return errors.push(`doors[${i}] must be an object.`)
      if (!WALLS.includes(d.wall as WallSide)) errors.push(`doors[${i}].wall must be one of ${WALLS.join(', ')}.`)
      for (const k of ['offset', 'width', 'height']) {
        if (!isNum(d[k])) errors.push(`doors[${i}].${k} must be a number.`)
      }
      doors.push({
        id: typeof d.id === 'string' ? d.id : uid('door'),
        kind: 'door',
        label: typeof d.label === 'string' ? d.label : `Door ${i + 1}`,
        wall: d.wall as WallSide,
        offset: Number(d.offset),
        width: Number(d.width),
        height: Number(d.height),
        leadsTo: d.leadsTo === 'outdoor' ? 'outdoor' : 'indoor',
      })
    })
  }

  const appliancesRaw = raw.appliances ?? []
  const appliances: Appliance[] = []
  if (!Array.isArray(appliancesRaw)) errors.push('"appliances" must be an array when present.')
  else
    appliancesRaw.forEach((a, i) => {
      if (!isObj(a)) return errors.push(`appliances[${i}] must be an object.`)
      if (!(String(a.type) in APPLIANCE_CATALOG)) return errors.push(`appliances[${i}].type is not a known appliance type.`)
      const type = a.type as ApplianceType
      const spec = APPLIANCE_CATALOG[type]
      appliances.push({
        id: typeof a.id === 'string' ? a.id : uid('appl'),
        type,
        label: typeof a.label === 'string' ? a.label : spec.label,
        powerW: isNum(a.powerW) ? a.powerW : spec.powerW,
        onFrom: isNum(a.onFrom) ? a.onFrom : spec.defaultOn[0],
        onTo: isNum(a.onTo) ? a.onTo : spec.defaultOn[1],
        x: isNum(a.x) ? a.x : 0,
        z: isNum(a.z) ? a.z : 0,
        rotationDeg: isNum(a.rotationDeg) ? a.rotationDeg : 0,
      })
    })

  if (errors.length) return { ok: false, errors }

  if (raw.schemaVersion !== 1) warnings.push('No schemaVersion 1 found; the file was read as version 1.')
  const now = new Date().toISOString()
  const d = dims as Json
  const room: Room = {
    schemaVersion: 1,
    id: typeof raw.id === 'string' ? raw.id : uid('room'),
    name: String(raw.name).trim(),
    type: ROOM_TYPES.includes(raw.type as RoomType) ? (raw.type as RoomType) : 'other',
    floorLevel: isNum(raw.floorLevel) ? Math.max(1, Math.round(raw.floorLevel)) : 1,
    dimensions: { length: Number(d.length), width: Number(d.width), height: Number(d.height) },
    orientation: orientation as CompassDirection,
    windows,
    doors,
    appliances,
    hasCeilingFan: raw.hasCeilingFan === true,
    hasAirConditioner: raw.hasAirConditioner === true,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: now,
  }

  const fitted = refitRoom(room)
  if (JSON.stringify(fitted) !== JSON.stringify(room)) {
    warnings.push('Some openings did not fit their walls and were adjusted.')
  }
  return { ok: true, room: fitted, warnings }
}
