import { cn } from '@/lib/utils'

/** House outline with a breeze line passing through it: a home and its air. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#164c61" />
      <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="none" stroke="#edf6f8" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 19.5c3-1.6 5-1.6 8 0s5 1.6 8 0 4.2-1.3 6 0" fill="none" stroke="#88c2d3" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        CoolNest <span className="font-normal text-ink-muted">3D</span>
      </span>
    </span>
  )
}
