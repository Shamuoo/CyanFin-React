import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, ArrowLeft, PictureInPicture2 } from 'lucide-react'

function fmtTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
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
  const [error, setError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [segments, setSegments] = useState<{type:string;start:number;end:number}[]>([])
  const [showSkip, setShowSkip] = useState(false)
  const [skipLabel, setSkipLabel] = useState('')

  const showControls = () => {
    setControlsVisible(true)
    clearTimeout(hideTimer.current)
    if (videoRef.current && !videoRef.current.paused)
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3500)
  }

  const loadVideo = (streamUrl: string, hlsUrl: string | null | undefined, startTime: number) => {
    const video = videoRef.current
    if (!video) return

    // Cleanup previous
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    video.pause()
    video.removeAttribute('src')
    video.load()
    setError('')
    setBuffering(true)

    const tryDirect = () => {
      // Direct stream — let browser play natively
      video.src = streamUrl
      if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime }, { once: true })
      video.play()
        .then(() => { setPlayMethod('Direct'); setBuffering(false) })
        .catch(() => {
          // Autoplay blocked
          setBuffering(false)
          setPlayMethod('Direct (tap to play)')
        })
    }

    const tryHLS = (url: string) => {
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30, startFragPrefetch: true, debug: false })
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.once(Hls.Events.MANIFEST_PARSED, () => {
          if (startTime > 0) video.currentTime = startTime
          video.play()
            .then(() => { setPlayMethod('HLS'); setBuffering(false) })
            .catch(() => { setBuffering(false) })
        })
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            hls.destroy()
            hlsRef.current = null
            setError('HLS stream failed. Try direct play.')
            setBuffering(false)
          }
        })
        hlsRef.current = hls
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url
        if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime }, { once: true })
        video.play().catch(() => {})
        setPlayMethod('Native HLS')
      } else {
        setError('This browser cannot play HLS streams.')
        setBuffering(false)
      }
    }

    // Strategy: try direct first, use HLS only if direct fails
    // Direct stream works if the browser supports the container/codec
    // Most modern browsers support H264+AAC in MP4/MKV natively
    video.src = streamUrl
    if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime }, { once: true })

    video.addEventListener('error', function onError() {
      video.removeEventListener('error', onError)
      // Direct failed — try HLS transcode if available
      if (hlsUrl) {
        console.log('[Player] Direct failed, trying HLS transcode')
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
        video.removeAttribute('src')
        video.load()
        tryHLS(hlsUrl)
      } else {
        setError(`Cannot play this file. Error: ${video.error?.message || 'Unknown'}`)
        setBuffering(false)
      }
    }, { once: true })

    video.play()
      .then(() => { setPlayMethod('Direct'); setBuffering(false) })
      .catch(err => {
        if (err.name === 'NotSupportedError') {
          // Container not supported, try HLS
          if (hlsUrl) { tryHLS(hlsUrl) }
          else { setError('Format not supported by browser'); setBuffering(false) }
        } else {
          // Autoplay blocked
          setBuffering(false)
          setPlayMethod('Direct')
        }
      })
  }

  // Fetch skip segments (intro/credits)
  useEffect(() => {
    if (!playingItem?.id) return
fetch(`/api/intro-skip?id=${playingItem.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.hasIntro && d.introStart !== undefined && d.introEnd !== undefined) {
          setSegments([{ type: 'Intro', start: d.introStart, end: d.introEnd }])
        }
      })
      .catch(() => {})
  }, [playingItem?.id])

  // Check if current time is in a skippable segment
  useEffect(() => {
    if (!segments.length) return
    const ticks = currentTime * 10_000_000
    const seg = segments.find(s => ticks >= s.start && ticks < s.end)
    if (seg) {
      setShowSkip(true)
      setSkipLabel(seg.type === 'Intro' ? 'Skip Intro' : seg.type === 'Credits' ? 'Skip Credits' : 'Skip')
    } else {
      setShowSkip(false)
    }
  }, [currentTime, segments])

  useEffect(() => {
    if (!playingItem) return
    loadVideo(
      playingItem.streamUrl,
      (playingItem as any).hlsUrl,
      playingItem.startTime || 0
    )
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [playingItem?.streamUrl])

  useEffect(() => {
    const video = videoRef.current; if (!video) return
    const on = (ev: string, fn: EventListener) => video.addEventListener(ev, fn)
    on('play', (() => { setPlaying(true); showControls() }) as EventListener)
    on('pause', (() => { setPlaying(false); setControlsVisible(true); clearTimeout(hideTimer.current) }) as EventListener)
    on('waiting', (() => setBuffering(true)) as EventListener)
    on('canplay', (() => setBuffering(false)) as EventListener)
    on('playing', (() => { setPlaying(true); setBuffering(false) }) as EventListener)
    on('timeupdate', (() => setCurrentTime(video.currentTime)) as EventListener)
    on('durationchange', (() => setDuration(video.duration)) as EventListener)
    on('ended', (() => { setPlayingItem(null); navigate('/') }) as EventListener)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current; if (!v) return
      switch(e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); showControls(); break
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); showControls(); break
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showControls(); break
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break
        case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen(); break
        case 'm': case 'M': v.muted = !v.muted; setMuted(v.muted); break
        case 'Escape': if (!document.fullscreenElement) { setPlayingItem(null); navigate('/') }; break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, setPlayingItem])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (!playingItem) { navigate('/'); return null }

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div ref={containerRef}
      className={`fixed inset-0 bg-black z-50 select-none ${controlsVisible ? 'cursor-default' : 'cursor-none'}`}
      onMouseMove={showControls} onClick={showControls}>

      <video ref={videoRef} className="w-full h-full object-contain"
        onClick={e => { e.stopPropagation(); videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause() }}
        playsInline crossOrigin="anonymous" />

      {/* Buffering */}
      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-8 rounded-xl max-w-lg"
            style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(231,76,60,0.3)' }}>
            <div className="text-2xl mb-3">⚠️</div>
            <p className="text-sm mb-4" style={{ color: '#e74c3c' }}>{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => loadVideo(playingItem.streamUrl, (playingItem as any).hlsUrl, currentTime)}
                className="px-4 py-2 rounded-full text-xs font-bold uppercase"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Retry</button>
              <button onClick={() => { setPlayingItem(null); navigate('/') }}
                className="px-4 py-2 rounded-full text-xs font-bold uppercase"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Play method badge */}
      {playMethod && controlsVisible && (
        <div className="absolute top-4 right-16 text-[9px] px-2 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.5)' }}>
          {playMethod}
        </div>
      )}

      {/* Skip intro/credits button */}
      <AnimatePresence>
        {showSkip && controlsVisible && (
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            onClick={() => {
              const ticks = currentTime * 10_000_000
              const seg = segments.find(s => ticks >= s.start && ticks < s.end)
              if (seg && videoRef.current) videoRef.current.currentTime = seg.end / 10_000_000
            }}
            className="absolute bottom-24 right-8 px-5 py-2.5 rounded-full text-sm font-bold tracking-wide uppercase transition-all hover:opacity-80"
            style={{ background: 'rgba(0,0,0,0.8)', color: 'white', border: '2px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}>
            {skipLabel} →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)', padding: '48px 32px 24px' }}>

        {/* Progress bar */}
        <div className="mb-4 group cursor-pointer py-1"
          onClick={e => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            if (videoRef.current?.duration) videoRef.current.currentTime = pct * videoRef.current.duration
          }}>
          <div className="h-1 group-hover:h-1.5 transition-all rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full rounded-full transition-none" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); setPlayingItem(null); navigate('/') }}
            className="text-white/60 hover:text-white transition-colors p-1"><ArrowLeft size={20} /></button>

          <button onClick={(e) => { e.stopPropagation(); videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause() }}
            className="text-white hover:text-white/80 p-1">
            {playing ? <Pause size={22} /> : <Play size={22} fill="white" />}
          </button>

          <span className="text-xs font-mono ml-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          <p className="flex-1 text-sm font-bold tracking-wide truncate mx-2"
            style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em' }}>
            {playingItem.title}
          </p>

          {/* Volume */}
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setMuted(videoRef.current.muted) } }}
              className="text-white/60 hover:text-white transition-colors">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; setMuted(v === 0) } }}
              className="w-20 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }} />
          </div>

          <button onClick={(e) => { e.stopPropagation(); try { document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture() } catch(err) {} }}
            className="text-white/60 hover:text-white transition-colors p-1"><PictureInPicture2 size={16} /></button>

          <button onClick={(e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen() }}
            className="text-white/60 hover:text-white transition-colors p-1">
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
