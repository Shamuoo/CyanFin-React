import { useEffect, Component, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import { useDpadNavigation } from '@/hooks/useDpadNavigation'

// Pages
import SetupPage from '@/pages/SetupPage'
import LoginPage from '@/pages/LoginPage'
import OnboardingPage from '@/pages/OnboardingPage'
import HomePage from '@/pages/HomePage'
import MoviesPage from '@/pages/MoviesPage'
import ShowsPage from '@/pages/ShowsPage'
import MusicPage from '@/pages/MusicPage'
import LibraryPage from '@/pages/LibraryPage'
import StatsPage from '@/pages/StatsPage'
import HealthPage from '@/pages/HealthPage'
import NowPlayingPage from '@/pages/NowPlayingPage'
import PlayerPage from '@/pages/PlayerPage'

// Layout
import Layout from '@/components/layout/Layout'
import ThemeProvider from '@/components/layout/ThemeProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60_000,
    },
  },
})

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error('[ErrorBoundary]', error) }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 16 }}>
          <p style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.1em' }}>Something went wrong</p>
          <p style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 400, textAlign: 'center' }}>{(this.state.error as Error).message}</p>
          <button onClick={() => this.setState({ error: null })}
            style={{ padding: '8px 20px', borderRadius: 20, background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function AuthGuard() {
  const { user, setUser, onboarded, setOnboarded, layout } = useStore()
  if (layout === 'tv') useDpadNavigation()

  // Listen for auth expiry
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [setUser])

  // Check server config — if Jellyfin not configured, force setup regardless of localStorage
  const { data: serverInfo, isLoading: checkingServer } = useQuery({
    queryKey: ['server-info'],
    queryFn: () => api.publicInfo(),
    retry: false,
    staleTime: 30_000,
  })

  // Check session
  const { isLoading: checkingSession } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const u = await api.me()
      setUser(u)
      return u
    },
    retry: false,
    enabled: !user && !!serverInfo?.configured,
    staleTime: Infinity,
  })

  const isLoading = checkingServer || (checkingSession && !!serverInfo?.configured)

  // Server says not configured — always show setup
  if (serverInfo && !serverInfo.configured) {
    if (onboarded) setOnboarded(false)
    return <Navigate to="/setup" replace />
  }

  if (!onboarded && !serverInfo?.configured) return <Navigate to="/setup" replace />
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function Spinner() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 32, height: 32, border: '2px solid', borderColor: 'rgba(255,255,255,0.1) rgba(255,255,255,0.1) rgba(255,255,255,0.1) var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              {/* Public — no auth needed */}
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Player — full screen, no layout chrome */}
              <Route path="/player" element={
                <ErrorBoundary>
                  <PlayerPage />
                </ErrorBoundary>
              } />

              {/* Authenticated routes */}
              <Route element={<AuthGuard />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
                  <Route path="/movies" element={<ErrorBoundary><MoviesPage /></ErrorBoundary>} />
                  <Route path="/shows" element={<ErrorBoundary><ShowsPage /></ErrorBoundary>} />
                  <Route path="/music" element={<ErrorBoundary><MusicPage /></ErrorBoundary>} />
                  <Route path="/library" element={<ErrorBoundary><LibraryPage /></ErrorBoundary>} />
                  <Route path="/stats" element={<ErrorBoundary><StatsPage /></ErrorBoundary>} />
                  <Route path="/health" element={<ErrorBoundary><HealthPage /></ErrorBoundary>} />
                  <Route path="/playing" element={<ErrorBoundary><NowPlayingPage /></ErrorBoundary>} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
