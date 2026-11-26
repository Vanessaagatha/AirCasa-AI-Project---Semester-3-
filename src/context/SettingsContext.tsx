import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppSettings } from '@/types'
import { STORAGE_KEYS, readJson, writeJson } from '@/services/storage'
import { GUIDANCE_THRESHOLDS } from '@/features/guidance/guidanceRules'
import { setDisplayPrefs } from '@/lib/format'

export const DEFAULT_SETTINGS: AppSettings = {
  dataMode: 'demo',
  apiBaseUrl: 'http://localhost:8000',
  scenario: 'typical',
  home: {
    homeName: 'My home',
    city: 'Jakarta',
    district: 'Tebet',
    homeType: 'townhouse',
    floors: 2,
  },
  theme: 'system',
  reduceMotion: false,
  compactLayout: false,
  notifications: {
    heatAlerts: true,
    rainAlerts: true,
    airQualityAlerts: true,
    dataAlerts: true,
    browserNotifications: false,
  },
  thresholds: { ...GUIDANCE_THRESHOLDS },
  simulation: {
    wallUValue: 2.3,
    roofUValue: 2.0,
    windowUValue: 5.8,
    windowSHGC: 0.7,
    shadingFactor: 0.4,
    infiltrationACH: 1.0,
    thermalMassKJPerM2K: 110,
    urbanWindFactor: 0.35,
    dischargeCoefficient: 0.61,
    occupants: 2,
  },
  region: {
    latitude: -6.23,
    longitude: 106.85,
    utcOffsetHours: 7,
    timeFormat: '24h',
  },
  autoRefreshSec: 0,
}

interface SettingsValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  updateHome: (patch: Partial<AppSettings['home']>) => void
  updateSection: <K extends 'notifications' | 'thresholds' | 'simulation' | 'region'>(key: K, patch: Partial<AppSettings[K]>) => void
  resetSettings: () => void
  resetSection: (key: 'thresholds' | 'simulation' | 'notifications' | 'region') => void
  /** Increments whenever data-affecting settings change; hooks use it to refetch. */
  dataVersion: number
  refreshData: () => void
  /** The theme actually applied after resolving "system". */
  resolvedTheme: 'light' | 'dark'
}

const SettingsContext = createContext<SettingsValue | null>(null)

function loadSettings(): AppSettings {
  const s = readJson<Partial<AppSettings>>(STORAGE_KEYS.settings, {})
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    home: { ...DEFAULT_SETTINGS.home, ...s.home },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...s.notifications },
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...s.thresholds },
    simulation: { ...DEFAULT_SETTINGS.simulation, ...s.simulation },
    region: { ...DEFAULT_SETTINGS.region, ...s.region },
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [dataVersion, setDataVersion] = useState(0)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // keep display preferences for formatters in sync before children render
  setDisplayPrefs({ timeFormat: settings.region.timeFormat })

  useEffect(() => {
    writeJson(STORAGE_KEYS.settings, settings)
  }, [settings])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolvedTheme: 'light' | 'dark' = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
    root.classList.toggle('reduce-motion', settings.reduceMotion)
    root.classList.toggle('compact', settings.compactLayout)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#0c1418' : '#f3f7f8')
  }, [resolvedTheme, settings.reduceMotion, settings.compactLayout])

  // optional automatic refresh
  useEffect(() => {
    if (!settings.autoRefreshSec) return
    const t = setInterval(() => setDataVersion((v) => v + 1), settings.autoRefreshSec * 1000)
    return () => clearInterval(t)
  }, [settings.autoRefreshSec])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
    if ('dataMode' in patch || 'scenario' in patch || 'apiBaseUrl' in patch) setDataVersion((v) => v + 1)
  }, [])

  const updateHome = useCallback((patch: Partial<AppSettings['home']>) => {
    setSettings((s) => ({ ...s, home: { ...s.home, ...patch } }))
  }, [])

  const updateSection = useCallback(
    <K extends 'notifications' | 'thresholds' | 'simulation' | 'region'>(key: K, patch: Partial<AppSettings[K]>) => {
      setSettings((s) => ({ ...s, [key]: { ...s[key], ...patch } }))
    },
    [],
  )

  const resetSection = useCallback((key: 'thresholds' | 'simulation' | 'notifications' | 'region') => {
    setSettings((s) => ({ ...s, [key]: { ...DEFAULT_SETTINGS[key] } }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setDataVersion((v) => v + 1)
  }, [])

  const refreshData = useCallback(() => setDataVersion((v) => v + 1), [])

  const value = useMemo(
    () => ({ settings, updateSettings, updateHome, updateSection, resetSettings, resetSection, dataVersion, refreshData, resolvedTheme }),
    [settings, updateSettings, updateHome, updateSection, resetSettings, resetSection, dataVersion, refreshData, resolvedTheme],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
