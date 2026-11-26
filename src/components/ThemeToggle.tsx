import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemePreference } from '@/types'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'

const NEXT: Record<ThemePreference, ThemePreference> = { light: 'dark', dark: 'system', system: 'light' }
const LABEL: Record<ThemePreference, string> = { light: 'Light theme', dark: 'Dark theme', system: 'Match system theme' }

/** Single button cycling light → dark → system. */
export function ThemeToggle({ className }: { className?: string }) {
  const { settings, updateSettings } = useSettings()
  const t = settings.theme
  const Icon = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor
  return (
    <button
      onClick={() => updateSettings({ theme: NEXT[t] })}
      className={cn('grid size-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-breeze-50 hover:text-ink', className)}
      aria-label={`${LABEL[t]}. Switch to ${LABEL[NEXT[t]].toLowerCase()}`}
      title={`${LABEL[t]} (click to change)`}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}

/** Three-way segmented control used in Settings and the account menu. */
export function ThemeSwitch() {
  const { settings, updateSettings } = useSettings()
  const opts: { v: ThemePreference; icon: typeof Sun; label: string }[] = [
    { v: 'light', icon: Sun, label: 'Light' },
    { v: 'dark', icon: Moon, label: 'Dark' },
    { v: 'system', icon: Monitor, label: 'System' },
  ]
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl border border-line bg-canvas p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={settings.theme === o.v}
          onClick={() => updateSettings({ theme: o.v })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium transition-colors',
            settings.theme === o.v ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          <o.icon className="size-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  )
}
