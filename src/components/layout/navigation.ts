import { Box, ChartLine, CloudSun, History, LayoutDashboard, Lightbulb, Settings, UserRound, Users, Wind, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, description: 'Current conditions across your home' },
      { to: '/app/rooms', label: 'My Rooms', icon: Box, description: 'Room dimensions, openings, appliances and 3D model' },
      { to: '/app/simulation', label: 'Airflow & Heat', icon: Wind, description: 'Simplified airflow and heat simulation' },
      { to: '/app/household', label: 'Household', icon: Users, description: 'Members, roles, comments and activity' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/app/environment', label: 'Environmental Data', icon: CloudSun, description: 'Weather, outlook and air quality' },
      { to: '/app/prediction', label: 'AI Prediction', icon: ChartLine, description: 'Indoor temperature 60 minutes ahead' },
      { to: '/app/guidance', label: 'Smart Guidance', icon: Lightbulb, description: 'Rule-based ventilation considerations' },
      { to: '/app/history', label: 'History & Analytics', icon: History, description: 'Observed and forecast values over time' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/app/profile', label: 'Profile', icon: UserRound, description: 'Your details and password' },
      { to: '/app/settings', label: 'Settings', icon: Settings, description: 'Preferences, data sources and privacy' },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
