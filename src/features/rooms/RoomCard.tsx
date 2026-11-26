import { DoorOpen, AppWindow, Compass } from 'lucide-react'
import type { Room, SensorReading } from '@/types'
import { cn } from '@/lib/utils'
import { fmtPct, fmtTemp } from '@/lib/format'
import { RoomPreview } from './RoomPreview'
import { floorArea } from './roomGeometry'

const typeLabel: Record<Room['type'], string> = {
  bedroom: 'Bedroom',
  living: 'Living room',
  kitchen: 'Kitchen',
  office: 'Office',
  other: 'Room',
}

export function RoomCard({
  room,
  reading,
  selected,
  onSelect,
}: {
  room: Room
  reading?: SensorReading | null
  selected?: boolean
  onSelect: () => void
}) {
  const { length, width } = room.dimensions
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex w-full flex-col overflow-hidden rounded-2xl border bg-surface text-left shadow-card transition-[border-color,box-shadow]',
        selected ? 'border-breeze-500 ring-2 ring-breeze-200' : 'border-line hover:border-breeze-300',
      )}
    >
      <div className={cn('relative px-6 pt-5 pb-2', selected ? 'bg-breeze-50' : 'bg-canvas')}>
        <RoomPreview room={room} className="mx-auto h-28 w-full" highlight={selected} />
        <span className="absolute top-3 left-3 rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-line">
          Floor {room.floorLevel}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{room.name}</p>
            <p className="text-xs text-ink-muted">
              {typeLabel[room.type]}, {length.toFixed(1)} × {width.toFixed(1)} m ({floorArea(room.dimensions).toFixed(1)} m²)
            </p>
          </div>
          <div className="text-right">
            <p className={cn('tabular text-lg leading-6 font-semibold', reading?.status === 'ok' ? 'text-ink' : 'text-ink-muted')}>
              {reading ? fmtTemp(reading.temperatureC) : '…'}
            </p>
            <p className="tabular text-xs text-mist-700">{reading?.status === 'ok' ? fmtPct(reading.humidityPct) : reading ? 'No reading' : ''}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <AppWindow className="size-3.5" /> {room.windows.length} window{room.windows.length === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1">
            <DoorOpen className="size-3.5" /> {room.doors.length} door{room.doors.length === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Compass className="size-3.5" /> Faces {room.orientation}
          </span>
        </div>
      </div>
    </button>
  )
}
