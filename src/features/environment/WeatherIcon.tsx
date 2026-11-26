import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSun, Haze, Moon, Sun } from 'lucide-react'
import type { WeatherCondition } from '@/types'

export function WeatherIcon({ condition, className, night }: { condition: WeatherCondition; className?: string; night?: boolean }) {
  switch (condition) {
    case 'clear':
      return night ? <Moon className={className} /> : <Sun className={className} />
    case 'partly-cloudy':
      return <CloudSun className={className} />
    case 'cloudy':
      return <Cloud className={className} />
    case 'haze':
      return <Haze className={className} />
    case 'light-rain':
      return <CloudDrizzle className={className} />
    case 'rain':
      return <CloudRain className={className} />
    case 'thunderstorm':
      return <CloudLightning className={className} />
  }
}
