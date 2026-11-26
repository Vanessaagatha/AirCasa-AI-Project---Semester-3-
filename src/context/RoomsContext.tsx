import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useHousehold } from './HouseholdContext'
import type { Room } from '@/types'
import { demoRooms } from '@/data/demoRooms'
import { STORAGE_KEYS, readJson, writeJson } from '@/services/storage'
import { createRoom } from '@/features/rooms/roomGeometry'
import { validateRoom } from '@/features/rooms/roomSchema'
import { uid } from '@/lib/utils'

interface RoomsValue {
  rooms: Room[]
  selectedRoom: Room | null
  selectedRoomId: string | null
  selectRoom: (id: string) => void
  addRoom: (room?: Room) => Room
  saveRoom: (room: Room) => void
  deleteRoom: (id: string) => void
  duplicateRoom: (id: string) => Room | null
  restoreDemoRooms: () => void
  storageError: string | null
}

const RoomsContext = createContext<RoomsValue | null>(null)

/** Load rooms from local storage; validate each so a corrupted entry can't break the app. */
function loadRooms(): { rooms: Room[]; error: string | null } {
  const stored = readJson<unknown>(STORAGE_KEYS.rooms, null)
  if (stored === null) return { rooms: demoRooms, error: null }
  if (!Array.isArray(stored)) return { rooms: demoRooms, error: 'Saved rooms were unreadable, so the demo rooms were loaded.' }
  const rooms: Room[] = []
  let skipped = 0
  for (const r of stored) {
    const parsed = validateRoom(r)
    if (parsed.ok) rooms.push({ ...parsed.room, updatedAt: (r as Room).updatedAt ?? parsed.room.updatedAt })
    else skipped++
  }
  return { rooms, error: skipped ? `${skipped} saved room(s) were invalid and skipped.` : null }
}

export function RoomsProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadRooms)
  const [rooms, setRooms] = useState<Room[]>(initial.rooms)
  const [storageError, setStorageError] = useState<string | null>(initial.error)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    const id = readJson<string | null>(STORAGE_KEYS.selectedRoom, null)
    return id && initial.rooms.some((r) => r.id === id) ? id : (initial.rooms[0]?.id ?? null)
  })

  const { log } = useHousehold()
  const fromOtherTab = useRef(false)

  useEffect(() => {
    if (fromOtherTab.current) {
      fromOtherTab.current = false
      return
    }
    if (!writeJson(STORAGE_KEYS.rooms, rooms)) setStorageError('Rooms could not be saved to this browser’s storage.')
  }, [rooms])

  // Live sync: rooms saved by a household member in another tab appear here.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEYS.rooms || !e.newValue) return
      fromOtherTab.current = true
      setRooms(loadRooms().rooms)
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  useEffect(() => {
    writeJson(STORAGE_KEYS.selectedRoom, selectedRoomId)
  }, [selectedRoomId])

  // keep a valid selection whenever the list changes
  useEffect(() => {
    if (!rooms.length) setSelectedRoomId(null)
    else if (!rooms.some((r) => r.id === selectedRoomId)) setSelectedRoomId(rooms[0].id)
  }, [rooms, selectedRoomId])

  const selectRoom = useCallback((id: string) => setSelectedRoomId(id), [])

  const addRoom = useCallback(
    (room?: Room) => {
      let next = room ?? createRoom(`New room ${rooms.length + 1}`)
      if (rooms.some((r) => r.id === next.id)) next = { ...next, id: uid('room') }
      setRooms((rs) => [...rs, next])
      setSelectedRoomId(next.id)
      log(room ? 'imported' : 'created', next.name)
      return next
    },
    [rooms, log],
  )

  const saveRoom = useCallback((room: Room) => {
    const stamped = { ...room, updatedAt: new Date().toISOString() }
    setRooms((rs) => (rs.some((r) => r.id === room.id) ? rs.map((r) => (r.id === room.id ? stamped : r)) : [...rs, stamped]))
    log('updated', room.name)
  }, [log])

  const deleteRoom = useCallback(
    (id: string) => {
      const r = rooms.find((x) => x.id === id)
      setRooms((rs) => rs.filter((x) => x.id !== id))
      if (r) log('deleted', r.name)
    },
    [rooms, log],
  )

  const duplicateRoom = useCallback(
    (id: string) => {
      const src = rooms.find((r) => r.id === id)
      if (!src) return null
      const now = new Date().toISOString()
      const copy: Room = {
        ...structuredClone(src),
        id: uid('room'),
        name: `${src.name} (copy)`,
        createdAt: now,
        updatedAt: now,
      }
      setRooms((rs) => [...rs, copy])
      setSelectedRoomId(copy.id)
      log('duplicated', src.name)
      return copy
    },
    [rooms, log],
  )

  const restoreDemoRooms = useCallback(() => {
    setRooms((rs) => [...rs.filter((r) => !demoRooms.some((d) => d.id === r.id)), ...structuredClone(demoRooms)])
    setStorageError(null)
  }, [])

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null

  const value = useMemo(
    () => ({
      rooms,
      selectedRoom,
      selectedRoomId,
      selectRoom,
      addRoom,
      saveRoom,
      deleteRoom,
      duplicateRoom,
      restoreDemoRooms,
      storageError,
    }),
    [rooms, selectedRoom, selectedRoomId, selectRoom, addRoom, saveRoom, deleteRoom, duplicateRoom, restoreDemoRooms, storageError],
  )
  return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRooms(): RoomsValue {
  const ctx = useContext(RoomsContext)
  if (!ctx) throw new Error('useRooms must be used inside <RoomsProvider>')
  return ctx
}
