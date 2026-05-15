import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, ChevronLeft, Music } from 'lucide-react'
import api from '@/lib/api'
import { playQueue } from '@/components/player/AudioBar'

type View = 'albums' | 'tracks'

export default function MusicPage() {
  const [view, setView] = useState<View>('albums')
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null)

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
    if (queue.length) playQueue(queue, startIdx)
  }

  if (view === 'tracks' && selectedAlbum) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
          <button onClick={() => setView('albums')}
            className="flex items-center gap-1.5 text-sm font-bold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--muted)' }}>
            <ChevronLeft size={16} /> Albums
          </button>
        </div>

        {/* Album header */}
        <div className="flex gap-6 p-6 pb-4">
          {selectedAlbum.imageUrl
            ? <img src={selectedAlbum.imageUrl} alt="" className="w-36 h-36 rounded-xl object-cover flex-shrink-0"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid var(--border2)' }} />
            : <div className="w-36 h-36 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                <Music size={40} style={{ color: 'var(--muted)' }} />
              </div>
          }
          <div className="flex flex-col justify-end min-w-0">
            <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>Album</p>
            <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.08em' }}>
              {selectedAlbum.title}
            </h1>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              {[selectedAlbum.artist, selectedAlbum.year].filter(Boolean).join(' · ')}
            </p>
            <button onClick={() => playAlbum(0)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide self-start transition-all hover:opacity-85"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              <Play size={14} fill="currentColor" /> Play All
            </button>
          </div>
        </div>

        {/* Track list */}
        {loadingTracks
          ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
          : <div className="px-6 space-y-1">
              {(tracks as any[]).map((track, idx) => (
                <div key={track.id}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg cursor-pointer group transition-all hover:bg-white/5"
                  onClick={() => playAlbum(idx)}>
                  <span className="w-6 text-right text-sm flex-shrink-0" style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {track.trackNumber || idx + 1}
                  </span>
                  <p className="flex-1 text-sm truncate" style={{ color: 'rgba(240,232,213,0.75)' }}>{track.title}</p>
                  <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted)' }}>
                    {track.duration ? `${Math.floor(track.duration/600_000_000)}:${String(Math.floor((track.duration%600_000_000)/10_000_000)).padStart(2,'0')}` : ''}
                  </span>
                  <Play size={14} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: 'var(--accent)' }} />
                </div>
              ))}
            </div>
        }
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
      <div style={{ padding: '24px var(--pad) 12px' }}>
        <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Music</h1>
      </div>
      {isLoading
        ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
        : (albums as any[]).length === 0
          ? <div className="text-center py-20" style={{ color: 'var(--muted)' }}>No music found in your library</div>
          : <div className="grid gap-4 pb-12" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', padding: '0 var(--pad) 48px' }}>
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
