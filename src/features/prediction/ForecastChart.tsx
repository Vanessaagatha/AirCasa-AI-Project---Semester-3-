import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ForecastRecord, Prediction } from '@/types'
import { ChartTooltip, SeriesLegend, axisPropsFor, timeTick, useChartTheme } from '@/components/charts/chartTheme'

interface Row {
  t: number
  observed: number | null
  forecast: number | null
  upcoming: number | null
}

/**
 * Observed indoor temperature (solid) against what was forecast 60 minutes
 * earlier for the same time (dashed). The current forecast is drawn past the
 * "now" line as a separate dashed segment.
 */
export function ForecastChart({
  records,
  current,
  height = 300,
}: {
  records: ForecastRecord[]
  current?: Prediction | null
  height?: number
}) {
  const C = useChartTheme()
  const SERIES = C.series
  const axisProps = axisPropsFor(C)
  const { rows, span, now } = useMemo(() => {
    const rows: Row[] = records.map((r) => ({
      t: new Date(r.targetTime).getTime(),
      observed: r.observedTempC,
      forecast: r.predictedTempC,
      upcoming: null,
    }))
    const now = current ? new Date(current.generatedAt).getTime() : Date.now()
    if (current?.status === 'ok' && current.currentTempC != null && current.predictedTempC != null) {
      const last = rows[rows.length - 1]
      if (!last || last.t < now) rows.push({ t: now, observed: current.currentTempC, forecast: null, upcoming: current.currentTempC })
      else last.upcoming = current.currentTempC
      rows.push({ t: new Date(current.targetTime).getTime(), observed: null, forecast: null, upcoming: current.predictedTempC })
    }
    const span = rows.length ? (rows[rows.length - 1].t - rows[0].t) / 3_600_000 : 24
    return { rows, span, now }
  }, [records, current])

  return (
    <div>
      <div className="mb-3">
        <SeriesLegend
          items={[
            { key: 'observed', label: 'Observed indoor', color: SERIES.indoor },
            { key: 'forecast', label: 'Forecast made 60 min earlier', color: SERIES.forecast, dashed: true },
            ...(current?.status === 'ok' ? [{ key: 'upcoming', label: 'Current forecast', color: SERIES.forecast, dashed: true }] : []),
          ]}
        />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => timeTick(v, span)}
              minTickGap={40}
              {...axisProps}
            />
            <YAxis domain={['dataMin - 0.6', 'dataMax + 0.6']} tickFormatter={(v: number) => `${v.toFixed(0)}°`} width={48} {...axisProps} />
            <Tooltip content={<ChartTooltip unit="°C" />} cursor={{ stroke: C.cursor, strokeWidth: 1 }} />
            <ReferenceLine x={now} stroke={C.refLabel} strokeDasharray="2 3" label={{ value: 'Now', position: 'insideTopRight', fill: C.refLabel, fontSize: 11 }} />
            <Line type="monotone" dataKey="observed" name="Observed indoor" stroke={SERIES.indoor} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: C.dotRing }} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="forecast" name="Earlier forecast" stroke={SERIES.forecast} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: C.dotRing }} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey="upcoming" name="Current forecast" stroke={SERIES.forecast} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: SERIES.forecast, stroke: C.dotRing, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
