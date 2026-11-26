import { lazy, Suspense } from 'react'
import { Box } from 'lucide-react'
import type { RoomViewer3DProps } from './RoomViewer3D'

const RoomViewer3D = lazy(() => import('./RoomViewer3D'))

function ViewerFallback() {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas">
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <Box className="size-4 animate-pulse" /> Loading 3D view
      </div>
    </div>
  )
}

/** Code-split wrapper so three.js only loads on pages that show a 3D room. */
export function LazyRoomViewer(props: RoomViewer3DProps) {
  return (
    <Suspense fallback={<ViewerFallback />}>
      <RoomViewer3D {...props} />
    </Suspense>
  )
}
