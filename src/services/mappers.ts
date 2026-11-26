/**
 * Convert FastAPI (snake_case) payloads into the app's domain types.
 * Keeping this in one place means backend field changes only touch this file.
 */
import type {
  CompassDirection,
  EnvironmentSample,
  ForecastRecord,
  HourlyOutlook,
  Prediction,
  PredictionStatus,
  ReadingStatus,
  SensorReading,
  WeatherCondition,
  WeatherData,
} from '@/types'

type Raw = Record<string, unknown>

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

const CONDITIONS: WeatherCondition[] = ['clear', 'partly-cloudy', 'cloudy', 'haze', 'light-rain', 'rain', 'thunderstorm']
const cond = (v: unknown): WeatherCondition =>
  CONDITIONS.includes(v as WeatherCondition) ? (v as WeatherCondition) : 'cloudy'

export interface ApiWeather {
  timestamp: string
  location_name?: string
  temperature_c?: number | null
  humidity_pct?: number | null
  condition?: string
  rain_probability_pct?: number | null
  wind_speed_ms?: number | null
  wind_direction_deg?: number | null
  pm25?: number | null
  pm25_source?: string
  source_label?: string
}

export function mapWeather(r: ApiWeather): WeatherData {
  return {
    timestamp: str(r.timestamp, new Date().toISOString()),
    locationName: str(r.location_name, 'Unknown location'),
    temperatureC: num(r.temperature_c),
    humidityPct: num(r.humidity_pct),
    condition: cond(r.condition),
    rainProbabilityPct: num(r.rain_probability_pct),
    windSpeedMs: num(r.wind_speed_ms),
    windDirectionDeg: num(r.wind_direction_deg),
    pm25: num(r.pm25),
    pm25Source: str(r.pm25_source, 'Regional estimate'),
    source: 'api',
    sourceLabel: str(r.source_label, 'CoolNest API'),
  }
}

export function mapOutlook(rows: Raw[]): HourlyOutlook[] {
  return rows.map((r) => ({
    timestamp: str(r.timestamp),
    temperatureC: num(r.temperature_c) ?? NaN,
    rainProbabilityPct: num(r.rain_probability_pct) ?? 0,
    condition: cond(r.condition),
  }))
}

export function mapReading(r: Raw, roomId: string): SensorReading {
  const status = (['ok', 'stale', 'missing'] as ReadingStatus[]).includes(r.status as ReadingStatus)
    ? (r.status as ReadingStatus)
    : num(r.temperature_c) == null
      ? 'missing'
      : 'ok'
  return {
    roomId: str(r.room_id, roomId),
    timestamp: str(r.timestamp, new Date().toISOString()),
    temperatureC: num(r.temperature_c),
    humidityPct: num(r.humidity_pct),
    source: 'sensor',
    sensorId: typeof r.sensor_id === 'string' ? r.sensor_id : null,
    status,
  }
}

export function mapHistory(rows: Raw[]): EnvironmentSample[] {
  return rows.map((r) => ({
    timestamp: str(r.timestamp),
    indoorTempC: num(r.indoor_temp_c),
    indoorHumidityPct: num(r.indoor_humidity_pct),
    outdoorTempC: num(r.outdoor_temp_c),
    outdoorHumidityPct: num(r.outdoor_humidity_pct),
    pm25: num(r.pm25),
  }))
}

export function mapPrediction(r: Raw, roomId: string, fallbackOrientation: CompassDirection): Prediction {
  const inputs = (r.inputs ?? {}) as Raw
  const status: PredictionStatus = (['ok', 'model-unavailable', 'insufficient-data'] as PredictionStatus[]).includes(
    r.status as PredictionStatus,
  )
    ? (r.status as PredictionStatus)
    : 'ok'
  const current = num(r.current_temp_c)
  const predicted = num(r.predicted_temp_c)
  return {
    roomId,
    status,
    generatedAt: str(r.generated_at, new Date().toISOString()),
    targetTime: str(r.target_time, new Date(Date.now() + 3_600_000).toISOString()),
    horizonMinutes: num(r.horizon_minutes) ?? 60,
    currentTempC: current,
    predictedTempC: predicted,
    deltaC: current != null && predicted != null ? Math.round((predicted - current) * 10) / 10 : null,
    intervalLowC: num(r.interval_low_c),
    intervalHighC: num(r.interval_high_c),
    inputs: {
      indoorTempC: num(inputs.indoor_temp_c),
      indoorHumidityPct: num(inputs.indoor_humidity_pct),
      outdoorTempC: num(inputs.outdoor_temp_c),
      outdoorHumidityPct: num(inputs.outdoor_humidity_pct),
      pm25: num(inputs.pm25),
      hourOfDay: num(inputs.hour_of_day) ?? new Date().getHours(),
      windowAreaM2: num(inputs.window_area_m2) ?? 0,
      orientation: (inputs.orientation as CompassDirection) ?? fallbackOrientation,
    },
    modelName: str(r.model_name, 'Unnamed model'),
    modelVersion: str(r.model_version, 'unknown'),
    isDemo: r.is_demo === true,
    message: typeof r.message === 'string' ? r.message : undefined,
  }
}

export function mapForecasts(rows: Raw[]): ForecastRecord[] {
  return rows.map((r) => ({
    issuedAt: str(r.issued_at),
    targetTime: str(r.target_time),
    predictedTempC: num(r.predicted_temp_c),
    observedTempC: num(r.observed_temp_c),
    isDemo: r.is_demo === true,
  }))
}
