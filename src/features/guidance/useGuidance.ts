import { useMemo } from 'react'
import type { Room } from '@/types'
import { useCurrentWeather, useLatestReading, useOutlook } from '@/features/environment/useEnvironment'
import { usePrediction } from '@/features/prediction/usePrediction'
import { evaluateGuidance, type GuidanceResult } from './guidanceRules'
import { useSettings } from '@/context/SettingsContext'

export function useGuidance(room: Room | null) {
  const reading = useLatestReading(room)
  const weather = useCurrentWeather()
  const outlook = useOutlook(6)
  const prediction = usePrediction(room)
  const { settings } = useSettings()
  const thresholds = settings.thresholds

  const loading = reading.loading || weather.loading || outlook.loading || prediction.loading
  const result: GuidanceResult | null = useMemo(() => {
    if (!room || loading) return null
    return evaluateGuidance({
      room,
      reading: reading.data,
      weather: weather.data,
      prediction: prediction.data,
      outlook: outlook.data,
      hour: new Date(weather.data?.timestamp ?? Date.now()).getHours(),
      thresholds,
    })
  }, [room, loading, reading.data, weather.data, prediction.data, outlook.data, thresholds])

  const errors = [reading.error, weather.error, outlook.error, prediction.error].filter(Boolean) as Error[]
  const reload = () => {
    reading.reload()
    weather.reload()
    outlook.reload()
    prediction.reload()
  }
  return { result, loading, errors, reload, reading, weather, prediction, outlook }
}
