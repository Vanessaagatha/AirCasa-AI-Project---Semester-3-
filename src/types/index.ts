/**
 * CoolNest 3D — shared domain types.
 *
 * These interfaces are the contract between the UI and the data layer.
 * Demo providers (src/data) and the future FastAPI client (src/services)
 * both produce these shapes, so pages never need to know where data came from.
 */

// ---------------------------------------------------------------------------
// Rooms & openings
// ---------------------------------------------------------------------------

/** Compass directions used for approximate room orientation. */
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

/**
 * Walls are named relative to the room itself.
 * The "front" wall faces the compass direction given by `Room.orientation`.
 * Front/back walls span the room length; left/right walls span the room width.
 */
export type WallSide = 'front' | 'right' | 'back' | 'left'

export type RoomType = 'bedroom' | 'living' | 'kitchen' | 'office' | 'other'

export interface RoomDimensions {
  /** metres, along the front/back walls */
  length: number
  /** metres, along the left/right walls */
  width: number
  /** metres, floor to ceiling */
  height: number
}

interface OpeningBase {
  id: string
  label: string
  wall: WallSide
  /**
   * Distance in metres from the left end of the wall (as seen from inside the room)
   * to the left edge of the opening.
   */
  offset: number
  /** metres */
  width: number
  /** metres */
  height: number
}

export type WindowStyle = 'sliding' | 'casement' | 'louvre' | 'fixed'

export interface WindowOpening extends OpeningBase {
  kind: 'window'
  /** metres from floor to bottom of window */
  sillHeight: number
  style: WindowStyle
  /** Can this window be opened for ventilation? */
  operable: boolean
  /** Has external shading, curtains or blinds */
  hasShading: boolean
  /** Has an insect / rain screen */
  hasScreen: boolean
}

export interface DoorOpening extends OpeningBase {
  kind: 'door'
  /** Whether the door leads outside (balcony, yard) or to another indoor space */
  leadsTo: 'outdoor' | 'indoor'
}

/** Aliases matching the names used in the project brief. */
export type Window = WindowOpening
export type Door = DoorOpening
export type Opening = WindowOpening | DoorOpening

