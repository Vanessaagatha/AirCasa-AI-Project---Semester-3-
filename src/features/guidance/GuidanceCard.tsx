import { useState, type ReactNode } from 'react'
import { ChevronDown, CloudRain, Database, Droplets, Gauge, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react'
import type { Recommendation, RecommendationCategory, RecommendationSeverity } from '@/types'
import { Badge, type Tone } from '@/components/ui'
import { cn } from '@/lib/utils'

const CATEGORY_ICON: Record<RecommendationCategory, LucideIcon> = {
  heat: Thermometer,
  ventilation: Wind,
  'air-quality': Gauge,
  rain: CloudRain,
  shading: Sun,
  humidity: Droplets,
  'data-quality': Database,
}

const SEVERITY: Record<RecommendationSeverity, { label: string; tone: Tone; bar: string; icon: string }> = {
  caution: { label: 'Caution', tone: 'ochre', bar: 'bg-ochre-500', icon: 'bg-ochre-100 text-ochre-700' },
  consider: { label: 'Worth considering', tone: 'sage', bar: 'bg-breeze-500', icon: 'bg-breeze-100 text-breeze-700' },
  info: { label: 'For information', tone: 'mist', bar: 'bg-mist-400', icon: 'bg-mist-100 text-mist-700' },
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[22px_1fr] gap-x-3">
      <span className="tabular mt-0.5 grid size-[22px] place-items-center rounded-full bg-canvas text-[11px] font-semibold text-ink-muted ring-1 ring-line">
        {step}
      </span>
      <div>
        <h4 className="text-xs font-semibold text-ink-muted">{title}</h4>
        <div className="mt-1 text-[13.5px] leading-[1.6] text-ink">{children}</div>
      </div>
    </div>
  )
}

export function GuidanceCard({ rec }: { rec: Recommendation }) {
  const [showRule, setShowRule] = useState(false)
  const Icon = CATEGORY_ICON[rec.category]
  const sev = SEVERITY[rec.severity]
  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <span className={cn('absolute inset-y-0 left-0 w-1', sev.bar)} aria-hidden />
      <header className="flex items-start gap-3 px-5 pt-5 pl-6">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', sev.icon)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{rec.title}</h3>
            <Badge tone={sev.tone}>{sev.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">Rule: {rec.ruleId}</p>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-4 pb-5 pl-6">
        <Section step={1} title="Detected condition">
          {rec.detectedCondition}
        </Section>
        <Section step={2} title="Suggested consideration">
          {rec.suggestion}
        </Section>
        <Section step={3} title="Why it may matter">
          <span className="text-ink-soft">{rec.rationale}</span>
        </Section>
        <Section step={4} title="Supporting data">
          <dl className="mt-1 grid gap-x-4 gap-y-2 rounded-xl bg-canvas p-3 sm:grid-cols-2">
            {rec.supportingData.map((d) => (
              <div key={d.label} className="min-w-0">
                <dt className="truncate text-[11px] text-ink-muted">{d.label}</dt>
                <dd className="tabular text-[13px] font-medium">
                  {d.value}
                  {d.source && <span className="ml-1.5 text-[11px] font-normal text-ink-muted">({d.source})</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section step={5} title="Uncertainty and limitations">
          <span className="text-ink-soft">{rec.limitations}</span>
        </Section>
      </div>

      <footer className="border-t border-line px-5 py-3 pl-6">
        <button onClick={() => setShowRule((s) => !s)} aria-expanded={showRule} className="flex items-center gap-1.5 text-xs font-medium text-breeze-700">
          <ChevronDown className={cn('size-3.5 transition-transform', showRule && 'rotate-180')} />
          How this was decided
        </button>
        {showRule && <p className="mt-2 text-xs leading-5 text-ink-muted">{rec.ruleDescription}</p>}
      </footer>
    </article>
  )
}
