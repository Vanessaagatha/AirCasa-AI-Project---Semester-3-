/**
 * Prototype authentication — accounts live in this browser's localStorage.
 *
 * Passwords are never stored in plain text: they are salted and hashed with
 * PBKDF2-SHA-256 (Web Crypto). This is still NOT production security: anyone
 * with access to the browser can read or delete the account store. A real
 * deployment should move accounts to the FastAPI backend (see docs/API_CONTRACT.md).
 */
import type { PublicUser, UserAccount } from '@/types'
import { uid } from '@/lib/utils'
import { STORAGE_KEYS, readJson, writeJson } from './storage'

export const DEMO_ACCOUNT = { email: 'demo@coolnest.app', password: 'demo1234', name: 'Demo Owner' }
/** Second demo account so collaboration can be tried in two tabs. */
export const DEMO_MEMBER = { email: 'sari@coolnest.app', password: 'demo1234', name: 'Sari Wulandari' }

export const AVATAR_COLORS = ['#1b5d74', '#2a7fc4', '#b7862f', '#8460c4', '#b4533c', '#2f849f', '#5f9a6a', '#5d6b7a']

export class AuthError extends Error {}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomSalt(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return toHex(a.buffer)
}

/** PBKDF2 when Web Crypto is available (https / localhost); a SHA-256 fallback otherwise. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  if (crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120_000, hash: 'SHA-256' }, key, 256)
    return 'pbkdf2$' + toHex(bits)
  }
  return 'sha256$' + sha256Fallback(salt + ':' + password)
}

/** Minimal SHA-256 for insecure contexts (e.g. opening the dev server via a LAN IP). */
function sha256Fallback(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const bytes = Array.from(new TextEncoder().encode(message))
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff)
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < bytes.length; o += 64) {
    const w = new Array<number>(64)
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3]
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    H[0] = (H[0] + a) | 0
    H[1] = (H[1] + b) | 0
    H[2] = (H[2] + c) | 0
    H[3] = (H[3] + d) | 0
    H[4] = (H[4] + e) | 0
    H[5] = (H[5] + f) | 0
    H[6] = (H[6] + g) | 0
    H[7] = (H[7] + h) | 0
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

export function loadUsers(): UserAccount[] {
  const users = readJson<unknown>(STORAGE_KEYS.users, [])
  return Array.isArray(users) ? (users as UserAccount[]) : []
}

export function saveUsers(users: UserAccount[]): void {
  writeJson(STORAGE_KEYS.users, users)
}

export function toPublic(u: UserAccount): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, salt, ...rest } = u
  return rest
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address.'
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers.'
  return null
}

export async function createAccount(name: string, email: string, password: string): Promise<UserAccount> {
  const users = loadUsers()
  const e = normalizeEmail(email)
  if (users.some((u) => u.email === e)) throw new AuthError('An account with this email already exists on this device. Log in instead.')
  const salt = randomSalt()
  const user: UserAccount = {
    id: uid('user'),
    name: name.trim(),
    email: e,
    salt,
    passwordHash: await hashPassword(password, salt),
    avatarColor: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  return user
}

export async function verifyCredentials(email: string, password: string): Promise<UserAccount> {
  const users = loadUsers()
  const user = users.find((u) => u.email === normalizeEmail(email))
  // same message for unknown email and wrong password
  const fail = new AuthError('Email or password is incorrect.')
  if (!user) throw fail
  const hash = await hashPassword(password, user.salt)
  if (hash !== user.passwordHash) throw fail
  return user
}

/** Create the demo account the first time the app runs. */
export async function ensureDemoAccount(): Promise<void> {
  for (const a of [DEMO_ACCOUNT, DEMO_MEMBER]) {
    if (!loadUsers().some((u) => u.email === a.email)) await createAccount(a.name, a.email, a.password)
  }
}

// ---------------------------------------------------------------- session

interface Session {
  userId: string
  at: string
}

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.session) ?? localStorage.getItem(STORAGE_KEYS.session)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function writeSession(userId: string, remember: boolean): void {
  const value = JSON.stringify({ userId, at: new Date().toISOString() })
  try {
    // each tab keeps its own session, so two people can collaborate side by side
    sessionStorage.setItem(STORAGE_KEYS.session, value)
    if (remember) localStorage.setItem(STORAGE_KEYS.session, value)
    else localStorage.removeItem(STORAGE_KEYS.session)
  } catch {
    /* storage unavailable */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.session)
    localStorage.removeItem(STORAGE_KEYS.session)
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- logout redirect

let loggedOutAt = 0
/** Remember that the user chose to log out, so route guards can show the right message. */
export function markLoggedOut(): void {
  loggedOutAt = Date.now()
}
export function recentlyLoggedOut(): boolean {
  return Date.now() - loggedOutAt < 3000
}
