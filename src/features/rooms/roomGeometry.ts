import type {
  CompassDirection,
  DoorOpening,
  Opening,
  Room,
  RoomDimensions,
  WallSide,
  WindowOpening,
} from '@/types'
import { clamp, round, uid } from '@/lib/utils'
import { fitAppliance } from './appliances'

export const WALLS: WallSide[] = ['front', 'right', 'back', 'left']
export const COMPASS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export const DIMENSION_LIMITS = {
  length: { min: 1.5, max: 15 },
  width: { min: 1.5, max: 15 },
  height: { min: 2.2, max: 5 },
} as const

export const WALL_THICKNESS = 0.12
/** Minimum gap kept between an opening and wall edges / ceiling. */
export const EDGE_MARGIN = 0.05

export const wallLabel: Record<WallSide, string> = {
  front: 'Front wall',
  right: 'Right wall',
  back: 'Back wall',
  left: 'Left wall',
}

export const compassLabel: Record<CompassDirection, string> = {
  N: 'North',
  NE: 'North-east',
  E: 'East',
  SE: 'South-east',
  S: 'South',
  SW: 'South-west',
  W: 'West',
  NW: 'North-west',
}

/** Length of a wall in metres. Front/back span the room length; left/right span its width. */
export function wallLength(wall: WallSide, d: RoomDimensions): number {
  return wall === 'front' || wall === 'back' ? d.length : d.width
}

/** Compass direction a given wall faces, based on the room's front-wall orientation. */
export function wallFacing(wall: WallSide, orientation: CompassDirection): CompassDirection {
  const quarterTurns = { front: 0, right: 2, back: 4, left: 6 }[wall]
  const idx = (COMPASS.indexOf(orientation) + quarterTurns) % 8
  return COMPASS[idx]
}

/** Angle (degrees clockwise from north) for a compass direction. */
export function compassDeg(dir: CompassDirection): number {
  return COMPASS.indexOf(dir) * 45
}

/**
 * Placement of a wall in 3D space.
 * The wall's local X axis runs left→right as seen from inside the room.
 * Room is centred on the origin: X spans length, Z spans width, front wall at +Z.
 * Standing inside facing the front wall (+Z), your right hand points to −X,
 * so the right wall sits at −X and the left wall at +X.
 * In every frame the wall's local +Z axis points into the room.
 */
export function wallFrame(wall: WallSide, d: RoomDimensions) {
  const halfL = d.length / 2
  const halfW = d.width / 2
  switch (wall) {
    case 'front':
      return { position: [0, 0, halfW] as [number, number, number], rotationY: Math.PI, length: d.length }
    case 'back':
      return { position: [0, 0, -halfW] as [number, number, number], rotationY: 0, length: d.length }
    case 'left':
      return { position: [halfL, 0, 0] as [number, number, number], rotationY: -Math.PI / 2, length: d.width }
    case 'right':
      return { position: [-halfL, 0, 0] as [number, number, number], rotationY: Math.PI / 2, length: d.width }
  }
}

/** World-space unit vector (x, z) on the floor plane pointing toward a compass bearing. */
export function compassVector(bearingDeg: number, orientation: CompassDirection): [number, number] {
  const a = ((compassDeg(orientation) - bearingDeg) * Math.PI) / 180
  return [Math.sin(a), Math.cos(a)]
}

export function openingBottom(o: Opening): number {
  return o.kind === 'window' ? o.sillHeight : 0
}

/** Clamp an opening so it fits inside its wall. Returns a new object. */
export function fitOpening<T extends Opening>(o: T, d: RoomDimensions): T {
  const len = wallLength(o.wall, d)
  const width = clamp(o.width, 0.3, Math.max(0.3, len - EDGE_MARGIN * 2))
  const maxHeight = d.height - EDGE_MARGIN - (o.kind === 'window' ? 0.1 : 0)
  const height = clamp(o.height, 0.3, Math.max(0.3, maxHeight))
  const offset = clamp(o.offset, EDGE_MARGIN, Math.max(EDGE_MARGIN, len - width - EDGE_MARGIN))
  const next = { ...o, width: round(width, 2), height: round(height, 2), offset: round(offset, 2) }
  if (next.kind === 'window') {
    const sill = clamp(next.sillHeight, 0, Math.max(0, d.height - height - EDGE_MARGIN))
    return { ...next, sillHeight: round(sill, 2) } as T
  }
  return next as T
}

