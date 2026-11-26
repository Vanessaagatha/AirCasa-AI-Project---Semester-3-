/**
 * DEMO DATA GENERATOR — synthetic environment values.
 *
 * Everything in this file is invented for interface demonstration. The curves
 * are shaped to look plausible for a humid tropical city (warm nights, hot
 * early afternoons, afternoon showers in the rainy season, morning/evening
 * traffic PM2.5 peaks), but they are NOT measurements and must never be
 * presented as such. Values are deterministic per room and per hour so charts
 * stay stable between renders.
 *
 * Replace these generators with real providers in src/services when sensors,
 * weather APIs and the FastAPI backend are available.
 */
import type {
  DemoScenario,
  EnvironmentSample,
  ForecastRecord,
  HourlyOutlook,
  Prediction,
  Room,
  SensorReading,
  WeatherCondition,
  WeatherData,
} from '@/types'
import { bump, clamp, hashString, round, seeded } from '@/lib/utils'
import { wallFacing, windowArea } from '@/features/rooms/roomGeometry'

const HOUR = 3_600_000

export const DEMO_MODEL_NAME = 'Demo heuristic (persistence + trend)'
export const DEMO_MODEL_VERSION = 'demo-0.1'
export const DEMO_LOCATION = 'Jakarta (demo location)'

function hourOf(t: number): number {
  const d = new Date(t)
  return d.getHours() + d.getMinutes() / 60
}

function dayIndex(t: number): number {
  const d = new Date(t)
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate()
}

/** Rain intensity 0–1 at time t. */
function rainIntensity(t: number, scenario: DemoScenario, now: number): number {
  const day = dayIndex(t)
  const h = hourOf(t)
  const rainyDay = seeded(day * 7 + 3) > 0.45
  let r = rainyDay ? bump(h, 16 + seeded(day) * 2, 2.5) * (0.5 + 0.5 * seeded(day * 13)) : 0
  if (scenario === 'rain-incoming') {
    const hoursFromNow = (t - now) / HOUR
    r = Math.max(r, bump(hoursFromNow, 2, 2.5) * 0.9)
  }
  return clamp(r, 0, 1)
}

function outdoorTemp(t: number, scenario: DemoScenario, now: number): number {
  const day = dayIndex(t)
  const h = hourOf(t)
  const dailyMean = 28.2 + (seeded(day * 3) - 0.5) * 1.2
  const amp = 3.6 + seeded(day * 5) * 1.2
  let temp = dailyMean + amp * Math.sin((2 * Math.PI * (h - 9)) / 24)
  temp -= 3.2 * rainIntensity(t, scenario, now)
  temp += (seeded(Math.floor(t / (HOUR / 2))) - 0.5) * 0.35
  if (scenario === 'hot-afternoon' && t > now - 30 * HOUR) temp += 2.8
  return temp
}

function outdoorHumidity(t: number, scenario: DemoScenario, now: number): number {
  const temp = outdoorTemp(t, scenario, now)
  const rain = rainIntensity(t, scenario, now)
  return clamp(86 - 3 * (temp - 26) + 12 * rain, 50, 97)
}

function pm25At(t: number, scenario: DemoScenario, now: number): number {
  const day = dayIndex(t)
  const h = hourOf(t)
  const base = 30 + seeded(day * 11) * 14
  let pm = base + 16 * bump(h, 8, 2.5) + 13 * bump(h, 20, 3) - 4 * bump(h, 14, 4)
  pm *= 1 - 0.45 * rainIntensity(t, scenario, now)
  pm += (seeded(Math.floor(t / HOUR) * 17) - 0.5) * 5
  if (scenario === 'poor-air' && t > now - 48 * HOUR) pm *= 2.1
  return Math.max(4, pm)
}

interface RoomProfile {
  seed: number
  offset: number
  westSun: number
  eastSun: number
  hasAc: boolean
}

function profileOf(room: Room): RoomProfile {
  let westSun = 0
  let eastSun = 0
  for (const w of room.windows) {
    const facing = wallFacing(w.wall, room.orientation)
    const area = w.width * w.height * (w.hasShading ? 0.4 : 1)
    if (facing === 'W' || facing === 'SW' || facing === 'NW') westSun += area
    if (facing === 'E' || facing === 'SE' || facing === 'NE') eastSun += area
  }
  return {
    seed: hashString(room.id) % 100_000,
    offset: (room.floorLevel > 1 ? 0.7 : 0) + (room.dimensions.height < 2.6 ? 0.3 : 0),
    westSun: Math.min(westSun, 3),
    eastSun: Math.min(eastSun, 3),
    hasAc: room.hasAirConditioner,
  }
}

