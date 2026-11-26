import { Link } from 'react-router-dom'
import { Box, CircleCheck, CircleDashed, CircleOff, Info, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { useRooms } from '@/context/RoomsContext'
import { useSettings } from '@/context/SettingsContext'
import { useGuidance } from '@/features/guidance/useGuidance'
import { GuidanceCard } from '@/features/guidance/GuidanceCard'
import { cn } from '@/lib/utils'

function ValidityChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        ok ? 'border-breeze-200 bg-breeze-50 text-breeze-700' : 'border-ochre-100 bg-ochre-50 text-ochre-700',
      )}
    >
      {ok ? <CircleCheck className="size-3.5" /> : <CircleOff className="size-3.5" />}
      {label}: {ok ? 'valid' : 'unavailable'}
    </span>
  )
}

export default function GuidancePage() {
  const { selectedRoom: room } = useRooms()
  const g = useGuidance(room)
  const T = useSettings().settings.thresholds

  if (!room) {
    return (
      <div>
        <PageHeader title="Smart Guidance" />
        <Card>
          <EmptyState
            icon={<Box className="size-5" />}
            title="Select or create a room first"
            description="Guidance depends on the room’s windows and orientation."
            action={
              <Link to="/app/rooms">
                <Button variant="primary">Go to My Rooms</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const recs = g.result?.recommendations ?? []

  return (
    <div>
      <PageHeader
        title="Smart Guidance"
        description={`Considerations for ${room.name.toLowerCase()}, produced by transparent rules from current readings, weather and the room’s openings.`}
        actions={
          <Button size="sm" icon={<RefreshCw className="size-3.5" />} onClick={g.reload}>
            Re-evaluate
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {g.result ? (
            <>
              <ValidityChip ok={g.result.dataValid.indoor} label="Indoor reading" />
              <ValidityChip ok={g.result.dataValid.outdoor} label="Outdoor weather" />
              <ValidityChip ok={g.result.dataValid.prediction} label="Forecast" />
            </>
          ) : (
            <Skeleton className="h-7 w-80" />
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="size-3.5" /> Rule-based, not AI-generated. No cooling outcome is guaranteed.
        </p>
      </div>

      {g.errors.length > 0 && (
        <div className="mb-4 space-y-2">
          {g.errors.map((e) => (
            <ErrorState key={e.message} error={e} onRetry={g.reload} compact />
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {g.loading ? (
            <>
              <Skeleton className="h-72 w-full rounded-2xl" />
              <Skeleton className="h-72 w-full rounded-2xl" />
            </>
          ) : recs.length ? (
            recs.map((r) => <GuidanceCard key={r.id} rec={r} />)
          ) : (
            <Card>
              <EmptyState
                icon={<CircleCheck className="size-5" />}
                title="No rules are triggered right now"
                description="None of the guidance rules fired for the current readings. This does not guarantee the room is comfortable."
              />
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Rules evaluated" description="Every rule is checked; this shows why each did or did not fire." />
            <ul className="space-y-3 p-5">
              {g.result?.evaluations.map((e) => (
                <li key={e.ruleId} className="flex gap-2.5">
                  {e.triggered ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-breeze-700" aria-label="Triggered" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-label="Not triggered" />
                  )}
                  <div>
                    <p className={cn('text-[13px] font-medium', e.triggered ? 'text-ink' : 'text-ink-soft')}>{e.name}</p>
                    <p className="text-xs leading-5 text-ink-muted">{e.reason}</p>
                  </div>
                </li>
              )) ?? <Skeleton className="h-60 w-full" />}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Info className="size-4 text-ink-muted" /> About these thresholds
            </h3>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              Warm-room threshold {T.warmIndoorC}°C, heat index bands from the US National Weather Service formula, PM2.5
              caution above {T.pm25CautionUgm3} µg/m³ (US EPA 24-hour scale), rain reminder at {T.rainProbabilityPct}%
              probability. These are illustrative defaults; adjust them in Settings → Guidance thresholds.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
