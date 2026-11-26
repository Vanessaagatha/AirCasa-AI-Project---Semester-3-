import type { WeatherCondition } from '@/types'

const NA = '—'

/** Display preferences set by SettingsProvider (kept module-level so plain formatters can use them). */
const prefs: { timeFormat: '24h' | '12h' } = { timeFormat: '24h' }
export function setDisplayPrefs(p: Partial<typeof prefs>) {
  Object.assign(prefs, p)
}
const hour12 = () => prefs.timeFormat === '12h'

export function fmtTemp(v: number | null | undefined, decimals = 1): string {
  return v == null || Number.isNaN(v) ? NA : `${v.toFixed(decimals)}°C`
}

export function fmtDelta(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return NA
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±'
  return `${sign}${Math.abs(v).toFixed(1)}°C`
}

export function fmtPct(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? NA : `${Math.round(v)}%`
}

export function fmtPm(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? NA : `${Math.round(v)} µg/m³`
}

export function fmtMetres(v: number, decimals = 2): string {
  return `${v.toFixed(decimals)} m`
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(hour12() ? 'en-US' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: hour12() })
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(),
  })
}

export function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function fmtRelative(iso: string, now = Date.now()): string {
  const diffMin = Math.round((now - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export const conditionLabel: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  haze: 'Hazy',
  'light-rain': 'Light rain',
  rain: 'Rain',
  thunderstorm: 'Thunderstorm',
}

export function windDirectionLabel(deg: number | null): string {
  if (deg == null) return NA
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

/** US EPA 24-hour PM2.5 breakpoints (2024 revision) used only as a reference scale. */
export function pm25Category(v: number | null): {
  label: string
  tone: 'good' | 'moderate' | 'sensitive' | 'unhealthy'
} {
  if (v == null) return { label: 'Unavailable', tone: 'moderate' }
  if (v <= 9) return { label: 'Good', tone: 'good' }
  if (v <= 35.4) return { label: 'Moderate', tone: 'moderate' }
  if (v <= 55.4) return { label: 'Unhealthy for sensitive groups', tone: 'sensitive' }
  return { label: 'Unhealthy', tone: 'unhealthy' }
}
