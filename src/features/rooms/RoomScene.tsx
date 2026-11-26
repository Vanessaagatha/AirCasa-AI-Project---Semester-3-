/**
 * 3D room geometry rendered with React Three Fiber.
 *
 * This is a geometric visualisation of the room the user describes. It does not
 * simulate airflow, heat transfer or sunlight — it only draws walls, openings
 * and a compass so the user can check their inputs.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { DoorOpening, Opening, Room, WallSide, WindowOpening } from '@/types'
import { WALL_THICKNESS, WALLS, compassVector, fitOpening, openingBottom, wallFrame } from './roomGeometry'
import { LabelProjector, type LabelRefMap, type SceneLabel } from './sceneLabels'

export type CameraView = 'perspective' | 'top' | 'front'

export interface RoomSceneProps {
  room: Room
  selectedOpeningId?: string | null
  onSelectOpening?: (id: string | null) => void
  onMoveOpening?: (opening: Opening) => void
  interactive?: boolean
  labels?: SceneLabel[]
  labelRefs?: LabelRefMap
  showCompass?: boolean
  furnished?: boolean
  autoRotate?: boolean
  view?: CameraView
  viewNonce?: number
  dark?: boolean
  /** extra scene content (simulation overlays, appliances) */
  children?: ReactNode
}

/** Environment colours that change with the app theme; room materials stay the same. */
const ENV = {
  light: { bg: '#f3f7f8', ground: '#eef3f4', hemiGround: '#dfe8ea', hemi: 1.25, sun: 1.5, ambient: 0.45, grid1: '#d6d0c2', grid2: '#e1dcd0', compass: '#22708a' },
  dark: { bg: '#0c1418', ground: '#121c21', hemiGround: '#24343b', hemi: 0.85, sun: 1.25, ambient: 0.3, grid1: '#a69f92', grid2: '#b8b1a4', compass: '#7cc0d4' },
}

const COLORS = {
  wall: '#f5f7f7',
  wallEdge: '#dbe4e7',
  floor: '#ece7dc',
  frame: '#ffffff',
  glass: '#a9cfe9',
  doorIndoor: '#cdbb9f',
  doorOutdoor: '#2f849f',
  selected: '#b7862f',
  hover: '#529fb7',
  compass: '#22708a',
}

// ----------------------------------------------------------------- Camera

