import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, KeyRound, LogOut, Palette, Trash2, UserRound } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { ThemeSwitch } from '@/components/ThemeToggle'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, useHousehold } from '@/context/HouseholdContext'
import { AVATAR_COLORS } from '@/services/authService'
import { fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Downscale an uploaded photo to a small square JPEG data URL (keeps localStorage small). */
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const size = 160
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const s = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    return c.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function Saved({ show }: { show: boolean }) {
  return show ? (
    <span className="inline-flex items-center gap-1 text-xs text-breeze-700">
      <Check className="size-3.5" /> Saved
    </span>
  ) : null
}

export default function ProfilePage() {
  const { user, updateProfile, changePassword, deleteAccount, logout } = useAuth()
  const { role, household, comments, activity } = useHousehold()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', occupation: user?.occupation ?? '', bio: user?.bio ?? '' })
  const [saved, setSaved] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [delPw, setDelPw] = useState('')
  const [delErr, setDelErr] = useState<string | null>(null)
  const [photoErr, setPhotoErr] = useState<string | null>(null)

  if (!user) return null
  const myComments = comments.filter((c) => c.authorId === user.id).length
  const myEdits = activity.filter((a) => a.actorId === user.id).length

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    updateProfile({ name: form.name.trim(), phone: form.phone.trim(), occupation: form.occupation.trim(), bio: form.bio.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: 'The new passwords do not match.' })
    try {
      await changePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      setPwMsg({ ok: true, text: 'Password updated.' })
    } catch (err) {
      setPwMsg({ ok: false, text: (err as Error).message })
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your details as other household members see them."
        actions={
          <Button
            size="sm"
            icon={<LogOut className="size-3.5" />}
            onClick={() => {
              logout()
            }}
          >
            Log out
          </Button>
        }
      />

      {/* Identity banner */}
      <Card className="mb-4 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-breeze-800 to-breeze-500" aria-hidden />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <div className="relative -mt-10">
            <Avatar name={user.name} color={user.avatarColor} image={user.avatarImage} size="lg" className="ring-4 ring-surface" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-card hover:text-ink"
              aria-label="Upload a profile photo"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                if (f.size > 8_000_000) return setPhotoErr('Choose an image under 8 MB.')
                try {
                  updateProfile({ avatarImage: await toAvatarDataUrl(f) })
                  setPhotoErr(null)
                } catch {
                  setPhotoErr('That file could not be read as an image.')
                }
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-[-0.01em]">{user.name}</h2>
            <p className="text-[13px] text-ink-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="sage">{role ? `${ROLE_LABEL[role]}, ${household.name}` : 'Not in a household'}</Badge>
              {user.occupation && <Badge>{user.occupation}</Badge>}
            </div>
            {photoErr && <p className="mt-2 text-xs text-clay-700">{photoErr}</p>}
          </div>
          <dl className="grid grid-cols-3 gap-6 text-right">
            <div>
              <dd className="tabular text-xl font-semibold">{myEdits}</dd>
              <dt className="text-xs text-ink-muted">Actions</dt>
            </div>
            <div>
              <dd className="tabular text-xl font-semibold">{myComments}</dd>
              <dt className="text-xs text-ink-muted">Comments</dt>
            </div>
            <div>
              <dd className="text-[13px] font-semibold">{fmtDateTime(user.createdAt).split(',')[0]}</dd>
              <dt className="text-xs text-ink-muted">Member since</dt>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Personal details" icon={<UserRound className="size-4" />} action={<Saved show={saved} />} />
          <form onSubmit={saveProfile} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="pf-name">
              <Input id="pf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Email" htmlFor="pf-email" hint="Email is your login and cannot be changed here.">
              <Input id="pf-email" value={user.email} disabled />
            </Field>
            <Field label="Phone (optional)" htmlFor="pf-phone">
              <Input id="pf-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+62" />
            </Field>
            <Field label="Occupation (optional)" htmlFor="pf-occ">
              <Input id="pf-occ" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="e.g. Works from home" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="About you (optional)" htmlFor="pf-bio" hint="For example, who is sensitive to heat in your home.">
                <textarea
                  id="pf-bio"
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-breeze-500 focus:ring-2 focus:ring-breeze-200 focus:outline-none"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary">
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Avatar colour" icon={<Palette className="size-4" />} description="Used when you have no photo." />
            <div className="flex flex-wrap items-center gap-2 p-5 pt-4">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateProfile({ avatarColor: c })}
                  className={cn('size-8 rounded-full ring-offset-2 ring-offset-surface transition', user.avatarColor === c && 'ring-2 ring-breeze-500')}
                  style={{ backgroundColor: c }}
                  aria-label={`Use colour ${c}`}
                  aria-pressed={user.avatarColor === c}
                />
              ))}
              {user.avatarImage && (
                <Button size="sm" variant="ghost" onClick={() => updateProfile({ avatarImage: undefined })}>
                  Remove photo
                </Button>
              )}
            </div>
            <div className="border-t border-line px-5 py-4">
              <p className="mb-2 text-[13px] font-medium text-ink-soft">Appearance</p>
              <ThemeSwitch />
            </div>
          </Card>

          <Card>
            <CardHeader title="Change password" icon={<KeyRound className="size-4" />} />
            <form onSubmit={savePassword} className="space-y-3 p-5 pt-4">
              <Field label="Current password" htmlFor="pw-cur">
                <Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </Field>
              <Field label="New password" htmlFor="pw-new" hint="At least 8 characters with letters and numbers.">
                <Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Field label="Confirm new password" htmlFor="pw-conf">
                <Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
              {pwMsg && <p className={cn('text-[13px]', pwMsg.ok ? 'text-breeze-700' : 'text-clay-700')}>{pwMsg.text}</p>}
              <Button type="submit" disabled={!pw.current || !pw.next}>
                Update password
              </Button>
            </form>
          </Card>

          <Card className="border-clay-100">
            <CardHeader title="Delete account" icon={<Trash2 className="size-4" />} description="Removes your login from this device. Rooms stay with the household." />
            <form
              className="flex flex-wrap items-end gap-2 p-5 pt-4"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!window.confirm('Delete your account permanently?')) return
                try {
                  await deleteAccount(delPw)
                  navigate('/login', { replace: true })
                } catch (err) {
                  setDelErr((err as Error).message)
                }
              }}
            >
              <div className="min-w-[200px] flex-1">
                <Field label="Confirm with your password" htmlFor="del-pw">
                  <Input id="del-pw" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
                </Field>
              </div>
              <Button type="submit" variant="danger" disabled={!delPw}>
                Delete account
              </Button>
              {delErr && <p className="w-full text-[13px] text-clay-700">{delErr}</p>}
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
