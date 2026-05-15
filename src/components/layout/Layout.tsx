import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Search, Settings, LogOut, Home, Film, Tv, Music, Wrench, BarChart2, Activity } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import SearchOverlay from '@/components/ui/SearchOverlay'
import SettingsPanel from '@/components/ui/SettingsPanel'
import DetailModal from '@/components/detail/DetailModal'
import AudioBar from '@/components/player/AudioBar'

export default function Layout() {
  const { user, setUser, showMusic, mode } = useStore()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Listen for auth expiry
  useEffect(() => {
    const handler = () => { setUser(null); navigate('/login') }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate, setUser])

  // Cmd+K search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

 const navLinks = [
    { to: '/', icon: <Home size={14} />, label: 'Home', end: true },
    { to: '/movies', icon: <Film size={14} />, label: 'Movies' },
    { to: '/shows', icon: <Tv size={14} />, label: 'TV Shows' },
    ...(showMusic ? [{ to: '/music', icon: <Music size={14} />, label: 'Music' }] : []),
    { to: '/library', icon: <Wrench size={14} />, label: 'Library' },
    { to: '/stats', icon: <BarChart2 size={14} />, label: 'Stats' },
    { to: '/health', icon: <Activity size={14} />, label: 'Health' },
  ]
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Nav */}
      <nav className="flex-shrink-0 flex items-center h-14 px-8 gap-1 z-50 relative"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border2)' }}>
        <span className="mr-6 text-lg tracking-widest" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
          CyanFin
        </span>
        <div className="flex gap-1 flex-1">
          {navLinks.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase transition-all ${
                  isActive ? 'text-[--accent] bg-[--subtle]' : 'text-[--muted] hover:text-[--cream] hover:bg-[--subtle]'
                }`}>
              {link.icon}{link.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{user?.name}</span>
          <button onClick={() => setSearchOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <Search size={14} />
          </button>
          <button onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <Settings size={14} />
          </button>
          <button onClick={async () => { await api.logout().catch(() => {}); setUser(null); navigate('/login') }}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-[--subtle]"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Overlays */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <DetailModal />
      <AudioBar />
    </div>
  )
}
