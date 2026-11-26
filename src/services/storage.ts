/** Safe wrappers around localStorage (private browsing / quota errors never crash the app). */

export const STORAGE_KEYS = {
  rooms: 'coolnest.rooms.v1',
  selectedRoom: 'coolnest.selectedRoom.v1',
  settings: 'coolnest.settings.v1',
  users: 'coolnest.users.v1',
  session: 'coolnest.session.v1',
  household: 'coolnest.household.v1',
  activity: 'coolnest.activity.v1',
  comments: 'coolnest.comments.v1',
  presence: 'coolnest.presence.v1',
} as const

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
