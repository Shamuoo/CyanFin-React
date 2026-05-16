import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, ExternalLink, ChevronLeft } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import PersonalRating from '@/components/ui/PersonalRating'
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
        startTime: item.userData?.PlaybackPositionTicks ? item.userData.PlaybackPositionTicks / 10_000_000 : 0,
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
              : <DetailContent item={item} onClose={() => setDetailItemId(null)} onPlay={handlePlay} jellyfinUrl={jellyfinUrl} />
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
  const [isFav, setIsFav] = useState(item.userData?.IsFavorite || false)
  const [isWatched, setIsWatched] = useState((item.userData?.PlayedPercentage || 0) >= 90)

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

function DetailContent({ item, onClose, onPlay, jellyfinUrl }: {
  item: MediaItem; onClose: () => void
  onPlay: (mediaSourceId?: string, audioIndex?: number) => void
  jellyfinUrl: string
}) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>()
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([])
  const themeSongRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const canPlay = item.type === 'Movie' || item.type === 'Episode'
  const backdrop = item.backdropUrls?.[0] || item.backdropUrl
  const selectedSource = mediaSources.find(s => s.id === selectedSourceId) || mediaSources[0]

  // Load playback info for version/audio picker
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
    }).catch(e => console.warn('[CyanFin] PlaybackInfo failed:', e.message))
  }, [item.id])

  // Theme song - play muted on open, unmute after 1s
  useEffect(() => {
    if (!item.themeSongUrl) return
    const audio = new Audio(item.themeSongUrl)
    audio.volume = 0
    audio.loop = true
    audio.play().catch(() => {})
    themeSongRef.current = audio
    // Fade in
    let vol = 0
    const fade = setInterval(() => {
      vol = Math.min(0.35, vol + 0.02)
      audio.volume = vol
      if (vol >= 0.35) clearInterval(fade)
    }, 100)
    return () => {
      clearInterval(fade)
      audio.pause()
      audio.src = ''
    }
  }, [item.themeSongUrl])

  return (
    <div>
      {/* Backdrop / Video Backdrop */}
      <div className="relative w-full" style={{ height: '52vh', minHeight: 280 }}>
        {/* Video backdrop - muted autoplay */}
        {item.videoBackdropUrl ? (
          <video ref={videoRef} src={item.videoBackdropUrl} autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover" />
        ) : backdrop ? (
          <div className="absolute inset-0 bg-cover bg-top transition-all duration-500"
            style={{ backgroundImage: `url('${backdrop}')` }} />
        ) : null}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 60%, rgba(8,6,4,0.95) 100%)' }} />

        {/* Backdrop dots */}
        {item.backdropUrls && item.backdropUrls.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {item.backdropUrls.slice(0, 6).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? 'var(--accent)' : 'rgba(255,255,255,0.3)' }} />
            ))}
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="px-8 pb-8" style={{ marginTop: -80, position: 'relative', zIndex: 10 }}>
        {/* Logo or title */}
        {item.logoUrl
          ? <img src={item.logoUrl} alt={item.title} className="object-contain mb-4"
              style={{ maxHeight: 96, maxWidth: 360, filter: 'drop-shadow(0 2px 20px rgba(0,0,0,1)) brightness(1.15)' }} />
          : <h1 className="mb-3 leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,56px)', letterSpacing: '0.08em', color: 'var(--cream)', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>
              {item.title}
            </h1>
        }

        {/* Type / series info */}
        {item.type === 'Episode' && (
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--accent)', opacity: 0.7 }}>
            {item.seriesName} · S{String(item.parentIndexNumber||0).padStart(2,'0')}E{String(item.indexNumber||0).padStart(2,'0')}
          </p>
        )}

        {/* Tagline */}
        {item.tagline && <p className="text-sm italic mb-3" style={{ color: 'var(--muted)' }}>{item.tagline}</p>}

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {[item.year?.toString(), item.genre, item.rating].filter(Boolean).map(v => (
            <span key={v} className="chip" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--accent)', border: '1px solid var(--border)' }}>{v}</span>
          ))}
          {item.score && <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>★ {parseFloat(String(item.score)).toFixed(1)}</span>}
          {(item.qualities || []).map(q => (
            <span key={q} className="chip" style={{ background: q.startsWith('4K') ? 'var(--accent)' : q.includes('3D') ? 'rgba(46,204,113,0.15)' : 'rgba(93,173,226,0.12)', color: q.startsWith('4K') ? 'var(--bg)' : q.includes('3D') ? '#2ecc71' : 'var(--blue)', border: `1px solid ${q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.25)'}` }}>{q}</span>
          ))}
          {item.audio && <span className="chip" style={{ background: 'rgba(93,173,226,0.08)', color: 'var(--blue)', border: '1px solid rgba(93,173,226,0.2)' }}>{item.audio}</span>}
          {item.runtime && (() => { const m = Math.round(item.runtime! / 600_000_000); return <span className="chip" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>{Math.floor(m/60)}h {m%60}m</span> })()}
          {item.partCount && item.partCount > 1 && <span className="chip" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--accent)', border: '1px solid rgba(201,168,76,0.2)' }}>📦 {item.partCount} films</span>}
        </div>

        {/* Version picker */}
        {mediaSources.length > 0 && (
          <div className="mb-3">
            <p className="text-[8px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Version</p>
            <div className="flex gap-2 flex-wrap">
              {mediaSources.map(src => (
                <button key={src.id}
                  onClick={() => {
                    setSelectedSourceId(src.id)
                    const def = src.audioStreams?.find((a: any) => a.isDefault)
                    setSelectedAudioIndex(def?.index ?? src.audioStreams?.[0]?.index)
                  }}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide transition-all"
                  style={{ background: selectedSourceId === src.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: selectedSourceId === src.id ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${selectedSourceId === src.id ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}` }}>
                  {[src.videoCodec?.toUpperCase(), src.name || src.container?.toUpperCase()].filter(Boolean).join(' · ') || 'Version 1'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio picker */}
        {selectedSource?.audioStreams && selectedSource.audioStreams.length > 0 && (
          <div className="mb-5">
            <p className="text-[8px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Audio</p>
            <div className="flex gap-2 flex-wrap">
              {selectedSource.audioStreams.map(a => (
                <button key={a.index} onClick={() => setSelectedAudioIndex(a.index)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide transition-all"
                  style={{ background: selectedAudioIndex === a.index ? 'rgba(93,173,226,0.2)' : 'rgba(255,255,255,0.04)', color: selectedAudioIndex === a.index ? 'var(--blue)' : 'var(--muted)', border: `1px solid ${selectedAudioIndex === a.index ? 'rgba(93,173,226,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                  {a.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap mb-6">
          {canPlay && (
            <button onClick={() => onPlay(selectedSourceId, selectedAudioIndex)}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold tracking-wider uppercase transition-all hover:opacity-85"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              <Play size={15} fill="currentColor" />
              {item.userData?.PlayedPercentage && item.userData.PlayedPercentage > 5 ? 'Resume' : 'Play'}
            </button>
          )}
          {jellyfinUrl && (
            <a href={`${jellyfinUrl}/web/#/details?id=${item.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold tracking-wider uppercase transition-all hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>
              <ExternalLink size={14} /> Jellyfin
            </a>
          )}
        </div>


        {/* External ratings */}
        {item.externalRatings && (
          <div className="flex gap-3 flex-wrap mb-4">
            {item.externalRatings.imdb != null && (
              <a href={item.externalRatings.imdbUrl || '#'} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold hover:opacity-80 transition-opacity"
                style={{ background: 'rgba(245,197,24,0.12)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.2)', textDecoration: 'none' }}>
                <span style={{ fontSize: 9, opacity: 0.7 }}>IMDb</span> {item.externalRatings.imdb}/10
              </a>
            )}
            {item.externalRatings.tmdb != null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                style={{ background: 'rgba(1,180,228,0.1)', color: '#01b4e4', border: '1px solid rgba(1,180,228,0.2)' }}>
                <span style={{ fontSize: 9, opacity: 0.7 }}>TMDB</span> {item.externalRatings.tmdb}%
              </div>
            )}
            {item.externalRatings.rt != null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                style={{ background: item.externalRatings.rt >= 60 ? 'rgba(250,87,0,0.12)' : 'rgba(100,100,100,0.12)', color: item.externalRatings.rt >= 60 ? '#fa5700' : '#888', border: `1px solid ${item.externalRatings.rt >= 60 ? 'rgba(250,87,0,0.25)' : 'rgba(100,100,100,0.2)'}` }}>
                <span style={{ fontSize: 11 }}>{item.externalRatings.rt >= 60 ? '🍅' : '🫙'}</span> {item.externalRatings.rt}%
              </div>
            )}
            {item.externalRatings.metascore != null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                style={{ background: 'rgba(102,175,68,0.12)', color: '#66af44', border: '1px solid rgba(102,175,68,0.25)' }}>
                <span style={{ fontSize: 9, opacity: 0.7 }}>Meta</span> {item.externalRatings.metascore}
              </div>
            )}
            {item.externalRatings.letterboxdUrl && (
              <a href={item.externalRatings.letterboxdUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold hover:opacity-80 transition-opacity"
                style={{ background: 'rgba(0,230,122,0.08)', color: '#00e67a', border: '1px solid rgba(0,230,122,0.2)', textDecoration: 'none' }}>
                🎬 Letterboxd
              </a>
            )}
          </div>
        )}

        {/* Personal rating */}
        <PersonalRating itemId={item.id} />

        {/* Integration actions */}
        <IntegrationActions item={item} />

        {/* Overview */}
        {item.overview && (
          <p className="text-sm leading-relaxed mb-5 max-w-2xl" style={{ color: 'rgba(240,232,213,0.6)', lineHeight: 1.7 }}>
            {item.overview}
          </p>
        )}

        {/* Crew */}
        {item.director && (
          <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
            Directed by <span style={{ color: 'rgba(240,232,213,0.65)', fontWeight: 600 }}>{item.director}</span>
          </p>
        )}

        {/* Cast */}
        {item.cast && item.cast.length > 0 && (
          <div className="mb-6">
            <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>Cast</p>
            <div className="flex gap-4 flex-wrap">
              {item.cast.slice(0, 12).map(actor => (
                <div key={actor.id} className="flex flex-col items-center gap-1.5" style={{ width: 72 }}>
                  {actor.imageTag
                    ? <img src={`/proxy/image?id=${actor.id}&type=Primary&w=185`} alt={actor.name}
                        className="w-16 h-16 rounded-full object-cover"
                        style={{ border: '2px solid rgba(255,255,255,0.08)', background: 'var(--bg3)' }} />
                    : <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl"
                        style={{ background: 'var(--bg3)', border: '2px solid rgba(255,255,255,0.08)', color: 'var(--muted)' }}>
                        {(actor.name || '?')[0]}
                      </div>
                  }
                  <p className="text-[9px] text-center leading-tight font-medium" style={{ color: 'var(--muted)', maxWidth: 72 }}>{actor.name}</p>
                  {actor.role && <p className="text-[7px] text-center" style={{ color: 'var(--muted)', opacity: 0.5 }}>{actor.role}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extras */}
        {item.extras && item.extras.length > 0 && (
          <div className="mb-6">
            <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>Extras & Special Features</p>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {item.extras.map(extra => (
                <div key={extra.id} className="flex-shrink-0 w-44 cursor-pointer group">
                  <div className="relative w-44 h-[99px] rounded-lg overflow-hidden mb-1.5"
                    style={{ background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {extra.thumbUrl && <img src={extra.thumbUrl} alt={extra.title} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <Play size={26} color="white" fill="white" />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold truncate" style={{ color: 'rgba(240,232,213,0.65)' }}>{extra.title}</p>
                  <p className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>{extra.type || 'Extra'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
