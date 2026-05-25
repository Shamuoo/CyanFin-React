import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Music,
         Repeat, Shuffle, Volume2, Mic, List, PlusSquare } from 'lucide-react'
import api from '@/lib/api'
import { playQueue, useAudioBar } from '@/components/player/AudioBar'
import { useStore } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

function fmtTime(ticks?: number) {
  if (!ticks) return '0:00'
  const s = Math.floor(ticks / 10_000_000)
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
}

function AudioVisualiser({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current)
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    // Find the audio element on the page
    const audio = document.querySelector('audio') as HTMLAudioElement
    if (!audio) return
    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaElementSource(audio)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser); analyser.connect(audioCtx.destination)
      analyserRef.current = analyser

      const draw = () => {
        animRef.current = requestAnimationFrame(draw)
        const canvas = canvasRef.current; if (!canvas) return
        const ctx = canvas.getContext('2d'); if (!ctx) return
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const barW = canvas.width / data.length
        data.forEach((v, i) => {
          const h = (v / 255) * canvas.height
          const alpha = 0.4 + (v / 255) * 0.6
          ctx.fillStyle = `rgba(201,168,76,${alpha})`
          ctx.fillRect(i * barW, canvas.height - h, barW - 1, h)
        })
      }
      draw()
    } catch {} // AudioContext may already exist
    return () => cancelAnimationFrame(animRef.current)
  }, [playing])

  return <canvas ref={canvasRef} width={280} height={40}
    style={{ opacity: playing ? 0.6 : 0, transition: 'opacity 0.5s' }} />
}

function LyricsPanel({ trackId, positionTicks }: { trackId: string; positionTicks?: number }) {
  const { data } = useQuery({
    queryKey: ['lyrics', trackId],
    queryFn: () => api.lyrics(trackId),
    staleTime: Infinity,
  })

  const lines: { Start: number; Text: string }[] = (data as any)?.Lyrics || []
  const currentMs = (positionTicks || 0) / 10_000

  const activeLine = lines.reduce((acc, l, i) => {
    return l.Start <= currentMs * 10_000 ? i : acc
  }, 0)

  if (!lines.length) return (
    <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted)', opacity: 0.3 }}>
      <p className="text-xs">No lyrics available</p>
    </div>
  )

  return (
    <div className="overflow-y-auto h-48 scrollbar-hide px-2 space-y-2">
      {lines.map((l, i) => (
        <p key={i} className="text-sm text-center transition-all duration-300"
          style={{ color: i === activeLine ? 'var(--cream)' : 'var(--muted)', opacity: i === activeLine ? 1 : 0.4, fontWeight: i === activeLine ? 700 : 400, transform: i === activeLine ? 'scale(1.05)' : 'scale(1)' }}>
          {l.Text}
        </p>
      ))}
    </div>
  )
}