export interface OpeningIssue {
  openingId: string
  message: string
}

/** Detect overlaps between openings on the same wall. */
export function findOpeningIssues(room: Room): OpeningIssue[] {
  const all: Opening[] = [...room.windows, ...room.doors]
  const issues: OpeningIssue[] = []
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]
      const b = all[j]
      if (a.wall !== b.wall) continue
      const xOverlap = a.offset < b.offset + b.width && b.offset < a.offset + a.width
      const aBottom = openingBottom(a)
      const bBottom = openingBottom(b)
      const yOverlap = aBottom < bBottom + b.height && bBottom < aBottom + a.height
      if (xOverlap && yOverlap) {
        issues.push({ openingId: b.id, message: `${b.label} overlaps ${a.label}` })
      }
    }
  }
  for (const o of all) {
    const len = wallLength(o.wall, room.dimensions)
    if (o.offset + o.width > len + 0.001 || openingBottom(o) + o.height > room.dimensions.height + 0.001) {
      issues.push({ openingId: o.id, message: `${o.label} extends beyond the ${o.wall} wall` })
    }
  }
  return issues
}

/** Refit all openings after room dimensions change. */
export function refitRoom(room: Room): Room {
  return {
    ...room,
    windows: room.windows.map((w) => fitOpening(w, room.dimensions)),
    doors: room.doors.map((dr) => fitOpening(dr, room.dimensions)),
    appliances: (room.appliances ?? []).map((a) => fitAppliance(a, room.dimensions)),
  }
}

export function floorArea(d: RoomDimensions): number {
  return d.length * d.width
}

export function roomVolume(d: RoomDimensions): number {
  return d.length * d.width * d.height
}

export function windowArea(room: Room, onlyOperable = false): number {
  return room.windows
    .filter((w) => !onlyOperable || w.operable)
    .reduce((sum, w) => sum + w.width * w.height, 0)
}

/** Walls that have at least one operable window or outdoor door. */
export function ventilationWalls(room: Room): WallSide[] {
  const set = new Set<WallSide>()
  room.windows.filter((w) => w.operable).forEach((w) => set.add(w.wall))
  room.doors.filter((d) => d.leadsTo === 'outdoor').forEach((d) => set.add(d.wall))
  return WALLS.filter((w) => set.has(w))
}

export function hasOppositeOpenings(room: Room): boolean {
  const walls = ventilationWalls(room)
  return (
    (walls.includes('front') && walls.includes('back')) ||
    (walls.includes('left') && walls.includes('right'))
  )
}

export function createWindow(room: Room, wall: WallSide = 'front'): WindowOpening {
  const count = room.windows.length + 1
  const len = wallLength(wall, room.dimensions)
  const width = Math.min(1.2, len - 0.4)
  return fitOpening(
    {
      id: uid('win'),
      kind: 'window',
      label: `Window ${count}`,
      wall,
      offset: (len - width) / 2,
      width,
      height: 1.2,
      sillHeight: 0.9,
      style: 'sliding',
      operable: true,
      hasShading: false,
      hasScreen: false,
    },
    room.dimensions,
  )
}

export function createDoor(room: Room, wall: WallSide = 'back'): DoorOpening {
  const count = room.doors.length + 1
  return fitOpening(
    {
      id: uid('door'),
      kind: 'door',
      label: `Door ${count}`,
      wall,
      offset: 0.3,
      width: 0.85,
      height: 2.05,
      leadsTo: 'indoor',
    },
    room.dimensions,
  )
}

export function createRoom(name = 'New room'): Room {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: uid('room'),
    name,
    type: 'bedroom',
    floorLevel: 1,
    dimensions: { length: 3.5, width: 3, height: 2.8 },
    orientation: 'S',
    windows: [],
    doors: [],
    appliances: [],
    hasCeilingFan: false,
    hasAirConditioner: false,
    createdAt: now,
    updatedAt: now,
  }
}
