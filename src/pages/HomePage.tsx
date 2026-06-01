import { useNavigate } from 'react-router-dom'
import { useRef, useCallback, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Info, Settings2, GripVertical, Eye, EyeOff } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import MediaRow from '@/components/ui/MediaRow'
import type { MediaItem } from '@/types'

// ── Section definitions ──
const ALL_SECTIONS = [
  { key: 'nextup',      label: 'New Episodes', default: true,         query: () => api.nextUp() },
  { key: 'continue',    label: 'Continue Watching',    query: () => api.continueWatching() },
  { key: 'recent',      label: 'Recently Added',       query: () => api.recentlyAdded() },
  { key: 'popular',     label: 'Popular',              query: () => api.popular() },
  { key: 'watchlist',   label: 'Shared Watchlist',      query: async () => { const d = await api.sharedWatchlist(); return d.items || [] } },
  { key: 'history',     label: 'Watch History',        query: () => api.history() },
  { key: 'shows',       label: 'TV Shows',             query: () => api.shows({ sort: 'DateCreated', order: 'Descending', limit: 20 }).then(r => r.items || []) },
  { key: 'toprated',    label: 'Top Rated',            query: () => api.movies({ sort: 'CommunityRating', order: 'Descending', limit: 20 }).then(r => r.items || []) },
  { key: 'collections', label: 'Collections',          query: () => api.collections() },
  { key: 'best3d',      label: 'Best in 3D',           query: () => api.best3D() },
  { key: 'upcoming',    label: 'Upcoming Releases',    query: () => api.get<any[]>('/api/upcoming/movies').catch(() => []) },
  { key: 'action',      label: 'Action',               query: () => api.movies({ genre: 'Action',   limit: 20 }).then(r => r.items || []) },
  { key: 'comedy',      label: 'Comedy',               query: () => api.movies({ genre: 'Comedy',   limit: 20 }).then(r => r.items || []) },
  { key: 'drama',       label: 'Drama',                query: () => api.movies({ genre: 'Drama',    limit: 20 }).then(r => r.items || []) },
  { key: 'scifi',       label: 'Sci-Fi',               query: () => api.movies({ genre: 'Science Fiction', limit: 20 }).then(r => r.items || []) },
  { key: 'horror',      label: 'Horror',               query: () => api.movies({ genre: 'Horror',   limit: 20 }).then(r => r.items || []) },
  { key: 'documentary', label: 'Documentaries',        query: () => api.movies({ genre: 'Documentary', limit: 20 }).then(r => r.items || []) },
  { key: 'trending',    label: 'Trending This Week',  query: () => api.trending() },
  { key: 'because',     label: 'Because You Watched', query: async () => {
      const d = await api.get<any>('/api/because-you-watched')
      return d.rows?.[0]?.items || []
    } },
  { key: 'random',      label: 'Random Pick',          query: () => api.random() },
]

// Fixed rows always shown first, genre rows randomised
const GENRE_MAP: Record<string, string> = {
  action: 'Action', comedy: 'Comedy', drama: 'Drama', scifi: 'Science Fiction',
  horror: 'Horror', thriller: 'Thriller', documentary: 'Documentary',
  animation: 'Animation', romance: 'Romance', crime: 'Crime', family: 'Family',
}

const FIXED_TOP = ['nextup','continue','because','newmovies','recent','trending']
const FIXED_BOTTOM = ['history','random']
const GENRE_ROWS = ALL_SECTIONS.map(s => s.key).filter(k => !FIXED_TOP.includes(k) && !FIXED_BOTTOM.includes(k))

function shuffleOnce<T>(arr: T[], seed = 1): T[] {
  // Deterministic daily shuffle so it changes each day but is consistent per session
  const day = Math.floor(Date.now() / 86_400_000)
  let s = seed + day
  return [...arr].sort(() => { s ^= s << 13; s ^= s >> 7; s ^= s << 17; return (s % 3) - 1 })
}

const DEFAULT_ORDER = [
  ...FIXED_TOP,
  ...shuffleOnce(GENRE_ROWS),
  ...FIXED_BOTTOM,
]
const DEFAULT_HIDDEN = ['best3d','animation','romance','crime','family']

