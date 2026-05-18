import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, ExternalLink, ChevronLeft, Youtube } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import PersonalRating from '@/components/ui/PersonalRating'
import MediaRow from '@/components/ui/MediaRow'
import CastOverlay from '@/components/ui/CastOverlay'
import type { MediaItem, MediaSource } from '@/types'
import { useNavigate } from 'react-router-dom'

export default function DetailModal() {
  const { detailItemId, setDetailItemId, setPlayingItem, jellyfinUrl } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailItemId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setDetailItemId])

  const { data: item } = useQuery({
    queryKey: ['item', detailItemId],
    queryFn: () => api.item(detailItemId!),
    enabled: !!detailItemId,
  })

  const handlePlay = async (mediaSourceId?: string, audioIndex?: number) => {
    if (!item) return
    try {
      const info = await api.playbackInfo(item.id, mediaSourceId, audioIndex)
      setPlayingItem({
        id: item.id, title: item.title ?? '',
        streamUrl: info.streamUrl, hlsUrl: info.hlsUrl,
        startTime: item.userData?.playbackPositionTicks ? item.userData.playbackPositionTicks / 10_000_000 : 0,
      } as any)
      setDetailItemId(null)
      navigate('/player')
    } catch(e) { console.error(e) }
  }

  return (
    <AnimatePresence>
      {detailItemId && (
        <>
          {/* Backdrop overlay */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setDetailItemId(null)} />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 z-[101] overflow-y-auto scrollbar-hide"
            style={{ background: 'rgba(8,6,4,0.94)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', top: '56px' }}>

            {/* Close bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
              style={{ background: 'rgba(8,6,4,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setDetailItemId(null)}
                className="flex items-center gap-1.5 text-sm font-bold tracking-wide transition-all hover:opacity-70"
                style={{ color: 'var(--muted)' }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setDetailItemId(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                <X size={14} />
              </button>
            </div>

            {!item
              ? <div className="flex items-center justify-center h-64">
                  <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
                </div>
              : <DetailContent item={item} onClose={() => setDetailItemId(null)} onPlay={handlePlay} jellyfinUrl={jellyfinUrl || ''} />
            }
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}


function IntegrationActions({ item }: { item: MediaItem }) {
  const { jellyfinUrl } = useStore()
  const [requested, setRequested] = useState(false)
  const [shared, setShared] = useState(false)
  const [isFav, setIsFav] = useState(item.userData?.isFavorite || false)
  const [isWatched, setIsWatched] = useState((item.userData?.playedPercentage || 0) >= 90)

  const { data: intCfg } = useQuery({ queryKey: ['integrations-config'], queryFn: api.integrationsConfig.bind(api), staleTime: 60_000 })

  const toggleFav = async () => {
    try {
      await api.post(`/api/user/favorite`, { itemId: item.id, favorite: !isFav })
      setIsFav(f => !f)
    } catch(e) {}
  }

  const toggleWatched = async () => {
    try {
      await api.post(`/api/user/watched`, { itemId: item.id, watched: !isWatched })
      setIsWatched(w => !w)
    } catch(e) {}
  }

  const requestMedia = async () => {
    try {
      await api.requestMedia(item.type === 'Movie' ? 'movie' : 'tv', item.id)
      setRequested(true)
    } catch(e) {}
  }

  const shareDiscord = async () => {
    try {
      await api.discordNotify({ title: item.title ?? '', overview: item.overview || '', posterUrl: item.posterUrl || '', type: item.type, year: String(item.year || '') })
      setShared(true)
    } catch(e) {}
  }

  const btnStyle = (active?: boolean) => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
    color: active ? 'var(--cream)' : 'var(--muted)',
    transition: 'all 0.15s',
  })

  return (
    <div className="flex gap-2 flex-wrap mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={toggleFav} style={btnStyle(isFav)}>{isFav ? '♥ Favourited' : '♡ Favourite'}</button>
      <button onClick={toggleWatched} style={btnStyle(isWatched)}>{isWatched ? '✓ Watched' : '○ Mark Watched'}</button>
      {intCfg?.jellyseerr && (item.type === 'Movie' || item.type === 'Series') && (
        <button onClick={requestMedia} disabled={requested} style={btnStyle(requested)}>
          {requested ? '✓ Requested' : '+ Request'}
        </button>
      )}
      {intCfg?.discord && (
        <button onClick={shareDiscord} disabled={shared} style={btnStyle(shared)}>
          {shared ? '✓ Shared' : '📢 Share'}
        </button>
      )}
    </div>
  )
}


function SimilarRow({ itemId }: { itemId: string }) {
  const { setDetailItemId } = useStore()
  const { data } = useQuery({
    queryKey: ['similar', itemId],
    queryFn: () => api.similar(itemId),
    staleTime: 5 * 60_000,
  })
  const items = Array.isArray(data) ? data : []
  if (!items.length) return null
  return (
    <div className="mt-6 -mx-6">
      <MediaRow title="More like this" items={items} onItemClick={i => setDetailItemId(i.id)} />
    </div>
  )
}

function DetailContent({ item, onClose, onPlay, jellyfinUrl }: {
  item: MediaItem; onClose: () => void
  onPlay: (mediaSourceId?: string, audioIndex?: number) => void
  jellyfinUrl: string
}) {
  const navigate = useNavigate()
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>()
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([])
  const [activeBackdrop, setActiveBackdrop] = useState(0)
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; imageTag?: string | null } | null>(null)
  const themeSongRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const canPlay = item.type === 'Movie' || item.type === 'Episode'
  const backdrops = item.backdropUrls?.length ? item.backdropUrls : (item.backdropUrl ? [item.backdropUrl] : [])
  const backdrop = backdrops[activeBackdrop] || null
  const selectedSource = mediaSources.find(s => s.id === selectedSourceId) || mediaSources[0]

  const { data: _trailerData } = useQuery({
    queryKey: ['trailer', item.externalIds?.Tmdb, item.type],
    queryFn: () => api.trailer(item.externalIds!.Tmdb!, item.type === 'Series' ? 'series' : 'movie'),
    enabled: !!item.externalIds?.Tmdb,
    staleTime: 24 * 60 * 60_000,
  })
  const trailerKey = (_trailerData as any)?.trailerKey as string | null | undefined

  // Auto-rotate backdrops
  useEffect(() => {
    if (backdrops.length <= 1) return
    const t = setInterval(() => setActiveBackdrop(i => (i + 1) % backdrops.length), 8000)
    return () => clearInterval(t)
  }, [backdrops.length])

  // Load playback info
  useEffect(() => {
    if (!item.id) return
    api.playbackInfo(item.id).then(info => {
      const sources = info.mediaSources || []
      if (sources.length) {
        setMediaSources(sources)
        setSelectedSourceId(sources[0].id)
        const def = sources[0].audioStreams?.find((a: any) => a.isDefault)
        if (def) setSelectedAudioIndex(def.index)
        else if (sources[0].audioStreams?.length) setSelectedAudioIndex(sources[0].audioStreams[0].index)
      }
    }).catch(() => {})
  }, [item.id])

  // Theme song
  useEffect(() => {
    if (!item.themeSongUrl) return
    const audio = new Audio(item.themeSongUrl)
    audio.volume = 0; audio.loop = true
    audio.play().catch(() => {})
    themeSongRef.current = audio
    let vol = 0
    const fade = setInterval(() => {
      vol = Math.min(0.3, vol + 0.02); audio.volume = vol
      if (vol >= 0.3) clearInterval(fade)
    }, 80)
    return () => { clearInterval(fade); audio.pause(); audio.src = '' }
  }, [item.themeSongUrl])

  const openPersonPage = (p: { id: string; name: string; imageTag?: string | null }) => {
    setSelectedPerson(null)
    onClose()
    navigate(`/person/${p.id}`, { state: { name: p.name, imageTag: p.imageTag } })
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>

      {selectedPerson && (
        <CastOverlay personId={selectedPerson.id} personName={selectedPerson.name}
          personImageTag={selectedPerson.imageTag} onClose={() => setSelectedPerson(null)} />
      )}

      {/* ── CINEMATIC HERO ── */}
      <div className="relative flex-shrink-0" style={{ height: '55vh', minHeight: 320 }}>
        {/* Backdrop */}
        {backdrop && (
          <div key={activeBackdrop} className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${backdrop}')`,
              animation: 'fadeIn 0.8s ease' }} />
        )}

        {/* Gradient overlays - cinematic vignette */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 30%, transparent 50%, var(--bg) 100%)',
        }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 60%)',
        }} />

        {/* Logo + title overlay bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-6">
          {item.logoUrl
            ? <img src={item.logoUrl} alt={item.title} className="object-contain mb-3"
                style={{ maxHeight: 80, maxWidth: 320,
                  filter: 'drop-shadow(0 2px 24px rgba(0,0,0,1)) brightness(1.1)' }} />
            : <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,4.5vw,52px)',
                  letterSpacing: '0.07em', color: 'var(--cream)',
                  textShadow: '0 2px 32px rgba(0,0,0,0.95)', marginBottom: 8, lineHeight: 1 }}>
                {item.title}
              </h1>
          }

          {item.type === 'Episode' && (
            <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: 'var(--accent)', opacity: 0.8 }}>
              {item.seriesName} · S{String(item.parentIndexNumber||0).padStart(2,'0')}E{String(item.indexNumber||0).padStart(2,'0')}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {[item.year?.toString(), item.runtime ? `${item.runtime}m` : null, item.rating].filter(Boolean).map(v => (
              <span key={v} className="text-[10px]" style={{ color: 'var(--muted)' }}>{v}</span>
            ))}
            {item.score && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>★ {parseFloat(String(item.score)).toFixed(1)}</span>}
            {(item.qualities || []).map(q => (
              <span key={q} className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.15)',
                  color: q.startsWith('4K') ? 'var(--bg)' : 'var(--blue)',
                  border: `1px solid ${q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.3)'}` }}>
                {q}
              </span>
            ))}
            {item.audio && (
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                {item.audio}
              </span>
            )}
          </div>
        </div>

        {/* Backdrop dots */}
        {backdrops.length > 1 && (
          <div className="absolute bottom-6 right-6 flex gap-1.5">
            {backdrops.slice(0, 6).map((_, i) => (
              <button key={i} onClick={() => setActiveBackdrop(i)}
                className="rounded-full transition-all"
                style={{ width: i === activeBackdrop ? 16 : 6, height: 6,
                  background: i === activeBackdrop ? 'var(--accent)' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        )}
      </div>

      {/* ── CONTENT BELOW HERO ── */}
      <div className="flex-1 px-8 pb-10" style={{ marginTop: -8 }}>

        {/* Ratings pills */}
        {item.externalRatings && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {item.externalRatings.imdb != null && (
              <a href={item.externalRatings.imdbUrl || '#'} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold hover:opacity-75 transition-opacity"
                style={{ background: 'rgba(245,197,24,0.1)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.2)', textDecoration: 'none' }}>
                <span style={{ fontSize: 8 }}>IMDb</span>{item.externalRatings.imdb}
              </a>
            )}
            {item.externalRatings.tmdb != null && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(1,180,228,0.08)', color: '#01b4e4', border: '1px solid rgba(1,180,228,0.15)' }}>
                <span style={{ fontSize: 8 }}>TMDB</span>{item.externalRatings.tmdb}%
              </span>
            )}
            {item.externalRatings.rt != null && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: item.externalRatings.rt >= 60 ? 'rgba(250,87,0,0.1)' : 'rgba(120,120,120,0.08)', color: item.externalRatings.rt >= 60 ? '#fa5700' : '#888', border: `1px solid ${item.externalRatings.rt >= 60 ? 'rgba(250,87,0,0.2)' : 'rgba(120,120,120,0.15)'}` }}>
                {item.externalRatings.rt >= 60 ? '🍅' : '🫙'}{item.externalRatings.rt}%
              </span>
            )}
            {item.externalRatings.metascore != null && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(102,175,68,0.08)', color: '#66af44', border: '1px solid rgba(102,175,68,0.2)' }}>
                <span style={{ fontSize: 8 }}>MC</span>{item.externalRatings.metascore}
              </span>
            )}
            {item.externalRatings.letterboxdUrl && (
              <a href={item.externalRatings.letterboxdUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold hover:opacity-75"
                style={{ background: 'rgba(0,165,80,0.08)', color: '#00a550', border: '1px solid rgba(0,165,80,0.18)', textDecoration: 'none' }}>
                LB
              </a>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap mb-6">
          {canPlay && (
            <button onClick={() => onPlay(selectedSourceId, selectedAudioIndex)}
              className="flex items-center gap-2 px-7 py-3.5 rounded-full font-bold tracking-wider uppercase text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em' }}>
              <Play size={15} fill="currentColor" />
              {item.userData?.playedPercentage && item.userData.playedPercentage > 5 ? 'Resume' : 'Play'}
            </button>
          )}
          {trailerKey && (
            <a href={`https://www.youtube.com/watch?v=${trailerKey}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-5 py-3.5 rounded-full font-bold tracking-wider uppercase text-sm transition-all hover:opacity-80"
              style={{ background: 'rgba(255,0,0,0.08)', color: '#ff4444', border: '1px solid rgba(255,0,0,0.2)', textDecoration: 'none' }}>
              <Youtube size={14} /> Trailer
            </a>
          )}
          {jellyfinUrl && (
            <a href={`${jellyfinUrl}/web/#/details?id=${item.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-3.5 rounded-full text-sm transition-all hover:opacity-70"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border2)', textDecoration: 'none' }}>
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Tagline */}
        {item.tagline && (
          <p className="text-sm italic mb-4" style={{ color: 'var(--muted)', opacity: 0.6 }}>{item.tagline}</p>
        )}

        {/* Overview */}
        {item.overview && (
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(240,232,213,0.65)', lineHeight: 1.75, maxWidth: '65ch' }}>
            {item.overview}
          </p>
        )}

        {/* Director + genres */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-6 text-xs">
          {item.director && (
            <div>
              <span style={{ color: 'var(--muted)', opacity: 0.5 }}>Director  </span>
              <span style={{ color: 'var(--cream)' }}>{item.director}</span>
            </div>
          )}
          {item.genres && item.genres.length > 0 && (
            <div>
              <span style={{ color: 'var(--muted)', opacity: 0.5 }}>Genre  </span>
              <span style={{ color: 'var(--cream)' }}>{item.genres.slice(0,3).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Version / audio pickers */}
        {mediaSources.length > 1 && (
          <div className="mb-5">
            <p className="text-[8px] font-bold tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.4 }}>Version</p>
            <div className="flex gap-2 flex-wrap">
              {mediaSources.map(s => (
                <button key={s.id} onClick={() => setSelectedSourceId(s.id)}
                  className="text-[10px] px-3 py-1.5 rounded-full font-bold transition-all"
                  style={{ background: selectedSourceId === s.id ? 'var(--accent)' : 'var(--subtle)',
                    color: selectedSourceId === s.id ? 'var(--bg)' : 'var(--muted)',
                    border: `1px solid ${selectedSourceId === s.id ? 'var(--accent)' : 'var(--border2)'}` }}>
                  {s.name || s.container}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSource?.audioStreams && selectedSource.audioStreams.length > 1 && (
          <div className="mb-6">
            <p className="text-[8px] font-bold tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.4 }}>Audio</p>
            <div className="flex gap-2 flex-wrap">
              {selectedSource.audioStreams.map((a: any) => (
                <button key={a.index} onClick={() => setSelectedAudioIndex(a.index)}
                  className="text-[10px] px-3 py-1.5 rounded-full font-bold transition-all"
                  style={{ background: selectedAudioIndex === a.index ? 'rgba(201,168,76,0.12)' : 'var(--subtle)',
                    color: selectedAudioIndex === a.index ? 'var(--accent)' : 'var(--muted)',
                    border: `1px solid ${selectedAudioIndex === a.index ? 'var(--border)' : 'var(--border2)'}` }}>
                  {a.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cast */}
        {item.cast && item.cast.length > 0 && (
          <div className="mb-7">
            <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>Cast</p>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {item.cast.slice(0, 15).map(actor => (
                <button key={actor.id}
                  onClick={() => setSelectedPerson({ id: actor.id, name: actor.name, imageTag: actor.imageTag })}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 hover:opacity-75 transition-opacity"
                  style={{ width: 68, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <div className="rounded-xl overflow-hidden" style={{ width: 68, height: 88, background: 'var(--bg3)' }}>
                    {actor.imageTag
                      ? <img src={`/proxy/image?id=${actor.id}&type=Primary&w=140`} alt={actor.name}
                          className="w-full h-full object-cover object-top" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl"
                          style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                          {actor.name[0]}
                        </div>
                    }
                  </div>
                  <p className="text-[9px] text-center font-medium leading-tight" style={{ color: 'var(--cream)' }}>{actor.name}</p>
                  {actor.role && <p className="text-[7px] text-center" style={{ color: 'var(--muted)', opacity: 0.5 }}>{actor.role}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Personal rating */}
        <PersonalRating itemId={item.id} />

        {/* Integration actions */}
        <IntegrationActions item={item} />

        {/* More like this */}
        <SimilarRow itemId={item.id} />
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}