function CameraRig({
  room,
  view,
  nonce,
  controls,
}: {
  room: Room
  view: CameraView
  nonce: number
  controls: RefObject<OrbitControlsImpl | null>
}) {
  const { camera, size } = useThree()
  const { length: L, width: W, height: H } = room.dimensions
  const aspect = Math.round((size.width / Math.max(1, size.height)) * 10) / 10
  useEffect(() => {
    // Fit a bounding sphere that includes the room and the compass ring.
    const roomR = 0.5 * Math.sqrt(L * L + W * W + H * H)
    const compassR = Math.max(L, W) / 2 + 1.35
    const r = Math.max(roomR, compassR) * (view === "top" ? 1.08 : view === "front" ? 1.05 : 1.22)
    const cam = camera as THREE.PerspectiveCamera
    const vfov = THREE.MathUtils.degToRad(cam.fov ?? 40)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const dist = r / Math.sin(Math.min(vfov, hfov) / 2)
    const target = new THREE.Vector3(0, view === 'top' ? 0 : H * 0.32, 0)
    const dir =
      view === 'top' ? new THREE.Vector3(0, 1, 0.0001) : view === 'front' ? new THREE.Vector3(0, 0.35, 1) : new THREE.Vector3(1, 0.95, 0.9)
    camera.position.copy(target).add(dir.normalize().multiplyScalar(dist))
    camera.lookAt(target)
    if (controls.current) {
      controls.current.target.copy(target)
      controls.current.update()
    }
    // re-run on explicit view requests and viewport shape changes, not on every dimension edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, nonce, aspect])
  return null
}

// ----------------------------------------------------------------- Walls

function buildWallGeometry(length: number, height: number, openings: Opening[]): THREE.ExtrudeGeometry {
  const t = WALL_THICKNESS
  const half = length / 2 + t // extend past corners so walls meet cleanly
  const shape = new THREE.Shape()
  shape.moveTo(-half, 0)
  shape.lineTo(half, 0)
  shape.lineTo(half, height)
  shape.lineTo(-half, height)
  shape.closePath()
  for (const o of openings) {
    const x0 = -length / 2 + o.offset
    const y0 = openingBottom(o) + (o.kind === 'door' ? 0.001 : 0)
    const hole = new THREE.Path()
    hole.moveTo(x0, y0)
    hole.lineTo(x0, y0 + o.height)
    hole.lineTo(x0 + o.width, y0 + o.height)
    hole.lineTo(x0 + o.width, y0)
    hole.closePath()
    shape.holes.push(hole)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false })
  geo.translate(0, 0, -t) // slab sits just outside the room boundary
  return geo
}

function Wall({
  wall,
  room,
  children,
  wallRef,
}: {
  wall: WallSide
  room: Room
  children?: (faded: boolean) => ReactNode
  wallRef?: (g: THREE.Group | null) => void
}) {
  const frame = wallFrame(wall, room.dimensions)
  const openings = useMemo(
    () => [...room.windows, ...room.doors].filter((o) => o.wall === wall),
    [room.windows, room.doors, wall],
  )
  const geometry = useMemo(
    () => buildWallGeometry(frame.length, room.dimensions.height, openings),
    [frame.length, room.dimensions.height, openings],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useRef<THREE.MeshStandardMaterial>(null)
  const [faded, setFaded] = useState(false)
  const outward = useMemo(() => {
    // local +Z points inward; outward is the opposite, rotated into world space
    return new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), frame.rotationY)
  }, [frame.rotationY])
  const pos = useMemo(() => new THREE.Vector3(...frame.position), [frame.position])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // Fade walls that sit between the camera and the room interior (cutaway view).
  useFrame(({ camera }) => {
    const facing = tmp.copy(camera.position).sub(pos).normalize().dot(outward) > 0.3
    if (facing !== faded) setFaded(facing)
    const m = material.current
    if (m) {
      const target = facing ? 0.07 : 1
      m.opacity += (target - m.opacity) * 0.18
      m.depthWrite = m.opacity > 0.95
    }
  })

  return (
    <group position={frame.position} rotation={[0, frame.rotationY, 0]} ref={wallRef}>
      <mesh geometry={geometry} castShadow={!faded} receiveShadow>
        <meshStandardMaterial ref={material} color={COLORS.wall} roughness={0.92} transparent opacity={1} />
      </mesh>
      {/* top edge line for definition */}
      <mesh position={[0, room.dimensions.height + 0.002, -WALL_THICKNESS / 2]}>
        <boxGeometry args={[frame.length + WALL_THICKNESS * 2, 0.004, WALL_THICKNESS]} />
        <meshBasicMaterial color={COLORS.wallEdge} transparent opacity={faded ? 0.2 : 1} />
      </mesh>
      {children?.(faded)}
    </group>
  )
}

// ----------------------------------------------------------------- Openings

interface OpeningMeshProps {
  opening: Opening
  wallLength: number
  selected: boolean
  faded: boolean
  interactive: boolean
  onPointerDown?: (e: ThreeEvent<PointerEvent>, o: Opening) => void
}

