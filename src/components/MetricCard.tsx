import type { ReactNode } from 'react'
import { Card, Skeleton, SourceTag } from './ui'
import { cn } from '@/lib/utils'

export type MetricTone = 'sage' | 'mist' | 'ochre' | 'clay' | 'neutral'

const iconTone: Record<MetricTone, string> = {
  sage: 'bg-breeze-100 text-breeze-700',
  mist: 'bg-mist-100 text-mist-700',
  ochre: 'bg-ochre-100 text-ochre-700',
  clay: 'bg-clay-100 text-clay-700',
  neutral: 'bg-canvas text-ink-soft',
}

export function MetricCard({
  icon,
  label,
  value,
  unit,
  detail,
  tone = 'sage',
  source,
  demo,
  loading,
  unavailable,
  className,
  children,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  unit?: string
  detail?: ReactNode
  tone?: MetricTone
  source?: string
  demo?: boolean
  loading?: boolean
  unavailable?: string | null
  className?: string
  children?: ReactNode
}) {
  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        <span className={cn('grid size-8 place-items-center rounded-lg', iconTone[tone])}>{icon}</span>
      </div>
      <div className="mt-3 min-h-[44px]">
        {loading ? (
          <Skeleton className="h-9 w-28" />
        ) : unavailable ? (
          <div>
            <p className="text-[28px] leading-9 font-semibold text-ink-muted">—</p>
            <p className="text-xs text-clay-700">{unavailable}</p>
          </div>
        ) : (
          <p className="tabular text-[32px] leading-10 font-semibold tracking-[-0.03em] text-ink">
            {value}
            {unit && <span className="ml-0.5 text-lg font-medium text-ink-muted">{unit}</span>}
          </p>
        )}
      </div>
      {detail && !loading && <div className="mt-1 text-[13px] text-ink-muted">{detail}</div>}
      {children}
      {source && (
        <div className="mt-auto pt-4">
          <SourceTag label={source} demo={demo} />
        </div>
      )}
    </Card>
  )
}
