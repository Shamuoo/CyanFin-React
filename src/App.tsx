import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { useDpadNavigation } from '@/hooks/useDpadNavigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import OnboardingPage from '@/pages/OnboardingPage'
import HomePage from '@/pages/HomePage'
import MoviesPage from '@/pages/MoviesPage'
import ShowsPage from '@/pages/ShowsPage'
import MusicPage from '@/pages/MusicPage'
import LibraryPage from '@/pages/LibraryPage'
import StatsPage from '@/pages/StatsPage'
import HealthPage from '@/pages/HealthPage'
import PlayerPage from '@/pages/PlayerPage'
import NowPlayingPage from '@/pages/NowPlayingPage'
import SetupPage from '@/pages/SetupPage'

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, layout, mode } = useStore()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (layout !== 'desktop') document.documentElement.setAttribute('data-layout', layout)
    else document.documentElement.removeAttribute('data-layout')
    document.documentElement.setAttribute('data-mode', mode)
  }, [theme, layout, mode])
  return <>{children}</>
}

export default function App() {
  const { user, setUser, onboarded, layout } = useStore()
  if (layout === 'tv') useDpadNavigation()

  // Listen for auth expiry from api client
  useEffect(() => {
    const handler = () => { setUser(null) }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [setUser])

  // Check session on mount — skip if not onboarded (show setup instead)
  const { isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const u = await api.me()
      setUser(u)
      return u
    },
    retry: false,
    enabled: !user && onboarded,
  })

  // Not onboarded — go straight to setup, no spinner needed
  if (!onboarded) {
    return (
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<SetupPage />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    )
  }

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, border: '2px solid', borderColor: 'rgba(255,255,255,0.1) rgba(255,255,255,0.1) rgba(255,255,255,0.1) var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
          <Route path="/onboarding" element={user ? <OnboardingPage /> : <Navigate to="/login" replace />} />
          <Route path="/" element={user ? <Layout /> : <Navigate to={!onboarded ? "/setup" : "/login"} replace />}>
            <Route index element={!onboarded ? <Navigate to="/setup" replace /> : <HomePage />} />
            <Route path="movies" element={<MoviesPage />} />
            <Route path="shows" element={<ShowsPage />} />
            <Route path="music" element={<MusicPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="playing" element={<NowPlayingPage />} />
          </Route>
          <Route path="/player" element={user ? <PlayerPage /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to={!onboarded ? "/setup" : "/"} replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
