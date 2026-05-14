import { useState, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Search, Settings, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'
import type { MediaItem } from '@/types'

interface NavBarProps {
  onItemClick: (item: MediaItem) => void
  onSettingsOpen: () => void
}

export function NavBar({ onItemClick, onSettingsOpen }: NavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { user } = useAuth()
  const { settings } = useSettings()

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.length >= 2,
    staleTime: 30000,
  })

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/movies', label: 'Movies' },
    { to: '/shows', label: 'TV Shows' },
    ...(settings.showMusic ? [{ to: '/music', label: 'Music' }] : []),
    { to: '/library', label: 'Library' },
    { to: '/stats', label: 'Stats' },
    { to: '/health', label: 'Health' },
  ]

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-8 gap-0 bg-gradient-to-b from-black/60 to-transparent">
        {/* Logo */}
        <span
          className="mr-8 text-[16px] tracking-[0.45em] text-[var(--accent)] cursor-pointer select-none"
          style={{ fontFamily: 'var(--font-display)' }}
          onClick={() => window.location.href = '/'}
        >
          CyanFin
        </span>

        {/* Nav links */}
        <div className="flex items-center gap-1 flex-1">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => cn(
                'px-3.5 py-1.5 rounded text-[10px] font-semibold tracking-[0.15em] uppercase transition-all border-none bg-none',
                isActive
                  ? 'text-[var(--accent)] bg-white/5'
                  : 'text-[var(--muted)] hover:text-[var(--cream)] hover:bg-white/5'
              )}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {user && (
            <span className="text-[10px] tracking-wide text-[var(--muted)] mr-1">{user.name}</span>
          )}
          <button
            onClick={() => setSearchOpen(true)}
            className="w-8 h-8 rounded-full bg-white/8 border border-white/8 text-[var(--muted)] hover:text-[var(--cream)] flex items-center justify-center transition-colors"
          >
            <Search size={14} />
          </button>
          <button
            onClick={onSettingsOpen}
            className="w-8 h-8 rounded-full bg-white/8 border border-white/8 text-[var(--muted)] hover:text-[var(--cream)] flex items-center justify-center transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </nav>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/88 backdrop-blur-xl flex flex-col items-center pt-16 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setSearchOpen(false); setQuery('') } }}
          >
            <div className="w-full max-w-2xl">
              <div className="relative mb-6">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setQuery('') } }}
                  placeholder="Search movies, shows, music…"
                  className="w-full pl-12 pr-5 py-4 rounded-3xl bg-white/8 border border-white/12 text-[var(--cream)] text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)] transition-colors"
                />
              </div>

              <div className="space-y-1 max-h-[65vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {isFetching && (
                  <p className="text-center text-[var(--muted)] text-sm py-4 italic">Searching…</p>
                )}
                {!isFetching && query.length >= 2 && results?.length === 0 && (
                  <p className="text-center text-[var(--muted)] text-sm py-4 italic">No results found</p>
                )}
                {results?.map(item => (
                  <motion.div
                    key={item.id}
                    className="flex gap-3.5 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => { setSearchOpen(false); setQuery(''); onItemClick(item) }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <img
                      src={item.posterUrl}
                      alt=""
                      className="w-11 h-16 object-cover rounded flex-shrink-0 bg-[var(--bg3)]"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                      <p className="text-sm font-bold text-[var(--cream)] truncate">{item.title}</p>
                      <p className="text-[10px] text-[var(--muted)]">
                        {[item.type, item.year, item.genre].filter(Boolean).join(' · ')}
                      </p>
                      {item.overview && (
                        <p className="text-[10px] text-[var(--muted)] line-clamp-2">{item.overview}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
