import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Play } from 'lucide-react'
import api from '@/lib/api'
import MediaCard from '@/components/ui/MediaCard'
import { useStore } from '@/lib/store'
import type { MediaItem } from '@/types'

type View = 'grid' | 'seasons' | 'episodes'

export default function ShowsPage() {
  const { setDetailItemId, setPlayingItem } = useStore()
  const [sort, setSort] = useState('SortName')
  const [order, setOrder] = useState('Ascending')
  const [genre, setGenre] = useState('')
  const [start, setStart] = useState(0)
  const [allItems, setAllItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Navigation state
  const [view, setView] = useState<View>('grid')
  const [selectedShow, setSelectedShow] = useState<MediaItem | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<MediaItem | null>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['shows', sort, order, genre, start],
    queryFn: () => api.shows({ sort, order, genre, start }),
  })
  const { data: genres = [] } = useQuery({
    queryKey: ['genres-series'],
    queryFn: () => api.genres('Series'),
  })
  const { data: seasons = [], isFetching: fetchingSeasons } = useQuery({
    queryKey: ['seasons', selectedShow?.id],
    queryFn: () => api.seasons(selectedShow!.id),
    enabled: !!selectedShow && view === 'seasons',
  })
  const { data: episodes = [], isFetching: fetchingEpisodes } = useQuery({
    queryKey: ['episodes', selectedShow?.id, selectedSeason?.id],
    queryFn: () => api.episodes(selectedShow!.id, selectedSeason!.id),
    enabled: !!selectedShow && !!selectedSeason && view === 'episodes',
  })

  useEffect(() => {
    if (!data) return
    setTotal(data.total)
    setAllItems(prev => start === 0 ? data.items : [...prev, ...data.items])
  }, [data, start])
  useEffect(() => { setStart(0); setAllItems([]) }, [sort, order, genre])
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const h = () => { if (!isFetching && allItems.length < total && el.scrollTop + el.clientHeight >= el.scrollHeight - 400) setStart(allItems.length) }
    el.addEventListener('scroll', h); return () => el.removeEventListener('scroll', h)
  }, [isFetching, allItems.length, total])

  const sel = 'px-3 py-1.5 rounded text-xs outline-none'
  const ss = { background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--cream)' }

  const playEpisode = async (ep: MediaItem) => {
    try {
      const info = await api.playbackInfo(ep.id)
      setPlayingItem({ id: ep.id, title: `${ep.seriesName} · ${ep.title}`, streamUrl: info.streamUrl, hlsUrl: info.hlsUrl, startTime: ep.userData?.playbackPositionTicks ? ep.userData.playbackPositionTicks / 10_000_000 : 0 } as any)
      window.location.href = '/player'
    } catch(e) { console.error(e) }
  }

  // ── Seasons view ──
  if (view === 'seasons' && selectedShow) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
          <button onClick={() => { setView('grid'); setSelectedShow(null) }}
            className="flex items-center gap-1.5 text-sm font-bold tracking-wide hover:opacity-70 transition-opacity"
            style={{ color: 'var(--muted)' }}>
            <ChevronLeft size={16} /> TV Shows
          </button>
          <span style={{ color: 'var(--border2)' }}>/</span>
          <span className="text-sm font-bold" style={{ color: 'var(--cream)', opacity: 0.7 }}>{selectedShow.title}</span>
        </div>

        {/* Show backdrop + info */}
        {selectedShow.backdropUrl && (
          <div className="relative h-48 overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${selectedShow.backdropUrl}')` }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), var(--bg))' }} />
            <div className="absolute bottom-4 left-6">
              <h1 className="text-3xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.1em' }}>{selectedShow.title}</h1>
            </div>
          </div>
        )}

        {fetchingSeasons
          ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
          : <div className="grid gap-4 p-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {(seasons as MediaItem[]).map(season => (
                <MediaCard key={season.id} item={season} width={130}
                  onClick={() => { setSelectedSeason(season); setView('episodes') }} />
              ))}
            </div>
        }
      </div>
    )
  }

  // ── Episodes view ──
  if (view === 'episodes' && selectedShow && selectedSeason) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
          <button onClick={() => setView('seasons')}
            className="flex items-center gap-1.5 text-sm font-bold tracking-wide hover:opacity-70 transition-opacity"
            style={{ color: 'var(--muted)' }}>
            <ChevronLeft size={16} /> {selectedShow.title}
          </button>
          <span style={{ color: 'var(--border2)' }}>/</span>
          <span className="text-sm font-bold" style={{ color: 'var(--cream)', opacity: 0.7 }}>{selectedSeason.title}</span>
        </div>

        {fetchingEpisodes
          ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
          : <div className="p-6 space-y-2">
              {(episodes as MediaItem[]).map(ep => (
                <div key={ep.id} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
                  style={{ border: '1px solid var(--border2)' }}
                  onClick={() => setDetailItemId(ep.id)}>
                  {/* Episode thumb */}
                  <div className="relative flex-shrink-0 w-36 h-20 rounded-lg overflow-hidden" style={{ background: 'var(--bg3)' }}>
                    {ep.thumbUrl
                      ? <img src={ep.thumbUrl} alt="" className="w-full h-full object-cover" />
                      : ep.backdropUrl
                        ? <img src={ep.backdropUrl} alt="" className="w-full h-full object-cover" />
                        : null
                    }
                    {/* Progress bar */}
                    {ep.userData?.playedPercentage && ep.userData.playedPercentage > 0 && ep.userData.playedPercentage < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <div style={{ width: `${ep.userData.playedPercentage}%`, height: '100%', background: 'var(--accent)' }} />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.4, minWidth: 28 }}>
                        {ep.indexNumber ?? '?'}
                      </span>
                      <p className="text-sm font-bold truncate" style={{ color: 'rgba(240,232,213,0.8)' }}>{ep.title}</p>
                    </div>
                    {ep.overview && <p className="text-[10px] line-clamp-2" style={{ color: 'var(--muted)' }}>{ep.overview}</p>}
                    {ep.runtime && <p className="text-[9px] mt-1" style={{ color: 'var(--muted)', opacity: 0.5 }}>{Math.round(ep.runtime / 600_000_000)}m</p>}
                  </div>
                  {/* Play button */}
                  <button onClick={e => { e.stopPropagation(); playEpisode(ep) }}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-85 active:scale-95"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
        }
      </div>
    )
  }

  // ── Grid view ──
  return (
    <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '24px var(--pad) 12px' }}>
        <div className="flex items-end gap-4 mb-4">
          <h1 className="text-xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>TV Shows</h1>
          <span className="text-[9px] tracking-[0.15em] pb-0.5" style={{ color: 'var(--muted)' }}>{total.toLocaleString()} shows</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={sort} onChange={e => setSort(e.target.value)} className={sel} style={ss}>
            {[['SortName','A–Z'],['PremiereDate','Year'],['CommunityRating','Rating'],['DateCreated','Date Added']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={order} onChange={e => setOrder(e.target.value)} className={sel} style={ss}>
            <option value="Ascending">↑ Asc</option><option value="Descending">↓ Desc</option>
          </select>
          <select value={genre} onChange={e => setGenre(e.target.value)} className={sel} style={ss}>
            <option value="">All Genres</option>
            {genres.map(g => <option key={typeof g === "string" ? g : (g as any).name} value={typeof g === "string" ? g : (g as any).name}>{typeof g === "string" ? g : (g as any).name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 pb-12" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', padding: '0 var(--pad) 48px' }}>
        {allItems.map(item => (
          <MediaCard key={item.id} item={item} width={130}
            onClick={() => { setSelectedShow(item); setView('seasons') }} />
        ))}
      </div>
      {isFetching && <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>}
    </div>
  )
}
