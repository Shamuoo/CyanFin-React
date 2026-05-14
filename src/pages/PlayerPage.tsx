import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { useStore } from '@/lib/store'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, ArrowLeft, PictureInPicture2 } from 'lucide-react'

function fmtTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60)
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}

export default function PlayerPage() {
  const { playingItem, setPlayingItem } = useStore()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [playMethod, setPlayMethod] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const showControls = () => {
    setControlsVisible(true)
    clearTimeout(hideTimer.current)
    if (videoRef.current && !videoRef.current.paused)
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3500)
  }

  useEffect(() => {
    if (!playingItem || !videoRef.current) return
    const video = videoRef.current
    const url = playingItem.streamUrl

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, startFragPrefetch: true })
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.once(Hls.Events.MANIFEST_PARSED, () => {
        if (playingItem.startTime) video.currentTime = playingItem.startTime
        video.play().catch(() => setBuffering(false))
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) { hls.destroy(); video.src = url; video.play().catch(() => {}) }
      })
      hlsRef.current = hls
      setPlayMethod('HLS')
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      if (playingItem.startTime) video.addEventListener('loadedmetadata', () => { video.currentTime = playingItem.startTime! }, { once: true })
      video.play().catch(() => {})
      setPlayMethod('Native HLS')
    } else {
      video.src = url
      video.play().catch(() => {})
      setPlayMethod('Direct')
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [playingItem])

  useEffect(() => {
    const video = videoRef.current; if (!video) return
    const handlers = {
      play: () => { setPlaying(true); showControls() },
      pause: () => { setPlaying(false); setControlsVisible(true); clearTimeout(hideTimer.current) },
      waiting: () => setBuffering(true),
      canplay: () => setBuffering(false),
      playing: () => setBuffering(false),
      timeupdate: () => setCurrentTime(video.currentTime),
      durationchange: () => setDuration(video.duration),
      ended: () => { setPlayingItem(null); navigate('/') },
    }
    Object.entries(handlers).forEach(([ev, fn]) => video.addEventListener(ev, fn as EventListener))
    return () => Object.entries(handlers).forEach(([ev, fn]) => video.removeEventListener(ev, fn as EventListener))
  }, [navigate, setPlayingItem])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current; if (!v) return
      switch(e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); showControls(); break
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); showControls(); break
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showControls(); break
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); showControls(); break
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); showControls(); break
        case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen(); break
        case 'm': case 'M': v.muted = !v.muted; setMuted(v.muted); break
        case 'Escape': if (!document.fullscreenElement) { setPlayingItem(null); navigate('/') }; break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, setPlayingItem])

  useEffect(() => {
    document.addEventListener('fullscreenchange', () => setFullscreen(!!document.fullscreenElement))
    return () => document.removeEventListener('fullscreenchange', () => {})
  }, [])

  if (!playingItem) { navigate('/'); return null }

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div ref={containerRef} className={`fixed inset-0 bg-black z-50 ${controlsVisible ? 'cursor-default' : 'cursor-none'}`}
      onMouseMove={showControls} onClick={showControls}>
      <video ref={videoRef} className="w-full h-full object-contain"
        onClick={e => { e.stopPropagation(); videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause() }} />

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      {/* Play method badge */}
      {playMethod && controlsVisible && (
        <div className="absolute top-4 right-16 text-[9px] px-2 py-0.5 rounded opacity-50" style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
          {playMethod}
        </div>
      )}

      {/* Controls overlay */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)', padding: '48px 32px 24px' }}>
        {/* Progress */}
        <div className="mb-3 group cursor-pointer" onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pct = (e.clientX - rect.left) / rect.width
          if (videoRef.current?.duration) videoRef.current.currentTime = pct * videoRef.current.duration
        }}>
          <div className="h-1 group-hover:h-1.5 transition-all rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setPlayingItem(null); navigate('/') }} className="text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <button onClick={() => { videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause() }} className="text-white hover:text-white/80">
            {playing ? <Pause size={22} /> : <Play size={22} fill="white" />}
          </button>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
          <p className="text-sm font-bold tracking-wide flex-1 truncate ml-2" style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.2em' }}>
            {playingItem.title}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setMuted(videoRef.current.muted) } }} className="text-white/70 hover:text-white">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input type="range" min="0" max="1" step="0.1" value={muted ? 0 : volume}
              onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) videoRef.current.volume = v; setMuted(v === 0) }}
              className="w-16 accent-[--accent]" />
          </div>
          <button onClick={() => { try { document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture() } catch(e) {} }}
            className="text-white/70 hover:text-white"><PictureInPicture2 size={18} /></button>
          <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen()}
            className="text-white/70 hover:text-white">
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
