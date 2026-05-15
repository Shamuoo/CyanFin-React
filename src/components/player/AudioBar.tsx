import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Track {
  id: string
  title: string
  artist?: string
  album?: string
  streamUrl: string
  duration?: number
  imageUrl?: string
}

// Global audio state - module level so it persists
let globalQueue: Track[] = []
let globalIdx = 0
let globalAudio: HTMLAudioElement | null = null
const listeners: Set<() => void> = new Set()
const notify = () => listeners.forEach(fn => fn())

export function playQueue(tracks: Track[], startIdx = 0) {
  globalQueue = tracks
  globalIdx = startIdx
  if (!globalAudio) globalAudio = new Audio()
  globalAudio.src = tracks[startIdx]?.streamUrl || ''
  globalAudio.play().catch(() => {})
  notify()
}

export function useAudioPlayer() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return { queue: globalQueue, idx: globalIdx, audio: globalAudio }
}

function fmtTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
}

export default function AudioBar() {
  const [visible, setVisible] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [, forceUpdate] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const fn = () => {
      audioRef.current = globalAudio
      setVisible(globalQueue.length > 0)
      forceUpdate(n => n + 1)
    }
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const handlers = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setCurrentTime(audio.currentTime),
      durationchange: () => setDuration(audio.duration),
      ended: () => {
        if (repeat) { audio.currentTime = 0; audio.play(); return }
        const next = shuffle
          ? Math.floor(Math.random() * globalQueue.length)
          : (globalIdx + 1) % globalQueue.length
        if (next !== globalIdx || repeat) {
          globalIdx = next
          audio.src = globalQueue[next]?.streamUrl || ''
          audio.play().catch(() => {})
          notify()
        } else setPlaying(false)
      }
    }
    Object.entries(handlers).forEach(([ev, fn]) => audio.addEventListener(ev, fn as EventListener))
    return () => Object.entries(handlers).forEach(([ev, fn]) => audio.removeEventListener(ev, fn as EventListener))
  }, [audioRef.current, shuffle, repeat])

  const track = globalQueue[globalIdx]
  const pct = duration ? (currentTime / duration) * 100 : 0

  const skip = (dir: 1 | -1) => {
    if (!globalAudio || !globalQueue.length) return
    const next = shuffle
      ? Math.floor(Math.random() * globalQueue.length)
      : (globalIdx + globalQueue.length + dir) % globalQueue.length
    globalIdx = next
    globalAudio.src = globalQueue[next]?.streamUrl || ''
    globalAudio.play().catch(() => {})
    notify()
  }

  const togglePlay = () => {
    if (!globalAudio) return
    globalAudio.paused ? globalAudio.play() : globalAudio.pause()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!globalAudio?.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    globalAudio.currentTime = ((e.clientX - rect.left) / rect.width) * globalAudio.duration
  }

  const iconBtn = "w-7 h-7 flex items-center justify-center rounded-full transition-all hover:bg-white/10 flex-shrink-0"

  return (
    <AnimatePresence>
      {visible && track && (
        <motion.div
          initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-4 px-6 py-3"
          style={{ background: 'rgba(10,8,4,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border2)', height: 68 }}>

          {/* Track info */}
          <div className="flex items-center gap-3 w-48 flex-shrink-0 min-w-0">
            {track.imageUrl && (
              <img src={track.imageUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0"
                style={{ border: '1px solid var(--border2)' }} />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold truncate" style={{ color: 'rgba(240,232,213,0.8)' }}>{track.title}</p>
              <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{track.artist || track.album || ''}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <button className={`${iconBtn} ${shuffle ? 'text-[--accent]' : ''}`} style={{ color: shuffle ? 'var(--accent)' : 'var(--muted)' }}
                onClick={() => setShuffle(s => !s)}><Shuffle size={13} /></button>
              <button className={iconBtn} style={{ color: 'var(--muted)' }} onClick={() => skip(-1)}><SkipBack size={16} /></button>
              <button onClick={togglePlay}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              </button>
              <button className={iconBtn} style={{ color: 'var(--muted)' }} onClick={() => skip(1)}><SkipForward size={16} /></button>
              <button className={iconBtn} style={{ color: repeat ? 'var(--accent)' : 'var(--muted)' }}
                onClick={() => setRepeat(r => !r)}><Repeat size={13} /></button>
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-[8px] font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>{fmtTime(currentTime)}</span>
              <div className="flex-1 h-1 rounded-full cursor-pointer" style={{ background: 'var(--border2)' }} onClick={seek}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
              <span className="text-[8px] font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>{fmtTime(duration)}</span>
            </div>
          </div>

          {/* Volume + close */}
          <div className="flex items-center gap-2 w-36 justify-end flex-shrink-0">
            <button className={iconBtn} style={{ color: 'var(--muted)' }}
              onClick={() => { if (globalAudio) { globalAudio.muted = !globalAudio.muted; setMuted(m => !m) } }}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input type="range" min="0" max="1" step="0.05" defaultValue="1"
              onChange={e => { if (globalAudio) globalAudio.volume = parseFloat(e.target.value) }}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
            <button className={iconBtn} style={{ color: 'var(--muted)' }}
              onClick={() => { if (globalAudio) { globalAudio.pause(); globalAudio.src = '' } globalQueue = []; globalIdx = 0; setVisible(false); notify() }}>
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
