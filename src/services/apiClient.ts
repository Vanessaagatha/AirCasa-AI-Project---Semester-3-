/**
 * Minimal HTTP client for the future CoolNest FastAPI backend.
 * See docs/API_CONTRACT.md for the expected endpoints and payloads.
 */

export class ApiError extends Error {
  readonly status: number | null
  readonly kind: 'network' | 'timeout' | 'http' | 'parse' | 'config'

  constructor(message: string, kind: ApiError['kind'], status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export const API_PATHS = {
  health: '/api/v1/health',
  currentWeather: '/api/v1/weather/current',
  outlook: (hours: number) => `/api/v1/weather/outlook?hours=${hours}`,
  latestReading: (roomId: string) => `/api/v1/rooms/${encodeURIComponent(roomId)}/readings/latest`,
  history: (roomId: string, hours: number, step: number) =>
    `/api/v1/rooms/${encodeURIComponent(roomId)}/history?hours=${hours}&step_minutes=${step}`,
  predict: '/api/v1/predict',
  forecasts: (roomId: string, hours: number) =>
    `/api/v1/rooms/${encodeURIComponent(roomId)}/forecasts?hours=${hours}`,
} as const

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  if (!baseUrl.trim()) throw new ApiError('No API base URL is configured. Add one in Settings.', 'config')
  const url = baseUrl.replace(/\/+$/, '') + path
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 8000)
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError(`Request to ${url} timed out.`, 'timeout')
    throw new ApiError(`Could not reach ${url}. Check that the FastAPI server is running and allows CORS.`, 'network')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { detail?: unknown }
      detail = typeof body.detail === 'string' ? `: ${body.detail}` : ''
    } catch {
      /* no JSON body */
    }
    throw new ApiError(`Server responded ${res.status}${detail}`, 'http', res.status)
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError('The server response was not valid JSON.', 'parse', res.status)
  }
}
