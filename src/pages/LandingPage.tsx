import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Wind,
  Ban,
  Box,
  Building2,
  ChartLine,
  CloudSun,
  Droplets,
  FlaskConical,
  Lightbulb,
  Menu,
  Moon,
  Thermometer,
  Wallet,
  X,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui'
import { LazyRoomViewer } from '@/features/rooms/LazyRoomViewer'
import { demoRooms } from '@/data/demoRooms'

// the hero shows a furnished bedroom; only ceiling-mounted appliances are drawn so they do not collide with furniture
const heroRoom = { ...demoRooms[0], appliances: (demoRooms[0].appliances ?? []).filter((a) => a.type === 'ceiling-fan' || a.type === 'lighting') }

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#who', label: 'Who it’s for' },
  { href: '#limits', label: 'Limitations' },
]

const FEATURES = [
  {
    icon: Box,
    title: 'A simple 3D model of your room',
    body: 'Enter the length, width and height, place windows, doors and appliances, and set which way the room faces. The model updates as you type.',
  },
  {
    icon: CloudSun,
    title: 'Indoor and outdoor conditions together',
    body: 'Room temperature and humidity sit next to outdoor temperature, rain chance and a regional PM2.5 estimate, each labelled with its source.',
  },
  {
    icon: ChartLine,
    title: 'A 60-minute temperature forecast',
    body: 'See whether the room is likely to warm or cool over the next hour, with past forecasts plotted against what actually happened.',
  },
  {
    icon: Wind,
    title: 'Airflow and heat what-ifs',
    body: 'Compare closed windows, open windows and air conditioning. See likely air paths through the room and where the heat comes from: sun, walls, roof or appliances.',
  },
  {
    icon: Users,
    title: 'Decide together',
    body: 'Invite your household with roles, discuss each room in comments, and see who changed what. Everyone works from the same room models.',
  },
  {
    icon: Lightbulb,
    title: 'Guidance you can check',
    body: 'Each suggestion shows the rule that produced it, the data behind it and what it cannot account for. No black-box advice.',
  },
]

const STEPS = [
  { title: 'Describe your room', body: 'Dimensions, openings and orientation. Saved in your browser as a small JSON file you can export.' },
  { title: 'Bring in readings', body: 'An indoor sensor plus outdoor weather and air-quality data. Demo values stand in until hardware is connected.' },
  { title: 'Check the forecast', body: 'The prediction service estimates indoor temperature an hour ahead from current conditions and room features.' },
  { title: 'Weigh the considerations', body: 'Read why ventilating, shading or closing windows may or may not make sense right now, and decide for yourself.' },
]

const BENEFITS = [
  { icon: Thermometer, title: 'Know when a room is heating up', body: 'Spot warm afternoons before they become uncomfortable evenings, especially in upper-floor and west-facing rooms.' },
  { icon: Droplets, title: 'Make sense of humidity', body: 'Humid air makes heat feel worse. Seeing both numbers together explains why a room feels stuffy.' },
  { icon: Wallet, title: 'Use cooling more deliberately', body: 'Choose between airing, shading, a fan or air conditioning with more context, without promises about savings.' },
  { icon: Moon, title: 'Better-informed evenings', body: 'Decide when to open windows for the night by comparing indoor and outdoor air rather than guessing.' },
]

const LIMITS = [
  'Airflow and heat results come from a simplified physics model, not CFD. They are shown as ranges for comparing options, not exact predictions.',
  'Demo forecasts come from a simple heuristic and are labelled as such. They are not trained model results.',
  'Outdoor PM2.5 is a regional estimate and does not represent the air inside your home.',
  'It cannot tell you how many degrees opening a window will remove.',
  'It is a household decision aid, not a tool for reducing city-wide urban heat.',
]

