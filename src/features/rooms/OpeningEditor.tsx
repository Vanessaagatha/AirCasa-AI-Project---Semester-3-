import { AppWindow, ChevronDown, Copy, DoorOpen, Trash2 } from 'lucide-react'
import type { Opening, Room, WallSide, WindowStyle } from '@/types'
import { Field, Input, MeasureInput, Select, Toggle } from '@/components/ui'
import { cn, uid } from '@/lib/utils'
import { EDGE_MARGIN, WALLS, compassLabel, fitOpening, wallFacing, wallLabel, wallLength } from './roomGeometry'

const STYLE_LABEL: Record<WindowStyle, string> = {
  sliding: 'Sliding',
  casement: 'Casement (hinged)',
  louvre: 'Louvre / jalousie',
  fixed: 'Fixed (does not open)',
}

export function OpeningEditor({
  opening,
  room,
  expanded,
  issue,
  onToggle,
  onChange,
  onDelete,
  onDuplicate,
}: {
  opening: Opening
  room: Room
  expanded: boolean
  issue?: string
  onToggle: () => void
  onChange: (o: Opening) => void
  onDelete: () => void
  onDuplicate: (o: Opening) => void
}) {
  const o = opening
  const len = wallLength(o.wall, room.dimensions)
  const set = (patch: Partial<Opening>) => onChange(fitOpening({ ...o, ...patch } as Opening, room.dimensions))
  const facing = wallFacing(o.wall, room.orientation)
  const Icon = o.kind === 'window' ? AppWindow : DoorOpen

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        expanded ? 'border-ochre-300 bg-surface shadow-card' : 'border-line bg-surface hover:border-breeze-300',
      )}
    >
      <button onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg',
            o.kind === 'window' ? 'bg-mist-100 text-mist-700' : 'bg-breeze-100 text-breeze-700',
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{o.label}</span>
          <span className="tabular block text-xs text-ink-muted">
            {wallLabel[o.wall]} ({facing}), {o.width.toFixed(2)} × {o.height.toFixed(2)} m
          </span>
          {issue && <span className="block text-xs text-ochre-700">{issue}</span>}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-muted transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-line px-3.5 pt-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" htmlFor={`${o.id}-label`}>
              <Input id={`${o.id}-label`} value={o.label} onChange={(e) => onChange({ ...o, label: e.target.value })} />
            </Field>
            <Field label="Wall" htmlFor={`${o.id}-wall`}>
              <Select
                id={`${o.id}-wall`}
                value={o.wall}
                onChange={(e) => {
                  const wall = e.target.value as WallSide
                  const newLen = wallLength(wall, room.dimensions)
                  set({ wall, offset: Math.min(o.offset, newLen - o.width - EDGE_MARGIN) })
                }}
              >
                {WALLS.map((w) => (
                  <option key={w} value={w}>
                    {w[0].toUpperCase() + w.slice(1)} ({compassLabel[wallFacing(w, room.orientation)].toLowerCase()})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <MeasureInput
            id={`${o.id}-offset`}
            label="Distance from left corner"
            hint="Measured along the wall from the left corner, as seen from inside the room."
            value={o.offset}
            min={EDGE_MARGIN}
            max={Math.max(EDGE_MARGIN, +(len - o.width - EDGE_MARGIN).toFixed(2))}
            onChange={(v) => set({ offset: v })}
          />
          <MeasureInput id={`${o.id}-width`} label="Width" value={o.width} min={0.3} max={+(len - EDGE_MARGIN * 2).toFixed(2)} onChange={(v) => set({ width: v })} />
          <MeasureInput
            id={`${o.id}-height`}
            label="Height"
            value={o.height}
            min={0.3}
            max={+(room.dimensions.height - EDGE_MARGIN).toFixed(2)}
            onChange={(v) => set({ height: v })}
          />

          {o.kind === 'window' ? (
            <>
              <MeasureInput
                id={`${o.id}-sill`}
                label="Sill height"
                hint="From the floor to the bottom of the window."
                value={o.sillHeight}
                min={0}
                max={Math.max(0, +(room.dimensions.height - o.height - EDGE_MARGIN).toFixed(2))}
                onChange={(v) => set({ sillHeight: v } as Partial<Opening>)}
              />
              <Field label="Window type" htmlFor={`${o.id}-style`}>
                <Select
                  id={`${o.id}-style`}
                  value={o.style}
                  onChange={(e) => {
                    const style = e.target.value as WindowStyle
                    onChange({ ...o, style, operable: style === 'fixed' ? false : o.operable })
                  }}
                >
                  {(Object.keys(STYLE_LABEL) as WindowStyle[]).map((s) => (
                    <option key={s} value={s}>
                      {STYLE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="space-y-3 rounded-xl bg-canvas p-3">
                <Toggle
                  id={`${o.id}-operable`}
                  label="Can be opened"
                  description="Used by the ventilation and rain rules."
                  checked={o.operable}
                  onChange={(v) => onChange({ ...o, operable: v })}
                />
                <Toggle
                  id={`${o.id}-shading`}
                  label="Has shading"
                  description="Awning, curtains, blinds or external shade."
                  checked={o.hasShading}
                  onChange={(v) => onChange({ ...o, hasShading: v })}
                />
                <Toggle
                  id={`${o.id}-screen`}
                  label="Has a rain or insect screen"
                  checked={o.hasScreen}
                  onChange={(v) => onChange({ ...o, hasScreen: v })}
                />
              </div>
            </>
          ) : (
            <Field label="Leads to" htmlFor={`${o.id}-leads`}>
              <Select id={`${o.id}-leads`} value={o.leadsTo} onChange={(e) => onChange({ ...o, leadsTo: e.target.value as 'indoor' | 'outdoor' })}>
                <option value="indoor">Another indoor space</option>
                <option value="outdoor">Outdoors (balcony, yard, street)</option>
              </Select>
            </Field>
          )}

          <div className="flex justify-between pt-1">
            <button
              onClick={() => onDuplicate({ ...o, id: uid(o.kind === 'window' ? 'win' : 'door'), label: `${o.label} copy` })}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
            >
              <Copy className="size-3.5" /> Duplicate
            </button>
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-clay-700 hover:underline">
              <Trash2 className="size-3.5" /> Remove {o.kind}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
