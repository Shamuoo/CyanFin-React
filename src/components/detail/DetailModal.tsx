import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, ExternalLink, ChevronLeft } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { MediaItem, MediaSource, AudioStream } from '@/types'
import { useNavigate } from 'react-router-dom'

export default function DetailModal() {
  const { detailItemId, setDetailItemId, setPlayingItem, jellyfinUrl } = useStore()
  const navigate = useNavigate()

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailItemId(null)
    }
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
      setPlayingItem({ id: item.id, title: item.title ?? '', streamUrl: info.streamUrl, startTime: item.userData?.PlaybackPositionTicks ? item.userData.PlaybackPositionTicks / 10_000_000 : 0, hlsUrl: info.hlsUrl } as any)
      setDetailItemId(null)
      navigate('/player')
    } catch(e) { console.error(e) }
  }

  return (
    <AnimatePresence>
      {detailItemId && (
        <>
          {/* Backdrop overlay - click to close */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setDetailItemId(null)}
          />
          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 z-[101] overflow-y-auto scrollbar-hide rounded-t-2xl"
            style={{ background: 'rgba(10,8,4,0.92)', backdropFilter: 'blur(24px)', top: '56px', WebkitBackdropFilter: 'blur(24px)' }}
          >
            {/* Close bar at top */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
              style={{ background: 'rgba(10,8,4,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border2)' }}>
              <button onClick={() => setDetailItemId(null)}
                className="flex items-center gap-2 text-sm font-bold tracking-wide transition-all hover:opacity-70"
                style={{ color: 'var(--muted)' }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setDetailItemId(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
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

function DetailContent({ item, onClose, onPlay, jellyfinUrl }: {
  item: MediaItem; onClose: () => void
  onPlay: (mediaSourceId?: string, audioIndex?: number) => void
  jellyfinUrl: string
}) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>()
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([])

  useEffect(() => {
    setSelectedSourceId(undefined)
    setSelectedAudioIndex(undefined)
    setMediaSources([])
    if (!item.id || (item.type !== 'Movie' && item.type !== 'Episode')) return
    api.playbackInfo(item.id).then(info => {
      if (info.mediaSources?.length) {
        setMediaSources(info.mediaSources)
        setSelectedSourceId(info.mediaSources[0].id)
        const def = info.mediaSources[0].audioStreams?.find(a => a.isDefault)
        if (def) setSelectedAudioIndex(def.index)
      }
    }).catch(() => {})
  }, [item.id])

  const selectedSource = mediaSources.find(s => s.id === selectedSourceId) || mediaSources[0]
  const canPlay = item.type === 'Movie' || item.type === 'Episode'
  const backdrop = item.backdropUrls?.[0] || item.backdropUrl

  return (
    <div>
      {/* Backdrop */}
      <div className="relative w-full" style={{ height: '45vh', minHeight: 240 }}>
        {backdrop
          ? <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url('${backdrop}')` }} />
          : <div className="absolute inset-0" style={{ background: 'var(--bg3)' }} />
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 60%, var(--bg) 100%)' }} />
      </div>

      {/* Info */}
      <div className="relative z-10 -mt-20" style={{ padding: '0 var(--pad)' }}>
        {item.logoUrl
          ? <img src={item.logoUrl} alt={item.title} className="max-h-16 max-w-xs object-contain mb-3"
              style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,1))' }} />
          : <h1 className="text-4xl mb-2 leading-none" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em', color: 'var(--cream)' }}>{item.title}</h1>
        }
        {item.tagline && <p className="text-sm italic mb-3" style={{ color: 'var(--muted)' }}>{item.tagline}</p>}

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[item.year?.toString(), item.genre, item.rating].filter(Boolean).map(v => (
            <span key={v} className="chip" style={{ background: 'var(--subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}>{v}</span>
          ))}
          {item.score && <span className="chip" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>★ {parseFloat(String(item.score)).toFixed(1)}</span>}
          {(item.qualities || []).map(q => (
            <span key={q} className="chip" style={{ background: q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.12)', color: q.startsWith('4K') ? 'var(--bg)' : 'var(--blue)', border: `1px solid ${q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.3)'}` }}>{q}</span>
          ))}
          {item.audio && <span className="chip" style={{ background: 'rgba(93,173,226,0.08)', color: 'var(--blue)', border: '1px solid rgba(93,173,226,0.2)' }}>🔊 {item.audio}</span>}
          {item.runtime && (() => { const m = Math.round(item.runtime! / 600_000_000); return <span className="chip" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>{Math.floor(m/60)}h {m%60}m</span> })()}
        </div>

        {/* Version picker */}
        {mediaSources.length > 1 && (
          <div className="mb-3">
            <p className="text-[8px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Version</p>
            <div className="flex gap-2 flex-wrap">
              {mediaSources.map(src => (
                <button key={src.id} onClick={() => { setSelectedSourceId(src.id); setSelectedAudioIndex(src.audioStreams?.find(a => a.isDefault)?.index) }}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                  style={{ background: selectedSourceId === src.id ? 'var(--accent)' : 'var(--subtle)', color: selectedSourceId === src.id ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${selectedSourceId === src.id ? 'var(--accent)' : 'var(--border2)'}` }}>
                  {src.name || src.container}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio picker */}
        {selectedSource?.audioStreams && selectedSource.audioStreams.length > 1 && (
          <div className="mb-4">
            <p className="text-[8px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Audio</p>
            <div className="flex gap-2 flex-wrap">
              {selectedSource.audioStreams.map(a => (
                <button key={a.index} onClick={() => setSelectedAudioIndex(a.index)}
                  className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all"
                  style={{ background: selectedAudioIndex === a.index ? 'rgba(93,173,226,0.2)' : 'var(--subtle)', color: selectedAudioIndex === a.index ? 'var(--blue)' : 'var(--muted)', border: `1px solid ${selectedAudioIndex === a.index ? 'rgba(93,173,226,0.4)' : 'var(--border2)'}` }}>
                  {a.title} {a.channels ? `${a.channels}ch` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap mb-6">
          {canPlay && (
            <button onClick={() => onPlay(selectedSourceId, selectedAudioIndex)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all hover:opacity-85"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              <Play size={14} fill="currentColor" /> Play
            </button>
          )}
          {jellyfinUrl && (
            <a href={`${jellyfinUrl}/web/#/details?id=${item.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--cream)', border: '1px solid var(--border2)', textDecoration: 'none' }}>
              <ExternalLink size={14} /> Jellyfin
            </a>
          )}
        </div>

        {/* Overview + crew */}
        {item.overview && <p className="text-sm leading-relaxed mb-4 max-w-3xl" style={{ color: 'var(--muted)' }}>{item.overview}</p>}
        {item.director && <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>Directed by <span style={{ color: 'var(--cream)', opacity: 0.7 }}>{item.director}</span></p>}

        {/* Cast */}
        {item.cast && item.cast.length > 0 && (
          <div className="mb-6">
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Cast</p>
            <div className="flex gap-3 flex-wrap">
              {item.cast.slice(0, 12).map(actor => (
                <div key={actor.id} className="flex flex-col items-center gap-1.5" style={{ width: 72 }}>
                  {actor.imageTag
                    ? <img src={`/proxy/image?id=${actor.id}&type=Primary&w=185`} alt={actor.name} className="w-16 h-16 rounded-full object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg3)' }} />
                    : <div className="w-12 h-12 rounded-full flex items-center justify-center text-base" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>{(actor.name || '?')[0]}</div>
                  }
                  <p className="text-[8px] text-center leading-tight truncate w-full" style={{ color: 'var(--muted)' }}>{actor.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extras */}
        {item.extras && item.extras.length > 0 && (
          <div className="mb-8">
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Extras</p>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {item.extras.map(extra => (
                <div key={extra.id} className="flex-shrink-0 w-40 cursor-pointer group">
                  <div className="relative w-40 h-[90px] rounded overflow-hidden mb-1.5" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                    {extra.thumbUrl && <img src={extra.thumbUrl} alt={extra.title} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <Play size={24} color="white" />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold truncate" style={{ color: 'rgba(240,232,213,0.65)' }}>{extra.title}</p>
                  <p className="text-[8px]" style={{ color: 'var(--muted)' }}>{extra.type || 'Extra'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