export default function LandingPage() {
  const [menu, setMenu] = useState(false)
  const { user } = useAuth()
  const startTo = user ? '/app' : '/register'
  return (
    <div className="min-h-screen bg-canvas">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" aria-label="CoolNest 3D home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Landing">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm text-ink-soft hover:text-ink">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="hidden sm:block">
                <Button variant="primary" size="sm">
                  Open dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/register" className="hidden sm:block">
                  <Button variant="primary" size="sm">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
            <button className="rounded-lg p-2 text-ink-soft hover:bg-breeze-50 md:hidden" onClick={() => setMenu((m) => !m)} aria-label="Toggle menu" aria-expanded={menu}>
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-line bg-surface px-5 py-3 md:hidden" aria-label="Landing mobile">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="block py-2 text-sm text-ink-soft">
                {n.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {!user && (
                <Link to="/login">
                  <Button className="w-full">Log in</Button>
                </Link>
              )}
              <Link to={user ? '/app' : '/register'} className={user ? 'col-span-2' : ''}>
                <Button variant="primary" className="w-full">
                  {user ? 'Open dashboard' : 'Sign up'}
                </Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-12 pb-16 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pt-20 lg:pb-24">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-breeze-200 bg-breeze-50 px-3 py-1 text-[13px] text-breeze-700">
            <Building2 className="size-3.5" /> For first homes in dense Indonesian cities
          </p>
          <h1 className="text-[40px] leading-[1.08] font-semibold tracking-[-0.03em] text-ink sm:text-5xl lg:text-[56px]">
            A Cooler, Healthier Home Starts with Understanding.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-7 text-ink-soft">
            Understand your home’s environment, anticipate indoor temperature changes, and receive practical environmental guidance.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={startTo}>
              <Button variant="primary" size="lg">
                Get started
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg">See how it works</Button>
            </a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-muted">
            <FlaskConical className="size-3.5 text-ochre-500" />
            Prototype running on clearly labelled demo data.
          </p>
        </div>

        <div className="relative">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[28px] border border-line bg-canvas shadow-lift">
            <LazyRoomViewer room={heroRoom} furnished autoRotate toolbar={false} defaultLabels={false} showCompass showAppliances />
          </div>
          {/* Illustrative readings */}
          <div className="absolute -bottom-5 left-4 flex flex-wrap gap-2 sm:left-6">
            <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
              <p className="text-[11px] text-ink-muted">Indoor now</p>
              <p className="tabular text-xl font-semibold tracking-tight">29.4°C</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
              <p className="text-[11px] text-ink-muted">In 60 minutes</p>
              <p className="tabular text-xl font-semibold tracking-tight text-forecast-700">30.1°C</p>
            </div>
            <div className="hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-card sm:block">
              <p className="text-[11px] text-ink-muted">Humidity</p>
              <p className="tabular text-xl font-semibold tracking-tight text-mist-700">68%</p>
            </div>
          </div>
          <p className="absolute top-4 left-4 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-ink-muted ring-1 ring-line">
            Illustrative values, drag to rotate
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">Everything about one room, in one place</h2>
            <p className="mt-3 text-[15px] leading-7 text-ink-soft">
              CoolNest brings together the shape of a room, what the air is doing inside and outside, and what the next hour may look like.
            </p>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-breeze-100 text-breeze-700">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-6 text-ink-soft">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-[-0.02em]">How it works</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">Four steps, from a tape measure to an informed decision.</p>
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="tabular grid size-8 place-items-center rounded-full bg-breeze-800 text-sm font-semibold text-white">{i + 1}</span>
                {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-line-strong md:block" />}
              </div>
              <h3 className="mt-4 text-[16px] font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section id="who" className="border-y border-line bg-breeze-50">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">Built for first-time homeowners</h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">
              Townhouses, row houses and apartments in places like Jakarta, Bekasi and Tangerang often sit close together, with limited
              shade and windows on only one or two sides. New owners rarely know how their rooms behave through a hot, humid day.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">
              CoolNest is meant to help build that understanding, one room at a time.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-breeze-200 bg-surface p-5">
                <b.icon className="size-5 text-breeze-700" />
                <h3 className="mt-3 text-[15px] font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-6 text-ink-soft">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section id="limits" className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.02em]">What CoolNest does not do</h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">
              A tool that informs decisions about health and comfort should be clear about its limits. These apply to this prototype.
            </p>
          </div>
          <ul className="space-y-3">
            {LIMITS.map((l) => (
              <li key={l} className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-[14px] leading-6 text-ink-soft">
                <Ban className="mt-1 size-4 shrink-0 text-ink-muted" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] bg-breeze-800 px-8 py-10 text-white sm:flex-row sm:items-center sm:px-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Start with the room you sleep in</h2>
            <p className="mt-2 max-w-lg text-[15px] leading-6 text-breeze-200">Three demo rooms are ready to explore. Edit them or add your own.</p>
          </div>
          <Link to={startTo}>
            <Button size="lg" className="border-transparent bg-white text-[#164c61] hover:bg-[#edf6f8]">
              Get started
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p>Computer Science – Artificial Intelligence project, BINUS University. Prototype, not a certified device.</p>
        </div>
      </footer>
    </div>
  )
}
