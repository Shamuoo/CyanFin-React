import { useQuery } from '@tanstack/react-query'
import { Play, Pause, Users } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'

function fmtTicks(ticks: number) {
  const s = Math.floor(ticks / 10_000_000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}

export default function NowPlayingPage() {
  const { setDetailItemId, setPlayingItem } = useStore()
  const navigate = useNavigate()

  const { data: nowPlaying, isLoading } = useQuery({
    queryKey: ['now-playing'],
    queryFn: api.nowPlaying.bind(api),
    refetchInterval: 5000,
  })

  const handlePlay = async (itemId: string, title: string) => {
    try {
      const info = await api.playbackInfo(itemId)
      setPlayingItem({ id: itemId, title, streamUrl: info.streamUrl, hlsUrl: info.hlsUrl } as any)
      navigate('/player')
    } catch(e) { console.error(e) }
  }

  if (isLoading) return (
    <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  if (!nowPlaying || !nowPlaying.item) return (
    <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
      <div className="text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.3, letterSpacing: '0.3em' }}>CYANFIN</div>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Nothing is playing right now</p>
    </div>
  )

  const { item, positionTicks, runtimeTicks, isPaused, allUsers = [] } = nowPlaying
  const pct = runtimeTicks ? (positionTicks / runtimeTicks) * 100 : 0
  const backdrop = item.backdropUrl || item.posterUrl

  return (
    <div className="h-full relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Full backdrop */}
      {backdrop && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${backdrop}')`, filter: 'blur(2px) brightness(0.3)', transform: 'scale(1.05)' }} />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))' }} />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center px-8 text-center">
        {/* Poster */}
        {item.posterUrl && (
          <img src={item.posterUrl} alt={item.title} className="w-32 h-48 object-cover rounded-xl mb-6 shadow-2xl"
            style={{ border: '2px solid rgba(255,255,255,0.1)' }} />
        )}

        {/* Logo or title */}
        {item.logoUrl
          ? <img src={item.logoUrl} alt={item.title} className="max-h-16 max-w-xs object-contain mb-3"
              style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,1))' }} />
          : <h1 className="text-3xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.1em' }}>
              {item.type === 'Episode' ? item.seriesName : item.title}
            </h1>
        }
        {item.type === 'Episode' && (
          <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
            S{String(item.parentIndexNumber||0).padStart(2,'0')}E{String(item.indexNumber||0).padStart(2,'0')} · {item.title}
          </p>
        )}
        <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
          {[item.year, item.genre, item.audio].filter(Boolean).join(' · ')}
        </p>

        {/* Progress */}
        <div className="w-full max-w-md mb-2">
          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
          </div>
        </div>
        <div className="flex justify-between w-full max-w-md mb-6 text-xs font-mono" style={{ color: 'var(--muted)' }}>
          <span>{fmtTicks(positionTicks)}</span>
          <span className="flex items-center gap-1.5">
            {isPaused ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
            {isPaused ? 'Paused' : 'Playing'}
          </span>
          <span>{fmtTicks(runtimeTicks)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => handlePlay(item.id, item.title)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all hover:opacity-85"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <Play size={14} fill="currentColor" /> Play Here
          </button>
          <button onClick={() => setDetailItemId(item.id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--cream)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Info
          </button>
        </div>

        {/* Other users watching */}
        {allUsers.length > 1 && (
          <div className="mt-6 flex items-center gap-2">
            <Users size={12} style={{ color: 'var(--muted)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {allUsers.map(u => (u as any).user).join(', ')} watching
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
