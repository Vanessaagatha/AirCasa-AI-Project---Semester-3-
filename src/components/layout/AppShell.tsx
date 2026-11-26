import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, FlaskConical, LogOut, Menu, Server, Settings, UserRound, Users, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar } from '@/components/Avatar'
import { ThemeSwitch, ThemeToggle } from '@/components/ThemeToggle'
import { NAV_GROUPS, NAV_ITEMS } from './navigation'
import { useSettings } from '@/context/SettingsContext'
import { useRooms } from '@/context/RoomsContext'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABEL, useHousehold } from '@/context/HouseholdContext'
import { cn } from '@/lib/utils'
import { scenarioLabel } from '@/data/scenarios'

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-3 text-[11px] font-medium text-ink-muted">{g.label}</p>
          <div className="space-y-0.5">
            {g.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/app'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                    isActive ? 'bg-breeze-100 font-medium text-breeze-700' : 'text-ink-soft hover:bg-breeze-50 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-breeze-500" aria-hidden />}
                    <item.icon className={cn('size-[18px]', isActive ? 'text-breeze-600' : 'text-ink-muted group-hover:text-ink-soft')} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function DataModeCard() {
  const { settings } = useSettings()
  const demo = settings.dataMode === 'demo'
  return (
    <Link
      to="/app/settings/data"
      className={cn(
        'block rounded-xl border p-3 text-xs leading-5 transition-colors',
        demo ? 'border-ochre-100 bg-ochre-50 text-ochre-700 hover:border-ochre-300' : 'border-mist-100 bg-mist-50 text-mist-700',
      )}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        {demo ? <FlaskConical className="size-3.5" /> : <Server className="size-3.5" />}
        {demo ? 'Demo mode' : 'API mode'}
      </span>
      <span className="mt-0.5 block opacity-90">{demo ? `Synthetic data, scenario: ${scenarioLabel[settings.scenario].toLowerCase()}.` : settings.apiBaseUrl}</span>
    </Link>
  )
}

function RoomSwitcher() {
  const { rooms, selectedRoomId, selectRoom } = useRooms()
  if (!rooms.length) return null
  return (
    <label className="hidden items-center gap-2 text-[13px] text-ink-muted sm:flex">
      <span className="hidden md:inline">Room</span>
      <select
        value={selectedRoomId ?? ''}
        onChange={(e) => selectRoom(e.target.value)}
        className="h-9 max-w-[180px] rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink focus:border-breeze-500 focus:outline-none"
        aria-label="Selected room"
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Avatars of household members active in other tabs right now. */
function PresenceStack() {
  const { presence } = useHousehold()
  const { user } = useAuth()
  const others = presence.filter((p) => p.userId !== user?.id)
  const unique = Array.from(new Map(others.map((p) => [p.userId, p])).values())
  if (!unique.length) return null
  const pageName = (path: string) => NAV_ITEMS.find((n) => (n.to === '/app' ? path === '/app' : path.startsWith(n.to)))?.label ?? 'the app'
  return (
    <Link to="/app/household" className="hidden items-center gap-2 rounded-xl px-2 py-1 hover:bg-breeze-50 md:flex" title="Household members online now">
      <span className="flex -space-x-2">
        {unique.slice(0, 3).map((p) => (
          <span key={p.userId} className="relative" title={`${p.name} is viewing ${pageName(p.page)}`}>
            <Avatar name={p.name} color={p.color} size="xs" ring />
            <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-[#3fae6a] ring-2 ring-surface" />
          </span>
        ))}
      </span>
      <span className="text-xs text-ink-muted">{unique.length === 1 ? `${unique[0].name.split(' ')[0]} is online` : `${unique.length} online`}</span>
    </Link>
  )
}

function AccountMenu() {
  const { user, logout } = useAuth()
  const { role, household } = useHousehold()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  if (!user) return null
  const doLogout = () => {
    logout()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 hover:bg-breeze-50"
      >
        <Avatar name={user.name} color={user.avatarColor} image={user.avatarImage} size="sm" />
        <span className="hidden text-left leading-tight xl:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium text-ink">{user.name}</span>
          <span className="block text-[11px] text-ink-muted">{role ? ROLE_LABEL[role] : 'No access'}</span>
        </span>
        <ChevronDown className="size-3.5 text-ink-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Avatar name={user.name} color={user.avatarColor} image={user.avatarImage} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <p className="mt-0.5 text-[11px] text-breeze-700">
                {role ? ROLE_LABEL[role] : 'No access'} of {household.name}
              </p>
            </div>
          </div>
          <div className="p-1.5">
            {[
              { to: '/app/profile', label: 'Your profile', icon: UserRound },
              { to: '/app/household', label: 'Household', icon: Users },
              { to: '/app/settings', label: 'Settings', icon: Settings },
            ].map((i) => (
              <Link key={i.to} to={i.to} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink-soft hover:bg-breeze-50 hover:text-ink">
                <i.icon className="size-4" /> {i.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-line px-4 py-3">
            <p className="mb-2 text-[11px] font-medium text-ink-muted">Appearance</p>
            <ThemeSwitch />
          </div>
          <div className="border-t border-line p-1.5">
            <button role="menuitem" onClick={doLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-clay-700 hover:bg-clay-50">
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { household } = useHousehold()
  const { settings } = useSettings()
  const current = NAV_ITEMS.find((n) => (n.to === '/app' ? location.pathname === '/app' : location.pathname.startsWith(n.to)))

  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const sidebarFooter = (
    <div className="mt-auto space-y-3 pt-6">
      <DataModeCard />
      <p className="px-1 text-[11px] leading-4 text-ink-muted">BINUS University CS–AI prototype. Not a certified monitoring device.</p>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="scrollbar-thin fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link to="/app" className="mb-7 px-2">
          <Logo />
        </Link>
        <SidebarNav />
        {sidebarFooter}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="scrollbar-thin absolute inset-y-0 left-0 flex w-72 flex-col overflow-y-auto bg-surface px-4 py-5 shadow-lift">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-muted hover:bg-breeze-50" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
            {sidebarFooter}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <button className="-ml-1 rounded-lg p-2 text-ink-soft hover:bg-breeze-50 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{current?.label ?? 'CoolNest'}</p>
            <p className="hidden truncate text-xs text-ink-muted sm:block">
              {household.name}, {settings.home.district}, {settings.home.city}
            </p>
          </div>
          <PresenceStack />
          <RoomSwitcher />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
