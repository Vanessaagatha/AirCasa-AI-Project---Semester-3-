import type { Room } from '@/types'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { getForecastHistory, getPrediction } from '@/services/predictionService'

export function usePrediction(room: Room | null) {
  const { settings, dataVersion } = useSettings()
  return useAsync(() => getPrediction(settings, room as Room), [dataVersion, room?.id, room?.updatedAt], !!room)
}

export function useForecastHistory(room: Room | null, hours = 24) {
  const { settings, dataVersion } = useSettings()
  return useAsync(
    () => getForecastHistory(settings, room as Room, hours),
    [dataVersion, room?.id, room?.updatedAt, hours],
    !!room,
  )
}
