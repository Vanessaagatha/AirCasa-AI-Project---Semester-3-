import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CircleCheck,
  CloudSun,
  Database,
  Droplets,
  Gauge,
  Lightbulb,
  Minus,
  Plus,
  RefreshCw,
  Thermometer,
  TriangleAlert,
  Wind,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, DemoLabel, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { MetricCard } from '@/components/MetricCard'
import { useRooms } from '@/context/RoomsContext'
import { useSettings } from '@/context/SettingsContext'
import { useCurrentWeather, useLatestReading, useLatestReadings } from '@/features/environment/useEnvironment'
import { usePrediction } from '@/features/prediction/usePrediction'
import { useGuidance } from '@/features/guidance/useGuidance'
import { WeatherIcon } from '@/features/environment/WeatherIcon'
import { RoomCard } from '@/features/rooms/RoomCard'
import { compassLabel, floorArea, roomVolume, windowArea } from '@/features/rooms/roomGeometry'
import { conditionLabel, fmtDelta, fmtRelative, fmtTemp, fmtTime, pm25Category, windDirectionLabel } from '@/lib/format'
import { scenarioLabel } from '@/data/scenarios'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'
import { Avatar } from '@/components/Avatar'
import { AlertsBanner } from '@/features/guidance/AlertsBanner'
import { RoomPreview } from '@/features/rooms/RoomPreview'
import { totalHeatNow } from '@/features/rooms/appliances'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

