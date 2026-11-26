import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Info, KeyRound, Loader2, Users } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'
import { DEMO_ACCOUNT, DEMO_MEMBER, validateEmail, validatePassword } from '@/services/authService'
import { RoomPreview } from '@/features/rooms/RoomPreview'
import { demoRooms } from '@/data/demoRooms'

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-[#0f3a4b] p-10 text-white lg:flex lg:flex-col">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden preserveAspectRatio="none" viewBox="0 0 600 800">
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M-20 ${120 + i * 75} C 120 ${80 + i * 75}, 240 ${170 + i * 75}, 380 ${120 + i * 75} S 600 ${90 + i * 75}, 640 ${130 + i * 75}`}
              fill="none"
              stroke="#88c2d3"
              strokeWidth="1.4"
            />
          ))}
        </svg>
        <Link to="/" className="relative inline-flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect width="32" height="32" rx="9" fill="#edf6f8" />
            <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="none" stroke="#164c61" strokeWidth="2" strokeLinejoin="round" />
            <path d="M5 19.5c3-1.6 5-1.6 8 0s5 1.6 8 0 4.2-1.3 6 0" fill="none" stroke="#2f849f" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="text-[15px] font-semibold">CoolNest 3D</span>
        </Link>
        <div className="relative mt-auto mb-auto max-w-md">
          <div className="mb-8 rounded-3xl bg-white/6 p-6 ring-1 ring-white/10 backdrop-blur-sm">
            <RoomPreview room={demoRooms[1]} className="mx-auto h-48 w-full" forceTheme="light" />
          </div>
          <p className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Know how your home breathes, before the afternoon heat sets in.</p>
          <p className="mt-4 text-[15px] leading-7 text-[#b7dbe5]">
            Model each room, follow indoor and outdoor conditions, and decide together with your household when to open windows, draw the
            curtains or switch on the fan.
          </p>
        </div>
        <p className="relative text-xs text-[#88c2d3]">BINUS University CS–AI prototype. Accounts are stored only in this browser.</p>
      </aside>

      {/* Form */}
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-ink-soft hover:text-ink">
            <ArrowLeft className="size-4" /> Back to home
          </Link>
          <div className="flex items-center gap-2">
            <span className="lg:hidden">
              <Logo />
            </span>
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="pr-10" required />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl border border-clay-100 bg-clay-50 px-3 py-2 text-[13px] text-clay-700">
      {message}
    </p>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e?: FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(override?.email ?? email, override?.password ?? password, remember)
      navigate(next.startsWith('/app') ? next : '/app', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back. Log in to see your rooms and household.">
      {params.get('reason') === 'logout' && (
        <p className="mb-5 rounded-xl border border-breeze-200 bg-breeze-50 px-3 py-2 text-[13px] text-breeze-700">You have been logged out.</p>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--color-breeze-600)]" />
          Keep me logged in on this device
        </label>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !email || !password}>
          {busy && <Loader2 className="size-4 animate-spin" />} Log in
        </Button>
      </form>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <KeyRound className="size-4 text-breeze-600" /> Demo accounts
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Password <span className="font-mono">demo1234</span>. Log in as each one in a separate tab to try live collaboration.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" disabled={busy} onClick={() => submit(undefined, DEMO_ACCOUNT)}>
            Owner
          </Button>
          <Button size="sm" disabled={busy} onClick={() => submit(undefined, DEMO_MEMBER)}>
            <Users className="size-3.5" /> Household editor
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        New to CoolNest?{' '}
        <Link to={`/register${params.toString() ? `?${params}` : ''}`} className="font-medium text-breeze-700 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const { household, inviteCode } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const invited = household.members.find((m) => m.email === email.trim().toLowerCase() && m.status === 'pending')
  const pwHint = password ? validatePassword(password) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Enter your name.')
    const emailErr = validateEmail(email)
    if (emailErr) return setError(emailErr)
    const pwErr = validatePassword(password)
    if (pwErr) return setError(pwErr)
    if (password !== confirm) return setError('The passwords do not match.')
    if (code.trim() && code.trim().toUpperCase() !== inviteCode(email.trim().toLowerCase())) {
      return setError('That invite code does not match this email address. Check the code with the person who invited you.')
    }
    if (!agree) return setError('Please confirm you understand how your data is stored.')
    setBusy(true)
    try {
      await register(name, email, password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create an account" subtitle={`Join ${household.name} or start exploring CoolNest.`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="reg-name">
          <Input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Email"
          htmlFor="reg-email"
          hint={invited ? `You were invited by ${invited.invitedBy ?? 'the owner'} as ${invited.role}. You will join automatically.` : undefined}
        >
          <Input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="reg-pw" hint={pwHint ?? (password ? 'Looks good' : 'At least 8 characters with letters and numbers')}>
            <PasswordInput id="reg-pw" value={password} onChange={setPassword} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" htmlFor="reg-pw2">
            <PasswordInput id="reg-pw2" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </Field>
        </div>
        <Field label="Invite code (optional)" htmlFor="reg-code" hint="If someone invited you, enter the code they shared.">
          <Input id="reg-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="NEST-1234" className="font-mono uppercase" />
        </Field>
        <label className="flex items-start gap-2 text-[13px] leading-5 text-ink-soft">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-breeze-600)]" />
          I understand this prototype stores my account and household data only in this browser.
        </label>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Create account
        </Button>
        <p className="flex gap-2 text-xs leading-5 text-ink-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Without an invitation you join {household.name} as a viewer. The owner can change your role.
        </p>
      </form>
      <p className="mt-6 text-center text-[13px] text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-breeze-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
