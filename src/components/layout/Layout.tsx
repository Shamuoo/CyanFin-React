import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Search, Settings, LogOut, Home, Film, Tv, Music, Wrench, BarChart2,
         Activity, Sparkles, Star, Download, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const t = setInterval(() =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 10000)
    return () => clearInterval(t)
  }, [])
  return <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>{time}</span>
}

export default function Layout() {
  const store = useStore()
  const { user, setUser, showMusic } = store
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { isTV, isPhone } = useDevice()

  useDpadNavigation(isTV)

  const { data: serverStatus } = useQuery({
    queryKey: ['servers-status-nav'], queryFn: api.serversStatus.bind(api),
    refetchInterval: 30_000, staleTime: 15_000, enabled: !!user, retry: false,
  })
  const { data: weather } = useQuery({
    queryKey: ['weather-nav', (store as any).city],
    queryFn: () => api.weather((store as any).city || 'Sydney'),
    enabled: !!user && !!(store as any).showWeather, staleTime: 15 * 60_000,
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

  useEffect(() => {
    document.documentElement.setAttribute('data-device',
      isTV ? 'tv' : isPhone ? 'phone' : 'desktop')
  }, [isTV, isPhone])

  const navLinks = [
    { to: '/',           icon: Home,       label: 'Home',        end: true },
    { to: '/movies',     icon: Film,       label: 'Movies' },
    { to: '/shows',      icon: Tv,         label: 'TV Shows' },
    ...(showMusic ? [{ to: '/music', icon: Music, label: 'Music' }] : []),
    { to: '/collections', icon: Star,      label: 'Collections' },
    { to: '/downloads',  icon: Download,   label: 'Downloads' },
  ]
  const adminLinks = [
    { to: '/library',    icon: Wrench,     label: 'Library' },
    { to: '/health',     icon: Activity,   label: 'Health' },
    { to: '/stats',      icon: BarChart2,  label: 'Stats' },
  ]
  const isAdmin = !!(user as any)?.isAdmin

  const StatusBar = () => (
    <>
      {(serverStatus as any)?.isOffline && (
        <div className="text-center py-1 text-[8px] font-bold tracking-widest uppercase"
          style={{ background: '#c0392b', color: '#fff' }}>
          ⚠ Offline — cached
        </div>
      )}
      {!(serverStatus as any)?.isOffline && (serverStatus as any)?.source === 'plex' && (
        <div className="text-center py-1 text-[8px] font-bold tracking-widest uppercase"
          style={{ background: '#cc8000', color: '#fff' }}>
          🟠 Plex Fallback
        </div>
      )}
    </>
  )

  // ── TV Layout ──────────────────────────────────────────────────────────────
  if (isTV) {
    return (
      <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>
        <aside className="flex flex-col flex-shrink-0 py-8 px-3 gap-1"
          style={{ width: 230, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--border2)' }}>
          <div className="px-3 mb-6">
            <span className="text-2xl tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</span>
            {(store as any).showClock && <div className="mt-1"><ClockDisplay /></div>}
          </div>
          {[...navLinks, ...(isAdmin ? adminLinks : [])].map(({ to, icon: Icon, label, end }: any) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[--accent] ${
                  isActive ? 'bg-[--accent] text-[--bg]' : 'text-[--muted] hover:bg-white/10 hover:text-white'}`}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
          <div className="mt-auto space-y-2 pt-4" style={{ borderTop: '1px solid var(--border2)' }}>
            <button onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[--accent]"
              style={{ color: 'var(--muted)' }}>
              <Settings size={16} /> Settings
            </button>
            <button onClick={async () => { await api.logout().catch(() => {}); setUser(null); navigate('/login') }}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[--accent]"
              style={{ color: 'var(--muted)' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-hidden"><Outlet /></main>
        <Screensaver /><ToastContainer />
        {aiOpen && <AINavigator onClose={() => setAiOpen(false)} />}
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        <DetailModal /><AudioBar />
      </div>
    )
  }

  // ── Phone Layout ───────────────────────────────────────────────────────────
  if (isPhone) {
    const bottomLinks = [
      { to: '/',       icon: Home,     label: 'Home',    end: true },
      { to: '/movies', icon: Film,     label: 'Movies' },
      { to: '/shows',  icon: Tv,       label: 'Shows' },
      { to: '/collections', icon: Star, label: 'Lists' },
      { to: '/downloads', icon: Download, label: 'Downloads' },
    ]
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
        <StatusBar />
        <nav className="flex items-center justify-between px-4 h-12 flex-shrink-0 z-50"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border2)' }}>
          <span className="text-base tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</span>
          <div className="flex gap-2">
            {(store as any).showClock && <ClockDisplay />}
            <button onClick={() => setSearchOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: 'var(--muted)', background: 'var(--subtle)', border: '1px solid var(--border2)' }}><Search size={16} /></button>
            <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: 'var(--muted)', background: 'var(--subtle)', border: '1px solid var(--border2)' }}><Settings size={16} /></button>
          </div>
        </nav>
        <main className="flex-1 overflow-hidden"><Outlet /></main>
        <nav className="flex-shrink-0 grid z-50"
          style={{ gridTemplateColumns: `repeat(${bottomLinks.length}, 1fr)`, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border2)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {bottomLinks.map(({ to, icon: Icon, label, end }: any) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${isActive ? 'text-[--accent]' : 'text-[--muted]'}`}>
              <Icon size={18} />
              <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
            </NavLink>
          ))}
        </nav>
        <ToastContainer />
        {aiOpen && <AINavigator onClose={() => setAiOpen(false)} />}
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        <DetailModal /><AudioBar />
      </div>
    )
  }

  // ── Desktop Layout: collapsible left sidebar ───────────────────────────────
  const W = collapsed ? 60 : 200

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg)', position: 'relative' }}>
      {(store as any).customBg && (
        <div className="absolute inset-0 pointer-events-none z-0"
          style={{ backgroundImage: 'url(/api/config/background)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1 }} />
      )}

      {/* Sidebar */}
      <aside className="flex flex-col flex-shrink-0 z-50 relative transition-all duration-200"
        style={{ width: W, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(24px)', borderRight: '1px solid var(--border2)' }}>

        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-4 h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border2)' }}>
          {!collapsed && (
            <span className="text-lg tracking-widest font-bold truncate"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</span>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 ml-auto flex-shrink-0"
            style={{ color: 'var(--muted)' }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Status bar */}
        <StatusBar />

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          {navLinks.map(({ to, icon: Icon, label, end }: any) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg transition-all group ${collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'} ${
                  isActive
                    ? 'bg-[--accent]/15 text-[--accent]'
                    : 'text-[--muted] hover:text-[--cream] hover:bg-white/5'
                }`}>
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && <span className="text-xs font-semibold tracking-wide uppercase truncate">{label}</span>}
            </NavLink>
          ))}

          {isAdmin && adminLinks.length > 0 && (
            <>
              {!collapsed && (
                <p className="text-[8px] font-bold tracking-[0.25em] uppercase px-3 pt-4 pb-1"
                  style={{ color: 'var(--muted)', opacity: 0.35 }}>Admin</p>
              )}
              {collapsed && <div className="my-2 mx-2" style={{ height: 1, background: 'var(--border2)' }} />}
              {adminLinks.map(({ to, icon: Icon, label }: any) => (
                <NavLink key={to} to={to} title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg transition-all ${collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'} ${
                      isActive ? 'bg-[--accent]/15 text-[--accent]' : 'text-[--muted] hover:text-[--cream] hover:bg-white/5'
                    }`}>
                  <Icon size={15} className="flex-shrink-0" />
                  {!collapsed && <span className="text-xs font-semibold tracking-wide uppercase truncate">{label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="flex-shrink-0 py-3 px-2 space-y-0.5" style={{ borderTop: '1px solid var(--border2)' }}>
          {!collapsed && (
            <div className="px-3 py-1 flex items-center justify-between">
              {(store as any).showClock && <ClockDisplay />}
              {weather && (store as any).showWeather && (
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {(weather as any).temp}° {(weather as any).description?.split(' ')[0]}
                </span>
              )}
            </div>
          )}
          {[
            { icon: Sparkles, label: 'AI', action: () => setAiOpen(true), accent: true },
            { icon: Search, label: 'Search', action: () => setSearchOpen(true) },
            { icon: Settings, label: 'Settings', action: () => setSettingsOpen(true) },
          ].map(({ icon: Icon, label, action, accent }: any) => (
            <button key={label} onClick={action} title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg transition-all hover:bg-white/8 ${collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'}`}
              style={{ color: accent ? 'var(--accent)' : 'var(--muted)' }}>
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>}
            </button>
          ))}
          {!collapsed && (
            <div className="px-3 py-1">
              <p className="text-[10px] truncate" style={{ color: 'var(--muted)', opacity: 0.5 }}>{user?.name}</p>
            </div>
          )}
          <button onClick={async () => { await api.logout().catch(() => {}); setUser(null); navigate('/login') }}
            title={collapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 rounded-lg transition-all hover:bg-white/8 ${collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'}`}
            style={{ color: 'var(--muted)' }}>
            <LogOut size={15} className="flex-shrink-0" />
            {!collapsed && <span className="text-xs font-semibold tracking-wide uppercase">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
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