function indoorTemp(room: Room, t: number, scenario: DemoScenario, now: number): number {
  const p = profileOf(room)
  const h = hourOf(t)
  const lagged = outdoorTemp(t - 2 * HOUR, scenario, now)
  let temp = 28.4 + p.offset + 0.55 * (lagged - 28)
  temp += 0.55 * p.westSun * bump(h, 16.5, 3.5)
  temp += 0.35 * p.eastSun * bump(h, 9.5, 3)
  temp += (seeded(Math.floor(t / (HOUR / 2)) + p.seed) - 0.5) * 0.25
  if (p.hasAc) {
    const day = new Date(t).getDay()
    const workday = day >= 1 && day <= 5
    const w = workday ? bump(h, 13, 5) : 0
    temp = temp * (1 - 0.75 * w) + 25.5 * 0.75 * w
  }
  return temp
}

function indoorHumidity(room: Room, t: number, scenario: DemoScenario, now: number): number {
  const p = profileOf(room)
  const temp = indoorTemp(room, t, scenario, now)
  const out = outdoorHumidity(t, scenario, now)
  return clamp(0.5 * out + 34 - 1.8 * (temp - 28) + (seeded(Math.floor(t / HOUR) + p.seed * 3) - 0.5) * 3, 42, 88)
}

function conditionAt(t: number, scenario: DemoScenario, now: number): WeatherCondition {
  const r = rainIntensity(t, scenario, now)
  if (r > 0.7) return 'thunderstorm'
  if (r > 0.45) return 'rain'
  if (r > 0.18) return 'light-rain'
  if (pm25At(t, scenario, now) > 60) return 'haze'
  const c = seeded(Math.floor(t / (3 * HOUR)) * 5)
  if (c > 0.7) return 'cloudy'
  if (c > 0.35) return 'partly-cloudy'
  return 'clear'
}

function rainProbability(t: number, scenario: DemoScenario, now: number): number {
  let maxR = 0
  for (let k = 0; k <= 3; k += 0.5) maxR = Math.max(maxR, rainIntensity(t + k * HOUR, scenario, now))
  return clamp(Math.round(8 + maxR * 90), 0, 98)
}

/** Sensor-offline scenario: indoor data missing for the most recent hours. */
function isIndoorMissing(t: number, scenario: DemoScenario, now: number): boolean {
  return scenario === 'sensor-offline' && t > now - 3 * HOUR
}

// ---------------------------------------------------------------------------
// Public demo providers
// ---------------------------------------------------------------------------

export function demoCurrentWeather(scenario: DemoScenario, now = Date.now()): WeatherData {
  return {
    timestamp: new Date(now).toISOString(),
    locationName: DEMO_LOCATION,
    temperatureC: round(outdoorTemp(now, scenario, now)),
    humidityPct: Math.round(outdoorHumidity(now, scenario, now)),
    condition: conditionAt(now, scenario, now),
    rainProbabilityPct: rainProbability(now, scenario, now),
    windSpeedMs: round(1.5 + seeded(Math.floor(now / HOUR) * 23) * 3),
    windDirectionDeg: Math.round(200 + seeded(dayIndex(now) * 29) * 90),
    pm25: Math.round(pm25At(now, scenario, now)),
    pm25Source: 'Demo regional estimate',
    source: 'demo',
    sourceLabel: 'Demo weather generator',
  }
}

export function demoOutlook(scenario: DemoScenario, hours = 12, now = Date.now()): HourlyOutlook[] {
  const start = Math.ceil(now / HOUR) * HOUR
  return Array.from({ length: hours }, (_, i) => {
    const t = start + i * HOUR
    return {
      timestamp: new Date(t).toISOString(),
      temperatureC: round(outdoorTemp(t, scenario, now)),
      rainProbabilityPct: rainProbability(t, scenario, now),
      condition: conditionAt(t, scenario, now),
    }
  })
}

export function demoLatestReading(room: Room, scenario: DemoScenario, now = Date.now()): SensorReading {
  const t = Math.floor(now / (5 * 60_000)) * 5 * 60_000
  const missing = isIndoorMissing(t, scenario, now)
  return {
    roomId: room.id,
    timestamp: new Date(missing ? now - 3.2 * HOUR : t).toISOString(),
    temperatureC: missing ? null : round(indoorTemp(room, t, scenario, now)),
    humidityPct: missing ? null : Math.round(indoorHumidity(room, t, scenario, now)),
    source: 'demo',
    sensorId: `demo-${room.id.replace('room_', '')}`,
    status: missing ? 'missing' : 'ok',
  }
}

