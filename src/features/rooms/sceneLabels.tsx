/**
 * Screen-space labels for the 3D room.
 *
 * Labels are plain DOM elements positioned over the canvas. A small projector
 * inside the R3F scene converts each 3D anchor to screen coordinates every
 * frame and writes the transform directly (no React re-render per frame).
 */
import { useMemo, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Room } from '@/types'
import { cn } from '@/lib/utils'
import { WALLS, compassVector, wallFacing, wallFrame } from './roomGeometry'

export type LabelKind = 'dimension' | 'wall' | 'compass' | 'compass-north'

export interface SceneLabel {
  id: string
  text: string
  kind: LabelKind
  position: [number, number, number]
}

export type LabelRefMap = MutableRefObject<Map<string, HTMLDivElement>>

export function computeLabels(room: Room, opts: { dimensions: boolean; walls: boolean; compass: boolean }): SceneLabel[] {
  const { length: L, width: W, height: H } = room.dimensions
  const out: SceneLabel[] = []
  if (opts.dimensions) {
    out.push({ id: 'dim-l', kind: 'dimension', text: `${L.toFixed(2)} m`, position: [0, 0.02, W / 2 + 0.45] })
    out.push({ id: 'dim-w', kind: 'dimension', text: `${W.toFixed(2)} m`, position: [L / 2 + 0.45, 0.02, 0] })
    out.push({ id: 'dim-h', kind: 'dimension', text: `h ${H.toFixed(2)} m`, position: [L / 2 + 0.2, H / 2, W / 2 + 0.2] })
  }
  if (opts.walls) {
    for (const w of WALLS) {
      const f = wallFrame(w, room.dimensions)
      const o = new THREE.Vector3(0, 0, -0.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rotationY)
      out.push({
        id: `wall-${w}`,
        kind: 'wall',
        text: `${w[0].toUpperCase() + w.slice(1)} (${wallFacing(w, room.orientation)})`,
        position: [f.position[0] + o.x, H + 0.25, f.position[2] + o.z],
      })
    }
  }
  if (opts.compass) {
    const r = Math.max(L, W) / 2 + 0.9 + 0.35
    ;['N', 'E', 'S', 'W'].forEach((label, i) => {
      const [x, z] = compassVector(i * 90, room.orientation)
      out.push({ id: `c-${label}`, kind: label === 'N' ? 'compass-north' : 'compass', text: label, position: [x * r, 0.02, z * r] })
    })
  }
  return out
}

/** Lives inside <Canvas>. Projects anchors to screen space each frame. */
export function LabelProjector({ labels, refs, room }: { labels: SceneLabel[]; refs: LabelRefMap; room: Room }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const ray = useMemo(() => new THREE.Ray(), [])
  const { length: L, width: W, height: H } = room.dimensions
  const box = useMemo(() => new THREE.Box3(new THREE.Vector3(-L / 2, 0, -W / 2), new THREE.Vector3(L / 2, H, W / 2)), [L, W, H])
  useFrame(() => {
    for (const l of labels) {
      const el = refs.current.get(l.id)
      if (!el) continue
      p.set(...l.position)
      v.copy(p).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2
      // Dim labels whose line of sight passes through the room (hidden behind the far walls).
      let occluded = false
      if (l.kind !== 'wall') {
        ray.origin.copy(camera.position)
        ray.direction.copy(p).sub(camera.position).normalize()
        const d = ray.intersectBox(box, hit)
        occluded = !!d && camera.position.distanceTo(hit) < camera.position.distanceTo(p) - 0.05 && !box.containsPoint(p)
      }
      el.style.opacity = visible ? (occluded ? '0.2' : '1') : '0'
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    }
  })
  return null
}

const kindClass: Record<LabelKind, string> = {
  dimension: 'rounded-md bg-surface/95 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft shadow-sm ring-1 ring-line tabular',
  wall: 'rounded-md bg-breeze-800/90 px-1.5 py-0.5 text-[10px] font-medium text-white',
  compass: 'text-[11px] font-semibold text-breeze-600',
  'compass-north': 'grid size-6 place-items-center rounded-full bg-breeze-800 text-[11px] font-semibold text-white',
}

/** Lives outside <Canvas>, absolutely positioned over it. */
export function LabelOverlay({ labels, refs }: { labels: SceneLabel[]; refs: LabelRefMap }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {labels.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            if (el) refs.current.set(l.id, el)
            else refs.current.delete(l.id)
          }}
          className={cn('absolute top-0 left-0 whitespace-nowrap opacity-0 will-change-transform', kindClass[l.kind])}
        >
          {l.text}
        </div>
      ))}
    </div>
  )
}
