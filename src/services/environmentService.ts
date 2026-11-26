/**
 * Environment data service.
 * In demo mode it returns synthetic values from src/data/demoEnvironment.ts.
 * In API mode it calls the FastAPI backend and maps the responses.
 */
import type { AppSettings, EnvironmentSample, HourlyOutlook, Room, SensorReading, TimeRange, WeatherData } from '@/types'
import { demoCurrentWeather, demoHistory, demoLatestReading, demoOutlook } from '@/data/demoEnvironment'
import { sleep } from '@/lib/utils'
import { API_PATHS, apiRequest } from './apiClient'
import { mapHistory, mapOutlook, mapReading, mapWeather, type ApiWeather } from './mappers'

export type DataContext = Pick<AppSettings, 'dataMode' | 'apiBaseUrl' | 'scenario'>

/** Small artificial delay so demo mode exercises loading states like a real network would. */
const DEMO_LATENCY_MS = 220

export const TIME_RANGES: Record<TimeRange, { label: string; hours: number; stepMinutes: number }> = {
  '24h': { label: '24 hours', hours: 24, stepMinutes: 30 },
  '3d': { label: '3 days', hours: 72, stepMinutes: 60 },
  '7d': { label: '7 days', hours: 168, stepMinutes: 120 },
  '14d': { label: '14 days', hours: 336, stepMinutes: 180 },
}

export async function getCurrentWeather(ctx: DataContext): Promise<WeatherData> {
  if (ctx.dataMode === 'demo') {
    await sleep(DEMO_LATENCY_MS)
    return demoCurrentWeather(ctx.scenario)
  }
  return mapWeather(await apiRequest<ApiWeather>(ctx.apiBaseUrl, API_PATHS.currentWeather))
}

export async function getOutlook(ctx: DataContext, hours = 12): Promise<HourlyOutlook[]> {
  if (ctx.dataMode === 'demo') {
    await sleep(DEMO_LATENCY_MS)
    return demoOutlook(ctx.scenario, hours)
  }
  return mapOutlook(await apiRequest<Record<string, unknown>[]>(ctx.apiBaseUrl, API_PATHS.outlook(hours)))
}

export async function getLatestReading(ctx: DataContext, room: Room): Promise<SensorReading> {
  if (ctx.dataMode === 'demo') {
    await sleep(DEMO_LATENCY_MS)
    return demoLatestReading(room, ctx.scenario)
  }
  const raw = await apiRequest<Record<string, unknown>>(ctx.apiBaseUrl, API_PATHS.latestReading(room.id))
  return mapReading(raw, room.id)
}

export async function getLatestReadings(ctx: DataContext, rooms: Room[]): Promise<Record<string, SensorReading>> {
  const entries = await Promise.all(rooms.map(async (r) => [r.id, await getLatestReading(ctx, r)] as const))
  return Object.fromEntries(entries)
}

export async function getHistory(ctx: DataContext, room: Room, range: TimeRange): Promise<EnvironmentSample[]> {
  const { hours, stepMinutes } = TIME_RANGES[range]
  if (ctx.dataMode === 'demo') {
    await sleep(DEMO_LATENCY_MS + 100)
    return demoHistory(room, hours, stepMinutes, ctx.scenario)
  }
  const raw = await apiRequest<Record<string, unknown>[]>(ctx.apiBaseUrl, API_PATHS.history(room.id, hours, stepMinutes))
  return mapHistory(raw)
}

export async function checkApiHealth(
  baseUrl: string,
): Promise<{ status: string; modelLoaded: boolean; modelVersion: string | null }> {
  const raw = await apiRequest<{ status?: string; model_loaded?: boolean; model_version?: string }>(
    baseUrl,
    API_PATHS.health,
    { timeoutMs: 5000 },
  )
  return {
    status: raw.status ?? 'unknown',
    modelLoaded: raw.model_loaded === true,
    modelVersion: raw.model_version ?? null,
  }
}
