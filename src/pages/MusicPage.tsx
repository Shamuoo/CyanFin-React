import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, Music, Repeat, Shuffle, Volume2, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { playQueue, useAudioBar } from '@/components/player/AudioBar'

function fmtTime(ticks?: number) {
  if (!ticks) return '0:00'
  const s = Math.floor(ticks / 10_000_000)
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
}

export default function MusicPage() {
  const [view, setView] = useState<'albums' | 'tracks' | 'nowplaying'>('albums')
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null)
  const [repeat, setRepeat] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const audioBar = useAudioBar()

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums'], queryFn: () => api.albums() as Promise<any[]>,
  })

  const { data: tracks = [], isLoading: loadingTracks } = useQuery({
    queryKey: ['tracks', selectedAlbum?.id],
    queryFn: () => api.tracks(selectedAlbum.id),
    enabled: !!selectedAlbum && view === 'tracks',
  })

  const playAlbum = (startIdx = 0) => {
    const queue = (tracks as any[]).map(t => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      streamUrl: t.streamUrl, duration: t.duration, imageUrl: selectedAlbum?.imageUrl,
    }))
    if (queue.length) { playQueue(queue, startIdx); setView('nowplaying') }
  }

  // ── Now Playing full-screen ───────────────────────────────────────────────
  if (view === 'nowplaying' && audioBar?.currentTrack) {
    const track = audioBar.currentTrack
    return (
      <div className="h-full flex flex-col items-center justify-between overflow-hidden"
        style={{ background: 'var(--bg)', padding: '24px 32px 32px' }}>

        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <button onClick={() => setView(selectedAlbum ? 'tracks' : 'albums')}
            className="flex items-center gap-1.5 hover:opacity-70"
            style={{ color: 'var(--muted)' }}>
            <ChevronDown size={18} /> <span className="text-xs">Library</span>
          </button>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--muted)', opacity: 0.4 }}>Now Playing</p>
          <div style={{ width: 60 }} />
        </div>

        {/* Album art */}
        <div className="flex-1 flex items-center justify-center py-8" style={{ maxHeight: 340 }}>
          {track.imageUrl
            ? <img src={track.imageUrl} alt={track.album || ''} className="rounded-2xl object-cover"
                style={{ width: 280, height: 280, maxWidth: '70vw', maxHeight: '70vw',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.08)' }} />
            : <div className="rounded-2xl flex items-center justify-center"
                style={{ width: 280, height: 280, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                <Music size={64} style={{ color: 'var(--muted)', opacity: 0.3 }} />
              </div>
          }
        </div>

        {/* Track info */}
        <div className="w-full text-center mb-6">
          <p className="text-xl font-bold mb-1 truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.05em' }}>
            {track.title}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {[track.artist, track.album].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full mb-4">
          <div className="relative h-1 rounded-full mb-2 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              audioBar.seek?.(pct)
            }}>
            <div className="h-full rounded-full transition-none"
              style={{ width: `${audioBar.progress || 0}%`, background: 'var(--accent)' }} />
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: 'var(--muted)' }}>
            <span>{fmtTime(audioBar.positionTicks)}</span>
            <span>{fmtTime(track.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setShuffle(s => !s)} style={{ color: shuffle ? 'var(--accent)' : 'var(--muted)', opacity: shuffle ? 1 : 0.4 }}>
              <Shuffle size={18} />
            </button>
            <div className="flex items-center gap-8">
              <button onClick={() => audioBar.prev?.()} className="hover:opacity-70" style={{ color: 'var(--cream)' }}>
                <SkipBack size={26} />
              </button>
              <button onClick={() => audioBar.togglePlay?.()}
                className="flex items-center justify-center rounded-full transition-all hover:scale-105"
                style={{ width: 64, height: 64, background: 'var(--accent)', color: 'var(--bg)' }}>
                {audioBar.playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />}
              </button>
              <button onClick={() => audioBar.next?.()} className="hover:opacity-70" style={{ color: 'var(--cream)' }}>
                <SkipForward size={26} />
              </button>
            </div>
            <button onClick={() => setRepeat(r => !r)} style={{ color: repeat ? 'var(--accent)' : 'var(--muted)', opacity: repeat ? 1 : 0.4 }}>
              <Repeat size={18} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3">
            <Volume2 size={14} style={{ color: 'var(--muted)', opacity: 0.4 }} />
            <input type="range" min="0" max="1" step="0.01"
              value={audioBar.volume ?? 1}
              onChange={e => audioBar.setVolume?.(parseFloat(e.target.value))}
              className="flex-1" style={{ accentColor: 'var(--accent)' }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Track list ─────────────────────────────────────────────────────────────
  if (view === 'tracks' && selectedAlbum) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
          <button onClick={() => setView('albums')}
            className="flex items-center gap-1.5 text-sm font-bold hover:opacity-70"
            style={{ color: 'var(--muted)' }}>
            <ChevronLeft size={16} /> Albums
          </button>
          {audioBar?.currentTrack && (
            <button onClick={() => setView('nowplaying')} className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--accent)' }}>
              ▶ Now Playing
            </button>
          )}
        </div>

        <div className="flex gap-6 p-6 pb-4">
          {selectedAlbum.imageUrl
            ? <img src={selectedAlbum.imageUrl} alt="" className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid var(--border2)' }} />
            : <div className="w-32 h-32 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                <Music size={32} style={{ color: 'var(--muted)' }} />
              </div>
          }
          <div className="flex flex-col justify-end min-w-0">
            <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>Album</p>
            <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.08em' }}>{selectedAlbum.title}</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{[selectedAlbum.artist, selectedAlbum.year].filter(Boolean).join(' · ')}</p>
            <button onClick={() => playAlbum(0)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide self-start hover:opacity-85"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              <Play size={14} fill="currentColor" /> Play All
            </button>
          </div>
        </div>

        {loadingTracks
          ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
          : <div className="px-6 space-y-1">
              {(tracks as any[]).map((track, idx) => (
                <div key={track.id}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg cursor-pointer group hover:bg-white/5"
                  onClick={() => playAlbum(idx)}>
                  <span className="w-6 text-right text-sm flex-shrink-0" style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {track.trackNumber || idx + 1}
                  </span>
                  <p className="flex-1 text-sm truncate" style={{ color: 'rgba(240,232,213,0.75)' }}>{track.title}</p>
                  <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100" style={{ color: 'var(--muted)' }}>
                    {track.duration ? `${Math.floor(track.duration/600_000_000)}:${String(Math.floor((track.duration%600_000_000)/10_000_000)).padStart(2,'0')}` : ''}
                  </span>
                  <Play size={14} className="opacity-0 group-hover:opacity-100 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                </div>
              ))}
            </div>
        }
      </div>
    )
  }

  // ── Album grid ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
      <div style={{ padding: '24px var(--pad) 12px' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Music</h1>
          {audioBar?.currentTrack && (
            <button onClick={() => setView('nowplaying')}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
              ▶ {audioBar.currentTrack.title}
            </button>
          )}
        </div>
      </div>
      {isLoading
        ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
        : (albums as any[]).length === 0
          ? <div className="text-center py-20" style={{ color: 'var(--muted)' }}>No music in your library</div>
          : <div className="grid gap-4 pb-12" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', padding: '12px var(--pad) 48px' }}>
              {(albums as any[]).map(album => (
                <div key={album.id} className="cursor-pointer group" onClick={() => { setSelectedAlbum(album); setView('tracks') }}>
                  <div className="rounded-xl overflow-hidden mb-2 relative" style={{ aspectRatio: '1/1', background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                    {album.imageUrl
                      ? <img src={album.imageUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      : <div className="w-full h-full flex items-center justify-center"><Music size={32} style={{ color: 'var(--muted)' }} /></div>
                    }
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <Play size={28} color="white" fill="white" />
                    </div>
                  </div>
                  <p className="text-[11px] font-bold truncate" style={{ color: 'rgba(240,232,213,0.75)' }}>{album.title}</p>
                  <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{album.artist}</p>
                </div>
              ))}
            </div>
      }
    </div>
  )
}
