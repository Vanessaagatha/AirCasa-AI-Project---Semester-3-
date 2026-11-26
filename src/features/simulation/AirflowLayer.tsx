/**
 * Schematic airflow visualisation for the 3D room.
 *
 * Particles follow smooth paths from inlet openings to outlet openings (cross
 * ventilation) or loop in and out of the same opening (single-sided), with
 * speeds scaled from the ventilation estimate. Paths are drawn, not solved:
 * they show likely direction and relative strength, not a CFD flow field.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Opening, Room } from '@/types'
import { openingBottom, wallFrame } from '@/features/rooms/roomGeometry'
import { APPLIANCE_CATALOG, applianceBaseY, isOnAt } from '@/features/rooms/appliances'
import type { VentilationResult } from './ventilation'

function openingFrame(room: Room, o: Opening) {
  const f = wallFrame(o.wall, room.dimensions)
  const c = Math.cos(f.rotationY)
  const s = Math.sin(f.rotationY)
  const along = new THREE.Vector3(c, 0, -s)
  const outward = new THREE.Vector3(-s, 0, -c)
  const lx = -f.length / 2 + o.offset + o.width / 2
  const centre = new THREE.Vector3(f.position[0] + lx * c, openingBottom(o) + o.height / 2, f.position[2] - lx * s)
  return { centre, outward, along }
}

interface PathDef {
  curve: THREE.CatmullRomCurve3
  length: number
  speed: number
  count: number
  color: THREE.Color
}

const COOL = new THREE.Color('#3fa7d6')
const WARM = new THREE.Color('#e08a3c')
const NEUTRAL = new THREE.Color('#9fb0b6')

export function AirflowLayer({
  room,
  vent,
  outdoorC,
  indoorC,
  showFans = true,
  density = 1,
}: {
  room: Room
  vent: VentilationResult
  outdoorC: number
  indoorC: number
  showFans?: boolean
  density?: number
}) {
  const { height: H, length: L, width: W } = room.dimensions
  const airColor = outdoorC < indoorC - 0.3 ? COOL : outdoorC > indoorC + 0.3 ? WARM : NEUTRAL

  const paths = useMemo<PathDef[]>(() => {
    const out: PathDef[] = []
    const total = Math.max(vent.flow - vent.infiltrationFlow, 1e-6)
    const visSpeed = (s: number) => THREE.MathUtils.clamp(0.35 + s * 1.6, 0.35, 2.6)
    if (vent.mode === 'cross') {
      const inlets = vent.openings.filter((o) => o.role === 'inlet')
      const outlets = vent.openings.filter((o) => o.role === 'outlet')
      const outletPts = outlets.map((o) => ({ ...openingFrame(room, o.opening), flow: o.flow, speed: o.speed }))
      if (vent.usesInternalDoors) {
        for (const d of room.doors.filter((x) => x.leadsTo === 'indoor')) {
          outletPts.push({ ...openingFrame(room, d), flow: total * 0.3, speed: 0.3 })
        }
      }
      for (const i of inlets) {
        const a = openingFrame(room, i.opening)
        for (const b of outletPts) {
          const share = (i.flow / total) * (b.flow / Math.max(outletPts.reduce((s, x) => s + x.flow, 0), 1e-6))
          const mid = a.centre.clone().lerp(b.centre, 0.5)
          mid.y = Math.min(H * 0.45, 1.2)
          const pts = [
            a.centre.clone().addScaledVector(a.outward, 1.1),
            a.centre.clone().addScaledVector(a.outward, 0.15),
            a.centre.clone().lerp(mid, 0.45).setY((a.centre.y + mid.y) / 2),
            mid,
            b.centre.clone().lerp(mid, 0.45).setY((b.centre.y + mid.y) / 2),
            b.centre.clone().addScaledVector(b.outward, 0.15),
            b.centre.clone().addScaledVector(b.outward, 1.1),
          ]
          const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
          out.push({ curve, length: curve.getLength(), speed: visSpeed(i.speed), count: Math.max(6, Math.round(share * 220 * density)), color: airColor })
        }
      }
    } else if (vent.mode === 'single-sided') {
      for (const o of vent.openings) {
        const f = openingFrame(room, o.opening)
        const h = o.opening.height
        const depth = Math.min(2.4 * h, (o.opening.wall === 'front' || o.opening.wall === 'back' ? W : L) * 0.6)
        const lowY = Math.max(0.15, f.centre.y - h * 0.25)
        const highY = Math.min(H - 0.15, f.centre.y + h * 0.25)
        const inward = f.outward.clone().negate()
        const base = (y: number) => f.centre.clone().setY(y)
        for (const side of [-1, 1]) {
          const lateral = f.along.clone().multiplyScalar(side * o.opening.width * 0.22)
          const pts = [
            base(lowY).addScaledVector(f.outward, 0.9).add(lateral),
            base(lowY).add(lateral),
            base(Math.max(0.2, lowY - 0.2)).addScaledVector(inward, depth * 0.6).add(lateral),
            base((lowY + highY) / 2).addScaledVector(inward, depth),
            base(highY + 0.1).addScaledVector(inward, depth * 0.5).sub(lateral),
            base(highY).sub(lateral),
            base(highY).addScaledVector(f.outward, 0.9).sub(lateral),
          ]
          const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
          out.push({ curve, length: curve.getLength(), speed: visSpeed(o.speed), count: Math.max(8, Math.round((o.flow / total) * 110 * density)), color: airColor })
        }
      }
    }
    // Fans: recirculate room air (no fresh air), drawn as a gentle loop
    if (showFans) {
      const hour = new Date().getHours()
      for (const a of room.appliances ?? []) {
        const spec = APPLIANCE_CATALOG[a.type]
        if (!spec.movesAir || !isOnAt(a, hour)) continue
        const y = applianceBaseY(a, H)
        const c = new THREE.Vector3(a.x, a.type === 'ceiling-fan' ? y : y + 1.05, a.z)
        const pts: THREE.Vector3[] = []
        if (a.type === 'ceiling-fan') {
          for (let k = 0; k < 12; k++) {
            const ang = (k / 12) * Math.PI * 2
            const r = 0.5 + 0.5 * Math.abs(Math.sin(ang))
            pts.push(new THREE.Vector3(c.x + Math.cos(ang) * r, c.y - 0.2 - (k / 12) * (y - 0.6), c.z + Math.sin(ang) * r))
          }
        } else {
          const rot = (a.rotationDeg * Math.PI) / 180
          const dir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot))
          for (let k = 0; k < 6; k++) pts.push(c.clone().addScaledVector(dir, k * 0.45).setY(c.y - k * 0.08))
        }
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
        out.push({ curve, length: curve.getLength(), speed: 1.2, count: Math.round(28 * density), color: NEUTRAL })
      }
    }
    return out
  }, [room, vent, H, L, W, airColor, density, showFans])

  const total = paths.reduce((s, p) => s + p.count, 0)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const state = useRef<{ path: number; u: number; jitter: THREE.Vector3 }[]>([])

  useLayoutEffect(() => {
    const st: { path: number; u: number; jitter: THREE.Vector3 }[] = []
    paths.forEach((p, pi) => {
      for (let k = 0; k < p.count; k++) {
        st.push({ path: pi, u: k / p.count + Math.random() * 0.02, jitter: new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.7) })
      }
    })
    state.current = st
    const m = mesh.current
    if (!m) return
    st.forEach((s, i) => m.setColorAt(i, paths[s.path].color))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [paths])

  const tmp = useMemo(() => new THREE.Object3D(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    const step = Math.min(dt, 0.05)
    state.current.forEach((s, i) => {
      const p = paths[s.path]
      s.u = (s.u + (p.speed * step) / Math.max(p.length, 0.1)) % 1
      p.curve.getPointAt(s.u, pos)
      pos.add(s.jitter)
      const fade = Math.sin(Math.PI * s.u)
      // spread the stream inside the room, keep it tight at the openings
      pos.addScaledVector(s.jitter, fade - 1)
      tmp.position.copy(pos)
      tmp.scale.setScalar(0.5 + 0.7 * fade)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {total > 0 && (
        <instancedMesh key={total} ref={mesh} args={[undefined, undefined, total]} frustumCulled={false}>
          <sphereGeometry args={[0.034, 8, 6]} />
          <meshBasicMaterial transparent opacity={0.85} depthWrite={false} />
        </instancedMesh>
      )}
      {/* direction arrows at each opening */}
      {vent.openings.map((o) => {
        const f = openingFrame(room, o.opening)
        const inward = o.role === 'inlet'
        const arrows = o.role === 'both' ? [true, false] : [inward]
        return arrows.map((isIn, k) => {
          const y = o.role === 'both' ? f.centre.y + (isIn ? -0.25 : 0.25) * o.opening.height : f.centre.y
          const p = f.centre.clone().setY(y).addScaledVector(f.outward, isIn ? 0.45 : 0.35)
          const dir = isIn ? f.outward.clone().negate() : f.outward.clone()
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
          return (
            <mesh key={`${o.opening.id}-${k}`} position={p} quaternion={q}>
              <coneGeometry args={[0.09, 0.26, 16]} />
              <meshBasicMaterial color={isIn ? airColor : NEUTRAL} transparent opacity={0.9} />
            </mesh>
          )
        })
      })}
    </group>
  )
}

/** Amber panels outside windows whose opacity follows current solar irradiance on that wall. */
export function SolarOverlay({ room, irradianceByWindow }: { room: Room; irradianceByWindow: Map<string, number> }) {
  return (
    <group>
      {room.windows.map((w) => {
        const I = irradianceByWindow.get(w.id) ?? 0
        if (I < 20) return null
        const f = openingFrame(room, w)
        const p = f.centre.clone().addScaledVector(f.outward, 0.09)
        const rotY = Math.atan2(f.outward.x, f.outward.z)
        const strength = Math.min(1, I / 700) * (w.hasShading ? 0.45 : 1)
        return (
          <mesh key={w.id} position={p} rotation={[0, rotY, 0]}>
            <planeGeometry args={[w.width * 1.05, w.height * 1.05]} />
            <meshBasicMaterial color="#f2a33a" transparent opacity={0.15 + 0.55 * strength} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}