export default function MusicPage() {
  const [view, setView] = useState<'albums'|'tracks'|'playlists'|'nowplaying'>('albums')
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null)
  const [repeat, setRepeat] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const audioBar = useAudioBar()
  const { setDetailItemId } = useStore()
  const qc = useQueryClient()

  const { data: albums = [], isLoading } = useQuery({ queryKey: ['albums'], queryFn: () => api.albums() as Promise<any[]> })
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => api.playlists() })

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

  // ── Now Playing ─────────────────────────────────────────────────────────────
  if (view === 'nowplaying' && audioBar?.currentTrack) {
    const track = audioBar.currentTrack
    return (
      <div className="h-full flex flex-col items-center justify-between overflow-hidden"
        style={{ background: 'var(--bg)', padding: '24px 32px 32px' }}>
        <div className="w-full flex items-center justify-between">
          <button onClick={() => setView(selectedAlbum ? 'tracks' : 'albums')}
            className="flex items-center gap-1.5 hover:opacity-70" style={{ color: 'var(--muted)' }}>
            <ChevronDown size={18} /> <span className="text-xs">Library</span>
          </button>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--muted)', opacity: 0.4 }}>Now Playing</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowLyrics(s => !s)}
              className="hover:opacity-70" title="Lyrics"
              style={{ color: showLyrics ? 'var(--accent)' : 'var(--muted)' }}>
              <Mic size={16} />
            </button>
            <button onClick={async () => {
              const name = prompt('Add to playlist:')
              if (!name) return
              await api.createPlaylist(name, [track.id]).catch(() => {})
              qc.invalidateQueries({ queryKey: ['playlists'] })
              toast.success(`Added to "${name}"`)
            }} className="hover:opacity-70" style={{ color: 'var(--muted)' }}>
              <PlusSquare size={16} />
            </button>
          </div>
        </div>

        {showLyrics ? (
          <div className="flex-1 w-full flex items-center justify-center py-4">
            <LyricsPanel trackId={track.id} positionTicks={audioBar.positionTicks} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="relative mb-2">
              {track.imageUrl
                ? <img src={track.imageUrl} alt={track.album || ''} className="rounded-2xl object-cover"
                    style={{ width: 260, height: 260, maxWidth: '70vw', maxHeight: '70vw', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.08)' }} />
                : <div className="rounded-2xl flex items-center justify-center" style={{ width: 260, height: 260, background: 'var(--bg3)' }}>
                    <Music size={64} style={{ color: 'var(--muted)', opacity: 0.3 }} />
                  </div>
              }
            </div>
            <AudioVisualiser playing={audioBar.playing || false} />
          </div>
        )}

        <div className="w-full text-center mb-4">
          <p className="text-xl font-bold mb-1 truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.05em' }}>
            {track.title}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {[track.artist, track.album].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="w-full mb-4">
          <div className="relative h-1 rounded-full mb-2 cursor-pointer" style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); audioBar.seek?.((e.clientX - r.left) / r.width) }}>
            <div className="h-full rounded-full transition-none" style={{ width: `${audioBar.progress || 0}%`, background: 'var(--accent)' }} />
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: 'var(--muted)' }}>
            <span>{fmtTime(audioBar.positionTicks)}</span>
            <span>{fmtTime(track.duration)}</span>
          </div>
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setShuffle(s => !s)} style={{ color: shuffle ? 'var(--accent)' : 'var(--muted)', opacity: shuffle ? 1 : 0.4 }}><Shuffle size={18} /></button>
            <div className="flex items-center gap-8">
              <button onClick={() => audioBar.prev?.()} className="hover:opacity-70" style={{ color: 'var(--cream)' }}><SkipBack size={26} /></button>
              <button onClick={() => audioBar.togglePlay?.()}
                className="flex items-center justify-center rounded-full transition-all hover:scale-105"
                style={{ width: 64, height: 64, background: 'var(--accent)', color: 'var(--bg)' }}>
                {audioBar.playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />}
              </button>
              <button onClick={() => audioBar.next?.()} className="hover:opacity-70" style={{ color: 'var(--cream)' }}><SkipForward size={26} /></button>
            </div>
            <button onClick={() => setRepeat(r => !r)} style={{ color: repeat ? 'var(--accent)' : 'var(--muted)', opacity: repeat ? 1 : 0.4 }}><Repeat size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 size={14} style={{ color: 'var(--muted)', opacity: 0.4 }} />
            <input type="range" min="0" max="1" step="0.01" value={audioBar.volume ?? 1}
              onChange={e => audioBar.setVolume?.(parseFloat(e.target.value))}
              className="flex-1" style={{ accentColor: 'var(--accent)' }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Playlists ────────────────────────────────────────────────────────────────
  if (view === 'playlists') {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        <div className="sticky top-0 flex items-center gap-3 px-6 py-4 z-10"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
          <button onClick={() => setView('albums')} className="hover:opacity-70" style={{ color: 'var(--muted)' }}>← Albums</button>
          <p className="font-bold text-sm" style={{ color: 'var(--cream)' }}>Playlists</p>
        </div>
        <div className="px-6 py-4 space-y-2">
          {(playlists as any[]).map(pl => (
            <div key={pl.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}
              onClick={() => { setSelectedAlbum(pl); setView('tracks') }}>
              {pl.posterUrl ? <img src={pl.posterUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                : <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg3)' }}><List size={20} style={{ color: 'var(--muted)' }} /></div>}
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--cream)' }}>{pl.title}</p>
              </div>
            </div>
          ))}
          {(playlists as any[]).length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--muted)', opacity: 0.3 }}>No playlists yet</p>}
        </div>
      </div>
    )
  }

  // ── Track list ───────────────────────────────────────────────────────────────
  if (view === 'tracks' && selectedAlbum) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        <div className="sticky top-0 flex items-center gap-3 px-6 py-4 z-10"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
          <button onClick={() => setView('albums')} className="flex items-center gap-1.5 text-sm font-bold hover:opacity-70" style={{ color: 'var(--muted)' }}>
            ← Albums
          </button>
          {audioBar?.currentTrack && (
            <button onClick={() => setView('nowplaying')} className="ml-auto text-[10px] px-3 py-1.5 rounded-full font-bold"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--accent)' }}>
              ▶ Now Playing
            </button>
          )}
        </div>
        <div className="flex gap-6 p-6 pb-4">
          {selectedAlbum.imageUrl
            ? <img src={selectedAlbum.imageUrl} alt="" className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid var(--border2)' }} />
            : <div className="w-32 h-32 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg3)' }}>
                <Music size={32} style={{ color: 'var(--muted)' }} />
              </div>
          }
          <div className="flex flex-col justify-end min-w-0">
            <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>Album</p>
            <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.08em' }}>{selectedAlbum.title}</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{[selectedAlbum.artist, selectedAlbum.year].filter(Boolean).join(' · ')}</p>
            <div className="flex gap-2">
              <button onClick={() => playAlbum(0)}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold hover:opacity-85"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                <Play size={14} fill="currentColor" /> Play
              </button>
              <button onClick={async () => {
                const name = selectedAlbum.title || 'New Playlist'
                const t = tracks as any[]
                await api.createPlaylist(name, t.map(x => x.id))
                qc.invalidateQueries({ queryKey: ['playlists'] })
                toast.success(`Playlist "${name}" created`)
              }} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm hover:opacity-80"
                style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                <PlusSquare size={13} /> Save
              </button>
            </div>
          </div>
        </div>
        {loadingTracks
          ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
          : <div className="px-6 space-y-1">
              {(tracks as any[]).map((track, idx) => (
                <div key={track.id} className="flex items-center gap-4 px-3 py-2.5 rounded-lg cursor-pointer group hover:bg-white/5"
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

  // ── Album grid ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
      <div style={{ padding: '24px var(--pad) 12px' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Music</h1>
          <div className="flex items-center gap-2">
            {audioBar?.currentTrack && (
              <button onClick={() => setView('nowplaying')}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
                ▶ {audioBar.currentTrack.title}
              </button>
            )}
            <button onClick={() => setView('playlists')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold hover:opacity-80"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
              <List size={12} /> Playlists
            </button>
          </div>
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
