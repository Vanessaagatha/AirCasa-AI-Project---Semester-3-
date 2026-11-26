import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PublicUser, UserAccount } from '@/types'
import {
  AuthError,
  clearSession,
  createAccount,
  ensureDemoAccount,
  hashPassword,
  loadUsers,
  markLoggedOut,
  readSession,
  saveUsers,
  toPublic,
  validatePassword,
  verifyCredentials,
  writeSession,
} from '@/services/authService'
import { STORAGE_KEYS } from '@/services/storage'

interface AuthValue {
  user: PublicUser | null
  ready: boolean
  login: (email: string, password: string, remember: boolean) => Promise<PublicUser>
  register: (name: string, email: string, password: string) => Promise<PublicUser>
  logout: () => void
  updateProfile: (patch: Partial<Pick<UserAccount, 'name' | 'avatarColor' | 'avatarImage' | 'phone' | 'occupation' | 'bio'>>) => void
  changePassword: (current: string, next: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  allUsers: () => PublicUser[]
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    ensureDemoAccount()
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return
        const s = readSession()
        const u = s ? loadUsers().find((x) => x.id === s.userId) : undefined
        if (u) {
          setUser(toPublic(u))
          // carry a remembered session into this tab
          writeSession(u.id, !!localStorage.getItem(STORAGE_KEYS.session))
        }
        setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // reflect profile edits made in other tabs
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEYS.users || !user) return
      const u = loadUsers().find((x) => x.id === user.id)
      setUser(u ? toPublic(u) : null)
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [user])

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const u = await verifyCredentials(email, password)
    const users = loadUsers().map((x) => (x.id === u.id ? { ...x, lastLoginAt: new Date().toISOString() } : x))
    saveUsers(users)
    writeSession(u.id, remember)
    const pub = toPublic({ ...u, lastLoginAt: new Date().toISOString() })
    setUser(pub)
    return pub
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const pwErr = validatePassword(password)
    if (pwErr) throw new AuthError(pwErr)
    const u = await createAccount(name, email, password)
    writeSession(u.id, false)
    const pub = toPublic(u)
    setUser(pub)
    return pub
  }, [])

  const logout = useCallback(() => {
    markLoggedOut()
    clearSession()
    setUser(null)
  }, [])

  const updateProfile: AuthValue['updateProfile'] = useCallback(
    (patch) => {
      if (!user) return
      const users = loadUsers().map((u) => (u.id === user.id ? { ...u, ...patch } : u))
      saveUsers(users)
      const u = users.find((x) => x.id === user.id)
      if (u) setUser(toPublic(u))
    },
    [user],
  )

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new AuthError('Not logged in.')
      await verifyCredentials(user.email, current).catch(() => {
        throw new AuthError('Current password is incorrect.')
      })
      const err = validatePassword(next)
      if (err) throw new AuthError(err)
      const users = loadUsers()
      const target = users.find((u) => u.id === user.id)!
      const passwordHash = await hashPassword(next, target.salt)
      saveUsers(users.map((u) => (u.id === user.id ? { ...u, passwordHash } : u)))
    },
    [user],
  )

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!user) return
      await verifyCredentials(user.email, password).catch(() => {
        throw new AuthError('Password is incorrect.')
      })
      saveUsers(loadUsers().filter((u) => u.id !== user.id))
      clearSession()
      setUser(null)
    },
    [user],
  )

  const allUsers = useCallback(() => loadUsers().map(toPublic), [])

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateProfile, changePassword, deleteAccount, allUsers }),
    [user, ready, login, register, logout, updateProfile, changePassword, deleteAccount, allUsers],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
