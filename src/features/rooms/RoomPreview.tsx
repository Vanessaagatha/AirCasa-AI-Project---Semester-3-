/**
 * Lightweight isometric SVG preview of a room.
 * Used for room cards so the dashboard does not create one WebGL context per room.
 * Uses the same coordinate system as the 3D scene (see roomGeometry.wallFrame).
 */
import { useMemo } from 'react'
import type { Opening, Room, WallSide } from '@/types'
import { openingBottom, wallFrame } from './roomGeometry'
import { useSettings } from '@/context/SettingsContext'

const PAL = {
  light: { floor: '#ece7dc', floorLine: '#d6d0c2', right: '#e6eef0', back: '#f5f8f8', line: '#cbd8dd', stub: '#e1eaed', stubHi: '#b7dbe5' },
  dark: { floor: '#4d493f', floorLine: '#5d584d', right: '#38464c', back: '#46555b', line: '#26353c', stub: '#2e3d43', stubHi: '#285c6f' },
}

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = 0.5

type P3 = [number, number, number]

function project([x, y, z]: P3): [number, number] {
  return [(x - z) * COS30, (x + z) * SIN30 - y]
}

/** Convert wall-local (u along wall, v up) to world coordinates. */
function wallPoint(wall: WallSide, room: Room, u: number, v: number): P3 {
  const f = wallFrame(wall, room.dimensions)
  const c = Math.cos(f.rotationY)
  const s = Math.sin(f.rotationY)
  return [f.position[0] + u * c, v, f.position[2] - u * s]
}

function openingPoly(o: Opening, room: Room): P3[] {
  const len = wallFrame(o.wall, room.dimensions).length
  const u0 = -len / 2 + o.offset
  const u1 = u0 + o.width
  const v0 = openingBottom(o)
  const v1 = v0 + o.height
  return [
    wallPoint(o.wall, room, u0, v0),
    wallPoint(o.wall, room, u1, v0),
    wallPoint(o.wall, room, u1, v1),
    wallPoint(o.wall, room, u0, v1),
  ]
}

export function RoomPreview({
  room,
  className,
  highlight,
  forceTheme,
}: {
  room: Room
  className?: string
  highlight?: boolean
  forceTheme?: 'light' | 'dark'
}) {
  const theme = useSettings().resolvedTheme
  const P = PAL[forceTheme ?? theme]
  const shapes = useMemo(() => {
    const { length: L, width: W, height: H } = room.dimensions
    const hl = L / 2
    const hw = W / 2
    const floor: P3[] = [
      [-hl, 0, -hw],
      [hl, 0, -hw],
      [hl, 0, hw],
      [-hl, 0, hw],
    ]
    const back: P3[] = [
      [-hl, 0, -hw],
      [hl, 0, -hw],
      [hl, H, -hw],
      [-hl, H, -hw],
    ]
    const right: P3[] = [
      [-hl, 0, -hw],
      [-hl, 0, hw],
      [-hl, H, hw],
      [-hl, H, -hw],
    ]
    const stub = 0.12 * H
    const front: P3[] = [
      [-hl, 0, hw],
      [hl, 0, hw],
      [hl, stub, hw],
      [-hl, stub, hw],
    ]
    const left: P3[] = [
      [hl, 0, -hw],
      [hl, 0, hw],
      [hl, stub, hw],
      [hl, stub, -hw],
    ]
    const all = [...floor, ...back, ...right]
    const pts = all.map(project)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const pad = 0.35
    const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`

    const openings = [...room.windows, ...room.doors]
    const tall = openings.filter((o) => o.wall === 'back' || o.wall === 'right')
    const low = openings.filter((o) => o.wall === 'front' || o.wall === 'left')
    return { floor, back, right, front, left, tall, low, viewBox, stroke: Math.max(L, W) / 140 }
  }, [room])

  const toPath = (poly: P3[]) => poly.map((p) => project(p).join(',')).join(' ')
  const lowSegment = (o: Opening) => {
    const len = wallFrame(o.wall, room.dimensions).length
    const u0 = -len / 2 + o.offset
    const a = project(wallPoint(o.wall, room, u0, 0.12 * room.dimensions.height))
    const b = project(wallPoint(o.wall, room, u0 + o.width, 0.12 * room.dimensions.height))
    return { a, b }
  }

  return (
    <svg viewBox={shapes.viewBox} className={className} role="img" aria-label={`Isometric preview of ${room.name}`}>
      <polygon points={toPath(shapes.floor)} fill={P.floor} stroke={P.floorLine} strokeWidth={shapes.stroke} />
      <polygon points={toPath(shapes.right)} fill={P.right} stroke={P.line} strokeWidth={shapes.stroke} />
      <polygon points={toPath(shapes.back)} fill={P.back} stroke={P.line} strokeWidth={shapes.stroke} />
      {shapes.tall.map((o) => (
        <polygon
          key={o.id}
          points={toPath(openingPoly(o, room))}
          fill={o.kind === 'window' ? '#bcd8ec' : o.leadsTo === 'outdoor' ? '#2f849f' : '#cdbb9f'}
          stroke={P.back}
          strokeWidth={shapes.stroke * 1.5}
        />
      ))}
      <polygon points={toPath(shapes.left)} fill={highlight ? P.stubHi : P.stub} stroke={P.line} strokeWidth={shapes.stroke} />
      <polygon points={toPath(shapes.front)} fill={highlight ? P.stubHi : P.stub} stroke={P.line} strokeWidth={shapes.stroke} />
      {shapes.low.map((o) => {
        const { a, b } = lowSegment(o)
        return (
          <line
            key={o.id}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={o.kind === 'window' ? '#2a7fc4' : '#2f849f'}
            strokeWidth={shapes.stroke * 4}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
