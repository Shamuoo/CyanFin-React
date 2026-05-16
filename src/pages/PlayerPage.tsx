import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, ArrowLeft, PictureInPicture2, Subtitles, SkipForward, List, Users } from 'lucide-react'
import api from '@/lib/api'
import WatchParty from '@/components/ui/WatchParty'
import type { MediaItem } from '@/types'

function fmtTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}

type Chapter = { name: string; startPositionTicks: number }
type SubStream = { index: number; title: string; language?: string; isDefault?: boolean }
type Panel = 'none' | 'subtitles' | 'chapters'

export default function PlayerPage() {
  const { playingItem, setPlayingItem } = useStore()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Playback state
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

  // Skip intro
  const [segments, setSegments] = useState<{type:string;start:number;end:number}[]>([])
  const [showSkip, setShowSkip] = useState(false)
  const [skipLabel, setSkipLabel] = useState('')

  // Chapters
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)

  // Subtitles
  const [subtitleStreams, setSubtitleStreams] = useState<SubStream[]>([])
  const [activeSubIndex, setActiveSubIndex] = useState<number>(-1) // -1 = off

  // Next episode
  const [nextEpisode, setNextEpisode] = useState<MediaItem | null>(null)
  const [showNextCard, setShowNextCard] = useState(false)
  const nextCardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Panel state
  const [openPanel, setOpenPanel] = useState<Panel>('none')
  const [watchPartyOpen, setWatchPartyOpen] = useState(false)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    clearTimeout(hideTimer.current)
    if (videoRef.current && !videoRef.current.paused)
      hideTimer.current = setTimeout(() => { setControlsVisible(false); setOpenPanel('none') }, 4000)
  }, [])

  // ── Video loading ──
  const loadVideo = useCallback((streamUrl: string, hlsUrl: string | null | undefined, startTime: number) => {
    const video = videoRef.current
    if (!video) return
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    video.pause(); video.removeAttribute('src'); video.load()
    setError(''); setBuffering(true); setShowNextCard(false)

    const tryHLS = (url: string) => {
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30, startFragPrefetch: true, debug: false })
        hls.loadSource(url); hls.attachMedia(video)
        hls.once(Hls.Events.MANIFEST_PARSED, () => {
          if (startTime > 0) video.currentTime = startTime
          video.play().then(() => { setPlayMethod('HLS'); setBuffering(false) }).catch(() => { setBuffering(false) })
        })
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) { hls.destroy(); hlsRef.current = null; setError('HLS failed.'); setBuffering(false) }
        })
        hlsRef.current = hls
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url
        if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime }, { once: true })
        video.play().catch(() => {}); setPlayMethod('Native HLS')
      }
    }

    video.src = streamUrl
    if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime }, { once: true })
    video.addEventListener('error', function onErr() {
      video.removeEventListener('error', onErr)
      if (hlsUrl) { video.removeAttribute('src'); video.load(); tryHLS(hlsUrl) }
      else { setError(`Cannot play. Error: ${video.error?.message || 'Unknown'}`); setBuffering(false) }
    }, { once: true })
    video.play()
      .then(() => { setPlayMethod('Direct'); setBuffering(false) })
      .catch(err => {
        if (err.name === 'NotSupportedError') { if (hlsUrl) tryHLS(hlsUrl); else { setError('Format not supported'); setBuffering(false) } }
        else { setBuffering(false); setPlayMethod('Direct') }
      })
  }, [])

  // ── Load item metadata (segments, chapters, subtitles, next ep) ──
  useEffect(() => {
    if (!playingItem?.id) return

    // Intro skipper
    fetch(`/api/intro-skip?id=${playingItem.id}`)
      .then(r => r.json())
      .then(d => { if (d.hasIntro) setSegments([{ type: 'Intro', start: d.introStart, end: d.introEnd }]) })
      .catch(() => {})

    // Item detail for chapters + subtitle streams
    api.item(playingItem.id).then(item => {
      if (item.chapters?.length) setChapters(item.chapters)
    }).catch(() => {})

    // Playback info for subtitle streams
    api.playbackInfo(playingItem.id).then(info => {
      const subs = info.mediaSources?.[0]?.subtitleStreams || []
      setSubtitleStreams(subs)
      const defSub = subs.find(s => s.isDefault)
      setActiveSubIndex(defSub?.index ?? -1)
    }).catch(() => {})

    // Next episode
    const p = playingItem as any
    if (p.seriesId && p.indexNumber !== undefined && p.parentIndexNumber !== undefined) {
      api.nextEpisode(p.seriesId, p.seasonId || '', p.indexNumber, p.parentIndexNumber)
        .then(r => { if (r.hasNext && r.episode) setNextEpisode(r.episode) })
        .catch(() => {})
    }
  }, [playingItem?.id])

  // ── Load video ──
  useEffect(() => {
    if (!playingItem) return
    loadVideo(playingItem.streamUrl, (playingItem as any).hlsUrl, playingItem.startTime || 0)
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [playingItem?.streamUrl, loadVideo])

  // ── Video events ──
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
    on('ended', (() => {
      if (nextEpisode) {
        // Show next episode card and auto-play after 8s
        setShowNextCard(true)
        nextCardTimer.current = setTimeout(() => playNextEpisode(), 8000)
      } else {
        setPlayingItem(null); navigate('/')
      }
    }) as EventListener)
  }, [nextEpisode]) // eslint-disable-line

  // ── Skip intro ──
  useEffect(() => {
    if (!segments.length) return
    const ticks = currentTime * 10_000_000
    const seg = segments.find(s => ticks >= s.start && ticks < s.end)
    if (seg) { setShowSkip(true); setSkipLabel(seg.type === 'Intro' ? 'Skip Intro' : 'Skip Credits') }
    else setShowSkip(false)
  }, [currentTime, segments])

  // ── Active chapter ──
  useEffect(() => {
    if (!chapters.length) return
    const ticks = currentTime * 10_000_000
    const ch = [...chapters].reverse().find(c => ticks >= c.startPositionTicks)
    setActiveChapter(ch || null)
  }, [currentTime, chapters])

  // ── Show next episode card 2 mins before end ──
  useEffect(() => {
    if (!nextEpisode || !duration || duration < 120) return
    if (duration - currentTime < 120 && !showNextCard) setShowNextCard(true)
  }, [currentTime, duration, nextEpisode, showNextCard])

  // ── Subtitles — apply to video element ──
  useEffect(() => {
    const video = videoRef.current; if (!video) return
    // Remove existing tracks
    while (video.textTracks.length > 0) {
      // Can't remove directly, just disable all
    }
    Array.from(video.textTracks).forEach(t => { t.mode = 'disabled' })
    if (activeSubIndex >= 0) {
      // For external subtitle streams, Jellyfin serves them as VTT via proxy
      const existing = Array.from(video.textTracks).find(t => t.id === String(activeSubIndex))
      if (existing) { existing.mode = 'showing'; return }
      // Add subtitle track
      if (playingItem) {
        const track = document.createElement('track')
        track.kind = 'subtitles'
        track.id = String(activeSubIndex)
        track.default = true
        track.src = `/proxy/subtitle?id=${playingItem.id}&index=${activeSubIndex}`
        video.appendChild(track)
        setTimeout(() => {
          const t = Array.from(video.textTracks).find(t => t.id === String(activeSubIndex))
          if (t) t.mode = 'showing'
        }, 200)
      }
    }
  }, [activeSubIndex, playingItem?.id])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current; if (!v) return
      switch(e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); showControls(); break
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); showControls(); break
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration||0, v.currentTime + 10); showControls(); break
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break
        case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen(); break
        case 'm': case 'M': v.muted = !v.muted; setMuted(v.muted); break
        case 'c': case 'C': setOpenPanel(p => p === 'subtitles' ? 'none' : 'subtitles'); showControls(); break
        case 'Escape': if (openPanel !== 'none') { setOpenPanel('none') } else if (!document.fullscreenElement) { setPlayingItem(null); navigate('/') }; break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, setPlayingItem, openPanel, showControls])


  // ── Jellyfin playback session reporting ──
  const reportingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    if (!playingItem?.id) return
    const itemId = playingItem.id
    const mediaSourceId = (playingItem as any).mediaSourceId

    // Report start
    fetch('/api/playback/start', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, mediaSourceId, positionTicks: Math.round((playingItem.startTime || 0) * 10_000_000) }),
    }).catch(() => {})

    // Report progress every 10s
    reportingRef.current = setInterval(() => {
      const video = videoRef.current
      if (!video) return
      fetch('/api/playback/progress', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId, mediaSourceId,
          positionTicks: Math.round(video.currentTime * 10_000_000),
          isPaused: video.paused,
          isMuted: video.muted,
          volumeLevel: Math.round(video.volume * 100),
        }),
      }).catch(() => {})
    }, 10_000)

    // Report stop on unmount
    return () => {
      clearInterval(reportingRef.current)
      const video = videoRef.current
      fetch('/api/playback/stop', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId, mediaSourceId,
          positionTicks: Math.round((video?.currentTime || 0) * 10_000_000),
        }),
      }).catch(() => {})
    }
  }, [playingItem?.id])

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const playNextEpisode = useCallback(async () => {
    if (!nextEpisode) return
    clearTimeout(nextCardTimer.current)
    setShowNextCard(false)
    try {
      const info = await api.playbackInfo(nextEpisode.id)
      setPlayingItem({
        id: nextEpisode.id, title: nextEpisode.title,
        streamUrl: info.streamUrl, hlsUrl: info.hlsUrl,
        startTime: 0,
        seriesId: (nextEpisode as any).seriesId,
        seasonId: (nextEpisode as any).seasonId,
        indexNumber: nextEpisode.indexNumber,
        parentIndexNumber: nextEpisode.parentIndexNumber,
      } as any)
    } catch(e) { console.error(e) }
  }, [nextEpisode, setPlayingItem])

  if (!playingItem) { navigate('/'); return null }

  const pct = duration ? (currentTime / duration) * 100 : 0
  const iconBtn = "text-white/60 hover:text-white transition-colors p-1.5"

  return (
    <div ref={containerRef}
      className={`fixed inset-0 bg-black z-50 select-none ${controlsVisible ? 'cursor-default' : 'cursor-none'}`}
      onMouseMove={showControls} onClick={() => { showControls(); if (openPanel !== 'none') setOpenPanel('none') }}>

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
          <div className="text-center p-8 rounded-xl max-w-lg" style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(231,76,60,0.3)' }}>
            <p className="text-sm mb-4" style={{ color: '#e74c3c' }}>{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => loadVideo(playingItem.streamUrl, (playingItem as any).hlsUrl, currentTime)}
                className="px-4 py-2 rounded-full text-xs font-bold uppercase" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Retry</button>
              <button onClick={() => { setPlayingItem(null); navigate('/') }}
                className="px-4 py-2 rounded-full text-xs font-bold uppercase" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Play method */}
      {playMethod && controlsVisible && !openPanel && (
        <div className="absolute top-4 right-4 text-[9px] px-2 py-0.5 rounded pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.4)' }}>{playMethod}</div>
      )}

      {/* Skip intro */}
      <AnimatePresence>
        {showSkip && controlsVisible && (
          <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            onClick={e => {
              e.stopPropagation()
              const ticks = currentTime * 10_000_000
              const seg = segments.find(s => ticks >= s.start && ticks < s.end)
              if (seg && videoRef.current) videoRef.current.currentTime = seg.end / 10_000_000
            }}
            className="absolute bottom-28 right-8 px-5 py-2.5 rounded-full text-sm font-bold tracking-wide uppercase"
            style={{ background: 'rgba(0,0,0,0.85)', color: 'white', border: '2px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}>
            {skipLabel} →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Next episode card */}
      <AnimatePresence>
        {showNextCard && nextEpisode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 right-8 flex flex-col gap-2 p-4 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', width: 280 }}
            onClick={e => e.stopPropagation()}>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--accent)', opacity: 0.6 }}>Up Next</p>
            <div className="flex gap-3 items-center">
              {nextEpisode.thumbUrl && <img src={nextEpisode.thumbUrl} alt="" className="w-20 h-12 object-cover rounded flex-shrink-0" style={{ background: 'var(--bg3)' }} />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  S{String(nextEpisode.parentIndexNumber||0).padStart(2,'0')}E{String(nextEpisode.indexNumber||0).padStart(2,'0')}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{nextEpisode.title}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={playNextEpisode}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                <SkipForward size={12} /> Play Now
              </button>
              <button onClick={() => { clearTimeout(nextCardTimer.current); setShowNextCard(false) }}
                className="px-3 py-2 rounded-full text-[10px] font-bold uppercase"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtitle panel */}
      <AnimatePresence>
        {openPanel === 'subtitles' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 bottom-20 rounded-xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', width: 220, maxHeight: 320 }}
            onClick={e => e.stopPropagation()}>
            <p className="text-[8px] font-bold tracking-widest uppercase px-4 pt-3 pb-2" style={{ color: 'var(--accent)', opacity: 0.5 }}>Subtitles</p>
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              {/* Off option */}
              <button onClick={() => setActiveSubIndex(-1)}
                className="w-full text-left px-4 py-2.5 text-[11px] transition-all hover:bg-white/5"
                style={{ color: activeSubIndex === -1 ? 'var(--accent)' : 'rgba(255,255,255,0.6)', background: activeSubIndex === -1 ? 'rgba(201,168,76,0.08)' : 'transparent' }}>
                {activeSubIndex === -1 ? '✓ ' : ''}Off
              </button>
              {subtitleStreams.map(sub => (
                <button key={sub.index} onClick={() => setActiveSubIndex(sub.index)}
                  className="w-full text-left px-4 py-2.5 text-[11px] transition-all hover:bg-white/5"
                  style={{ color: activeSubIndex === sub.index ? 'var(--accent)' : 'rgba(255,255,255,0.6)', background: activeSubIndex === sub.index ? 'rgba(201,168,76,0.08)' : 'transparent' }}>
                  {activeSubIndex === sub.index ? '✓ ' : ''}{sub.title}
                </button>
              ))}
              {subtitleStreams.length === 0 && (
                <p className="px-4 py-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>No subtitles available</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chapter panel */}
      <AnimatePresence>
        {openPanel === 'chapters' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 bottom-20 rounded-xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', width: 240, maxHeight: 360 }}
            onClick={e => e.stopPropagation()}>
            <p className="text-[8px] font-bold tracking-widest uppercase px-4 pt-3 pb-2" style={{ color: 'var(--accent)', opacity: 0.5 }}>Chapters</p>
            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 300 }}>
              {chapters.map((ch, i) => {
                const isActive = activeChapter?.startPositionTicks === ch.startPositionTicks
                return (
                  <button key={i} onClick={() => { if (videoRef.current) videoRef.current.currentTime = ch.startPositionTicks / 10_000_000; setOpenPanel('none') }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all hover:bg-white/5"
                    style={{ background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent' }}>
                    <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--muted)', width: 36 }}>
                      {fmtTime(ch.startPositionTicks / 10_000_000)}
                    </span>
                    <span className="text-[11px] truncate" style={{ color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.65)' }}>
                      {isActive ? '▶ ' : ''}{ch.name || `Chapter ${i + 1}`}
                    </span>
                  </button>
                )
              })}
              {chapters.length === 0 && (
                <p className="px-4 py-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>No chapters available</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)', padding: '48px 32px 20px' }}>

        {/* Chapter name + progress */}
        {activeChapter && (
          <p className="text-[9px] tracking-[0.2em] uppercase mb-2 opacity-60" style={{ color: 'var(--accent)' }}>
            {activeChapter.name}
          </p>
        )}

        {/* Progress bar with chapter markers */}
        <div className="mb-4 relative group cursor-pointer py-1"
          onClick={e => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            const p = (e.clientX - rect.left) / rect.width
            if (videoRef.current?.duration) videoRef.current.currentTime = p * videoRef.current.duration
          }}>
          <div className="h-1 group-hover:h-1.5 transition-all rounded-full relative" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full rounded-full transition-none" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
            {/* Chapter markers */}
            {chapters.map((ch, i) => duration > 0 && (
              <div key={i} className="absolute top-0 h-full w-0.5 opacity-40"
                style={{ left: `${(ch.startPositionTicks / 10_000_000 / duration) * 100}%`, background: 'rgba(255,255,255,0.8)' }} />
            ))}
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); setPlayingItem(null); navigate('/') }} className={iconBtn}><ArrowLeft size={20} /></button>

          <button onClick={e => { e.stopPropagation(); videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause() }}
            className="text-white hover:text-white/80 p-1">
            {playing ? <Pause size={22} /> : <Play size={22} fill="white" />}
          </button>

          {nextEpisode && (
            <button onClick={e => { e.stopPropagation(); playNextEpisode() }} className={iconBtn} title="Next episode">
              <SkipForward size={18} />
            </button>
          )}

          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          <p className="flex-1 text-sm font-bold tracking-wide truncate mx-2"
            style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.2em' }}>
            {playingItem.title}
          </p>

          {/* Volume */}
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setMuted(videoRef.current.muted) } }} className={iconBtn}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; setMuted(v === 0) } }}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
          </div>

          {/* Subtitles button (C key) */}
          <button onClick={e => { e.stopPropagation(); setOpenPanel(p => p === 'subtitles' ? 'none' : 'subtitles') }}
            className={`${iconBtn} ${openPanel === 'subtitles' ? 'text-[--accent]' : ''}`}
            title="Subtitles (C)">
            <Subtitles size={16} />
          </button>

          {/* Chapters button */}
          {chapters.length > 0 && (
            <button onClick={e => { e.stopPropagation(); setOpenPanel(p => p === 'chapters' ? 'none' : 'chapters') }}
              className={`${iconBtn} ${openPanel === 'chapters' ? 'text-[--accent]' : ''}`}
              title="Chapters">
              <List size={16} />
            </button>
          )}

          <button onClick={e => { e.stopPropagation(); setWatchPartyOpen(true) }}
            className={iconBtn} title="Watch Party">
            <Users size={16} />
          </button>

          <button onClick={e => { e.stopPropagation(); try { document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture() } catch {} }} className={iconBtn}>
            <PictureInPicture2 size={16} />
          </button>

          <button onClick={e => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen() }} className={iconBtn}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
      {watchPartyOpen && (
        <WatchParty
          onClose={() => setWatchPartyOpen(false)}
          itemId={playingItem?.id}
          itemTitle={playingItem?.title}
          currentTime={currentTime}
          isPaused={!playing}
          onSeek={t => { if (videoRef.current) videoRef.current.currentTime = t }}
          onPause={p => { if (p) videoRef.current?.pause(); else videoRef.current?.play() }}
        />
      )}
    </div>
  )
}
