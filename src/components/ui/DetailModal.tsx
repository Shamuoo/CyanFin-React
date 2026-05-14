import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Edit, ExternalLink, MessageCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn, fmtRuntime } from '@/lib/utils'
import type { MediaItem } from '@/types'

interface DetailModalProps {
  item: MediaItem | null
  onClose: () => void
  onPlay: (item: MediaItem) => void
}

export function DetailModal({ item, onClose, onPlay }: DetailModalProps) {
  const [backdropIdx, setBackdropIdx] = useState(0)

  // Load full item data
  const { data: full } = useQuery({
    queryKey: ['item', item?.id],
    queryFn: () => api.item(item!.id),
    enabled: !!item,
    staleTime: 5 * 60 * 1000,
  })

  const { data: intCfg } = useQuery({
    queryKey: ['integrations-config'],
    queryFn: api.integrationsConfig,
    staleTime: 60 * 1000,
  })

  const display = full || item

  useEffect(() => {
    setBackdropIdx(0)
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [item, onClose])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = item ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [item])

  const handleRequest = useCallback(async () => {
    if (!display) return
    try {
      await api.requestMedia('movie', display.id)
      alert('Requested!')
    } catch (e) {
      alert('Request failed')
    }
  }, [display])

  const handleDiscord = useCallback(async () => {
    if (!display) return
    await api.discordNotify({
      title: display.title, overview: display.overview || '',
      posterUrl: display.posterUrl, type: display.type, year: String(display.year || ''),
    })
  }, [display])

  const backdrops = full?.backdropUrls?.length
    ? full.backdropUrls
    : [display?.backdropUrl || display?.posterUrl || '']

  const currentBackdrop = backdrops[backdropIdx]

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            {/* ── Backdrop hero ── */}
            <div className="relative w-full" style={{ height: '55vh', minHeight: 320 }}>
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
                style={{ backgroundImage: `url('${currentBackdrop}')` }}
              />
              {/* Vignette */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-[var(--bg)]" />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>

              {/* Backdrop dots */}
              {backdrops.length > 1 && (
                <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
                  {backdrops.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBackdropIdx(i)}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full transition-all',
                        i === backdropIdx
                          ? 'bg-[var(--accent)] scale-125'
                          : 'bg-white/25 hover:bg-white/50'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Poster + info row ── */}
            <div
              className="flex gap-7 px-8 -mt-20 relative z-10 items-end"
              style={{ marginBottom: 0 }}
            >
              {/* Poster */}
              <motion.img
                src={display?.posterUrl}
                alt={display?.title}
                className="flex-shrink-0 rounded-xl shadow-2xl border border-white/10 object-cover"
                style={{ width: 150, height: 225 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0 pb-2">
                {/* Logo or title */}
                {full?.logoUrl ? (
                  <motion.img
                    src={full.logoUrl}
                    alt={display?.title}
                    className="max-h-16 max-w-xs object-contain mb-3"
                    style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,1))' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                ) : (
                  <h1
                    className="font-display text-4xl leading-none tracking-wide text-[var(--cream)] mb-2"
                    style={{ fontFamily: 'var(--font-display)', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}
                  >
                    {display?.title}
                  </h1>
                )}

                {/* Type badge */}
                {display?.type === 'Episode' ? (
                  <p className="text-[11px] tracking-widest uppercase text-[var(--accent)] opacity-60 mb-2">
                    {display.seriesName} · S{String(display.parentIndexNumber || 0).padStart(2, '0')}E{String(display.indexNumber || 0).padStart(2, '0')}
                  </p>
                ) : (
                  <p className="text-[10px] tracking-widest uppercase text-[var(--accent)] opacity-60 mb-2">
                    {display?.type}
                  </p>
                )}

                {/* Chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {display?.year && <Chip variant="accent">{display.year}</Chip>}
                  {display?.genre && <Chip>{display.genre}</Chip>}
                  {display?.rating && <Chip variant="accent">{display.rating}</Chip>}
                  {display?.score && <Chip>★ {display.score.toFixed(1)}</Chip>}
                  {display?.qualities?.map(q => (
                    <Chip key={q} variant={q.includes('3D') ? 'green' : q.startsWith('4K') ? 'gold' : 'accent'}>
                      {q}
                    </Chip>
                  ))}
                  {display?.audio && (
                    <Chip variant={['Atmos','DTS:X','TrueHD','DTS-HD MA'].includes(display.audio) ? 'accent' : 'default'}>
                      🔊 {display.audio}
                    </Chip>
                  )}
                  {display?.versionCount && display.versionCount > 1 && (
                    <Chip>📀 {display.versionCount} versions</Chip>
                  )}
                  {display?.runtime && <Chip>{fmtRuntime(display.runtime)}</Chip>}
                  {display?.studios?.[0] && <Chip>{display.studios[0]}</Chip>}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {(display?.type === 'Movie' || display?.type === 'Episode') && (
                    <button
                      onClick={() => display && onPlay(display)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--bg)] text-[11px] font-bold tracking-widest uppercase hover:opacity-85 transition-opacity"
                    >
                      <Play size={13} fill="currentColor" /> Play
                    </button>
                  )}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-meta-editor', { detail: { item: display } }))}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 text-[var(--cream)] text-[11px] font-bold tracking-widest uppercase hover:bg-white/12 transition-colors"
                  >
                    <Edit size={12} /> Edit
                  </button>
                  {intCfg?.jellyseerr && display?.type === 'Movie' && (
                    <button
                      onClick={handleRequest}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 text-[var(--cream)] text-[11px] font-bold tracking-widest uppercase hover:bg-white/12 transition-colors"
                    >
                      📋 Request
                    </button>
                  )}
                  {intCfg?.discord && (
                    <button
                      onClick={handleDiscord}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 text-[var(--cream)] text-[11px] font-bold tracking-widest uppercase hover:bg-white/12 transition-colors"
                    >
                      <MessageCircle size={12} /> Share
                    </button>
                  )}
                  {(window as any)._jellyfinUrl && (
                    <a
                      href={`${(window as any)._jellyfinUrl}/web/#/details?id=${display?.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 text-[var(--cream)] text-[11px] font-bold tracking-widest uppercase hover:bg-white/12 transition-colors"
                    >
                      <ExternalLink size={12} /> Jellyfin
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="px-8 pt-6 pb-16">
              {display?.tagline && (
                <p className="text-sm italic text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
                  {display.tagline}
                </p>
              )}
              {display?.overview && (
                <p className="text-sm leading-relaxed text-[var(--muted)] max-w-3xl mb-4">
                  {display.overview}
                </p>
              )}
              {display?.director && (
                <p className="text-[11px] text-[var(--muted)] opacity-60 mb-6">
                  Directed by <span className="opacity-100">{display.director}</span>
                </p>
              )}

              {/* Cast */}
              {display?.cast && display.cast.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-[9px] font-bold tracking-[0.3em] uppercase text-[var(--accent)] opacity-50 mb-3">Cast</h3>
                  <div className="flex flex-wrap gap-3">
                    {display.cast.map(actor => (
                      <div key={actor.id} className="flex flex-col items-center gap-1 w-14">
                        {actor.imageTag ? (
                          <img
                            src={`/proxy/image?id=${actor.id}&type=Primary&w=185`}
                            alt={actor.name}
                            className="w-12 h-12 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[var(--bg3)] border border-white/10 flex items-center justify-center text-lg text-[var(--muted)]">
                            {actor.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-[8px] text-[var(--muted)] text-center leading-tight truncate w-full">{actor.name}</span>
                        {actor.role && (
                          <span className="text-[7px] text-[var(--muted)] opacity-40 text-center leading-tight truncate w-full">{actor.role}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extras */}
              {full?.extras && full.extras.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-[9px] font-bold tracking-[0.3em] uppercase text-[var(--accent)] opacity-50 mb-3">
                    Extras & Special Features
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {full.extras.map(extra => (
                      <div
                        key={extra.id}
                        className="flex-shrink-0 w-40 cursor-pointer group"
                        onClick={() => {
                          onClose()
                          window.dispatchEvent(new CustomEvent('play-item', { detail: { item: extra } }))
                        }}
                      >
                        <div className="relative w-40 h-24 rounded-md overflow-hidden bg-[var(--bg3)] border border-white/10">
                          {extra.thumbUrl && (
                            <img src={extra.thumbUrl} alt={extra.title} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Play size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--muted)] mt-1.5 truncate">{extra.title}</p>
                        <p className="text-[8px] text-[var(--muted)] opacity-40 uppercase tracking-wide">{extra.type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Small chip component
function Chip({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'accent' | 'green' | 'gold' }) {
  return (
    <span className={cn(
      'text-[9px] font-bold tracking-wide px-2.5 py-1 rounded-full uppercase',
      variant === 'accent' && 'bg-[var(--subtle)] text-[var(--accent)] border border-[var(--border)]',
      variant === 'green' && 'bg-green-500/12 text-green-400 border border-green-400/20',
      variant === 'gold' && 'bg-amber-500/15 text-amber-400 border border-amber-400/25',
      variant === 'default' && 'bg-white/5 text-[var(--muted)] border border-white/8',
    )}>
      {children}
    </span>
  )
}
