import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Box, Eye, EyeOff, MousePointerClick, RotateCcw, Square } from 'lucide-react'
import type { Opening, Room } from '@/types'
import { cn } from '@/lib/utils'
import { RoomScene, type CameraView } from './RoomScene'
import { ApplianceMeshes } from './ApplianceMeshes'
import { LabelOverlay, computeLabels } from './sceneLabels'
import { useSettings } from '@/context/SettingsContext'

class WebGLBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-ink">The 3D view could not start</p>
            <p className="mt-1 max-w-xs text-[13px] text-ink-muted">
              This browser or device may not support WebGL. Room details can still be edited, saved and exported.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export interface RoomViewer3DProps {
  room: Room
  selectedOpeningId?: string | null
  onSelectOpening?: (id: string | null) => void
  onMoveOpening?: (o: Opening) => void
  interactive?: boolean
  furnished?: boolean
  autoRotate?: boolean
  toolbar?: boolean
  showCompass?: boolean
  defaultLabels?: boolean
  className?: string
  /** extra R3F content rendered inside the scene (appliances, simulation overlays) */
  sceneChildren?: ReactNode
  /** extra DOM content over the canvas */
  overlay?: ReactNode
  /** hide the default bottom captions */
  hideCaptions?: boolean
  /** draw the room's appliances (non-interactive) */
  showAppliances?: boolean
}

function ToolButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid size-8 place-items-center rounded-lg transition-colors',
        active ? 'bg-breeze-800 text-white' : 'text-ink-soft hover:bg-breeze-50 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export default function RoomViewer3D({
  room,
  selectedOpeningId,
  onSelectOpening,
  onMoveOpening,
  interactive = false,
  furnished = false,
  autoRotate = false,
  toolbar = true,
  showCompass = true,
  defaultLabels = true,
  className,
  sceneChildren,
  overlay,
  hideCaptions = false,
  showAppliances = false,
}: RoomViewer3DProps) {
  const { resolvedTheme, settings: appSettings } = useSettings()
  const dark = resolvedTheme === 'dark'
  const reduceMotion = appSettings.reduceMotion
  const [view, setView] = useState<CameraView>('perspective')
  const [nonce, setNonce] = useState(0)
  const [labels, setLabels] = useState(defaultLabels)
  const labelRefs = useRef(new Map<string, HTMLDivElement>())
  const sceneLabels = useMemo(
    () => computeLabels(room, { dimensions: labels, walls: labels, compass: showCompass }),
    [room, labels, showCompass],
  )

  const request = (v: CameraView) => {
    setView(v)
    setNonce((n) => n + 1)
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <WebGLBoundary>
        <Canvas
          shadows="percentage"
          flat
          dpr={[1, 2]}
          camera={{ fov: 40, near: 0.1, far: 100, position: [8, 7, 8] }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          onPointerMissed={() => interactive && onSelectOpening?.(null)}
        >
          <Suspense fallback={null}>
            <RoomScene
              room={room}
              selectedOpeningId={selectedOpeningId}
              onSelectOpening={onSelectOpening}
              onMoveOpening={onMoveOpening}
              interactive={interactive}
              labels={sceneLabels}
              labelRefs={labelRefs}
              showCompass={showCompass}
              furnished={furnished}
              autoRotate={autoRotate && !reduceMotion}
              view={view}
              viewNonce={nonce}
              dark={dark}
            >
              {showAppliances && <ApplianceMeshes room={room} />}
              {sceneChildren}
            </RoomScene>
          </Suspense>
        </Canvas>
        <LabelOverlay labels={sceneLabels} refs={labelRefs} />
        {overlay}
      </WebGLBoundary>

      {toolbar && (
        <>
          <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-xl border border-line bg-surface/95 p-1 shadow-card backdrop-blur">
            <ToolButton active={view === 'perspective'} onClick={() => request('perspective')} label="3D view">
              <Box className="size-4" />
            </ToolButton>
            <ToolButton active={view === 'top'} onClick={() => request('top')} label="Top view">
              <Square className="size-4" />
            </ToolButton>
            <ToolButton active={view === 'front'} onClick={() => request('front')} label="Front wall view">
              <span className="text-[11px] font-semibold">F</span>
            </ToolButton>
            <span className="mx-0.5 h-5 w-px bg-line" />
            <ToolButton active={labels} onClick={() => setLabels((l) => !l)} label={labels ? 'Hide labels' : 'Show labels'}>
              {labels ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </ToolButton>
            <ToolButton onClick={() => request(view)} label="Reset camera">
              <RotateCcw className="size-4" />
            </ToolButton>
          </div>
          {!hideCaptions && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
            <p className="rounded-lg bg-surface/90 px-2.5 py-1.5 text-[11px] leading-4 text-ink-muted shadow-sm ring-1 ring-line backdrop-blur">
              Geometry editor. Airflow and heat estimates are on the Simulation page.
            </p>
            {interactive && (
              <p className="hidden items-center gap-1.5 rounded-lg bg-surface/90 px-2.5 py-1.5 text-[11px] text-ink-muted shadow-sm ring-1 ring-line backdrop-blur sm:flex">
                <MousePointerClick className="size-3.5" />
                Drag to rotate, scroll to zoom, drag an opening or appliance to move it
              </p>
            )}
          </div>
          )}
        </>
      )}
    </div>
  )
}