export function demoHistory(
  room: Room,
  hours: number,
  stepMinutes: number,
  scenario: DemoScenario,
  now = Date.now(),
): EnvironmentSample[] {
  const step = stepMinutes * 60_000
  const end = Math.floor(now / step) * step
  const count = Math.floor((hours * HOUR) / step)
  const rows: EnvironmentSample[] = []
  for (let i = count; i >= 0; i--) {
    const t = end - i * step
    const missing = isIndoorMissing(t, scenario, now)
    rows.push({
      timestamp: new Date(t).toISOString(),
      indoorTempC: missing ? null : round(indoorTemp(room, t, scenario, now), 2),
      indoorHumidityPct: missing ? null : round(indoorHumidity(room, t, scenario, now), 1),
      outdoorTempC: round(outdoorTemp(t, scenario, now), 2),
      outdoorHumidityPct: round(outdoorHumidity(t, scenario, now), 1),
      pm25: round(pm25At(t, scenario, now), 1),
    })
  }
  return rows
}

/**
 * The demo "forecast" is a transparent heuristic, not machine learning:
 *   predicted = current + 0.6 × (last-hour change) + 0.12 × (outdoor − indoor)
 * It exists only so the UI has something shaped like a forecast to display.
 */
function heuristicForecast(room: Room, t: number, scenario: DemoScenario, now: number): number {
  const cur = indoorTemp(room, t, scenario, now)
  const prev = indoorTemp(room, t - HOUR, scenario, now)
  const out = outdoorTemp(t, scenario, now)
  return cur + 0.6 * (cur - prev) + 0.12 * (out - cur)
}

export function demoPrediction(room: Room, scenario: DemoScenario, now = Date.now()): Prediction {
  const t = Math.floor(now / (5 * 60_000)) * 5 * 60_000
  const reading = demoLatestReading(room, scenario, now)
  const weather = demoCurrentWeather(scenario, now)
  const base: Omit<Prediction, 'status' | 'predictedTempC' | 'deltaC'> = {
    roomId: room.id,
    generatedAt: new Date(t).toISOString(),
    targetTime: new Date(t + HOUR).toISOString(),
    horizonMinutes: 60,
    currentTempC: reading.temperatureC,
    intervalLowC: null,
    intervalHighC: null,
    inputs: {
      indoorTempC: reading.temperatureC,
      indoorHumidityPct: reading.humidityPct,
      outdoorTempC: weather.temperatureC,
      outdoorHumidityPct: weather.humidityPct,
      pm25: weather.pm25,
      hourOfDay: new Date(t).getHours(),
      windowAreaM2: round(windowArea(room), 2),
      orientation: room.orientation,
    },
    modelName: DEMO_MODEL_NAME,
    modelVersion: DEMO_MODEL_VERSION,
    isDemo: true,
  }

  if (scenario === 'model-unavailable') {
    return {
      ...base,
      status: 'model-unavailable',
      predictedTempC: null,
      deltaC: null,
      message: 'The prediction service did not respond. Readings are still shown, but no forecast is available.',
    }
  }
  if (reading.status !== 'ok' || reading.temperatureC == null) {
    return {
      ...base,
      status: 'insufficient-data',
      predictedTempC: null,
      deltaC: null,
      message: 'No indoor reading in the last 3 hours, so a forecast cannot be produced.',
    }
  }
  const predicted = round(heuristicForecast(room, t, scenario, now))
  return {
    ...base,
    status: 'ok',
    predictedTempC: predicted,
    deltaC: round(predicted - reading.temperatureC),
  }
}

export function demoForecastHistory(
  room: Room,
  hours: number,
  scenario: DemoScenario,
  now = Date.now(),
): ForecastRecord[] {
  const end = Math.floor(now / HOUR) * HOUR
  const records: ForecastRecord[] = []
  for (let i = hours; i >= 1; i--) {
    const issued = end - i * HOUR
    const target = issued + HOUR
    const issuedMissing = isIndoorMissing(issued, scenario, now)
    const targetMissing = isIndoorMissing(target, scenario, now)
    records.push({
      issuedAt: new Date(issued).toISOString(),
      targetTime: new Date(target).toISOString(),
      predictedTempC:
        issuedMissing || (scenario === 'model-unavailable' && issued > now - 2 * HOUR)
          ? null
        : round(heuristicForecast(room, issued, scenario, now), 2),
      observedTempC: targetMissing ? null : round(indoorTemp(room, target, scenario, now), 2),
      isDemo: true,
    })
  }
  return records
}