function FrameBars({ w, h, depth, color, bar = 0.05 }: { w: number; h: number; depth: number; color: string; bar?: number }) {
  return (
    <group>
      <mesh position={[0, h / 2 - bar / 2, 0]} castShadow>
        <boxGeometry args={[w, bar, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, -h / 2 + bar / 2, 0]} castShadow>
        <boxGeometry args={[w, bar, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[-w / 2 + bar / 2, 0, 0]} castShadow>
        <boxGeometry args={[bar, h, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[w / 2 - bar / 2, 0, 0]} castShadow>
        <boxGeometry args={[bar, h, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  )
}

function WindowMesh({ opening: o, wallLength, selected, faded, interactive, onPointerDown }: OpeningMeshProps & { opening: WindowOpening }) {
  const [hover, setHover] = useState(false)
  const cx = -wallLength / 2 + o.offset + o.width / 2
  const cy = o.sillHeight + o.height / 2
  const frameColor = selected ? COLORS.selected : hover ? COLORS.hover : COLORS.frame
  const depth = WALL_THICKNESS + 0.02
  const show = !faded || selected
  return (
    <group position={[cx, cy, -WALL_THICKNESS / 2]}>
      <mesh
        onPointerDown={interactive ? (e) => onPointerDown?.(e, o) : undefined}
        onPointerOver={interactive ? (e) => (e.stopPropagation(), setHover(true), (document.body.style.cursor = 'grab')) : undefined}
        onPointerOut={interactive ? () => (setHover(false), (document.body.style.cursor = '')) : undefined}
      >
        <boxGeometry args={[o.width, o.height, 0.02]} />
        <meshPhysicalMaterial
          color={COLORS.glass}
          transparent
          opacity={show ? 0.45 : 0.15}
          roughness={0.08}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      {show && <FrameBars w={o.width} h={o.height} depth={depth} color={frameColor} />}
      {show && o.style === 'sliding' && (
        <mesh>
          <boxGeometry args={[0.04, o.height, depth * 0.6]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
      )}
      {show && o.style === 'casement' && (
        <mesh>
          <boxGeometry args={[0.035, o.height, depth * 0.6]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
      )}
      {show &&
        o.style === 'louvre' &&
        Array.from({ length: Math.max(2, Math.floor(o.height / 0.12)) }, (_, i) => i).map((i, _, arr) => (
          <mesh key={i} position={[0, -o.height / 2 + ((i + 0.5) * o.height) / arr.length, 0]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[o.width - 0.08, 0.008, 0.08]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
        ))}
      {show && o.hasShading && (
        <mesh position={[0, o.height / 2 + 0.08, -WALL_THICKNESS / 2 - 0.18]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[o.width + 0.3, 0.03, 0.42]} />
          <meshStandardMaterial color="#529fb7" roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

function DoorMesh({ opening: o, wallLength, selected, faded, interactive, onPointerDown }: OpeningMeshProps & { opening: DoorOpening }) {
  const [hover, setHover] = useState(false)
  const cx = -wallLength / 2 + o.offset + o.width / 2
  const base = o.leadsTo === 'outdoor' ? COLORS.doorOutdoor : COLORS.doorIndoor
  const color = selected ? COLORS.selected : hover ? COLORS.hover : base
  const show = !faded || selected
  return (
    <group position={[cx, o.height / 2, -WALL_THICKNESS / 2]}>
      <mesh
        onPointerDown={interactive ? (e) => onPointerDown?.(e, o) : undefined}
        onPointerOver={interactive ? (e) => (e.stopPropagation(), setHover(true), (document.body.style.cursor = 'grab')) : undefined}
        onPointerOut={interactive ? () => (setHover(false), (document.body.style.cursor = '')) : undefined}
        castShadow
      >
        <boxGeometry args={[o.width - 0.04, o.height - 0.02, 0.045]} />
        <meshStandardMaterial color={color} roughness={0.7} transparent opacity={show ? 1 : 0.18} />
      </mesh>
      {show && (
        <>
          <FrameBars w={o.width + 0.06} h={o.height + 0.03} depth={WALL_THICKNESS + 0.02} color={selected ? COLORS.selected : '#ffffff'} bar={0.04} />
          <mesh position={[o.width / 2 - 0.12, -0.02, 0.04]}>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshStandardMaterial color="#59625c" metalness={0.4} roughness={0.4} />
          </mesh>
        </>
      )}
    </group>
  )
}

// ----------------------------------------------------------------- Compass

function CompassRose({ room, color }: { room: Room; color: string }) {
  const { length: L, width: W } = room.dimensions
  const r = Math.max(L, W) / 2 + 0.9
  const [nx, nz] = compassVector(0, room.orientation)
  const arrowRot = Math.atan2(nx, nz)
  return (
    <group position={[0, 0.003, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r - 0.012, r + 0.012, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      <group rotation={[0, arrowRot, 0]} position={[nx * r, 0, nz * r]}>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI]}>
          <circleGeometry args={[0.16, 3]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    </group>
  )
}

// ----------------------------------------------------------------- Furniture (landing illustration only)

function Furniture({ room }: { room: Room }) {
  const { length: L, width: W } = room.dimensions
  return (
    <group>
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.004, 0.1]} receiveShadow>
        <planeGeometry args={[L * 0.45, W * 0.4]} />
        <meshStandardMaterial color="#b7dbe5" roughness={1} />
      </mesh>
      {/* bed against back wall */}
      <group position={[L * 0.12, 0, -W / 2 + 1.05]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.4, 2]} />
          <meshStandardMaterial color="#e9e4da" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.45, 0.25]} castShadow>
          <boxGeometry args={[1.62, 0.12, 1.5]} />
          <meshStandardMaterial color="#9cb6c9" roughness={1} />
        </mesh>
        <mesh position={[0, 0.48, -0.75]} castShadow>
          <boxGeometry args={[1.3, 0.14, 0.38]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
        <mesh position={[0, 0.55, -1.0]} castShadow>
          <boxGeometry args={[1.7, 1.1, 0.06]} />
          <meshStandardMaterial color="#b9a58a" roughness={0.8} />
        </mesh>
      </group>
      {/* side table + plant */}
      <group position={[L * 0.12 - 1.15, 0, -W / 2 + 0.35]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.45, 0.5, 0.4]} />
          <meshStandardMaterial color="#b9a58a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.06, 0.22, 16]} />
          <meshStandardMaterial color="#f4f5f1" />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.17, 16, 12]} />
          <meshStandardMaterial color="#5f9a6a" roughness={1} />
        </mesh>
      </group>
      {/* ceiling fan */}
      {room.hasCeilingFan && !(room.appliances ?? []).some((a) => a.type === "ceiling-fan") && (
        <group position={[0, room.dimensions.height - 0.35, 0]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.35, 8]} />
            <meshStandardMaterial color="#59625c" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]} position={[0, -0.18, 0]}>
              <boxGeometry args={[1.1, 0.012, 0.12]} />
              <meshStandardMaterial color="#e9e4da" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// ----------------------------------------------------------------- Scene

interface DragState {
  id: string
  wall: WallSide
  grabDx: number
  grabDy: number
}

export function RoomScene({
  room,
  selectedOpeningId = null,
  onSelectOpening,
  onMoveOpening,
  interactive = false,
  labels = [],
  labelRefs,
  showCompass = true,
  furnished = false,
  autoRotate = false,
  view = 'perspective',
  viewNonce = 0,
  dark = false,
  children,
}: RoomSceneProps) {
  const E = dark ? ENV.dark : ENV.light
  const { length: L, width: W, height: H } = room.dimensions
  const controls = useRef<OrbitControlsImpl | null>(null)
  const wallGroups = useRef<Partial<Record<WallSide, THREE.Group | null>>>({})
  const [drag, setDrag] = useState<DragState | null>(null)
  const openings = useMemo(() => [...room.windows, ...room.doors], [room.windows, room.doors])

  useEffect(() => {
    if (!drag) return
    const end = () => {
      setDrag(null)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [drag])

  const startDrag = (e: ThreeEvent<PointerEvent>, o: Opening) => {
    e.stopPropagation()
    onSelectOpening?.(o.id)
    const group = wallGroups.current[o.wall]
    if (!group || !onMoveOpening) return
    const local = group.worldToLocal(e.point.clone())
    const len = wallFrame(o.wall, room.dimensions).length
    const cx = -len / 2 + o.offset + o.width / 2
    const cy = openingBottom(o) + o.height / 2
    setDrag({ id: o.id, wall: o.wall, grabDx: local.x - cx, grabDy: local.y - cy })
    document.body.style.cursor = 'grabbing'
  }

  const onDragMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || !onMoveOpening) return
    e.stopPropagation()
    const group = wallGroups.current[drag.wall]
    const o = openings.find((x) => x.id === drag.id)
    if (!group || !o) return
    const local = group.worldToLocal(e.point.clone())
    const len = wallFrame(o.wall, room.dimensions).length
    const cx = local.x - drag.grabDx
    const offset = Math.round((cx + len / 2 - o.width / 2) * 20) / 20 // snap to 5 cm
    let next: Opening = { ...o, offset }
    if (o.kind === 'window') {
      const sill = Math.round((local.y - drag.grabDy - o.height / 2) * 20) / 20
      next = { ...o, offset, sillHeight: sill }
    }
    next = fitOpening(next, room.dimensions)
    if (next.offset !== o.offset || openingBottom(next) !== openingBottom(o)) onMoveOpening(next)
  }

  return (
    <>
      <color attach="background" args={[E.bg]} />
      <fog attach="fog" args={[E.bg, 22, 48]} />
      <hemisphereLight args={['#ffffff', E.hemiGround, E.hemi]} />
      <directionalLight
        position={[6, 10, 5]}
        intensity={E.sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      <ambientLight intensity={E.ambient} />

      <CameraRig room={room} view={view} nonce={viewNonce} controls={controls} />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!drag}
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        target={[0, H * 0.35, 0]}
      />

      {/* ground + floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color={E.ground} roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        receiveShadow
        onPointerDown={interactive ? () => onSelectOpening?.(null) : undefined}
      >
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.95} />
      </mesh>
      {/* 50 cm floor grid for scale */}
      <gridHelper
        args={[Math.max(L, W), Math.round(Math.max(L, W) / 0.5), E.grid1, E.grid2]}
        position={[0, 0.002, 0]}
        scale={[L / Math.max(L, W), 1, W / Math.max(L, W)]}
      />

      {WALLS.map((wall) => (
        <Wall key={wall} wall={wall} room={room} wallRef={(g) => {
            wallGroups.current[wall] = g
          }}>
          {(faded) => (
            <>
              {openings
                .filter((o) => o.wall === wall)
                .map((o) =>
                  o.kind === 'window' ? (
                    <WindowMesh
                      key={o.id}
                      opening={o}
                      wallLength={wallFrame(wall, room.dimensions).length}
                      selected={o.id === selectedOpeningId}
                      faded={faded}
                      interactive={interactive}
                      onPointerDown={startDrag}
                    />
                  ) : (
                    <DoorMesh
                      key={o.id}
                      opening={o}
                      wallLength={wallFrame(wall, room.dimensions).length}
                      selected={o.id === selectedOpeningId}
                      faded={faded}
                      interactive={interactive}
                      onPointerDown={startDrag}
                    />
                  ),
                )}
              {drag?.wall === wall && (
                <mesh position={[0, H / 2, -WALL_THICKNESS / 2]} onPointerMove={onDragMove}>
                  <planeGeometry args={[60, 60]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              )}
            </>
          )}
        </Wall>
      ))}

      {furnished && <Furniture room={room} />}
      {showCompass && <CompassRose room={room} color={E.compass} />}
      {labelRefs && labels.length > 0 && <LabelProjector labels={labels} refs={labelRefs} room={room} />}
      {children}
    </>
  )
}
