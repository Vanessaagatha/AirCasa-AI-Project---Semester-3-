/**
 * Reusable UI primitives. Kept in one file so the visual language is easy to audit.
 */
import { forwardRef, type HTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { CircleAlert, FlaskConical, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------- Card

export function Card({
  className,
  children,
  as: Tag = 'section',
  ...rest
}: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 text-ink-muted">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ----------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }
>(function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variant === 'primary' && 'bg-breeze-800 text-white hover:bg-breeze-900',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-breeze-50',
        variant === 'ghost' && 'text-ink-soft hover:bg-breeze-50 hover:text-ink',
        variant === 'danger' && 'border border-clay-100 bg-surface text-clay-700 hover:bg-clay-50',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

// ----------------------------------------------------------------- Badge

export type Tone = 'neutral' | 'sage' | 'mist' | 'ochre' | 'clay'

const toneClass: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-soft border-line',
  sage: 'bg-breeze-50 text-breeze-700 border-breeze-200',
  mist: 'bg-mist-50 text-mist-700 border-mist-100',
  ochre: 'bg-ochre-50 text-ochre-700 border-ochre-100',
  clay: 'bg-clay-50 text-clay-700 border-clay-100',
}

export function Badge({ tone = 'neutral', children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Shows where a number came from. Used next to every reading. */
export function SourceTag({ label, demo }: { label: string; demo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
      {demo && <FlaskConical className="size-3 text-ochre-500" aria-hidden />}
      {label}
    </span>
  )
}

export function DemoLabel({ children = 'Demo data', className }: { children?: ReactNode; className?: string }) {
  return (
    <Badge tone="ochre" icon={<FlaskConical className="size-3" aria-hidden />} className={className}>
      {children}
    </Badge>
  )
}

// ----------------------------------------------------------------- States

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-breeze-50 text-breeze-600">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, compact }: { error: Error | string; onRetry?: () => void; compact?: boolean }) {
  const message = typeof error === 'string' ? error : error.message
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-clay-100 bg-clay-50 text-clay-700',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        <p className="font-medium">Data could not be loaded</p>
        <p className="break-words opacity-90">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium hover:underline">
          <RefreshCw className="size-3.5" aria-hidden /> Retry
        </button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-breeze-100/70', className)} aria-hidden />
}

// ----------------------------------------------------------------- Form controls

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-breeze-500 focus:outline-none focus:ring-2 focus:ring-breeze-200 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputClass, 'appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a8580' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    >
      {children}
    </select>
  )
}

/** Number input with a unit suffix and a synced slider. */
export function MeasureInput({
  id,
  label,
  value,
  min,
  max,
  step = 0.05,
  unit = 'm',
  onChange,
  hint,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  hint?: ReactNode
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer"
          aria-label={`${label} slider`}
        />
        <div className="relative w-24 shrink-0">
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : ''}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (e.target.value !== '' && Number.isFinite(v)) onChange(v)
            }}
            className={cn(inputClass, 'tabular h-9 pr-7 text-right')}
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-muted">{unit}</span>
        </div>
      </div>
    </Field>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  id: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-line-strong transition-colors peer-checked:bg-breeze-700 peer-focus-visible:ring-2 peer-focus-visible:ring-breeze-300" />
        <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-xl border border-line bg-canvas p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[10px] font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------- Page header

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
