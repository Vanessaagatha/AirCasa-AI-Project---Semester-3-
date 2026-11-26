import type { CompassDirection } from '@/types'
import { cn } from '@/lib/utils'
import { compassLabel } from './roomGeometry'

const GRID: (CompassDirection | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE']

/** 3×3 compass grid: choose which direction the room's front wall faces. */
export function OrientationPicker({ value, onChange }: { value: CompassDirection; onChange: (d: CompassDirection) => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div role="radiogroup" aria-label="Front wall orientation" className="grid w-fit shrink-0 grid-cols-3 gap-1 rounded-2xl border border-line bg-canvas p-1.5">
        {GRID.map((d, i) =>
          d ? (
            <button
              key={d}
              role="radio"
              aria-checked={value === d}
              aria-label={compassLabel[d]}
              onClick={() => onChange(d)}
              className={cn(
                'grid size-10 place-items-center rounded-xl text-xs font-semibold transition-colors',
                value === d ? 'bg-breeze-800 text-white' : 'text-ink-soft hover:bg-surface hover:text-ink',
              )}
            >
              {d}
            </button>
          ) : (
            <div key={i} className="grid size-10 place-items-center" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-6">
                <rect x="5" y="5" width="14" height="14" rx="2" className="fill-breeze-100 stroke-breeze-300" />
                <path d="M12 2.5v5" className="stroke-breeze-700" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          ),
        )}
      </div>
      <p className="text-[13px] leading-5 text-ink-muted">
        The front wall faces <span className="font-medium text-ink">{compassLabel[value].toLowerCase()}</span>. An approximate direction is
        enough; it is used for sun-exposure guidance only.
      </p>
    </div>
  )
}
