import { useEffect, useState, Component, type ReactNode } from 'react'
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
import UpcomingPage from '@/pages/UpcomingPage'
import PersonPage from '@/pages/PersonPage'
import CollectionsPage from '@/pages/CollectionsPage'
import HistoryPage from '@/pages/HistoryPage'
import PeoplePage from '@/pages/PeoplePage'
import StudiosPage from '@/pages/StudiosPage'
import ServersPage from '@/pages/ServersPage'
import UsersPage from '@/pages/UsersPage'
import DownloadsPage from '@/pages/DownloadsPage'
import PlayerPage from '@/pages/PlayerPage'

// Layout
import Layout from '@/components/layout/Layout'
import ThemeProvider from '@/components/layout/ThemeProvider'
import { toast } from '@/components/ui/Toast'

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
    const handler = () => {
      setUser(null)
      toast.warn('Session expired — please sign in again')
    }
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

  // Wait for server info before routing — prevents flash to setup
  if (checkingServer) return <Spinner />

  // ONLY show setup if server has no Jellyfin URL configured
  // Never trigger from localStorage flag on minor updates
  if (serverInfo && !serverInfo.configured) {
    return <Navigate to="/setup" replace />
  }

  // Server is configured — go to login/home
  if (checkingSession) return <Spinner />
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
function OfflineBanner() {
  const { data: status } = useQuery({
    queryKey: ['ha-status-banner'],
    queryFn:  () => api.get<any>('/api/servers/status'),
    refetchInterval: 10_000,
    staleTime: 8_000,
  })
  const offline = (status as any)?.isOffline
  if (!offline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-center gap-2 py-2 text-xs font-bold"
      style={{ background: '#e74c3c', color: 'white', letterSpacing: '0.05em' }}>
      <span className="animate-pulse">⚠</span>
      All servers unreachable — retrying every 10s
    </div>
  )
}

function ChangelogModal({ onClose }: { onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['changelog'], queryFn: () => api.changelog(), staleTime: Infinity })
  const cl = (data as any)?.changelog || ''
  const lines = cl.split('\n').slice(0, 40)
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border2)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--cream)' }}>What's New</p>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}>✕</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-80 text-xs space-y-1" style={{ color: 'var(--muted)' }}>
          {lines.map((l: string, i: number) => (
            <p key={i} style={{ color: l.startsWith('##') ? 'var(--accent)' : l.startsWith('-') ? 'var(--cream)' : 'var(--muted)' }}>{l}</p>
          ))}
        </div>
        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border2)' }}>
          <button onClick={onClose} className="w-full py-2 rounded-full text-xs font-bold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Got it</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [showChangelog, setShowChangelog] = useState(false)

  useEffect(() => {
    const VERSION = '0.19.1'
    const seen = localStorage.getItem('cf_changelog_seen')
    if (seen !== VERSION) {
      setTimeout(() => setShowChangelog(true), 2000)
      localStorage.setItem('cf_changelog_seen', VERSION)
    }
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <OfflineBanner />
        {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
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
                  <Route path="/upcoming" element={<ErrorBoundary><UpcomingPage /></ErrorBoundary>} />
                  <Route path="/person/:id" element={<ErrorBoundary><PersonPage /></ErrorBoundary>} />
                  <Route path="/users" element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
                  <Route path="/servers" element={<ErrorBoundary><ServersPage /></ErrorBoundary>} />
                  <Route path="/people" element={<ErrorBoundary><PeoplePage /></ErrorBoundary>} />
                  <Route path="/studios" element={<ErrorBoundary><StudiosPage /></ErrorBoundary>} />
                  <Route path="/history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
                  <Route path="/collections" element={<ErrorBoundary><CollectionsPage /></ErrorBoundary>} />
                  <Route path="/downloads" element={<ErrorBoundary><DownloadsPage /></ErrorBoundary>} />
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
