import { AirVent, Computer, CookingPot, Droplet, Fan, Flame, Lightbulb, Package, Refrigerator, Shirt, Tv, type LucideIcon } from 'lucide-react'
import type { ApplianceType } from '@/types'

const ICONS: Record<ApplianceType, LucideIcon> = {
  'ceiling-fan': Fan,
  'standing-fan': Fan,
  'air-conditioner': AirVent,
  refrigerator: Refrigerator,
  television: Tv,
  computer: Computer,
  lighting: Lightbulb,
  'rice-cooker': CookingPot,
  'water-dispenser': Droplet,
  stove: Flame,
  iron: Shirt,
  other: Package,
}

export function ApplianceIcon({ type, className }: { type: ApplianceType; className?: string }) {
  const Icon = ICONS[type]
  return <Icon className={className} aria-hidden />
}
