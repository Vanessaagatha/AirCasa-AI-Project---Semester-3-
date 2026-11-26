import { useMemo } from 'react'
import { CircleCheck, CloudRain, Droplets, Gauge, Info, RefreshCw, Thermometer, TriangleAlert, Wind } from 'lucide-react'
import { Badge, Button, Card, CardHeader, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { useChartTheme } from '@/components/charts/chartTheme'
import { useRooms } from '@/context/RoomsContext'
import { useSettings } from '@/context/SettingsContext'
import { useCurrentWeather, useHistory, useLatestReadings, useOutlook } from '@/features/environment/useEnvironment'
import { WeatherIcon } from '@/features/environment/WeatherIcon'
import { conditionLabel, fmtPct, fmtPm, fmtRelative, fmtTemp, pm25Category, windDirectionLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function EnvironmentPage() {
  const { rooms, selectedRoom } = useRooms()
  const { settings, refreshData } = useSettings()
  const weather = useCurrentWeather()
  const outlook = useOutlook(12)
  const readings = useLatestReadings(rooms)
  const history = useHistory(selectedRoom ?? rooms[0] ?? null, '24h')
  const demo = settings.dataMode === 'demo'
  const SERIES = useChartTheme().series
  const w = weather.data
  const cat = pm25Category(w?.pm25 ?? null)

  const pmRows = useMemo(() => (history.data ?? []).map((r) => ({ t: new Date(r.timestamp).getTime(), pm25: r.pm25 })), [history.data])
  const tempRows = useMemo(
    () => (history.data ?? []).map((r) => ({ t: new Date(r.timestamp).getTime(), outdoor: r.outdoorTempC, outdoorHumidity: r.outdoorHumidityPct })),
    [history.data],
  )
  const isNight = (iso: string) => {
    const h = new Date(iso).getHours()
    return h >= 18 || h < 6
  }

  return (
    <div>
      <PageHeader
        title="Environmental Data"
        description={`Outdoor conditions around ${settings.home.district}, ${settings.home.city}, and the status of each room sensor.`}
        actions={
          <>
            {demo && <Badge tone="ochre">Demo data</Badge>}
            <Button size="sm" icon={<RefreshCw className="size-3.5" />} onClick={refreshData}>
              Refresh
            </Button>
          </>
        }
      />

      {weather.error && (
        <div className="mb-4">
          <ErrorState error={weather.error} onRetry={weather.reload} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Current weather */}
        <Card className="p-6">
          {weather.loading || !w ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] text-ink-muted">{w.locationName}</p>
                  <p className="tabular mt-2 text-[56px] leading-none font-semibold tracking-[-0.04em]">{fmtTemp(w.temperatureC)}</p>
                  <p className="mt-2 text-[15px] font-medium text-ink-soft">{conditionLabel[w.condition]}</p>
                </div>
                <div className="grid size-20 place-items-center rounded-3xl bg-mist-50 text-mist-500">
                  <WeatherIcon condition={w.condition} night={isNight(w.timestamp)} className="size-10" />
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-[13px] xl:grid-cols-4">
                {[
                  { icon: Droplets, k: 'Humidity', v: fmtPct(w.humidityPct) },
                  { icon: CloudRain, k: 'Rain chance (3 h)', v: fmtPct(w.rainProbabilityPct) },
                  { icon: Wind, k: 'Wind', v: `${w.windSpeedMs?.toFixed(1) ?? '—'} m/s ${windDirectionLabel(w.windDirectionDeg)}` },
                  { icon: Gauge, k: 'PM2.5 (regional)', v: fmtPm(w.pm25) },
                ].map((x) => (
                  <div key={x.k}>
                    <dt className="flex items-center gap-1.5 text-ink-muted">
                      <x.icon className="size-3.5" /> {x.k}
                    </dt>
                    <dd className="tabular mt-1 font-semibold">{x.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-xs text-ink-muted">
                {w.sourceLabel}, updated {fmtRelative(w.timestamp)}. PM2.5 from {w.pm25Source.toLowerCase()}.
              </p>
            </>
          )}
        </Card>

        {/* Air quality */}
        <Card className="flex flex-col">
          <CardHeader title="Outdoor air quality" description="Regional PM2.5 over the last 24 hours" />
          <div className="flex-1 p-5 pt-3">
            {w?.pm25 != null && (
              <div className="mb-3 flex items-center gap-2">
                <Badge tone={cat.tone === 'good' ? 'sage' : cat.tone === 'moderate' ? 'neutral' : 'ochre'}>{cat.label}</Badge>
                <span className="text-xs text-ink-muted">US EPA 24-hour scale used as a reference</span>
              </div>
            )}
            {history.loading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : history.error ? (
              <ErrorState error={history.error} onRetry={history.reload} compact />
            ) : (
              <TimeSeriesChart
                data={pmRows}
                unit=" µg/m³"
                height={180}
                yDomain={[0, 'auto']}
                series={[{ key: 'pm25', label: 'PM2.5', color: SERIES.pm25 }]}
                refLines={[{ y: 15, label: 'WHO 24-h guideline' }]}
              />
            )}
          </div>
          <p className="flex gap-2 border-t border-line px-5 py-3 text-xs leading-5 text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            This is an outdoor estimate for the wider area. It does not measure the air inside your home.
          </p>
        </Card>
      </div>

      {/* Outlook */}
      <Card className="mt-4">
        <CardHeader title="Next 12 hours" description="Hourly outdoor temperature and rain probability" />
        <div className="scrollbar-thin overflow-x-auto p-5 pt-4">
          {outlook.loading ? (
            <Skeleton className="h-28 w-full" />
          ) : outlook.error ? (
            <ErrorState error={outlook.error} onRetry={outlook.reload} compact />
          ) : (
            <ol className="flex min-w-[720px] gap-2">
              {outlook.data?.map((o) => (
                <li key={o.timestamp} className="flex flex-1 flex-col items-center rounded-xl border border-line bg-canvas px-2 py-3 text-center">
                  <span className="tabular text-xs text-ink-muted">
                    {new Date(o.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <WeatherIcon condition={o.condition} night={isNight(o.timestamp)} className="my-2 size-5 text-ink-soft" />
                  <span className="tabular text-sm font-semibold">{o.temperatureC.toFixed(0)}°</span>
                  <span className={cn('tabular mt-1 text-[11px]', o.rainProbabilityPct >= 60 ? 'font-semibold text-mist-700' : 'text-ink-muted')}>
                    {o.rainProbabilityPct}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Outdoor temperature, last 24 hours" />
          <div className="p-5">
            {history.loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <TimeSeriesChart
                data={tempRows}
                unit="°C"
                height={200}
                yTickFormat={(v) => `${v.toFixed(0)}°`}
                series={[{ key: 'outdoor', label: 'Outdoor temperature', color: SERIES.outdoor }]}
              />
            )}
          </div>
        </Card>

        {/* Sensors */}
        <Card>
          <CardHeader title="Room sensors" description="Latest indoor reading per room" icon={<Thermometer className="size-4" />} />
          <div className="scrollbar-thin overflow-x-auto p-5 pt-3">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="py-2 font-medium">Room</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Temp</th>
                  <th className="py-2 text-right font-medium">Humidity</th>
                  <th className="py-2 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rooms.map((r) => {
                  const rd = readings.data?.[r.id]
                  return (
                    <tr key={r.id} className="border-b border-line/70 last:border-0">
                      <td className="py-2.5 font-medium">{r.name}</td>
                      <td className="py-2.5">
                        {!rd ? (
                          <span className="text-ink-muted">…</span>
                        ) : rd.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-breeze-700">
                            <CircleCheck className="size-3.5" /> Reporting
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-ochre-700">
                            <TriangleAlert className="size-3.5" /> {rd.status === 'missing' ? 'No data' : 'Stale'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">{fmtTemp(rd?.temperatureC)}</td>
                      <td className="py-2.5 text-right">{fmtPct(rd?.humidityPct)}</td>
                      <td className="py-2.5 text-right text-ink-muted">{rd ? fmtRelative(rd.timestamp) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {readings.error && <ErrorState error={readings.error} onRetry={readings.reload} compact />}
            {demo && <p className="mt-3 text-xs text-ink-muted">Demo sensors: values are generated, no hardware is connected.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
