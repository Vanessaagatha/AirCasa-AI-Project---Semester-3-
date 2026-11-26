import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, X } from 'lucide-react'
import type { Recommendation, Room } from '@/types'
import { useSettings } from '@/context/SettingsContext'
import { useGuidance } from './useGuidance'
import { cn } from '@/lib/utils'

const SESSION_KEY = 'coolnest.notified.v1'

/** Dashboard alerts driven by guidance rules and the user's notification settings. */
export function AlertsBanner({ room }: { room: Room | null }) {
  const { settings } = useSettings()
  const n = settings.notifications
  const { result } = useGuidance(room)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const wanted = (r: Recommendation) =>
    (r.ruleId === 'overheating' && n.heatAlerts) ||
    (r.ruleId === 'rain' && n.rainAlerts) ||
    (r.ruleId === 'air-quality' && n.airQualityAlerts) ||
    (r.ruleId === 'data-validity' && n.dataAlerts)

  const alerts = (result?.recommendations ?? []).filter(wanted).filter((r) => !dismissed.has(`${room?.id}:${r.ruleId}`))

  // optional browser notification, once per rule and room per session
  useEffect(() => {
    if (!n.browserNotifications || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !room) return
    let sent: string[] = []
    try {
      sent = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]')
    } catch {
      sent = []
    }
    const fresh = alerts.filter((a) => !sent.includes(`${room.id}:${a.ruleId}`))
    fresh.forEach((a) => new Notification(`${room.name}: ${a.title}`, { body: a.detectedCondition, tag: `${room.id}:${a.ruleId}` }))
    if (fresh.length) sessionStorage.setItem(SESSION_KEY, JSON.stringify([...sent, ...fresh.map((a) => `${room.id}:${a.ruleId}`)]))
  }, [alerts, n.browserNotifications, room])

  if (!room || !alerts.length) return null
  return (
    <div className="mb-6 space-y-2" aria-live="polite">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex items-start gap-3 rounded-2xl border px-4 py-3',
            a.severity === 'caution' ? 'border-ochre-300 bg-ochre-50 text-ochre-700' : 'border-mist-200 bg-mist-50 text-mist-700',
          )}
        >
          <BellRing className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1 text-[13px] leading-5">
            <p className="font-semibold">
              {a.title} in {room.name.toLowerCase()}
            </p>
            <p className="opacity-90">{a.detectedCondition}</p>
          </div>
          <Link to="/app/guidance" className="shrink-0 text-[13px] font-medium underline-offset-2 hover:underline">
            See guidance
          </Link>
          <button onClick={() => setDismissed((d) => new Set(d).add(`${room.id}:${a.ruleId}`))} className="shrink-0 rounded-lg p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss alert">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
