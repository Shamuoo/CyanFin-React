import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useStore()
  const { isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: api.me.bind(api),
    retry: false,
    enabled: !user,
  })

  useEffect(() => {
    if (isError) setUser(null)
  }, [isError, setUser])

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  return <>{children}</>
}

export default function App() {
  const { user, onboarded } = useStore()

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthGuard>
          <Routes>
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
              <Route index element={!onboarded ? <Navigate to="/onboarding" /> : <HomePage />} />
              <Route path="movies" element={<MoviesPage />} />
              <Route path="shows" element={<ShowsPage />} />
              <Route path="music" element={<MusicPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="playing" element={<NowPlayingPage />} />
            </Route>
            <Route path="/player" element={user ? <PlayerPage /> : <Navigate to="/login" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthGuard>
      </BrowserRouter>
    </ThemeProvider>
  )
}