export default function DashboardPage() {
  const { rooms, selectedRoom, selectRoom, addRoom } = useRooms()
  const { settings, refreshData } = useSettings()
  const navigate = useNavigate()
  const weather = useCurrentWeather()
  const reading = useLatestReading(selectedRoom)
  const readings = useLatestReadings(rooms)
  const demo = settings.dataMode === 'demo'
  const { user } = useAuth()
  const { household, presence } = useHousehold()
  const firstName = user?.name.split(' ')[0] ?? ''
  const online = Array.from(new Map(presence.filter((p) => p.userId !== user?.id).map((p) => [p.userId, p])).values())

  const w = weather.data
  const pmCat = pm25Category(w?.pm25 ?? null)
  const indoorUnavailable = reading.error
    ? 'Could not load'
    : reading.data && reading.data.status !== 'ok'
      ? `Sensor ${reading.data.status}, last seen ${fmtRelative(reading.data.timestamp)}`
      : null

  return (
    <div>
      {/* Home air summary */}
      <section className="relative mb-6 overflow-hidden rounded-[24px] border border-breeze-200 bg-gradient-to-br from-breeze-50 via-surface to-mist-50 p-6 sm:p-8">
        <svg className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 text-breeze-200" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M0 ${40 + i * 30} C 90 ${15 + i * 30}, 170 ${70 + i * 30}, 260 ${40 + i * 30} S 380 ${18 + i * 30}, 420 ${46 + i * 30}`} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
          ))}
        </svg>
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {demo && <DemoLabel>Demo data</DemoLabel>}
              <span className="text-xs text-ink-muted">{household.name}</span>
            </div>
            <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-7 text-ink-soft">
              {selectedRoom && reading.data?.temperatureC != null && w?.temperatureC != null
                ? reading.data.temperatureC > w.temperatureC + 0.5
                  ? `${selectedRoom.name} is ${(reading.data.temperatureC - w.temperatureC).toFixed(1)}°C warmer than outside right now, so outdoor air could help cool it if air quality and rain allow.`
                  : reading.data.temperatureC < w.temperatureC - 0.5
                    ? `${selectedRoom.name} is ${(w.temperatureC - reading.data.temperatureC).toFixed(1)}°C cooler than outside. Keeping sun and warm air out may help it stay that way.`
                    : `${selectedRoom.name} and the outdoors are at a similar temperature right now.`
                : selectedRoom
                  ? `Current conditions for ${selectedRoom.name.toLowerCase()} and the outdoors around ${settings.home.district}.`
                  : 'Add a room to start seeing indoor conditions.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/app/simulation">
                <Button variant="primary" size="sm" icon={<Wind className="size-3.5" />}>
                  Simulate airflow
                </Button>
              </Link>
              <Link to="/app/guidance">
                <Button size="sm" icon={<Lightbulb className="size-3.5" />}>
                  Read guidance
                </Button>
              </Link>
              <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={refreshData}>
                Refresh
              </Button>
            </div>
            {online.length > 0 && (
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
                <span className="flex -space-x-1.5">
                  {online.slice(0, 3).map((p) => (
                    <Avatar key={p.userId} name={p.name} color={p.color} size="xs" ring />
                  ))}
                </span>
                {online.map((p) => p.name.split(' ')[0]).join(', ')} {online.length === 1 ? 'is' : 'are'} also here now
              </p>
            )}
          </div>
          {selectedRoom && (
            <div className="relative hidden rounded-2xl bg-surface/70 p-4 ring-1 ring-breeze-100 backdrop-blur lg:block">
              <RoomPreview room={selectedRoom} className="mx-auto h-36 w-full" />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-ink-muted">Indoor</p>
                  <p className="tabular text-lg font-semibold">{fmtTemp(reading.data?.temperatureC)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-ink-muted">Outdoor</p>
                  <p className="tabular text-lg font-semibold">{fmtTemp(w?.temperatureC)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-ink-muted">Appliance heat</p>
                  <p className="tabular text-lg font-semibold">{Math.round(totalHeatNow(selectedRoom.appliances ?? [], new Date().getHours()))} W</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <AlertsBanner room={selectedRoom} />

      {weather.error && (
        <div className="mb-4">
          <ErrorState error={weather.error} onRetry={weather.reload} />
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={<Thermometer className="size-4" />}
          label={selectedRoom ? `Indoor temperature, ${selectedRoom.name}` : 'Indoor temperature'}
          value={reading.data?.temperatureC?.toFixed(1)}
          unit="°C"
          tone="sage"
          loading={reading.loading && !!selectedRoom}
          unavailable={!selectedRoom ? 'No room selected' : indoorUnavailable}
          detail={reading.data?.status === 'ok' ? `Measured ${fmtTime(reading.data.timestamp)}` : undefined}
          source={reading.data ? (reading.data.source === 'demo' ? 'Demo sensor' : `Sensor ${reading.data.sensorId ?? ''}`) : undefined}
          demo={reading.data?.source === 'demo'}
        />
        <MetricCard
          icon={<Droplets className="size-4" />}
          label="Indoor humidity"
          value={reading.data?.humidityPct != null ? Math.round(reading.data.humidityPct) : undefined}
          unit="%"
          tone="mist"
          loading={reading.loading && !!selectedRoom}
          unavailable={!selectedRoom ? 'No room selected' : indoorUnavailable}
          detail={
            reading.data?.humidityPct != null
              ? reading.data.humidityPct >= 70
                ? 'Humid; heat may feel stronger'
                : reading.data.humidityPct < 40
                  ? 'Relatively dry'
                  : 'Within a common comfort range'
              : undefined
          }
          source={reading.data ? (reading.data.source === 'demo' ? 'Demo sensor' : 'Room sensor') : undefined}
          demo={reading.data?.source === 'demo'}
        />
        <MetricCard
          icon={<CloudSun className="size-4" />}
          label="Outdoor temperature"
          value={w?.temperatureC?.toFixed(1)}
          unit="°C"
          tone="ochre"
          loading={weather.loading}
          unavailable={weather.error ? 'Could not load' : w && w.temperatureC == null ? 'Not reported' : null}
          detail={
            w && reading.data?.temperatureC != null && w.temperatureC != null
              ? `${fmtDelta(w.temperatureC - reading.data.temperatureC)} compared with indoors`
              : w
                ? `Humidity ${w.humidityPct ?? '—'}%`
                : undefined
          }
          source={w?.sourceLabel}
          demo={w?.source === 'demo'}
        />
        <MetricCard
          icon={<Gauge className="size-4" />}
          label="Outdoor air quality (PM2.5)"
          value={w?.pm25 != null ? Math.round(w.pm25) : undefined}
          unit=" µg/m³"
          tone={pmCat.tone === 'good' ? 'sage' : pmCat.tone === 'moderate' ? 'neutral' : 'ochre'}
          loading={weather.loading}
          unavailable={weather.error ? 'Could not load' : w && w.pm25 == null ? 'Not reported' : null}
          detail={
            w?.pm25 != null ? (
              <span>
                {pmCat.label} <span className="text-ink-muted">(US EPA 24-h scale, regional estimate)</span>
              </span>
            ) : undefined
          }
          source={w?.pm25Source}
          demo={w?.source === 'demo'}
        />
        <MetricCard
          icon={w ? <WeatherIcon condition={w.condition} className="size-4" night={new Date().getHours() >= 18 || new Date().getHours() < 6} /> : <CloudSun className="size-4" />}
          label="Weather conditions"
          value={w ? <span className="text-[26px]">{conditionLabel[w.condition]}</span> : undefined}
          tone="mist"
          loading={weather.loading}
          unavailable={weather.error ? 'Could not load' : null}
          detail={
            w ? (
              <span className="flex flex-wrap gap-x-3">
                <span>Rain chance {w.rainProbabilityPct ?? '—'}% (3 h)</span>
                <span className="inline-flex items-center gap-1">
                  <Wind className="size-3.5" /> {w.windSpeedMs?.toFixed(1) ?? '—'} m/s {windDirectionLabel(w.windDirectionDeg)}
                </span>
              </span>
            ) : undefined
          }
          source={w ? `${w.sourceLabel}, ${w.locationName}` : undefined}
          demo={w?.source === 'demo'}
        />
        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-ink-soft">Data source and status</span>
            <span className="grid size-8 place-items-center rounded-lg bg-canvas text-ink-soft">
              <Database className="size-4" />
            </span>
          </div>
          <dl className="mt-3 space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Mode</dt>
              <dd className="font-medium">{demo ? `Demo, ${scenarioLabel[settings.scenario].toLowerCase()}` : 'FastAPI backend'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Indoor sensor</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                {reading.data?.status === 'ok' ? (
                  <>
                    <CircleCheck className="size-3.5 text-breeze-600" /> Reporting
                  </>
                ) : reading.data ? (
                  <>
                    <TriangleAlert className="size-3.5 text-ochre-500" /> {reading.data.status}
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Weather feed</dt>
              <dd className="font-medium">{w ? 'Available' : weather.error ? 'Error' : '…'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Last updated</dt>
              <dd className="tabular font-medium">{weather.loadedAt ? fmtTime(weather.loadedAt) : '…'}</dd>
            </div>
          </dl>
          <Link to="/app/settings" className="mt-auto pt-4 text-xs font-medium text-breeze-700 hover:underline">
            Manage data sources
          </Link>
        </Card>
      </div>

      {/* Rooms */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.01em]">Your rooms</h2>
            <p className="text-[13px] text-ink-muted">Select a room to see its details below.</p>
          </div>
          <Button
            size="sm"
            icon={<Plus className="size-3.5" />}
            onClick={() => {
              addRoom()
              navigate('/app/rooms')
            }}
          >
            Add room
          </Button>
        </div>
        {rooms.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Box className="size-5" />}
              title="No rooms yet"
              description="Describe a room’s size, windows and doors to start monitoring it."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    addRoom()
                    navigate('/app/rooms')
                  }}
                >
                  Create your first room
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((r) => (
              <RoomCard key={r.id} room={r} reading={readings.data?.[r.id]} selected={r.id === selectedRoom?.id} onSelect={() => selectRoom(r.id)} />
            ))}
          </div>
        )}
      </section>

      {selectedRoom && <SelectedRoomPanel />}
    </div>
  )
}

function SelectedRoomPanel() {
  const { selectedRoom: room } = useRooms()
  const prediction = usePrediction(room)
  const guidance = useGuidance(room)
  if (!room) return null
  const p = prediction.data
  const top = guidance.result?.recommendations[0]

  const trendIcon =
    p?.deltaC == null ? null : p.deltaC > 0.1 ? (
      <ArrowUpRight className="size-4" />
    ) : p.deltaC < -0.1 ? (
      <ArrowDownRight className="size-4" />
    ) : (
      <Minus className="size-4" />
    )

  return (
    <section className="mt-10 grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title={room.name} description="Room details" action={<Link to="/app/rooms"><Button size="sm">Open room</Button></Link>} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-[13px]">
          {[
            ['Dimensions', `${room.dimensions.length} × ${room.dimensions.width} × ${room.dimensions.height} m`],
            ['Floor area', `${floorArea(room.dimensions).toFixed(1)} m²`],
            ['Volume', `${roomVolume(room.dimensions).toFixed(1)} m³`],
            ['Front wall faces', compassLabel[room.orientation]],
            ['Window area', `${windowArea(room).toFixed(2)} m²`],
            ['Openable window area', `${windowArea(room, true).toFixed(2)} m²`],
            ['Floor', `Level ${room.floorLevel}`],
            ['Cooling', [room.hasCeilingFan && 'Fan', room.hasAirConditioner && 'Air conditioner'].filter(Boolean).join(', ') || 'None recorded'],
            ['Appliances', `${(room.appliances ?? []).length} recorded`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-muted">{k}</dt>
              <dd className="tabular mt-0.5 font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          title="Next 60 minutes"
          description="Forecast indoor temperature"
          action={p?.isDemo ? <DemoLabel>Demo</DemoLabel> : undefined}
        />
        <div className="flex flex-1 flex-col p-5">
          {prediction.loading ? (
            <Skeleton className="h-16 w-40" />
          ) : prediction.error ? (
            <ErrorState error={prediction.error} onRetry={prediction.reload} compact />
          ) : p?.status !== 'ok' ? (
            <div className="rounded-xl border border-ochre-100 bg-ochre-50 p-4 text-[13px] text-ochre-700">
              <p className="font-medium">{p?.status === 'model-unavailable' ? 'Model unavailable' : 'Not enough data'}</p>
              <p className="mt-0.5 opacity-90">{p?.message}</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-4">
                <p className="tabular text-[40px] leading-none font-semibold tracking-[-0.03em] text-forecast-700">{fmtTemp(p.predictedTempC)}</p>
                <Badge tone={p.deltaC! > 0.1 ? 'ochre' : p.deltaC! < -0.1 ? 'mist' : 'neutral'} icon={trendIcon}>
                  {fmtDelta(p.deltaC)}
                </Badge>
              </div>
              <p className="mt-2 text-[13px] text-ink-muted">
                From {fmtTemp(p.currentTempC)} now, for {fmtTime(p.targetTime)}.
              </p>
            </>
          )}
          <p className="mt-auto pt-4 text-[11px] leading-4 text-ink-muted">
            {p?.isDemo ? 'DEMO DATA — NOT A REAL MODEL PREDICTION. ' : ''}Source: {p?.modelName ?? '…'}
          </p>
          <Link to="/app/prediction" className="mt-2 text-xs font-medium text-breeze-700 hover:underline">
            Open forecast details
          </Link>
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Top consideration" description="From the transparent guidance rules" icon={<Lightbulb className="size-4" />} />
        <div className="flex flex-1 flex-col p-5">
          {guidance.loading ? (
            <Skeleton className="h-20 w-full" />
          ) : top ? (
            <>
              <p className={cn('text-[15px] font-semibold', top.severity === 'caution' ? 'text-ochre-700' : 'text-ink')}>{top.title}</p>
              <p className="mt-1.5 line-clamp-4 text-[13px] leading-5 text-ink-soft">{top.suggestion}</p>
              {guidance.result!.recommendations.length > 1 && (
                <p className="mt-2 text-xs text-ink-muted">
                  {guidance.result!.recommendations.length - 1} more consideration{guidance.result!.recommendations.length > 2 ? 's' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">No rules are triggered for this room right now.</p>
          )}
          <Link to="/app/guidance" className="mt-auto pt-4 text-xs font-medium text-breeze-700 hover:underline">
            See all guidance
          </Link>
        </div>
      </Card>
    </section>
  )
}
