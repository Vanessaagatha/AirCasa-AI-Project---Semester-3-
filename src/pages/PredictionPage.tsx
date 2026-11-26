import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CircleOff,
  Clock,
  Cpu,
  FlaskConical,
  Minus,
  RefreshCw,
  Thermometer,
  TriangleAlert,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from '@/components/ui'
import { useRooms } from '@/context/RoomsContext'
import { useForecastHistory, usePrediction } from '@/features/prediction/usePrediction'
import { ForecastChart } from '@/features/prediction/ForecastChart'
import { compassLabel } from '@/features/rooms/roomGeometry'
import { fmtDateTime, fmtDelta, fmtPct, fmtPm, fmtTemp, fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Prediction } from '@/types'

export default function PredictionPage() {
  const { selectedRoom: room } = useRooms()
  const [hours, setHours] = useState<'12' | '24' | '48'>('24')
  const prediction = usePrediction(room)
  const history = useForecastHistory(room, Number(hours))

  if (!room) {
    return (
      <div>
        <PageHeader title="AI Prediction" />
        <Card>
          <EmptyState
            icon={<Box className="size-5" />}
            title="Select or create a room first"
            description="Forecasts are made per room, using its readings and features."
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

  const p = prediction.data
  const isDemo = p?.isDemo ?? true

  return (
    <div>
      <PageHeader
        title="AI Prediction"
        description={`Indoor temperature for ${room.name.toLowerCase()}, 60 minutes ahead.`}
        actions={
          <Button
            size="sm"
            icon={<RefreshCw className="size-3.5" />}
            onClick={() => {
              prediction.reload()
              history.reload()
            }}
          >
            Refresh forecast
          </Button>
        }
      />

      {isDemo && (
        <div role="note" className="mb-6 flex flex-col gap-2 rounded-2xl border border-ochre-300 bg-ochre-50 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold tracking-wide text-ochre-700">
            <FlaskConical className="size-4" /> DEMO DATA — NOT A REAL MODEL PREDICTION
          </span>
          <span className="text-[13px] leading-5 text-ochre-700/90">
            Values come from a simple persistence-plus-trend formula on synthetic readings. No trained model is connected, and no accuracy is
            claimed.
          </span>
        </div>
      )}

      {prediction.error && (
        <div className="mb-4">
          <ErrorState error={prediction.error} onRetry={prediction.reload} />
        </div>
      )}

      {/* Headline numbers */}
      <div className="grid gap-4 md:grid-cols-[1fr_1.3fr_1fr]">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-soft">
            <Thermometer className="size-4 text-breeze-600" /> Current indoor temperature
          </p>
          {prediction.loading ? (
            <Skeleton className="mt-4 h-10 w-28" />
          ) : (
            <p className="tabular mt-3 text-[36px] leading-none font-semibold tracking-[-0.03em]">{fmtTemp(p?.currentTempC ?? null)}</p>
          )}
          <p className="mt-3 text-xs text-ink-muted">{p ? `Reading at ${fmtTime(p.generatedAt)}` : ' '}</p>
        </Card>

        <PredictedCard prediction={p} loading={prediction.loading} />

        <Card className="p-5">
          <p className="text-[13px] font-medium text-ink-soft">Predicted difference</p>
          {prediction.loading ? (
            <Skeleton className="mt-4 h-10 w-28" />
          ) : p?.deltaC != null ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-9 place-items-center rounded-xl',
                    p.deltaC > 0.1 ? 'bg-ochre-100 text-ochre-700' : p.deltaC < -0.1 ? 'bg-mist-100 text-mist-700' : 'bg-canvas text-ink-soft',
                  )}
                >
                  {p.deltaC > 0.1 ? <ArrowUpRight className="size-5" /> : p.deltaC < -0.1 ? <ArrowDownRight className="size-5" /> : <Minus className="size-5" />}
                </span>
                <p className="tabular text-[36px] leading-none font-semibold tracking-[-0.03em]">{fmtDelta(p.deltaC)}</p>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {p.deltaC > 0.1 ? 'Likely warming' : p.deltaC < -0.1 ? 'Likely cooling' : 'Little change expected'} over the next hour.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[28px] font-semibold text-ink-muted">—</p>
          )}
        </Card>
      </div>

      {/* Chart */}
      <Card className="mt-4">
        <CardHeader
          title="Observed versus forecast"
          description="Each dashed point is what was forecast an hour before that time. Gaps mean data was missing."
          action={
            <Segmented
              ariaLabel="History window"
              size="sm"
              value={hours}
              onChange={setHours}
              options={[
                { value: '12', label: '12 h' },
                { value: '24', label: '24 h' },
                { value: '48', label: '48 h' },
              ]}
            />
          }
        />
        <div className="p-5">
          {history.loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : history.error ? (
            <ErrorState error={history.error} onRetry={history.reload} />
          ) : history.data && history.data.length ? (
            <ForecastChart records={history.data} current={p} />
          ) : (
            <EmptyState title="No forecast history yet" description="Forecasts will appear here once the service has been running for an hour." />
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Inputs */}
        <Card>
          <CardHeader title="Environmental inputs" description="What the forecast was given. Missing inputs are shown as dashes." />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px] sm:grid-cols-3">
            {[
              ['Indoor temperature', fmtTemp(p?.inputs.indoorTempC)],
              ['Indoor humidity', fmtPct(p?.inputs.indoorHumidityPct)],
              ['Outdoor temperature', fmtTemp(p?.inputs.outdoorTempC)],
              ['Outdoor humidity', fmtPct(p?.inputs.outdoorHumidityPct)],
              ['Outdoor PM2.5 (regional)', fmtPm(p?.inputs.pm25)],
              ['Hour of day', p ? `${String(p.inputs.hourOfDay).padStart(2, '0')}:00` : '—'],
              ['Window area', p ? `${p.inputs.windowAreaM2.toFixed(2)} m²` : '—'],
              ['Front wall faces', p ? compassLabel[p.inputs.orientation] : '—'],
              ['Horizon', p ? `${p.horizonMinutes} minutes` : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-muted">{k}</dt>
                <dd className={cn('tabular mt-0.5 font-medium', v === '—' ? 'text-ink-muted' : 'text-ink')}>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Model */}
        <Card>
          <CardHeader title="Model and data source" icon={<Cpu className="size-4" />} />
          <dl className="space-y-3 p-5 text-[13px]">
            <Row k="Model" v={p?.modelName ?? '…'} />
            <Row k="Version" v={p?.modelVersion ?? '…'} />
            <Row
              k="Status"
              v={
                p ? (
                  <Badge tone={p.status === 'ok' ? 'sage' : 'ochre'}>
                    {p.status === 'ok' ? 'Forecast available' : p.status === 'model-unavailable' ? 'Model unavailable' : 'Insufficient data'}
                  </Badge>
                ) : (
                  '…'
                )
              }
            />
            <Row k="Data" v={isDemo ? <Badge tone="ochre">Synthetic demo readings</Badge> : 'Live sensors and weather API'} />
            <Row k="Generated" v={p ? fmtDateTime(p.generatedAt) : '…'} />
            <Row k="Uncertainty interval" v={p?.intervalLowC != null ? `${fmtTemp(p.intervalLowC)} to ${fmtTemp(p.intervalHighC)}` : 'Not provided'} />
          </dl>
          <p className="border-t border-line px-5 py-4 text-xs leading-5 text-ink-muted">
            To connect a trained model, serve it behind <code className="rounded bg-canvas px-1 font-mono">POST /api/v1/predict</code> and switch the
            data source to FastAPI in Settings. Model evaluation should be reported separately from this interface.
          </p>
        </Card>
      </div>

      {/* Forecast history table */}
      <Card className="mt-4">
        <CardHeader title="Forecast history" description="Most recent first." icon={<Clock className="size-4" />} />
        <div className="scrollbar-thin overflow-x-auto p-5 pt-3">
          {history.data?.length ? (
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="py-2 font-medium">Issued</th>
                  <th className="py-2 font-medium">For</th>
                  <th className="py-2 text-right font-medium">Forecast</th>
                  <th className="py-2 text-right font-medium">Observed</th>
                  <th className="py-2 text-right font-medium">Forecast − observed</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {[...history.data]
                  .reverse()
                  .slice(0, 12)
                  .map((r) => {
                    const diff = r.predictedTempC != null && r.observedTempC != null ? r.predictedTempC - r.observedTempC : null
                    return (
                      <tr key={r.issuedAt} className="border-b border-line/70 last:border-0">
                        <td className="py-2.5 text-ink-soft">{fmtDateTime(r.issuedAt)}</td>
                        <td className="py-2.5 text-ink-soft">{fmtTime(r.targetTime)}</td>
                        <td className="py-2.5 text-right">{fmtTemp(r.predictedTempC)}</td>
                        <td className="py-2.5 text-right">{fmtTemp(r.observedTempC)}</td>
                        <td className={cn('py-2.5 text-right', diff == null && 'text-ink-muted')}>{fmtDelta(diff)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          ) : history.loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <p className="text-[13px] text-ink-muted">No records.</p>
          )}
          {isDemo && <p className="mt-3 text-xs text-ink-muted">Differences are between two synthetic series and say nothing about real model accuracy.</p>}
        </div>
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  )
}

function PredictedCard({ prediction: p, loading }: { prediction: Prediction | null; loading: boolean }) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-14 w-40" />
      </Card>
    )
  }
  if (!p || p.status !== 'ok') {
    const unavailable = p?.status === 'model-unavailable'
    return (
      <Card className="border-ochre-100 bg-ochre-50/60 p-5">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ochre-700">
          {unavailable ? <CircleOff className="size-4" /> : <TriangleAlert className="size-4" />}
          {unavailable ? 'Prediction model unavailable' : 'Not enough data to forecast'}
        </p>
        <p className="mt-3 text-[13px] leading-5 text-ochre-700/90">{p?.message ?? 'No forecast was returned.'}</p>
        <p className="mt-3 text-xs text-ink-muted">
          {unavailable ? 'Readings and guidance still work; forecast-based rules are skipped.' : 'Check the room sensor in Settings.'}
        </p>
      </Card>
    )
  }
  return (
    <Card className="relative overflow-hidden border-forecast-500/30 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-soft">Predicted in 60 minutes</p>
        {p.isDemo && (
          <Badge tone="ochre" icon={<FlaskConical className="size-3" />}>
            Demo
          </Badge>
        )}
      </div>
      <p className="tabular mt-3 text-[52px] leading-none font-semibold tracking-[-0.04em] text-forecast-700">{fmtTemp(p.predictedTempC)}</p>
      <p className="mt-3 text-xs text-ink-muted">
        For {fmtTime(p.targetTime)}. {p.isDemo ? 'Not a model prediction.' : `${p.modelName} ${p.modelVersion}`}
      </p>
    </Card>
  )
}
