import type { Room, TimeRange } from '@/types'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { getCurrentWeather, getHistory, getLatestReading, getLatestReadings, getOutlook } from '@/services/environmentService'

/** Data hooks: pages use these and never call services directly. */

export function useCurrentWeather() {
  const { settings, dataVersion } = useSettings()
  return useAsync(() => getCurrentWeather(settings), [dataVersion])
}

export function useOutlook(hours = 12) {
  const { settings, dataVersion } = useSettings()
  return useAsync(() => getOutlook(settings, hours), [dataVersion, hours])
}

export function useLatestReading(room: Room | null) {
  const { settings, dataVersion } = useSettings()
  return useAsync(() => getLatestReading(settings, room as Room), [dataVersion, room?.id, room?.updatedAt], !!room)
}

export function useLatestReadings(rooms: Room[]) {
  const { settings, dataVersion } = useSettings()
  const key = rooms.map((r) => r.id + r.updatedAt).join('|')
  return useAsync(() => getLatestReadings(settings, rooms), [dataVersion, key])
}

export function useHistory(room: Room | null, range: TimeRange) {
  const { settings, dataVersion } = useSettings()
  return useAsync(() => getHistory(settings, room as Room, range), [dataVersion, room?.id, room?.updatedAt, range], !!room)
}
