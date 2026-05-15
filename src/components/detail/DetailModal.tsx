import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, ExternalLink, ChevronDown } from 'lucide-react'
import type { MediaSource, AudioStream } from '@/types'
import { useStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { MediaItem } from '@/types'
import { useNavigate } from 'react-router-dom'

export default function DetailModal() {
  const { detailItemId, setDetailItemId, setPlayingItem, jellyfinUrl } = useStore()
  const navigate = useNavigate()

  const { data: item } = useQuery({
    queryKey: ['item', detailItemId],
    queryFn: () => api.item(detailItemId!),
    enabled: !!detailItemId,
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailItemId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setDetailItemId])

  const handlePlay = async () => {
    if (!item) return
    try {
      const info = await api.playbackInfo(item.id)
      setPlayingItem({
        id: item.id, title: item.title || "", streamUrl: info.streamUrl,
        startTime: item.userData?.PlaybackPositionTicks ? item.userData.PlaybackPositionTicks / 10_000_000 : 0,
      })
      setDetailItemId(null)
      navigate('/player')
    } catch(e) { console.error(e) }
  }

  return (
    <AnimatePresence>
      {detailItemId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
         className="fixed inset-x-0 bottom-0 overflow-y-auto scrollbar-hide z-30" style={{ background: 'var(--bg)', top: '56px' }}>
          {item
            ? <DetailContent item={item} onClose={() => setDetailItemId(null)} onPlay={handlePlay} jellyfinUrl={jellyfinUrl} />
            : <div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
          }
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DetailContent({ item, onClose, onPlay, jellyfinUrl }: { item: MediaItem; onClose: () => void; onPlay: (mediaSourceId?: string, audioIndex?: number) => void; jellyfinUrl: string }) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined)
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>(undefined)
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([])
  const [loadingInfo, setLoadingInfo] = useState(false)

  useEffect(() => {
    if (!item.id) return
    setLoadingInfo(true)
    api.playbackInfo(item.id).then(info => {
      if (info.mediaSources?.length) {
        setMediaSources(info.mediaSources)
        setSelectedSourceId(info.mediaSources[0].id)
        const def = info.mediaSources[0].audioStreams.find(a => a.isDefault)
        if (def) setSelectedAudioIndex(def.index)
      }
    }).catch(() => {}).finally(() => setLoadingInfo(false))
  }, [item.id])

  const selectedSource = mediaSources.find(s => s.id === selectedSourceId) || mediaSources[0]
  const canPlay = item.type === 'Movie' || item.type === 'Episode'
  const backdrop = item.backdropUrls?.[0] || item.backdropUrl


  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Backdrop */}
      <div className="relative w-full" style={{ height: '50vh', minHeight: 280 }}>
        {backdrop && <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url('${backdrop}')` }} />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 60%, var(--bg) 100%)' }} />
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all hover:bg-white/20"
          style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
          <X size={18} />
        </button>
      </div>

      {/* Info row - no poster, just text overlapping backdrop */}
      <div className="relative z-10" style={{ padding: '0 var(--pad)', marginTop: -100 }}>
        <div className="flex-1 min-w-0 pb-2 flex flex-col justify-end">
          {item.logoUrl
            ? <img src={item.logoUrl} alt={item.title} className="max-h-16 max-w-[240px] object-contain mb-3" style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,1)) brightness(1.1)' }} />
            : <h1 className="text-4xl mb-2 leading-none" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em', color: 'var(--cream)' }}>{item.title}</h1>
          }
          {item.tagline && <p className="text-sm italic mb-3" style={{ color: 'var(--muted)' }}>{item.tagline}</p>}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[item.year?.toString(), item.genre, item.rating].filter(Boolean).map(v => (
              <span key={v} className="chip" style={{ background: 'var(--subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}>{v}</span>
            ))}
            {item.score && <span className="chip" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>★ {parseFloat(String(item.score)).toFixed(1)}</span>}
            {(item.qualities || []).map(q => (
              <span key={q} className="chip" style={{ background: q.startsWith('4K') ? 'var(--accent)' : q.includes('3D') ? 'rgba(46,204,113,0.12)' : 'rgba(93,173,226,0.12)', color: q.startsWith('4K') ? 'var(--bg)' : q.includes('3D') ? '#2ecc71' : 'var(--blue)', border: `1px solid ${q.startsWith('4K') ? 'var(--accent)' : 'rgba(93,173,226,0.2)'}` }}>{q}</span>
            ))}
            {item.audio && <span className="chip" style={{ background: 'rgba(93,173,226,0.08)', color: 'var(--blue)', border: '1px solid rgba(93,173,226,0.2)' }}>🔊 {item.audio}</span>}
          </div>
          {/* Version picker */}
          {mediaSources.length > 1 && (
            <div className="mb-3 flex gap-2 flex-wrap">
              {mediaSources.map(src => (
                <button key={src.id} onClick={() => { setSelectedSourceId(src.id); setSelectedAudioIndex(src.audioStreams.find(a => a.isDefault)?.index) }}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                  style={{ background: selectedSourceId === src.id ? 'var(--accent)' : 'var(--subtle)', color: selectedSourceId === src.id ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${selectedSourceId === src.id ? 'var(--accent)' : 'var(--border2)'}` }}>
                  {src.name || src.container}
                </button>
              ))}
            </div>
          )}
          {/* Audio stream picker */}
          {selectedSource?.audioStreams && selectedSource.audioStreams.length > 1 && (
            <div className="mb-3 flex gap-2 flex-wrap items-center">
              <span className="text-[8px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Audio:</span>
              {selectedSource.audioStreams.map(a => (
                <button key={a.index} onClick={() => setSelectedAudioIndex(a.index)}
                  className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all"
                  style={{ background: selectedAudioIndex === a.index ? 'rgba(93,173,226,0.2)' : 'var(--subtle)', color: selectedAudioIndex === a.index ? 'var(--blue)' : 'var(--muted)', border: `1px solid ${selectedAudioIndex === a.index ? 'rgba(93,173,226,0.4)' : 'var(--border2)'}` }}>
                  {a.title} {a.channels ? `${a.channels}ch` : ''}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {canPlay && (
              <button onClick={() => onPlay(selectedSourceId, selectedAudioIndex)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all hover:opacity-85"
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
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px var(--pad) 48px' }}>
        {item.overview && <p className="text-sm leading-relaxed mb-5 max-w-3xl" style={{ color: 'var(--muted)' }}>{item.overview}</p>}
        {item.director && <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>Directed by <span style={{ color: 'var(--cream)', opacity: 0.7 }}>{item.director}</span></p>}
        {item.cast && item.cast.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[9px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Cast</h3>
            <div className="flex gap-3 flex-wrap">
              {item.cast.map(actor => (
                <div key={actor.id} className="flex flex-col items-center gap-1 w-14">
                  {actor.imageTag
                    ? <img src={`/proxy/image?id=${actor.id}&type=Primary&w=185`} alt={actor.name} className="w-12 h-12 rounded-full object-cover" style={{ border: '1px solid var(--border2)', background: 'var(--bg3)' }} />
                    : <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>{(actor.name || '?')[0]}</div>
                  }
                  <p className="text-[8px] text-center leading-tight" style={{ color: 'var(--muted)' }}>{actor.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {item.extras && item.extras.length > 0 && (
          <div>
            <h3 className="text-[9px] font-bold tracking-[0.25em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Extras</h3>
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
    </motion.div>
  )
}
