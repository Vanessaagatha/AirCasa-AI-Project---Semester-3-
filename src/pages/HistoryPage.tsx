import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Box, Download, FlaskConical } from 'lucide-react'
import type { EnvironmentSample, TimeRange } from '@/types'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Segmented, Select, Skeleton } from '@/components/ui'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { useChartTheme } from '@/components/charts/chartTheme'
import { useRooms } from '@/context/RoomsContext'
import { useSettings } from '@/context/SettingsContext'
import { useHistory } from '@/features/environment/useEnvironment'
import { useForecastHistory } from '@/features/prediction/usePrediction'
import { ForecastChart } from '@/features/prediction/ForecastChart'
import { TIME_RANGES } from '@/services/environmentService'
import { fmtDateTime } from '@/lib/format'

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function toCsv(rows: EnvironmentSample[], demo: boolean): string {
  const head = 'timestamp,indoor_temp_c,indoor_humidity_pct,outdoor_temp_c,outdoor_humidity_pct,pm25_ugm3'
  const lines = rows.map((r) =>
    [r.timestamp, r.indoorTempC, r.indoorHumidityPct, r.outdoorTempC, r.outdoorHumidityPct, r.pm25].map((v) => (v == null ? '' : v)).join(','),
  )
  return (demo ? '# DEMO DATA - synthetic values, not measurements\n' : '') + [head, ...lines].join('\n')
}