export interface Room {
  schemaVersion: 1
  id: string
  name: string
  type: RoomType
  /** 1 = ground floor */
  floorLevel: number
  dimensions: RoomDimensions
  orientation: CompassDirection
  windows: WindowOpening[]
  doors: DoorOpening[]
  hasCeilingFan: boolean
  hasAirConditioner: boolean
  /** Heat-producing and cooling appliances placed in the room (optional for older files). */
  appliances?: Appliance[]
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Appliances
// ---------------------------------------------------------------------------

export type ApplianceType =
  | 'ceiling-fan'
  | 'standing-fan'
  | 'air-conditioner'
  | 'refrigerator'
  | 'television'
  | 'computer'
  | 'lighting'
  | 'rice-cooker'
  | 'water-dispenser'
  | 'stove'
  | 'iron'
  | 'other'

export interface Appliance {
  id: string
  type: ApplianceType
  label: string
  /** rated electrical power, W */
  powerW: number
  /** typical hours of use; [start, end) in local hours, end may wrap past midnight */
  onFrom: number
  onTo: number
  /** position of the appliance centre on the floor plan, metres from room centre */
  x: number
  z: number
  /** rotation about the vertical axis, degrees */
  rotationDeg: number
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Where a value came from. Shown in the UI next to every number. */
export type DataSourceKind = 'demo' | 'sensor' | 'api' | 'manual'

export type ReadingStatus = 'ok' | 'stale' | 'missing'

export interface SensorReading {
  roomId: string
  /** ISO timestamp */
  timestamp: string
  temperatureC: number | null
  humidityPct: number | null
  source: DataSourceKind
  sensorId: string | null
  status: ReadingStatus
}

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'haze'
  | 'light-rain'
  | 'rain'
  | 'thunderstorm'

export interface WeatherData {
  timestamp: string
  locationName: string
  temperatureC: number | null
  humidityPct: number | null
  condition: WeatherCondition
  /** probability of rain within the next 3 hours, 0–100 */
  rainProbabilityPct: number | null
  windSpeedMs: number | null
  /** degrees, direction wind is coming from */
  windDirectionDeg: number | null
  /** Regional outdoor PM2.5 estimate in µg/m³ (NOT indoor PM2.5) */
  pm25: number | null
  pm25Source: string
  source: DataSourceKind
  sourceLabel: string
}

export interface HourlyOutlook {
  timestamp: string
  temperatureC: number
  rainProbabilityPct: number
  condition: WeatherCondition
}

/** A single row of combined history used by the analytics charts. */
export interface EnvironmentSample {
  timestamp: string
  indoorTempC: number | null
  indoorHumidityPct: number | null
  outdoorTempC: number | null
  outdoorHumidityPct: number | null
  pm25: number | null
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

export type PredictionStatus = 'ok' | 'model-unavailable' | 'insufficient-data'

export interface PredictionInputs {
  indoorTempC: number | null
  indoorHumidityPct: number | null
  outdoorTempC: number | null
  outdoorHumidityPct: number | null
  pm25: number | null
  hourOfDay: number
  windowAreaM2: number
  orientation: CompassDirection
}

export interface Prediction {
  roomId: string
  status: PredictionStatus
  /** when the forecast was produced */
  generatedAt: string
  /** the time the forecast refers to */
  targetTime: string
  horizonMinutes: number
  currentTempC: number | null
  predictedTempC: number | null
  deltaC: number | null
  /** optional interval if the model provides one */
  intervalLowC: number | null
  intervalHighC: number | null
  inputs: PredictionInputs
  modelName: string
  modelVersion: string
  /** true for demo-generated values. The UI must label these as not real predictions. */
  isDemo: boolean
  message?: string
}

/** Past forecast paired with what was later observed. */
export interface ForecastRecord {
  /** time the forecast was made */
  issuedAt: string
  /** time the forecast refers to (issuedAt + horizon) */
  targetTime: string
  predictedTempC: number | null
  observedTempC: number | null
  isDemo: boolean
}

// ---------------------------------------------------------------------------
// Guidance
// ---------------------------------------------------------------------------

export type RecommendationSeverity = 'info' | 'consider' | 'caution'

export type RecommendationCategory =
  | 'heat'
  | 'ventilation'
  | 'air-quality'
  | 'rain'
  | 'shading'
  | 'humidity'
  | 'data-quality'

export interface SupportingDatum {
  label: string
  value: string
  /** optional data source label */
  source?: string
}

export interface Recommendation {
  id: string
  /** identifier of the transparent rule that produced it */
  ruleId: string
  title: string
  category: RecommendationCategory
  severity: RecommendationSeverity
  /** 1. Detected condition */
  detectedCondition: string
  /** 2. Suggested consideration */
  suggestion: string
  /** 3. Why it may matter */
  rationale: string
  /** 4. Supporting data */
  supportingData: SupportingDatum[]
  /** 5. Uncertainty or limitations */
  limitations: string
  /** human-readable description of the rule's trigger */
  ruleDescription: string
}

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------

export type DataMode = 'demo' | 'api'

/** Demo scenarios let presenters show edge cases without real hardware. */
export type DemoScenario =
  | 'typical'
  | 'hot-afternoon'
  | 'rain-incoming'
  | 'poor-air'
  | 'sensor-offline'
  | 'model-unavailable'

export interface HomeInfo {
  homeName: string
  city: string
  district: string
  homeType: 'landed-house' | 'townhouse' | 'apartment' | 'kos'
  floors: number
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface NotificationSettings {
  heatAlerts: boolean
  rainAlerts: boolean
  airQualityAlerts: boolean
  dataAlerts: boolean
  browserNotifications: boolean
}

export interface GuidanceThresholds {
  warmIndoorC: number
  hotIndoorC: number
  heatIndexExtremeCautionC: number
  heatIndexDangerC: number
  ventilationCoolerByC: number
  pm25CautionUgm3: number
  pm25UnhealthyUgm3: number
  rainProbabilityPct: number
  highHumidityPct: number
  fanUsefulFromC: number
}

/** Editable physical assumptions for the simplified simulation. */
export interface SimulationAssumptions {
  wallUValue: number
  roofUValue: number
  windowUValue: number
  windowSHGC: number
  shadingFactor: number
  infiltrationACH: number
  thermalMassKJPerM2K: number
  urbanWindFactor: number
  dischargeCoefficient: number
  occupants: number
}

export interface RegionSettings {
  latitude: number
  longitude: number
  utcOffsetHours: number
  timeFormat: '24h' | '12h'
}

export interface AppSettings {
  dataMode: DataMode
  apiBaseUrl: string
  scenario: DemoScenario
  home: HomeInfo
  theme: ThemePreference
  reduceMotion: boolean
  compactLayout: boolean
  notifications: NotificationSettings
  thresholds: GuidanceThresholds
  simulation: SimulationAssumptions
  region: RegionSettings
  /** seconds between automatic data refreshes; 0 = off */
  autoRefreshSec: number
}

// ---------------------------------------------------------------------------
// Users & collaboration (prototype: stored locally in the browser)
// ---------------------------------------------------------------------------

export type HouseholdRole = 'owner' | 'editor' | 'viewer'

export interface UserAccount {
  id: string
  name: string
  email: string
  passwordHash: string
  salt: string
  avatarColor: string
  avatarImage?: string
  phone?: string
  occupation?: string
  bio?: string
  createdAt: string
  lastLoginAt?: string
}

export type PublicUser = Omit<UserAccount, 'passwordHash' | 'salt'>

export interface HouseholdMember {
  email: string
  name: string
  role: HouseholdRole
  status: 'active' | 'pending'
  userId?: string
  invitedBy?: string
  joinedAt?: string
  invitedAt: string
}

export interface Household {
  id: string
  name: string
  members: HouseholdMember[]
  createdAt: string
}

export interface ActivityEntry {
  id: string
  at: string
  actorName: string
  actorId: string | null
  action: string
  target?: string
}

export interface RoomComment {
  id: string
  roomId: string
  authorId: string
  authorName: string
  authorColor: string
  text: string
  at: string
}

export interface PresenceEntry {
  tabId: string
  userId: string
  name: string
  color: string
  page: string
  at: number
}

export type TimeRange = '24h' | '3d' | '7d' | '14d'
