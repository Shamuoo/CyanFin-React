import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import type { MediaItem } from '@/types'

const IDLE_TIMEOUT = 5 * 60 * 1000
const SLIDE_DURATION = 8000

export default function Screensaver() {
  const { user } = useStore()
  const [active, setActive] = useState(false)
  const [items, setItems] = useState<MediaItem[]>([])
  const [idx, setIdx] = useState(0)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    api.movies({ sort: 'CommunityRating', order: 'Descending', limit: 30 })
      .then(r => setItems((r.items || []).filter((i: MediaItem) => i.backdropUrl)))
      .catch(() => {})
  }, [user])

  const resetTimer = useCallback(() => {
    setActive(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setActive(true), IDLE_TIMEOUT)
  }, [])

  useEffect(() => {
    const events = ['mousemove','keydown','mousedown','touchstart','scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(idleTimer.current)
    }
  }, [resetTimer])

  useEffect(() => {
    if (!active || !items.length) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), SLIDE_DURATION)
    return () => clearInterval(t)
  }, [active, items.length])

  useEffect(() => {
    if (!active) return
    const dismiss = () => setActive(false)
    window.addEventListener('click', dismiss)
    window.addEventListener('keydown', dismiss)
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [active])

  const current = items[idx]

  return (
    <AnimatePresence>
      {active && current && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 z-[300]"
          style={{ background: '#000', cursor: 'none' }}>

          <AnimatePresence mode="wait">
            <motion.div key={idx}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${current.backdropUrl}')` }} />
          </AnimatePresence>

          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />

          <Clock />

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="absolute bottom-16 left-16">
            {current.logoUrl
              ? <img src={current.logoUrl} alt={current.title} className="max-h-20 max-w-xs object-contain mb-3"
                  style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,1))' }} />
              : <h2 className="text-4xl mb-2"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.1em', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>
                  {current.title}
                </h2>
            }
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {[current.year, current.genre].filter(Boolean).join(' · ')}
            </p>
          </motion.div>

          <div className="absolute bottom-16 right-16 flex gap-1.5">
            {items.slice(0, 8).map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-500"
                style={{ width: i === idx % 8 ? 20 : 6, height: 4, background: i === idx % 8 ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>

          <p className="absolute top-8 right-8 text-[10px] tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.2)' }}>Click or press any key to dismiss</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="absolute top-12 left-16">
      <p className="text-7xl font-thin" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
        {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </div>
  )
}
