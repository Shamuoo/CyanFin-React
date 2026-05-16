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
  { key: 'continue',    label: 'Continue Watching', query: () => api.continueWatching() },
  { key: 'recent',      label: 'Recently Added',    query: () => api.recentlyAdded() },
  { key: 'popular',     label: 'Popular',           query: () => api.popular() },
  { key: 'history',     label: 'Watch History',     query: () => api.history() },
  { key: 'shows',       label: 'TV Shows',          query: () => api.shows({ sort: 'DateCreated', order: 'Descending', limit: 20 }).then(r => r.items || []) },
  { key: 'toprated',    label: 'Top Rated',         query: () => api.movies({ sort: 'CommunityRating', order: 'Descending', limit: 20 }).then(r => r.items || []) },
  { key: 'collections', label: 'Collections',       query: () => api.collections() },
  { key: 'best3d',      label: 'Best in 3D',        query: () => api.best3D() },
]

const DEFAULT_ORDER = ALL_SECTIONS.map(s => s.key)
const DEFAULT_HIDDEN: string[] = []

export default function HomePage() {
  const { setDetailItemId, setPlayingItem, homeSectionOrder, homeSectionHidden, setHomeSections } = useStore()
  const [configOpen, setConfigOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const order = homeSectionOrder?.length ? homeSectionOrder : DEFAULT_ORDER
  const hidden = homeSectionHidden || DEFAULT_HIDDEN

  const sections = order
    .map(key => ALL_SECTIONS.find(s => s.key === key))
    .filter(Boolean) as typeof ALL_SECTIONS

  // Hero
  const { data: heroRecent } = useQuery({ queryKey: ['hero-recent'], queryFn: () => api.recentlyAdded(), staleTime: 60_000 })
  const { data: heroPopular } = useQuery({ queryKey: ['hero-popular'], queryFn: () => api.popular(), staleTime: 60_000 })
  const heroItems = [...(heroRecent || []), ...(heroPopular || [])].filter(i => i.backdropUrl).filter((v,i,a) => a.findIndex(x => x.id === v.id) === i).slice(0, 8)
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => {
    if (heroItems.length <= 1) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % heroItems.length), 7000)
    return () => clearInterval(t)
  }, [heroItems.length])
  const heroItem = heroItems[heroIdx]

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
          <SectionRow key={sec.key} label={sec.label} queryFn={sec.query} />
        ))
      }

      <div style={{ height: 48 }} />
    </div>
  )
}

function SectionRow({ label, queryFn }: { label: string; queryFn: () => Promise<MediaItem[]> }) {
  const { setDetailItemId } = useStore()
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['home-section', label],
    queryFn,
    staleTime: 5 * 60_000,
  })
  const data = Array.isArray(rawData) ? rawData : (rawData as any)?.items || []
  if (!isLoading && !data.length) return null
  return <MediaRow title={label} items={data} loading={isLoading} onItemClick={item => setDetailItemId(item.id)} />
}
