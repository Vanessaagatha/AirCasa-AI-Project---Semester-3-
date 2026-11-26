import { ChevronDown, Copy, Trash2 } from 'lucide-react'
import type { Appliance, Room } from '@/types'
import { Field, Input, MeasureInput, Select } from '@/components/ui'
import { cn, uid } from '@/lib/utils'
import { APPLIANCE_CATALOG, dailyKWh, fitAppliance, heatGainAt, hoursPerDay } from './appliances'
import { ApplianceIcon } from './ApplianceIcon'

const HOURS = Array.from({ length: 25 }, (_, h) => h)

export function ApplianceEditor({
  appliance: a,
  room,
  expanded,
  disabled,
  onToggle,
  onChange,
  onDelete,
  onDuplicate,
}: {
  appliance: Appliance
  room: Room
  expanded: boolean
  disabled?: boolean
  onToggle: () => void
  onChange: (a: Appliance) => void
  onDelete: () => void
  onDuplicate: (a: Appliance) => void
}) {
  const s = APPLIANCE_CATALOG[a.type]
  const set = (patch: Partial<Appliance>) => onChange(fitAppliance({ ...a, ...patch }, room.dimensions))
  const { length: L, width: W } = room.dimensions
  const peakHeat = Math.max(...Array.from({ length: 24 }, (_, h) => heatGainAt(a, h)))

  return (
    <div className={cn('rounded-xl border transition-colors', expanded ? 'border-ochre-300 bg-surface shadow-card' : 'border-line bg-surface hover:border-breeze-300')}>
      <button onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', a.type === 'air-conditioner' ? 'bg-mist-100 text-mist-700' : 'bg-linen-100 text-linen-500')}>
          <ApplianceIcon type={a.type} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{a.label}</span>
          <span className="tabular block text-xs text-ink-muted">
            {a.powerW} W, {hoursPerDay(a)} h/day, about {dailyKWh(a).toFixed(1)} kWh/day
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-muted transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <fieldset disabled={disabled} className="space-y-4 border-t border-line px-3.5 pt-4 pb-4 disabled:opacity-70">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" htmlFor={`${a.id}-label`}>
              <Input id={`${a.id}-label`} value={a.label} onChange={(e) => onChange({ ...a, label: e.target.value })} />
            </Field>
            <Field label="Rated power" htmlFor={`${a.id}-power`} hint="From the appliance label">
              <div className="relative">
                <Input id={`${a.id}-power`} type="number" min={0} max={10000} value={a.powerW} onChange={(e) => set({ powerW: Number(e.target.value) || 0 })} className="tabular pr-8 text-right" />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-muted">W</span>
              </div>
            </Field>
            <Field label="Usually on from" htmlFor={`${a.id}-from`}>
              <Select id={`${a.id}-from`} value={a.onFrom} onChange={(e) => set({ onFrom: Number(e.target.value) })}>
                {HOURS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Until" htmlFor={`${a.id}-to`}>
              <Select id={`${a.id}-to`} value={a.onTo} onChange={(e) => set({ onTo: Number(e.target.value) })}>
                {HOURS.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h === 24 ? '24:00 (all day)' : `${String(h).padStart(2, '0')}:00`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {s.mount !== 'ceiling' || a.type === 'lighting' || a.type === 'ceiling-fan' ? (
            <>
              <MeasureInput id={`${a.id}-x`} label="Position along the length" value={a.x} min={-L / 2} max={L / 2} onChange={(v) => set({ x: v })} hint="0 is the centre of the room" />
              <MeasureInput id={`${a.id}-z`} label="Position along the width" value={a.z} min={-W / 2} max={W / 2} onChange={(v) => set({ z: v })} />
            </>
          ) : null}
          <MeasureInput id={`${a.id}-rot`} label="Rotation" unit="°" step={15} value={a.rotationDeg} min={0} max={345} onChange={(v) => set({ rotationDeg: v })} />

          <dl className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-3 text-xs">
            <div>
              <dt className="text-ink-muted">Heat released when on</dt>
              <dd className="tabular font-medium">{a.type === 'air-conditioner' ? 'Removes heat (≈ ' + (s.coolingW ?? 0) + ' W cooling)' : `≈ ${Math.round(peakHeat)} W`}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Assumed duty cycle</dt>
              <dd className="tabular font-medium">{Math.round(s.dutyCycle * 100)}% of rated power</dd>
            </div>
          </dl>

          <div className="flex justify-between pt-1">
            <button onClick={() => onDuplicate({ ...a, id: uid('appl'), label: `${a.label} copy`, x: a.x + 0.3 })} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink">
              <Copy className="size-3.5" /> Duplicate
            </button>
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-clay-700 hover:underline">
              <Trash2 className="size-3.5" /> Remove appliance
            </button>
          </div>
        </fieldset>
      )}
    </div>
  )
}
