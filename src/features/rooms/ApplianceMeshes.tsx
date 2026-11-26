/**
 * Simple stylised 3D appliances placed in the room. Each can be selected and
 * dragged across the floor plan. Fans spin when they are scheduled "on" now.
 */
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Appliance, Room } from '@/types'
import { APPLIANCE_CATALOG, applianceBaseY, fitAppliance, isOnAt } from './appliances'

const SELECTED = '#b7862f'

function Body({ a, color }: { a: Appliance; color: string }) {
  const s = APPLIANCE_CATALOG[a.type]
  const [w, d, h] = s.size
  const blade = useRef<THREE.Group>(null)
  const on = isOnAt(a, new Date().getHours())
  useFrame((_, dt) => {
    if (blade.current && on) blade.current.rotation.y += dt * 6
  })

  switch (a.type) {
    case 'ceiling-fan':
      return (
        <group>
          <mesh position={[0, h - 0.05, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
            <meshStandardMaterial color="#59625c" />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 20]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <group ref={blade} position={[0, 0.05, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]} position={[0, 0, 0]}>
                <boxGeometry args={[w, 0.012, 0.12]} />
                <meshStandardMaterial color={color} />
              </mesh>
            ))}
          </group>
        </group>
      )
    case 'standing-fan':
      return (
        <group>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.04, 24]} />
            <meshStandardMaterial color="#c9cfd2" />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 1.0, 8]} />
            <meshStandardMaterial color="#8a9599" />
          </mesh>
          <group position={[0, 1.05, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <torusGeometry args={[0.2, 0.012, 8, 32]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <group ref={blade}>
              {[0, 1, 2].map((i) => (
                <mesh key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
                  <boxGeometry args={[0.34, 0.01, 0.08]} />
                  <meshStandardMaterial color="#9fd3e2" transparent opacity={0.85} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      )
    case 'lighting':
      return (
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[w / 2, w / 2, h, 32]} />
          <meshStandardMaterial color={color} emissive={on ? '#fff1c4' : '#000000'} emissiveIntensity={on ? 0.6 : 0} />
        </mesh>
      )
    case 'air-conditioner':
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.03, d / 2 + 0.001]}>
            <boxGeometry args={[w * 0.9, 0.03, 0.01]} />
            <meshStandardMaterial color="#b7c4c9" />
          </mesh>
          <mesh position={[w / 2 - 0.08, h - 0.06, d / 2 + 0.002]}>
            <boxGeometry args={[0.03, 0.012, 0.004]} />
            <meshBasicMaterial color={on ? '#58a7c0' : '#7a8580'} />
          </mesh>
        </group>
      )
    case 'television':
      return (
        <group>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.18]} />
            <meshStandardMaterial color="#3a4448" />
          </mesh>
          <mesh position={[0, h / 2 + 0.04, 0]} castShadow>
            <boxGeometry args={[w, h, 0.05]} />
            <meshStandardMaterial color={color} roughness={0.3} />
          </mesh>
          <mesh position={[0, h / 2 + 0.04, 0.026]}>
            <planeGeometry args={[w - 0.04, h - 0.04]} />
            <meshStandardMaterial color={on ? '#2f5f74' : '#14191b'} emissive={on ? '#1b5d74' : '#000'} emissiveIntensity={on ? 0.3 : 0} />
          </mesh>
        </group>
      )
    case 'refrigerator':
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          <mesh position={[0, h * 0.68, d / 2 + 0.002]}>
            <boxGeometry args={[w - 0.02, 0.008, 0.004]} />
            <meshStandardMaterial color="#9aa6ab" />
          </mesh>
          <mesh position={[w / 2 - 0.07, h * 0.5, d / 2 + 0.02]}>
            <boxGeometry args={[0.02, 0.3, 0.03]} />
            <meshStandardMaterial color="#9aa6ab" />
          </mesh>
        </group>
      )
    default:
      return (
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      )
  }
}

/** Shows an implied table/counter under counter-mounted items. */
function Counter({ a }: { a: Appliance }) {
  const s = APPLIANCE_CATALOG[a.type]
  if (s.mount !== 'counter') return null
  return (
    <group>
      <mesh position={[0, 0.735, 0]} castShadow receiveShadow>
        <boxGeometry args={[s.size[0] + 0.25, 0.03, s.size[1] + 0.2]} />
        <meshStandardMaterial color="#c8b597" roughness={0.8} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (s.size[0] / 2 + 0.08), 0.36, sz * (s.size[1] / 2 + 0.06)]}>
            <boxGeometry args={[0.04, 0.72, 0.04]} />
            <meshStandardMaterial color="#b09c7e" />
          </mesh>
        )),
      )}
    </group>
  )
}

export function ApplianceMeshes({
  room,
  selectedId,
  onSelect,
  onMove,
  interactive = false,
}: {
  room: Room
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onMove?: (a: Appliance) => void
  interactive?: boolean
}) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const [drag, setDrag] = useState<{ id: string; dx: number; dz: number } | null>(null)
  const appliances = room.appliances ?? []

  useEffect(() => {
    if (!drag) return
    if (controls) controls.enabled = false
    const end = () => {
      setDrag(null)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerup', end)
    return () => {
      window.removeEventListener('pointerup', end)
      if (controls) controls.enabled = true
    }
  }, [drag, controls])

  const start = (e: ThreeEvent<PointerEvent>, a: Appliance) => {
    if (!interactive) return
    e.stopPropagation()
    onSelect?.(a.id)
    if (!onMove) return
    setDrag({ id: a.id, dx: 0, dz: 0 })
    document.body.style.cursor = 'grabbing'
  }

  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || !onMove) return
    e.stopPropagation()
    const a = appliances.find((x) => x.id === drag.id)
    if (!a) return
    const next = fitAppliance({ ...a, x: Math.round((e.point.x - drag.dx) * 20) / 20, z: Math.round((e.point.z - drag.dz) * 20) / 20 }, room.dimensions)
    if (next.x !== a.x || next.z !== a.z) onMove(next)
  }

  return (
    <group>
      {appliances.map((a) => {
        const s = APPLIANCE_CATALOG[a.type]
        const y = applianceBaseY(a, room.dimensions.height)
        const selected = a.id === selectedId
        return (
          <group key={a.id} position={[a.x, 0, a.z]} rotation={[0, (a.rotationDeg * Math.PI) / 180, 0]}>
            <Counter a={a} />
            <group
              position={[0, y, 0]}
              onPointerDown={(e) => start(e, a)}
              onPointerOver={interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'grab')) : undefined}
              onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
            >
              <Body a={a} color={selected ? SELECTED : s.color} />
            </group>
            {selected && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
                <ringGeometry args={[Math.max(s.size[0], s.size[1]) * 0.6, Math.max(s.size[0], s.size[1]) * 0.6 + 0.03, 40]} />
                <meshBasicMaterial color={SELECTED} />
              </mesh>
            )}
          </group>
        )
      })}
      {drag && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onPointerMove={move}>
          <planeGeometry args={[60, 60]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