export default function HomePage() {
  const { setDetailItemId, setPlayingItem, homeSectionOrder, homeSectionHidden, setHomeSections } = useStore()
  const [configOpen, setConfigOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [showEditor, setShowEditor] = useState(false)


  const [dragOver, setDragOver] = useState<number | null>(null)

  // Merge any new sections added in updates into saved order
  const order = (() => {
    const saved = homeSectionOrder?.length ? homeSectionOrder : DEFAULT_ORDER
    const allKeys = ALL_SECTIONS.map(s => s.key)
    const missing = allKeys.filter(k => !saved.includes(k))
    return missing.length ? [...saved, ...missing] : saved
  })()
  const hidden = homeSectionHidden || DEFAULT_HIDDEN

  const sections = order
    .map(key => ALL_SECTIONS.find(s => s.key === key))
    .filter(Boolean) as typeof ALL_SECTIONS

  // Hero
  const { data: heroRecent } = useQuery({ queryKey: ['hero-recent'], queryFn: () => api.recentlyAdded(), staleTime: 60_000 })
  const heroItems = (heroRecent as any[] || []).filter((i: any) => i.backdropUrl).slice(0, 8)
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => {
    if (heroItems.length <= 1) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % heroItems.length), 7000)
    return () => clearInterval(t)
  }, [heroItems.length])
  // Hero keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target !== document.body) return
      if (e.key === 'ArrowLeft')  setHeroIdx(i => (i - 1 + heroItems.length) % heroItems.length)
      if (e.key === 'ArrowRight') setHeroIdx(i => (i + 1) % heroItems.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [heroItems.length])

  const heroItem = heroItems.length > 0 ? heroItems[heroIdx % heroItems.length] : null

  const handlePlay = async (item: MediaItem) => {
    try {
      const info = await api.playbackInfo(item.id)
      setPlayingItem({ id: item.id, title: item.title ?? '', streamUrl: info.streamUrl, hlsUrl: info.hlsUrl } as any)
    } catch(e) {}
  }

  // Drag/drop for section config
  const onDragStart = (i: number) => setDragIdx(i)
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i) }
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOver(null); return }
    const newOrder = [...order]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(i, 0, moved)
    setHomeSections(newOrder, hidden)
    setDragIdx(null); setDragOver(null)
  }
  const toggleHidden = (key: string) => {
    const newHidden = hidden.includes(key) ? hidden.filter(h => h !== key) : [...hidden, key]
    setHomeSections(order, newHidden)
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>

      {/* Home layout editor */}
      {showEditor && (
        <div className="mx-4 mt-4 mb-2 rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--accent)', opacity: 0.5 }}>Customise Home</p>
            <button onClick={() => setShowEditor(false)} style={{ color: 'var(--muted)', fontSize: 12 }}>✕</button>
          </div>
          <p className="text-[9px] mb-3" style={{ color: 'var(--muted)', opacity: 0.5 }}>Drag rows on the page to reorder. Toggle visibility below.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_SECTIONS.map(sec => {
              const isHidden = hidden.includes(sec.key)
              return (
                <button key={sec.key}
                  onClick={() => {
                    const newHidden = isHidden ? hidden.filter(k => k !== sec.key) : [...hidden, sec.key]
                    const newOrder = order.includes(sec.key) ? order : [...order, sec.key]
                    setHomeSections(newOrder, newHidden)
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:opacity-80"
                  style={{ background: isHidden ? 'var(--subtle)' : 'rgba(201,168,76,0.08)', border: `1px solid ${isHidden ? 'var(--border2)' : 'var(--border)'}` }}>
                  <span style={{ fontSize: 11 }}>{isHidden ? '○' : '●'}</span>
                  <span className="text-[10px] font-bold" style={{ color: isHidden ? 'var(--muted)' : 'var(--accent)' }}>{sec.label}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => setHomeSections(DEFAULT_ORDER, [])}
            className="mt-3 text-[9px] hover:opacity-70"
            style={{ color: 'var(--muted)', opacity: 0.4 }}>
            Reset to defaults
          </button>
        </div>
      )}

      {/* Layout edit button */}
      <div className="sticky top-0 z-10" style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 right-4" style={{ pointerEvents: 'all' }}>
        <button onClick={() => setShowEditor(e => !e)}
          className="text-[9px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wide transition-all hover:opacity-80"
          style={{ background: showEditor ? 'var(--accent)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', color: showEditor ? 'var(--bg)' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          ⊞ Edit
        </button>
      </div>
      </div>

      {/* Hero */}
      {heroItem && (
        <div className="relative w-full" style={{ height: '60vh', minHeight: 320 }}>
          <AnimatePresence mode="wait">
            <motion.div key={heroIdx}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-cover bg-top"
              style={{ backgroundImage: `url('${heroItem.backdropUrl}')` }} />
          </AnimatePresence>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 50%, var(--bg) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />

          <div className="absolute bottom-12 left-8 right-8 flex flex-col gap-3">
            {heroItem.logoUrl
              ? <img src={heroItem.logoUrl} alt={heroItem.title} className="max-h-20 max-w-[280px] object-contain"
                  style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,1))' }} />
              : <h1 className="text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.08em', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>
                  {heroItem.title}
                </h1>
            }
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {[heroItem.year, heroItem.genre].filter(Boolean).join(' · ')}
            </p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => handlePlay(heroItem)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide hover:opacity-85 transition-all"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                <Play size={14} fill="currentColor" /> Play
              </button>
              <button onClick={() => setDetailItemId(heroItem.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide hover:bg-white/15 transition-all"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                <Info size={14} /> Info
              </button>
            </div>
          </div>

          {/* Hero dots */}
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            {heroItems.map((_, i) => (
              <button key={i} onClick={() => setHeroIdx(i)}
                className="rounded-full transition-all"
                style={{ width: i === heroIdx ? 20 : 6, height: 4, background: i === heroIdx ? 'var(--accent)' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        </div>
      )}

      {/* Section config button */}
      <div className="flex items-center justify-between px-6 py-3">
        <div />
        <button onClick={() => setConfigOpen(o => !o)}
          className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase transition-all hover:opacity-70"
          style={{ color: 'var(--muted)' }}>
          <Settings2 size={12} /> Customise
        </button>
      </div>

      {/* Section config panel */}
      <AnimatePresence>
        {configOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mx-6 mb-4 rounded-xl"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>
                Drag to reorder · click eye to show/hide
              </p>
              <div className="space-y-1">
                {order.map((key, i) => {
                  const sec = ALL_SECTIONS.find(s => s.key === key)
                  if (!sec) return null
                  const isHidden = hidden.includes(key)
                  return (
                    <div key={key} draggable
                      onDragStart={() => onDragStart(i)}
                      onDragOver={e => onDragOver(e, i)}
                      onDrop={() => onDrop(i)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all"
                      style={{ background: dragOver === i ? 'rgba(255,255,255,0.08)' : 'transparent', opacity: isHidden ? 0.4 : 1 }}>
                      <GripVertical size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                      <span className="flex-1 text-sm" style={{ color: 'var(--cream)' }}>{sec.label}</span>
                      <button onClick={() => toggleHidden(key)}
                        className="transition-all hover:opacity-70">
                        {isHidden ? <EyeOff size={14} style={{ color: 'var(--muted)' }} /> : <Eye size={14} style={{ color: 'var(--accent)' }} />}
                      </button>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => { setHomeSections(DEFAULT_ORDER, DEFAULT_HIDDEN); }}
                className="mt-3 text-[9px] tracking-wide" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                Reset to default
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media rows */}
      {sections
        .filter(s => !hidden.includes(s.key))
        .map(sec => (
          <SectionRow key={sec.key} sectionKey={sec.key} label={sec.label} queryFn={sec.query} />
        ))
      }

      <div style={{ height: 48 }} />
    </div>
  )
}

function SectionRow({ sectionKey, label, queryFn, cardWidth }: { sectionKey: string; label: string; queryFn: () => Promise<MediaItem[]>; cardWidth?: number }) {
  const { setDetailItemId } = useStore()
  const navigate = useNavigate()
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['home-section', label],
    queryFn,
    staleTime: 5 * 60_000,
  })
  const data = Array.isArray(rawData) ? rawData : (rawData as any)?.items || []
  if (!isLoading && !data.length) return null
  const genre = GENRE_MAP[sectionKey]
  const handleTitleClick = genre ? () => navigate(`/movies?genre=${encodeURIComponent(genre)}`) : undefined
  return <MediaRow title={label} items={data} loading={isLoading} onItemClick={item => setDetailItemId(item.id)} onTitleClick={handleTitleClick} cardWidth={cardWidth} />
}
