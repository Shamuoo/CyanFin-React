import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Info } from 'lucide-react'
import api from '@/lib/api'
import MediaRow from '@/components/ui/MediaRow'
import { useStore } from '@/lib/store'
import type { MediaItem } from '@/types'

export default function HomePage() {
  const { setDetailItemId, setPlayingItem, showWeather, city, units } = useStore()
  const [heroIdx, setHeroIdx] = useState(0)
  const [heroItems, setHeroItems] = useState<MediaItem[]>([])

  const sections = [
    { key: 'continue', label: 'Continue Watching', query: () => api.continueWatching() },
    { key: 'recent', label: 'Recently Added', query: () => api.recentlyAdded() },
    { key: 'popular', label: 'Most Popular', query: () => api.popular() },
    { key: 'history', label: 'Watch History', query: () => api.history() },
    { key: 'best3d', label: 'Best in 3D', query: () => api.best3D() },
    { key: 'onthisday', label: 'On This Day', query: () => api.onThisDay() },
    { key: 'coming', label: 'Coming Soon', query: () => api.comingSoon() },
  ]

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.stats.bind(api), staleTime: 60_000 })
  const { data: weather } = useQuery({ queryKey: ['weather', city], queryFn: () => api.weather(city), enabled: showWeather && !!city, staleTime: 15 * 60_000 })
  const { data: recent } = useQuery({ queryKey: ['recently-added'], queryFn: api.recentlyAdded.bind(api) })

  useEffect(() => {
    if (recent?.length) {
      setHeroItems(recent.filter(i => i.backdropUrl || i.posterUrl).slice(0, 8))
    }
  }, [recent])

  useEffect(() => {
    if (heroItems.length < 2) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % heroItems.length), 8000)
    return () => clearInterval(t)
  }, [heroItems])

  const heroItem = heroItems[heroIdx]

  const handlePlay = async (item: MediaItem) => {
    try {
      const info = await api.playbackInfo(item.id)
      setPlayingItem({ id: item.id, title: item.title, streamUrl: info.streamUrl })
      window.location.href = '/player'
    } catch(e) {}
  }

  const weatherIcons: Record<number, string> = { 113:'☀️',116:'⛅',119:'☁️',122:'☁️',176:'🌦️',200:'⛈️',227:'🌨️',230:'❄️',263:'🌧️',296:'🌧️',356:'⛈️' }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <div className="relative" style={{ height: '85vh', minHeight: 500 }}>
        <AnimatePresence mode="wait">
          {heroItem && (
            <motion.div key={heroItem.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${heroItem.backdropUrl || heroItem.posterUrl}')` }} />
          )}
        </AnimatePresence>
        {/* Gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 40%, var(--bg) 100%)' }} />

        {/* Dots */}
        {heroItems.length > 1 && (
          <div className="absolute top-5 right-5 flex gap-1.5 z-10">
            {heroItems.map((_, i) => (
              <button key={i} onClick={() => setHeroIdx(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === heroIdx ? 'var(--accent)' : 'rgba(255,255,255,0.3)', transform: i === heroIdx ? 'scale(1.4)' : 'scale(1)' }} />
            ))}
          </div>
        )}

        {/* Side poster */}
        {heroItem?.posterUrl && (
          <div className="absolute bottom-10 right-8 hidden lg:block">
            <img src={heroItem.posterUrl} alt="" className="w-32 h-48 object-cover rounded-xl shadow-2xl"
              style={{ border: '2px solid rgba(255,255,255,0.08)' }} />
          </div>
        )}

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 pb-8" style={{ padding: '0 var(--pad) 32px' }}>
          {heroItem?.logoUrl
            ? <img src={heroItem.logoUrl} alt={heroItem.title} className="max-h-16 max-w-[300px] object-contain mb-4"
                style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,1)) brightness(1.1)' }} />
            : <h1 className="text-5xl lg:text-7xl mb-3 leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.08em' }}>
                {heroItem?.title}
              </h1>
          }
          {heroItem && (
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              {[heroItem.year, heroItem.genre, heroItem.rating, heroItem.score ? `★ ${parseFloat(String(heroItem.score)).toFixed(1)}` : '', heroItem.qualities?.[0]].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="flex gap-2 items-center flex-wrap">
            {heroItem && (
              <>
                <button onClick={() => handlePlay(heroItem)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all hover:opacity-85"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  <Play size={14} fill="currentColor" /> Play
                </button>
                <button onClick={() => setDetailItemId(heroItem.id)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all hover:bg-white/15"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--cream)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <Info size={14} /> More Info
                </button>
              </>
            )}
            {/* Stats */}
            {stats && (
              <div className="flex gap-4 ml-4">
                {[['Movies', stats.movies], ['Shows', stats.shows], ['Episodes', stats.episodes]].map(([l, v]) => (
                  <div key={String(l)}>
                    <div className="text-lg leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.6 }}>{Number(v).toLocaleString()}</div>
                    <div className="text-[8px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Weather */}
            {weather && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full ml-auto text-xs"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--muted)', border: '1px solid var(--border2)', backdropFilter: 'blur(8px)' }}>
                {weatherIcons[weather.code] || '🌤'} {units === 'F' ? weather.tempF : weather.temp}° {weather.desc}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media rows */}
      <div className="pb-12">
        {sections.map(sec => (
          <SectionRow key={sec.key} skey={sec.key} label={sec.label} query={sec.query} onItemClick={(item: import("@/types").MediaItem) => setDetailItemId(item.id)} />
        ))}
      </div>
    </div>
  )
}

function SectionRow({ label, query, onItemClick }: { skey?: string; label: string; query: () => Promise<MediaItem[]>; onItemClick: (item: MediaItem) => void }) {
  const { data = [] } = useQuery({ queryKey: [label], queryFn: query, staleTime: 60_000 })
  if (!data.length) return null
  return <MediaRow title={label} items={data} onItemClick={onItemClick} />
}
