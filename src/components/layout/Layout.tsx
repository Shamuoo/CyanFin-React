import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Search, Settings, LogOut, Home, Film, Tv, Music, Wrench, BarChart2,
         Activity, Sparkles, Star, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import SearchOverlay from '@/components/ui/SearchOverlay'
import SettingsPanel from '@/components/ui/SettingsPanel'
import AINavigator from '@/components/ui/AINavigator'
import DetailModal from '@/components/detail/DetailModal'
import AudioBar from '@/components/player/AudioBar'
import ToastContainer from '@/components/ui/Toast'
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts'
import Screensaver from '@/components/ui/Screensaver'
import { useDpadNavigation } from '@/hooks/useDpadNavigation'
import { useDevice } from '@/hooks/useDevice'

function ClockDisplay() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 10000)
    return () => clearInterval(t)
  }, [])
  return <span className="text-[11px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>{time}</span>
}

export default function Layout() {
  const store = useStore()
  const { user, setUser, showMusic } = store
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const { isTV, isPhone, isMobile } = useDevice()

  // Enable D-pad on TV
  useDpadNavigation(isTV)

  const { data: serverStatus } = useQuery({
    queryKey: ['servers-status-nav'],
    queryFn: api.serversStatus.bind(api),
    refetchInterval: 30_000, staleTime: 15_000, enabled: !!user, retry: false,
  })

  const { data: weather } = useQuery({
    queryKey: ['weather-nav', (store as any).city],
    queryFn: () => api.weather((store as any).city || 'Sydney'),
    enabled: !!user && !!(store as any).showWeather,
    staleTime: 15 * 60_000,
  })

  useEffect(() => {
    const handler = () => { setUser(null); navigate('/login') }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate, setUser])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); setAiOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Set TV class on root
  useEffect(() => {
    document.documentElement.setAttribute('data-device', isTV ? 'tv' : isPhone ? 'phone' : 'desktop')
  }, [isTV, isPhone])

  const navLinks = [
    { to: '/',           icon: <Home size={isTV ? 20 : 14} />,      label: 'Home',        end: true },
    { to: '/movies',     icon: <Film size={isTV ? 20 : 14} />,      label: 'Movies' },
    { to: '/shows',      icon: <Tv size={isTV ? 20 : 14} />,        label: 'TV Shows' },
    ...(showMusic ? [{ to: '/music', icon: <Music size={isTV ? 20 : 14} />, label: 'Music' }] : []),
    { to: '/collections', icon: <Star size={isTV ? 20 : 14} />,     label: 'Collections' },
    { to: '/downloads',  icon: <Download size={isTV ? 20 : 14} />,  label: 'Downloads' },
    { to: '/library',    icon: <Wrench size={isTV ? 20 : 14} />,    label: 'Library',    adminOnly: true },
    { to: '/health',     icon: <Activity size={isTV ? 20 : 14} />,  label: 'Health',     adminOnly: true },
    { to: '/stats',      icon: <BarChart2 size={isTV ? 20 : 14} />, label: 'Stats',      adminOnly: true },
  ]

  const visibleLinks = navLinks.filter(l => !(l as any).adminOnly || (user as any)?.isAdmin)

  // ── TV Layout ──────────────────────────────────────────────────────────────
  if (isTV) {
    return (
      <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}
        data-device="tv">
        {/* TV sidebar */}
        <aside className="flex flex-col flex-shrink-0 py-8 px-2 gap-1"
          style={{ width: 220, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--border2)' }}>
          <div className="px-4 mb-6">
            <span className="text-2xl tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</span>
            {(store as any).showClock && <div className="mt-1"><ClockDisplay /></div>}
          </div>

          {visibleLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={(link as any).end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[--accent] ${
                  isActive ? 'bg-[--accent] text-[--bg]' : 'text-[--muted] hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                }`}>
              {link.icon} {link.label}
            </NavLink>
          ))}

          <div className="mt-auto px-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border2)' }}>
            {(serverStatus as any)?.isOffline && (
              <p className="text-[9px] font-bold" style={{ color: '#e74c3c' }}>⚠ Offline</p>
            )}
            {(serverStatus as any)?.source === 'plex' && (
              <p className="text-[9px] font-bold" style={{ color: '#e5a00d' }}>🟠 Plex</p>
            )}
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{user?.name}</p>
            <button onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[--accent]"
              style={{ color: 'var(--muted)' }}>
              <Settings size={16} /> Settings
            </button>
            <button onClick={async () => { await api.logout().catch(() => {}); setUser(null); navigate('/login') }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[--accent]"
              style={{ color: 'var(--muted)' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </aside>

        {/* TV main */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>

        {/* Overlays */}
        <Screensaver />
        <ToastContainer />
        {aiOpen && <AINavigator onClose={() => setAiOpen(false)} />}
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        <DetailModal />
        <AudioBar />
      </div>
    )
  }

  // ── Phone Layout ───────────────────────────────────────────────────────────
  if (isPhone) {
    // Bottom nav shows 5 primary items
    const bottomLinks = [
      { to: '/',          icon: <Home size={18} />,  label: 'Home',     end: true },
      { to: '/movies',    icon: <Film size={18} />,  label: 'Movies' },
      { to: '/shows',     icon: <Tv size={18} />,    label: 'Shows' },
      { to: '/search',    icon: <Search size={18} />, label: 'Search' },
      { to: '/downloads', icon: <Download size={18} />, label: 'Downloads' },
    ]

    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
        {/* Banners */}
        {(serverStatus as any)?.isOffline && (
          <div className="text-center py-1.5 text-[9px] font-bold tracking-widest uppercase"
            style={{ background: '#e74c3c', color: '#fff' }}>
            ⚠ Offline — cached content
          </div>
        )}
        {!(serverStatus as any)?.isOffline && (serverStatus as any)?.source === 'plex' && (
          <div className="text-center py-1.5 text-[9px] font-bold tracking-widest uppercase"
            style={{ background: '#cc8000', color: '#fff' }}>
            🟠 Plex Fallback
          </div>
        )}

        {/* Top bar (minimal) */}
        <nav className="flex items-center justify-between px-4 h-12 flex-shrink-0 z-50"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border2)' }}>
          <span className="text-base tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</span>
          <div className="flex items-center gap-2">
            {(store as any).showClock && <ClockDisplay />}
            <button onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ color: 'var(--muted)', background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
              <Search size={16} />
            </button>
            <button onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ color: 'var(--muted)', background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
              <Settings size={16} />
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Outlet />
        </main>

        {/* Bottom tab bar */}
        <nav className="flex-shrink-0 grid z-50"
          style={{
            gridTemplateColumns: `repeat(${bottomLinks.length}, 1fr)`,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--border2)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
          {bottomLinks.map(link => (
            link.to === '/search'
              ? <button key="/search" onClick={() => setSearchOpen(true)}
                  className="flex flex-col items-center justify-center py-2.5 gap-0.5"
                  style={{ color: 'var(--muted)' }}>
                  <Search size={18} />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Search</span>
                </button>
              : <NavLink key={link.to} to={link.to} end={(link as any).end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                      isActive ? 'text-[--accent]' : 'text-[--muted]'
                    }`}>
                  {link.icon}
                  <span className="text-[9px] font-bold uppercase tracking-wide">{link.label}</span>
                </NavLink>
          ))}
        </nav>

        {/* Overlays */}
        <ToastContainer />
        {aiOpen && <AINavigator onClose={() => setAiOpen(false)} />}
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        <DetailModal />
        <AudioBar />
      </div>
    )
  }

  // ── Desktop Layout ─────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)', position: 'relative' }}>
      {(store as any).customBg && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'url(/api/config/background)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12, zIndex: 0 }} />
      )}

      {/* Banners */}
      {(serverStatus as any)?.isOffline && (
        <div className="text-center py-1.5 text-[9px] font-bold tracking-widest uppercase z-50 relative"
          style={{ background: '#e74c3c', color: '#fff' }}>
          ⚠ All servers offline — showing cached content
        </div>
      )}
      {!(serverStatus as any)?.isOffline && (serverStatus as any)?.source === 'plex' && (
        <div className="text-center py-1.5 text-[9px] font-bold tracking-widest uppercase z-50 relative"
          style={{ background: '#cc8000', color: '#fff' }}>
          🟠 Plex Fallback Active
        </div>
      )}

      {/* Top nav */}
      <nav className="flex-shrink-0 flex items-center h-14 px-6 gap-1 z-50 relative"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border2)' }}>
        <span className="mr-5 text-lg tracking-widest flex-shrink-0" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
          CyanFin
        </span>
        <div className="flex gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
          {visibleLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={(link as any).end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive ? 'text-[--accent] bg-[--subtle]' : 'text-[--muted] hover:text-[--cream] hover:bg-[--subtle]'
                }`}>
              {link.icon}{link.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {(store as any).showClock && <ClockDisplay />}
          {weather && (store as any).showWeather && (
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {(weather as any).temp}°{(store as any).units || 'C'} {(weather as any).description}
            </span>
          )}
          <span className="text-xs hidden md:block" style={{ color: 'var(--muted)' }}>{user?.name}</span>
          <button onClick={() => setAiOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border)', color: 'var(--accent)' }} title="AI (⌘I)">
            <Sparkles size={13} />
          </button>
          <button onClick={() => setSearchOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <Search size={13} />
          </button>
          <button onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <Settings size={13} />
          </button>
          <button onClick={async () => { await api.logout().catch(() => {}); setUser(null); navigate('/login') }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <LogOut size={13} />
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden z-10 relative">
        <Outlet />
      </main>

      <Screensaver />
      <ToastContainer />
      <KeyboardShortcuts />
      {aiOpen && <AINavigator onClose={() => setAiOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <DetailModal />
      <AudioBar />
    </div>
  )
}
