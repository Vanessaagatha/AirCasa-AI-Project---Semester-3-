/**
 * Shared chart styling for Recharts.
 *
 * Series colours are a categorical palette validated for colour-vision
 * deficiency (lightness band, chroma floor and adjacent-pair ΔE all pass on
 * the white surface). Forecasts are additionally drawn dashed, so observed vs
 * forecast is never distinguished by colour alone.
 */
import type { ReactNode } from 'react'
import { fmtDateTime } from '@/lib/format'
import { useSettings } from '@/context/SettingsContext'

export const SERIES = {
  indoor: '#3f8a3c',
  humidity: '#2a7fc4',
  outdoor: '#c0632a',
  forecast: '#8460c4',
  pm25: '#5d6b7a',
} as const

/** Dark-surface series, re-stepped and validated against #161e1a. */
export const SERIES_DARK = {
  indoor: '#4fa34b',
  humidity: '#3f8fd2',
  outdoor: '#d2713a',
  forecast: '#9a7ed6',
  pm25: '#8996a3',
} as const

export const GRID = '#e8eef0'
export const AXIS = '#9fb0b6'

export interface ChartTheme {
  series: Record<keyof typeof SERIES, string>
  grid: string
  tick: string
  cursor: string
  refLine: string
  refLabel: string
  dotRing: string
  brushStroke: string
  brushFill: string
}

const LIGHT_THEME: ChartTheme = {
  series: SERIES,
  grid: GRID,
  tick: '#73858d',
  cursor: '#c3d1d6',
  refLine: '#b4c4ca',
  refLabel: '#73858d',
  dotRing: '#ffffff',
  brushStroke: '#88c2d3',
  brushFill: '#edf6f8',
}

const DARK_THEME: ChartTheme = {
  series: SERIES_DARK,
  grid: '#1f2e35',
  tick: '#82959c',
  cursor: '#34484f',
  refLine: '#3f545c',
  refLabel: '#82959c',
  dotRing: '#131e23',
  brushStroke: '#285c6f',
  brushFill: '#0f2229',
}

/** Chart colours for the active light/dark theme. */
// eslint-disable-next-line react-refresh/only-export-components
export function useChartTheme(): ChartTheme {
  return useSettings().resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME
}

export const axisProps = {
  stroke: AXIS,
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: '#73858d' },
} as const

export function axisPropsFor(t: ChartTheme) {
  return { ...axisProps, tick: { fontSize: 11, fill: t.tick } }
}

export function timeTick(ms: number, spanHours: number): string {
  const d = new Date(ms)
  if (spanHours <= 30) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (spanHours <= 80 ? ` ${String(d.getHours()).padStart(2, '0')}h` : '')
}

interface TooltipEntry {
  dataKey?: string | number
  name?: string | number
  value?: number | string | null | (number | string)[]
  color?: string
  stroke?: string
  strokeDasharray?: string | number
}

/** Tooltip body: values wear ink colours, a small swatch carries series identity. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  formatLabel,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: number | string
  unit: string | ((key: string) => string)
  formatLabel?: (l: number | string) => ReactNode
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value != null && !Array.isArray(p.value))
  return (
    <div className="min-w-[170px] rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-lift">
      <p className="mb-1.5 font-medium text-ink">{label != null ? (formatLabel ? formatLabel(label) : fmtDateTime(new Date(label).toISOString())) : ''}</p>
      {rows.length === 0 && <p className="text-ink-muted">No data at this time</p>}
      {rows.map((p) => {
        const u = typeof unit === 'function' ? unit(String(p.dataKey)) : unit
        const dashed = !!p.strokeDasharray
        return (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <svg width="14" height="6" aria-hidden>
                <line x1="0" y1="3" x2="14" y2="3" stroke={p.stroke ?? p.color} strokeWidth="2" strokeDasharray={dashed ? '3 2' : undefined} />
              </svg>
              {p.name}
            </span>
            <span className="tabular font-medium text-ink">
              {typeof p.value === 'number' ? p.value.toFixed(u === '%' || u === ' µg/m³' ? 0 : 1) : p.value}
              {u}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Legend rendered in HTML so it can be keyboard-operable and toggle series. */
export function SeriesLegend({
  items,
  hidden,
  onToggle,
}: {
  items: { key: string; label: string; color: string; dashed?: boolean }[]
  hidden?: Set<string>
  onToggle?: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => {
        const off = hidden?.has(it.key)
        const content = (
          <>
            <svg width="18" height="8" aria-hidden>
              <line x1="0" y1="4" x2="18" y2="4" stroke={it.color} strokeWidth="2.5" strokeDasharray={it.dashed ? '4 3' : undefined} />
            </svg>
            <span className={off ? 'text-ink-muted line-through' : 'text-ink-soft'}>{it.label}</span>
          </>
        )
        return onToggle ? (
          <button
            key={it.key}
            onClick={() => onToggle(it.key)}
            aria-pressed={!off}
            className="inline-flex items-center gap-1.5 rounded-md text-xs hover:text-ink"
            title={off ? `Show ${it.label}` : `Hide ${it.label}`}
          >
            {content}
          </button>
        ) : (
          <span key={it.key} className="inline-flex items-center gap-1.5 text-xs">
            {content}
          </span>
        )
      })}
    </div>
  )
}
