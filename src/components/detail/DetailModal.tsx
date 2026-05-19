import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, ExternalLink, ChevronLeft, Youtube, Download, Loader } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import PersonalRating from '@/components/ui/PersonalRating'
import MediaRow from '@/components/ui/MediaRow'
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

  const handlePlay = async (mediaSourceId?: string, audioIndex?: number, episode?: MediaItem) => {
    const target = episode || item
    if (!target) return
    try {
      const info = await api.playbackInfo(target.id, mediaSourceId, audioIndex)
      setPlayingItem({
        id: target.id, title: episode ? `${item?.title ?? ''} · ${episode.title ?? ''}` : (target.title ?? ''),
        streamUrl: info.streamUrl, hlsUrl: info.hlsUrl,
        startTime: (target?.userData?.playbackPositionTicks ?? 0) / 10_000_000,
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
  const [isFav, setIsFav] = useState(item.userData?.isFavorite || false)
  const [isWatched, setIsWatched] = useState((item.userData?.playedPercentage || 0) >= 90)
  const [requested, setRequested] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [shared, setShared] = useState(false)

  const { data: intCfg } = useQuery({
    queryKey: ['integrations-config'], queryFn: api.integrationsConfig.bind(api), staleTime: 60_000,
  })
  const cfg = intCfg as any

  const toggleFav = async () => {
    try { await api.toggleFavorite(item.id, !isFav); setIsFav(f => !f) } catch {}
  }
  const toggleWatched = async () => {
    try { await api.toggleWatched(item.id, !isWatched); setIsWatched(w => !w) } catch {}
  }
  const requestMedia = async () => {
    if (requesting || requested) return
    setRequesting(true)
    try {
      await api.requestMedia(item.type === 'Movie' ? 'movie' : 'tv', item.id)
      setRequested(true)
      toast.success(`${item.title} requested`)
    } catch(e: any) { toast.error(e.message || 'Request failed') }
    setRequesting(false)
  }
  const shareDiscord = async () => {
    try {
      await api.discordNotify({ title: item.title ?? '', overview: item.overview || '', posterUrl: item.posterUrl || '', type: item.type, year: String(item.year || '') })
      setShared(true); setTimeout(() => setShared(false), 3000)
    } catch {}
  }

  const pill = (label: string, active?: boolean, onClick?: () => void) => (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: onClick ? 'pointer' : 'default',
      border: '1px solid rgba(255,255,255,0.1)',
      background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
      color: active ? 'var(--cream)' : 'var(--muted)', transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div className="mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* User actions */}
      <div className="flex gap-2 flex-wrap mb-3">
        {pill(isFav ? '♥ Favourited' : '♡ Favourite', isFav, toggleFav)}
        {pill(isWatched ? '✓ Watched' : 'Mark watched', isWatched, toggleWatched)}
        {cfg?.discord && pill(shared ? '✓ Shared' : '⬡ Discord', shared, shareDiscord)}
      </div>

      {/* Request row — Jellyseerr / Radarr / Sonarr */}
      {(cfg?.jellyseerr || cfg?.radarr || cfg?.sonarr) && (
        <div className="flex items-center gap-2 flex-wrap">
          {cfg?.jellyseerr && (
            <button onClick={requestMedia} disabled={requesting || requested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: requested ? 'rgba(46,204,113,0.1)' : 'rgba(201,168,76,0.08)', color: requested ? '#2ecc71' : 'var(--accent)', border: `1px solid ${requested ? 'rgba(46,204,113,0.3)' : 'var(--border)'}` }}>
              {requesting ? '…' : requested ? '✓ Requested' : '↓ Request — Jellyseerr'}
            </button>
          )}
          {!cfg?.jellyseerr && cfg?.radarr && item.type === 'Movie' && (
            <button onClick={requestMedia} disabled={requesting || requested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
              {requesting ? '…' : requested ? '✓ Sent to Radarr' : '↓ Add to Radarr'}
            </button>
          )}
          {!cfg?.jellyseerr && cfg?.sonarr && item.type === 'Series' && (
            <button onClick={requestMedia} disabled={requesting || requested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
              {requesting ? '…' : requested ? '✓ Sent to Sonarr' : '↓ Add to Sonarr'}
            </button>
          )}
        </div>
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

function SeasonsPanel({ item, onPlayEpisode }: { item: MediaItem; onPlayEpisode: (ep: MediaItem) => void }) {
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null)

  const { data: seasons } = useQuery({
    queryKey: ['seasons', item.id],
    queryFn: () => api.seasons(item.id),
    enabled: item.type === 'Series',
    staleTime: 5 * 60_000,
  })

  const seasonList = Array.isArray(seasons) ? seasons : []

  const activeSeason = selectedSeason || seasonList[0]?.id || null

  const { data: episodes } = useQuery({
    queryKey: ['episodes', item.id, activeSeason],
    queryFn: () => api.episodes(item.id, activeSeason!),
    enabled: !!activeSeason,
    staleTime: 5 * 60_000,
  })

  const episodeList = Array.isArray(episodes) ? episodes : []

  if (item.type !== 'Series') return null
  if (seasonList.length === 0) return null

  return (
    <div className="mb-7">
      <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>Episodes</p>

      {/* Season selector */}
      {seasonList.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {seasonList.map(s => (
            <button key={s.id}
              onClick={() => setSelectedSeason(s.id)}
              className="flex-shrink-0 text-[10px] px-3 py-1.5 rounded-full font-bold transition-all"
              style={{
                background: (activeSeason === s.id) ? 'var(--accent)' : 'var(--subtle)',
                color: (activeSeason === s.id) ? 'var(--bg)' : 'var(--muted)',
                border: `1px solid ${(activeSeason === s.id) ? 'transparent' : 'var(--border2)'}`,
              }}>
              {s.title || s.seasonName || `Season ${s.indexNumber}`}
            </button>
          ))}
        </div>
      )}

      {/* Episode list */}
      <div className="space-y-2">
        {episodeList.map(ep => {
          const pct = ep.userData?.playedPercentage || 0
          const played = ep.userData?.played
          return (
            <button key={ep.id}
              onClick={() => onPlayEpisode(ep)}
              className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:opacity-80 group"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
              {/* Thumbnail */}
              <div className="relative flex-shrink-0 rounded-lg overflow-hidden"
                style={{ width: 120, height: 68, background: 'var(--bg3)' }}>
                {ep.thumbUrl || ep.posterUrl ? (
                  <img src={ep.thumbUrl || ep.posterUrl || undefined} alt=""
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ color: 'var(--muted)', fontSize: 24 }}>▶</div>
                )}
                {/* Progress bar */}
                {pct > 0 && pct < 100 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
                  </div>
                )}
                {played && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <span style={{ color: '#2ecc71', fontSize: 18 }}>✓</span>
                  </div>
                )}
                {/* Play overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <span style={{ color: 'white', fontSize: 20 }}>▶</span>
                </div>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[10px] font-bold" style={{ color: 'var(--accent)', opacity: 0.6 }}>
                    E{String(ep.indexNumber || 0).padStart(2,'0')}
                  </span>
                  <span className="text-xs font-bold truncate" style={{ color: 'var(--cream)' }}>{ep.title}</span>
                  {ep.runtime && <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--muted)' }}>{ep.runtime}m</span>}
                </div>
                {ep.overview && (
                  <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>
                    {ep.overview}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}


function DetailContent({ item, onClose, onPlay, jellyfinUrl }: {
  item: MediaItem; onClose: () => void
  onPlay: (mediaSourceId?: string, audioIndex?: number, episode?: MediaItem) => void
  jellyfinUrl: string
}) {
  const navigate = useNavigate()
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>()
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([])
  const [activeBackdrop, setActiveBackdrop] = useState(0)
  const themeSongRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const canPlay = item.type === 'Movie' || item.type === 'Episode'
  const [downloading, setDownloading] = useState(false)
  const doDownload = async () => {
    setDownloading(true)
    try {
      await api.startDownload(item.id, item.title || item.id)
      toast.success(`Downloading ${item.title}…`)
    } catch(e: any) { toast.error(e.message || 'Download failed') }
    setDownloading(false)
  }
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

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>

      {/* ── CINEMATIC HERO — full height backdrop, blur-from-bottom ── */}
      <div className="relative flex-shrink-0" style={{ height: 'clamp(260px, 52vh, 480px)' }}>
        {/* Full backdrop */}
        {backdrop && (
          <div key={activeBackdrop} className="absolute inset-0"
            style={{ backgroundImage: `url('${backdrop}')`, backgroundSize: 'cover', backgroundPosition: 'center top', animation: 'fadeIn 0.7s ease' }} />
        )}
        {/* Dark base fallback */}
        {!backdrop && <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)' }} />}

        {/* Bottom blur + fade overlay — the key effect */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(0,0,0,0.5) 60%, var(--bg) 100%)',
        }} />
        {/* Left vignette */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
        }} />

        {/* Content overlaid at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-7 pb-5">
          {/* Logo or title */}
          {item.logoUrl
            ? <img src={item.logoUrl} alt={item.title} className="object-contain mb-3"
                style={{ maxHeight: 72, maxWidth: 300, filter: 'drop-shadow(0 2px 20px rgba(0,0,0,1)) brightness(1.05)' }} />
            : <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 48px)',
                  letterSpacing: '0.07em', color: 'white', textShadow: '0 2px 24px rgba(0,0,0,0.9)',
                  marginBottom: 8, lineHeight: 1 }}>
                {item.title}
              </h1>
          }

          {/* Metadata + ratings all in one compact row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {item.type === 'Episode' && (
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)', opacity: 0.9 }}>
                {item.seriesName} · S{String(item.parentIndexNumber||0).padStart(2,'0')}E{String(item.indexNumber||0).padStart(2,'0')}
              </span>
            )}
            {item.year && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.year}</span>}
            {item.runtime && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>· {item.runtime}m</span>}
            {item.rating && (
              <span className="text-[8px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {item.rating}
              </span>
            )}
            {(item.qualities||[]).slice(0,1).map(q => (
              <span key={q} className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.2)', color: q.startsWith('4K') ? 'var(--bg)' : '#5dade2', border: 'none' }}>
                {q}
              </span>
            ))}
            {item.audio && <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.audio}</span>}

            {/* Ratings inline — compact, no cutoff */}
            {item.externalRatings?.imdb != null && (
              <a href={item.externalRatings.imdbUrl||'#'} target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 hover:opacity-75"
                style={{ color: '#f5c518', textDecoration: 'none', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                ★ {item.externalRatings.imdb}
              </a>
            )}
            {item.externalRatings?.rt != null && (
              <span className="text-[10px] font-bold" style={{ color: item.externalRatings.rt >= 60 ? '#fa5700' : '#888', whiteSpace: 'nowrap' }}>
                {item.externalRatings.rt >= 60 ? '🍅' : '🫙'} {item.externalRatings.rt}%
              </span>
            )}
            {item.externalRatings?.metascore != null && (
              <span className="text-[10px] font-bold" style={{ color: '#66af44', whiteSpace: 'nowrap' }}>
                MC {item.externalRatings.metascore}
              </span>
            )}
            {item.externalRatings?.letterboxdUrl && (
              <a href={item.externalRatings.letterboxdUrl} target="_blank" rel="noreferrer"
                className="text-[9px] font-bold hover:opacity-75"
                style={{ color: '#00a550', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                LB
              </a>
            )}
          </div>

          {/* Action buttons overlaid on hero */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {canPlay && (
              <button onClick={() => onPlay(selectedSourceId, selectedAudioIndex)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold tracking-wider uppercase text-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em', backdropFilter: 'blur(8px)' }}>
                <Play size={14} fill="currentColor" />
                {item.userData?.playedPercentage && item.userData.playedPercentage > 5 ? 'Resume' : 'Play'}
              </button>
            )}
            {trailerKey && (
              <a href={`https://www.youtube.com/watch?v=${trailerKey}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold tracking-wide text-sm transition-all hover:opacity-80"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)', textDecoration: 'none' }}>
                <Youtube size={13} /> Trailer
              </a>
            )}
            {canPlay && (
              <button onClick={doDownload} disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-sm transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                title="Download for offline">
                {downloading ? <Loader size={13} className="animate-spin" /> : <Download size={13} />}
              </button>
            )}
            {jellyfinUrl && (
              <a href={`${jellyfinUrl}/web/#/details?id=${item.id}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 px-3 py-2.5 rounded-full text-sm transition-all hover:opacity-70"
                style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Backdrop dots */}
        {backdrops.length > 1 && (
          <div className="absolute bottom-5 right-6 flex gap-1.5">
            {backdrops.slice(0, 5).map((_, i) => (
              <button key={i} onClick={() => setActiveBackdrop(i)}
                className="rounded-full transition-all"
                style={{ width: i === activeBackdrop ? 14 : 5, height: 5,
                  background: i === activeBackdrop ? 'var(--accent)' : 'rgba(255,255,255,0.3)' }} />
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

        {/* Seasons + Episodes for TV shows */}
        {item.type === 'Series' && (
          <SeasonsPanel item={item} onPlayEpisode={ep => onPlay(undefined, undefined, ep)} />
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
                  onClick={() => { onClose(); navigate(`/person/${actor.id}`, { state: { name: actor.name, imageTag: actor.imageTag } }) }}
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
