/**
 * Approximate sun position and clear-sky irradiance.
 * Accuracy is roughly ±1° for sun angles and ±20 % for irradiance, which is
 * adequate for comparing scenarios but not for engineering design.
 */
import type { CompassDirection, WeatherCondition } from '@/types'
import { compassDeg } from '@/features/rooms/roomGeometry'

const RAD = Math.PI / 180

export interface SunPosition {
  /** degrees above the horizon */
  altitude: number
  /** degrees clockwise from north */
  azimuth: number
}

/** NOAA-style simplified solar position for a given instant and location. */
export function sunPosition(date: Date, latitude: number, longitude: number): SunPosition {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = (date.getTime() - start) / 86_400_000
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1)
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  const trueSolarMin = utcMinutes + eqTime + 4 * longitude
  const hourAngle = (trueSolarMin / 4 - 180) * RAD
  const lat = latitude * RAD
  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)))
  const altitude = 90 - zen / RAD
  let az = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / RAD + 180
  az = ((az % 360) + 360) % 360
  return { altitude, azimuth: az }
}

/** Fraction of clear-sky beam irradiance reaching the ground for a weather condition. */
export const CLOUD_FACTOR: Record<WeatherCondition, number> = {
  clear: 1,
  'partly-cloudy': 0.7,
  cloudy: 0.35,
  haze: 0.65,
  'light-rain': 0.25,
  rain: 0.15,
  thunderstorm: 0.1,
}

export interface Irradiance {
  /** direct normal, W/m² */
  dni: number
  /** diffuse horizontal, W/m² */
  dhi: number
  /** global horizontal, W/m² */
  ghi: number
}

/** Meinel clear-sky model with a simple cloud attenuation. */
export function irradiance(sun: SunPosition, condition: WeatherCondition): Irradiance {
  if (sun.altitude <= 0.5) return { dni: 0, dhi: 0, ghi: 0 }
  const s = Math.sin(sun.altitude * RAD)
  const airMass = 1 / Math.max(s, 0.05)
  const clearDni = 1353 * Math.pow(0.7, Math.pow(airMass, 0.678))
  const cf = CLOUD_FACTOR[condition]
  const dni = clearDni * cf
  // overcast skies are brighter diffusely than the beam reduction suggests
  const dhi = (0.1 + 0.25 * (1 - cf)) * clearDni * s
  return { dni, dhi, ghi: dni * s + dhi }
}

/** Irradiance on a vertical wall facing the given compass direction, W/m². */
export function verticalIrradiance(sun: SunPosition, irr: Irradiance, facing: CompassDirection, groundReflectance = 0.2): number {
  if (irr.ghi <= 0) return 0
  const wallAz = compassDeg(facing)
  const cosInc = Math.cos(sun.altitude * RAD) * Math.cos((sun.azimuth - wallAz) * RAD)
  const beam = irr.dni * Math.max(0, cosInc)
  const diffuse = irr.dhi * 0.5
  const reflected = irr.ghi * groundReflectance * 0.5
  return beam + diffuse + reflected
}