export default function HistoryPage() {
  const { rooms, selectedRoom, selectRoom } = useRooms()
  const { settings } = useSettings()
  const [range, setRange] = useState<TimeRange>('3d')
  const history = useHistory(selectedRoom, range)
  const forecastHours = Math.min(TIME_RANGES[range].hours, 168)
  const forecasts = useForecastHistory(selectedRoom, forecastHours)
  const demo = settings.dataMode === 'demo'
  const SERIES = useChartTheme().series
  const T = settings.thresholds

  const rows = useMemo(
    () =>
      (history.data ?? []).map((r) => ({
        t: new Date(r.timestamp).getTime(),
        indoor: r.indoorTempC,
        outdoor: r.outdoorTempC,
        humidity: r.indoorHumidityPct,
        outdoorHumidity: r.outdoorHumidityPct,
        pm25: r.pm25,
      })),
    [history.data],
  )

  const stats = useMemo(() => {
    const d = history.data ?? []
    if (!d.length) return null
    const step = TIME_RANGES[range].stepMinutes / 60
    const indoor = d.map((r) => r.indoorTempC).filter((x): x is number => x != null)
    return {
      meanIndoor: mean(d.map((r) => r.indoorTempC)),
      maxIndoor: indoor.length ? Math.max(...indoor) : null,
      hoursWarm: d.filter((r) => (r.indoorTempC ?? 0) >= T.warmIndoorC).length * step,
      meanHumidity: mean(d.map((r) => r.indoorHumidityPct)),
      meanPm: mean(d.map((r) => r.pm25)),
      missing: d.filter((r) => r.indoorTempC == null).length,
    }
  }, [history.data, range, T.warmIndoorC])

  if (!selectedRoom) {
    return (
      <div>
        <PageHeader title="History & Analytics" />
        <Card>
          <EmptyState
            icon={<Box className="size-5" />}
            title="No room to show"
            description="Create a room to start collecting history."
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

  const download = () => {
    if (!history.data) return
    const blob = new Blob([toCsv(history.data, demo)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedRoom.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${range}${demo ? '-demo' : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const block = (h: number, node: ReactNode) =>
    history.loading ? (
      <div style={{ height: h }} className="animate-pulse rounded-lg bg-breeze-100/70" />
    ) : history.error ? (
      <ErrorState error={history.error} onRetry={history.reload} />
    ) : rows.length ? (
      node
    ) : (
      <EmptyState title="No data in this range" />
    )

  return (
    <div>
      <PageHeader
        title="History & Analytics"
        description="Observed values are solid lines; forecasts are dashed. Click legend items to hide a series; drag the handles under the temperature chart to zoom."
        actions={demo ? <Badge tone="ochre" icon={<FlaskConical className="size-3" />}>Demo data</Badge> : undefined}
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-muted">
            Room
            <Select value={selectedRoom.id} onChange={(e) => selectRoom(e.target.value)} className="h-9 w-48">
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </label>
          <Segmented<TimeRange>
            ariaLabel="Date range"
            value={range}
            onChange={setRange}
            options={(Object.keys(TIME_RANGES) as TimeRange[]).map((k) => ({ value: k, label: TIME_RANGES[k].label }))}
          />
        </div>
        <Button size="sm" icon={<Download className="size-3.5" />} onClick={download} disabled={!history.data?.length}>
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Mean indoor', stats?.meanIndoor != null ? `${stats.meanIndoor.toFixed(1)}°C` : '—'],
          ['Peak indoor', stats?.maxIndoor != null ? `${stats.maxIndoor.toFixed(1)}°C` : '—'],
          [`Time at ≥ ${T.warmIndoorC}°C`, stats ? `${stats.hoursWarm.toFixed(0)} h` : '—'],
          ['Mean indoor humidity', stats?.meanHumidity != null ? `${stats.meanHumidity.toFixed(0)}%` : '—'],
          ['Mean outdoor PM2.5', stats?.meanPm != null ? `${stats.meanPm.toFixed(0)} µg/m³` : '—'],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-ink-muted">{k}</p>
            {history.loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="tabular mt-1 text-xl font-semibold tracking-tight">{v}</p>}
          </Card>
        ))}
      </div>
      {stats && stats.missing > 0 && (
        <p className="mb-4 text-xs text-ochre-700">{stats.missing} indoor samples are missing in this range; they appear as gaps.</p>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader title="Temperature" description="Indoor (observed) and outdoor temperature on the same scale." />
          <div className="p-5">
            {block(
              300,
              <TimeSeriesChart
                data={rows}
                unit="°C"
                height={300}
                brush
                yTickFormat={(v) => `${v.toFixed(0)}°`}
                series={[
                  { key: 'indoor', label: 'Indoor temperature', color: SERIES.indoor },
                  { key: 'outdoor', label: 'Outdoor temperature', color: SERIES.outdoor },
                ]}
              />,
            )}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Indoor humidity" description="Relative humidity in the room." />
            <div className="p-5">
              {block(
                220,
                <TimeSeriesChart
                  data={rows}
                  unit="%"
                  height={220}
                  yTickFormat={(v) => `${v.toFixed(0)}%`}
                  series={[{ key: 'humidity', label: 'Indoor humidity', color: SERIES.humidity }]}
                  refLines={[{ y: T.highHumidityPct, label: `${T.highHumidityPct}% guidance threshold` }]}
                />,
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Outdoor PM2.5 estimate" description="Regional estimate, not indoor air." />
            <div className="p-5">
              {block(
                220,
                <TimeSeriesChart
                  data={rows}
                  unit=" µg/m³"
                  height={220}
                  yDomain={[0, 'auto']}
                  series={[{ key: 'pm25', label: 'Outdoor PM2.5', color: SERIES.pm25 }]}
                  refLines={[
                    { y: 15, label: 'WHO 24-h guideline (15)' },
                    { y: 35.4, label: 'US EPA sensitive groups (35.4)' },
                  ]}
                />,
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Prediction versus actual"
            description={`Forecasts made 60 minutes ahead against what was later observed${TIME_RANGES[range].hours > 168 ? ' (last 7 days)' : ''}.`}
            action={demo ? <Badge tone="ochre">Demo, not a model</Badge> : undefined}
          />
          <div className="p-5">
            {forecasts.loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : forecasts.error ? (
              <ErrorState error={forecasts.error} onRetry={forecasts.reload} />
            ) : forecasts.data?.length ? (
              <ForecastChart records={forecasts.data} />
            ) : (
              <EmptyState title="No forecasts in this range" />
            )}
          </div>
        </Card>
      </div>

      {history.loadedAt && (
        <p className="mt-4 text-xs text-ink-muted">
          Loaded {fmtDateTime(history.loadedAt)}. {demo ? 'All values are synthetic demo data.' : 'Source: CoolNest API.'}
        </p>
      )}
    </div>
  )
}
