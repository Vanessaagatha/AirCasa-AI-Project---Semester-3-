import { useMemo, useState } from 'react'
import { Brush, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip, SeriesLegend, axisPropsFor, timeTick, useChartTheme } from './chartTheme'

export interface SeriesDef {
  key: string
  label: string
  color: string
  dashed?: boolean
}

export interface RefLine {
  y: number
  label: string
}

/** Generic single-axis time series line chart with toggleable legend and optional brush zoom. */
export function TimeSeriesChart<T extends { t: number }>({
  data,
  series,
  unit,
  height = 260,
  brush = false,
  refLines = [],
  yTickFormat,
  yDomain = ['auto', 'auto'],
}: {
  data: T[]
  series: SeriesDef[]
  unit: string
  height?: number
  brush?: boolean
  refLines?: RefLine[]
  yTickFormat?: (v: number) => string
  yDomain?: [number | string, number | string]
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const C = useChartTheme()
  const axisProps = axisPropsFor(C)
  const span = useMemo(() => (data.length > 1 ? (data[data.length - 1].t - data[0].t) / 3_600_000 : 24), [data])
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3">
          <SeriesLegend items={series} hidden={hidden} onToggle={toggle} />
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => timeTick(v, span)}
              minTickGap={48}
              {...axisProps}
            />
            <YAxis domain={yDomain} tickFormatter={yTickFormat} width={52} {...axisProps} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: C.cursor, strokeWidth: 1 }} />
            {refLines.map((r) => (
              <ReferenceLine
                key={r.label}
                y={r.y}
                stroke={C.refLine}
                strokeDasharray="3 3"
                label={{ value: r.label, position: 'insideTopLeft', fill: C.refLabel, fontSize: 10 }}
              />
            ))}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: C.dotRing }}
                hide={hidden.has(s.key)}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {brush && data.length > 20 && (
              <Brush dataKey="t" height={22} stroke={C.brushStroke} fill={C.brushFill} travellerWidth={8} tickFormatter={(v: number) => timeTick(v, span)} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
