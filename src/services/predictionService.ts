/**
 * Prediction service — the single entry point pages use for forecasts.
 *
 * Demo mode: returns a transparent heuristic from src/data/demoEnvironment.ts,
 * always flagged `isDemo: true` so the UI shows the demo label.
 * API mode: POSTs the room to the FastAPI `/api/v1/predict` endpoint, where an
 * independently trained and tested model can be served.
 */
import type { ForecastRecord, Prediction, Room } from '@/types'
import { demoForecastHistory, demoPrediction } from '@/data/demoEnvironment'
import { sleep } from '@/lib/utils'
import { API_PATHS, ApiError, apiRequest } from './apiClient'
import { mapForecasts, mapPrediction } from './mappers'
import type { DataContext } from './environmentService'

export async function getPrediction(ctx: DataContext, room: Room): Promise<Prediction> {
  if (ctx.dataMode === 'demo') {
    await sleep(350)
    return demoPrediction(room, ctx.scenario)
  }
  try {
    const raw = await apiRequest<Record<string, unknown>>(ctx.apiBaseUrl, API_PATHS.predict, {
      method: 'POST',
      body: JSON.stringify({ room, horizon_minutes: 60 }),
      timeoutMs: 15000,
    })
    return mapPrediction(raw, room.id, room.orientation)
  } catch (e) {
    // 503 from the backend means "model not loaded" — show the unavailable state rather than a crash.
    if (e instanceof ApiError && e.status === 503) {
      return {
        roomId: room.id,
        status: 'model-unavailable',
        generatedAt: new Date().toISOString(),
        targetTime: new Date(Date.now() + 3_600_000).toISOString(),
        horizonMinutes: 60,
        currentTempC: null,
        predictedTempC: null,
        deltaC: null,
        intervalLowC: null,
        intervalHighC: null,
        inputs: {
          indoorTempC: null,
          indoorHumidityPct: null,
          outdoorTempC: null,
          outdoorHumidityPct: null,
          pm25: null,
          hourOfDay: new Date().getHours(),
          windowAreaM2: 0,
          orientation: room.orientation,
        },
        modelName: 'Unavailable',
        modelVersion: '—',
        isDemo: false,
        message: e.message,
      }
    }
    throw e
  }
}

export async function getForecastHistory(ctx: DataContext, room: Room, hours = 24): Promise<ForecastRecord[]> {
  if (ctx.dataMode === 'demo') {
    await sleep(300)
    return demoForecastHistory(room, hours, ctx.scenario)
  }
  const raw = await apiRequest<Record<string, unknown>[]>(ctx.apiBaseUrl, API_PATHS.forecasts(room.id, hours))
  return mapForecasts(raw)
}
