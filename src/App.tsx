import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SettingsProvider } from '@/context/SettingsContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
import { RoomsProvider } from '@/context/RoomsContext'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui'
import LandingPage from '@/pages/LandingPage'
import DashboardPage from '@/pages/DashboardPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { LoginPage, RegisterPage } from '@/pages/AuthPages'
import { recentlyLoggedOut } from '@/services/authService'

const RoomsPage = lazy(() => import('@/pages/RoomsPage'))
const EnvironmentPage = lazy(() => import('@/pages/EnvironmentPage'))
const PredictionPage = lazy(() => import('@/pages/PredictionPage'))
const SimulationPage = lazy(() => import('@/pages/SimulationPage'))
const GuidancePage = lazy(() => import('@/pages/GuidancePage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const HouseholdPage = lazy(() => import('@/pages/HouseholdPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  )
}

/** Sends visitors who are not logged in to the login page, then back where they were going. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="grid min-h-screen place-items-center text-sm text-ink-muted">Loading…</div>
  if (!user) {
    if (recentlyLoggedOut()) return <Navigate to="/login?reason=logout" replace />
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (ready && user) return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <AuthProvider>
          <HouseholdProvider>
            <RoomsProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
                  <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
                  <Route
                    path="/app"
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="rooms" element={<RoomsPage />} />
                    <Route path="environment" element={<EnvironmentPage />} />
                    <Route path="prediction" element={<PredictionPage />} />
                    <Route path="simulation" element={<SimulationPage />} />
                    <Route path="guidance" element={<GuidancePage />} />
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="household" element={<HouseholdPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="settings/:section" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage standalone />} />
                </Routes>
              </Suspense>
            </RoomsProvider>
          </HouseholdProvider>
        </AuthProvider>
      </BrowserRouter>
    </SettingsProvider>
  )
}
