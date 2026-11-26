import { cn } from '@/lib/utils'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const SIZE = { xs: 'size-6 text-[10px]', sm: 'size-8 text-[11px]', md: 'size-10 text-sm', lg: 'size-20 text-2xl' }

export function Avatar({
  name,
  color,
  image,
  size = 'md',
  ring,
  className,
}: {
  name: string
  color: string
  image?: string
  size?: keyof typeof SIZE
  ring?: boolean
  className?: string
}) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white', SIZE[size], ring && 'ring-2 ring-surface', className)}
      style={{ backgroundColor: color }}
      title={name}
      aria-hidden
    >
      {image ? <img src={image} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  )
}
