/**
 * Household collaboration (prototype).
 *
 * Members, roles, invitations, room comments, an activity log and live presence
 * are stored in this browser's localStorage and synchronised between open tabs
 * with the `storage` event. Two people can collaborate on the same device in
 * separate tabs or windows. Syncing between different devices needs a backend;
 * the data shapes here are designed to move to the FastAPI service unchanged.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { ActivityEntry, Household, HouseholdMember, HouseholdRole, PresenceEntry, RoomComment } from '@/types'
import { useAuth } from './AuthContext'
import { STORAGE_KEYS, readJson, writeJson } from '@/services/storage'
import { DEMO_ACCOUNT, DEMO_MEMBER } from '@/services/authService'
import { uid } from '@/lib/utils'

const MAX_ACTIVITY = 300
const PRESENCE_TTL_MS = 30_000
const TAB_ID = uid('tab')

export type Permission = 'edit-rooms' | 'manage-members' | 'comment' | 'change-data-settings'

const ROLE_PERMISSIONS: Record<HouseholdRole, Permission[]> = {
  owner: ['edit-rooms', 'manage-members', 'comment', 'change-data-settings'],
  editor: ['edit-rooms', 'comment'],
  viewer: ['comment'],
}

export const ROLE_LABEL: Record<HouseholdRole, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' }
export const ROLE_DESCRIPTION: Record<HouseholdRole, string> = {
  owner: 'Manages members and data sources, and can edit everything.',
  editor: 'Can edit rooms, appliances and openings, and comment.',
  viewer: 'Can view all rooms and data, and comment.',
}

function seedHousehold(): Household {
  const now = new Date()
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
  return {
    id: uid('home'),
    name: 'Rumah Tebet',
    createdAt: ago(20),
    members: [
      { email: DEMO_ACCOUNT.email, name: DEMO_ACCOUNT.name, role: 'owner', status: 'active', invitedAt: ago(20), joinedAt: ago(20) },
      { email: DEMO_MEMBER.email, name: DEMO_MEMBER.name, role: 'editor', status: 'active', invitedAt: ago(12), joinedAt: ago(11), invitedBy: DEMO_ACCOUNT.name },
      { email: 'budi@coolnest.app', name: 'Budi Santoso', role: 'viewer', status: 'pending', invitedAt: ago(2), invitedBy: DEMO_ACCOUNT.name },
    ],
  }
}

function seedActivity(): ActivityEntry[] {
  const now = Date.now()
  const at = (h: number) => new Date(now - h * 3_600_000).toISOString()
  return [
    { id: uid('act'), at: at(2), actorName: DEMO_MEMBER.name, actorId: null, action: 'commented on', target: 'Master bedroom' },
    { id: uid('act'), at: at(26), actorName: DEMO_ACCOUNT.name, actorId: null, action: 'invited Budi Santoso as viewer' },
    { id: uid('act'), at: at(50), actorName: DEMO_MEMBER.name, actorId: null, action: 'added a ceiling fan to', target: 'Living room' },
    { id: uid('act'), at: at(260), actorName: DEMO_ACCOUNT.name, actorId: null, action: 'created the household' },
  ]
}

function seedComments(): RoomComment[] {
  return [
    {
      id: uid('cmt'),
      roomId: 'room_master',
      authorId: 'seed',
      authorName: DEMO_MEMBER.name,
      authorColor: '#2a7fc4',
      text: 'The main window gets direct sun from about 3 pm. Should we add an awning before the dry season?',
      at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    },
  ]
}

interface HouseholdValue {
  household: Household
  me: HouseholdMember | null
  role: HouseholdRole | null
  can: (p: Permission) => boolean
  activity: ActivityEntry[]
  comments: RoomComment[]
  presence: PresenceEntry[]
  log: (action: string, target?: string) => void
  renameHousehold: (name: string) => void
  invite: (email: string, name: string, role: HouseholdRole) => { ok: true; code: string } | { ok: false; error: string }
  changeRole: (email: string, role: HouseholdRole) => void
  removeMember: (email: string) => void
  leaveHousehold: () => void
  addComment: (roomId: string, text: string) => void
  deleteComment: (id: string) => void
  inviteCode: (email: string) => string
}

const HouseholdContext = createContext<HouseholdValue | null>(null)

/** Deterministic, human-friendly invite code shown to the inviter. */
function codeFor(householdId: string, email: string): string {
  let h = 0
  for (const c of householdId + email) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `NEST-${(h % 9000) + 1000}`
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const [household, setHousehold] = useState<Household>(() => readJson<Household | null>(STORAGE_KEYS.household, null) ?? seedHousehold())
  const [activity, setActivity] = useState<ActivityEntry[]>(() => readJson<ActivityEntry[] | null>(STORAGE_KEYS.activity, null) ?? seedActivity())
  const [comments, setComments] = useState<RoomComment[]>(() => readJson<RoomComment[] | null>(STORAGE_KEYS.comments, null) ?? seedComments())
  const [presence, setPresence] = useState<PresenceEntry[]>([])
  const skipWrite = useRef(false)

  // persist
  useEffect(() => {
    if (skipWrite.current) return
    writeJson(STORAGE_KEYS.household, household)
  }, [household])
  useEffect(() => {
    if (skipWrite.current) return
    writeJson(STORAGE_KEYS.activity, activity)
  }, [activity])
  useEffect(() => {
    if (skipWrite.current) return
    writeJson(STORAGE_KEYS.comments, comments)
  }, [comments])

  // cross-tab sync
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return
      skipWrite.current = true
      try {
        if (e.key === STORAGE_KEYS.household) setHousehold(JSON.parse(e.newValue))
        if (e.key === STORAGE_KEYS.activity) setActivity(JSON.parse(e.newValue))
        if (e.key === STORAGE_KEYS.comments) setComments(JSON.parse(e.newValue))
        if (e.key === STORAGE_KEYS.presence) setPresence(readPresence())
      } catch {
        /* ignore malformed */
      }
      queueMicrotask(() => {
        skipWrite.current = false
      })
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  // join the household on login: activate an invite, or join as viewer
  useEffect(() => {
    if (!user) return
    setHousehold((h) => {
      const existing = h.members.find((m) => m.email === user.email)
      if (existing?.status === 'active' && existing.userId === user.id && existing.name === user.name) return h
      const now = new Date().toISOString()
      if (existing) {
        return {
          ...h,
          members: h.members.map((m) =>
            m.email === user.email ? { ...m, status: 'active', userId: user.id, name: user.name, joinedAt: m.joinedAt ?? now } : m,
          ),
        }
      }
      const hasOwner = h.members.some((m) => m.role === 'owner' && m.status === 'active')
      return {
        ...h,
        members: [...h.members, { email: user.email, name: user.name, userId: user.id, role: hasOwner ? 'viewer' : 'owner', status: 'active', invitedAt: now, joinedAt: now }],
      }
    })
  }, [user])

  // presence heartbeat
  useEffect(() => {
    if (!user) return
    const beat = () => {
      const list = readPresence().filter((p) => p.tabId !== TAB_ID)
      list.push({ tabId: TAB_ID, userId: user.id, name: user.name, color: user.avatarColor, page: location.pathname, at: Date.now() })
      writeJson(STORAGE_KEYS.presence, list)
      setPresence(list)
    }
    beat()
    const t = setInterval(beat, 10_000)
    const leave = () => writeJson(STORAGE_KEYS.presence, readPresence().filter((p) => p.tabId !== TAB_ID))
    window.addEventListener('beforeunload', leave)
    return () => {
      clearInterval(t)
      window.removeEventListener('beforeunload', leave)
      leave()
    }
  }, [user, location.pathname])

  const me = user ? household.members.find((m) => m.email === user.email) ?? null : null
  const role = me?.status === 'active' ? me.role : null
  const can = useCallback((p: Permission) => !!role && ROLE_PERMISSIONS[role].includes(p), [role])

  const log = useCallback(
    (action: string, target?: string) => {
      const entry: ActivityEntry = { id: uid('act'), at: new Date().toISOString(), actorName: user?.name ?? 'Someone', actorId: user?.id ?? null, action, target }
      setActivity((a) => [entry, ...a].slice(0, MAX_ACTIVITY))
    },
    [user],
  )

  const renameHousehold = useCallback(
    (name: string) => {
      setHousehold((h) => ({ ...h, name }))
      log(`renamed the household to “${name}”`)
    },
    [log],
  )

  const invite: HouseholdValue['invite'] = useCallback(
    (email, name, inviteRole) => {
      const e = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Enter a valid email address.' }
      if (household.members.some((m) => m.email === e)) return { ok: false, error: 'This person is already a member or invited.' }
      const member: HouseholdMember = {
        email: e,
        name: name.trim() || e.split('@')[0],
        role: inviteRole,
        status: 'pending',
        invitedAt: new Date().toISOString(),
        invitedBy: user?.name,
      }
      setHousehold((h) => ({ ...h, members: [...h.members, member] }))
      log(`invited ${member.name} as ${ROLE_LABEL[inviteRole].toLowerCase()}`)
      return { ok: true, code: codeFor(household.id, e) }
    },
    [household, user, log],
  )

  const changeRole = useCallback(
    (email: string, next: HouseholdRole) => {
      const m = household.members.find((x) => x.email === email)
      setHousehold((h) => ({ ...h, members: h.members.map((x) => (x.email === email ? { ...x, role: next } : x)) }))
      if (m) log(`changed ${m.name}’s role to ${ROLE_LABEL[next].toLowerCase()}`)
    },
    [household, log],
  )

  const removeMember = useCallback(
    (email: string) => {
      const m = household.members.find((x) => x.email === email)
      setHousehold((h) => ({ ...h, members: h.members.filter((x) => x.email !== email) }))
      if (m) log(m.status === 'pending' ? `cancelled the invite for ${m.name}` : `removed ${m.name} from the household`)
    },
    [household, log],
  )

  const leaveHousehold = useCallback(() => {
    if (!user) return
    setHousehold((h) => ({ ...h, members: h.members.filter((x) => x.email !== user.email) }))
    log('left the household')
  }, [user, log])

  const addComment = useCallback(
    (roomId: string, text: string) => {
      if (!user || !text.trim()) return
      setComments((c) => [
        ...c,
        { id: uid('cmt'), roomId, authorId: user.id, authorName: user.name, authorColor: user.avatarColor, text: text.trim(), at: new Date().toISOString() },
      ])
    },
    [user],
  )

  const deleteComment = useCallback((id: string) => setComments((c) => c.filter((x) => x.id !== id)), [])
  const inviteCode = useCallback((email: string) => codeFor(household.id, email), [household.id])

  const livePresence = useMemo(() => presence.filter((p) => Date.now() - p.at < PRESENCE_TTL_MS), [presence])

  const value = useMemo(
    () => ({
      household,
      me,
      role,
      can,
      activity,
      comments,
      presence: livePresence,
      log,
      renameHousehold,
      invite,
      changeRole,
      removeMember,
      leaveHousehold,
      addComment,
      deleteComment,
      inviteCode,
    }),
    [household, me, role, can, activity, comments, livePresence, log, renameHousehold, invite, changeRole, removeMember, leaveHousehold, addComment, deleteComment, inviteCode],
  )
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

function readPresence(): PresenceEntry[] {
  const list = readJson<PresenceEntry[]>(STORAGE_KEYS.presence, [])
  return Array.isArray(list) ? list.filter((p) => Date.now() - p.at < PRESENCE_TTL_MS) : []
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHousehold(): HouseholdValue {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>')
  return ctx
}

/** Optional variant for components that may render outside the provider (e.g. landing). */
// eslint-disable-next-line react-refresh/only-export-components
export function useHouseholdOptional(): HouseholdValue | null {
  return useContext(HouseholdContext)
}
