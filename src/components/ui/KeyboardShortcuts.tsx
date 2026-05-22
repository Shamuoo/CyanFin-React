import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { section: 'Navigation' },
  { key: '⌘K',     desc: 'Search' },
  { key: '⌘I',     desc: 'AI Navigator' },
  { key: '?',       desc: 'This help overlay' },
  { key: 'Esc',     desc: 'Close modal / exit player' },

  { section: 'Player' },
  { key: 'Space / K', desc: 'Play / Pause' },
  { key: '← / →',    desc: 'Seek ±10 seconds' },
  { key: '↑ / ↓',    desc: 'Volume ±10%' },
  { key: 'F',         desc: 'Toggle fullscreen' },
  { key: 'M',         desc: 'Mute / unmute' },
  { key: 'C',         desc: 'Subtitles panel' },
  { key: 'L',         desc: 'Chapters panel' },
  { key: 'N',         desc: 'Next episode' },

  { section: 'General' },
  { key: 'G then H',  desc: 'Go to Home' },
  { key: 'G then M',  desc: 'Go to Movies' },
  { key: 'G then T',  desc: 'Go to TV Shows' },
  { key: 'G then S',  desc: 'Go to Settings' },
]

export default function KeyboardShortcuts() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.target?.toString().includes('Input')) {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>

          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border2)' }}>
              <p className="text-sm font-bold tracking-wide" style={{ color: 'var(--cream)' }}>Keyboard Shortcuts</p>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--muted)' }}><X size={16} /></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: '70vh' }}>
              {SHORTCUTS.map((s, i) => {
                if ('section' in s) {
                  return <p key={i} className="text-[8px] font-bold tracking-[0.3em] uppercase pt-2" style={{ color: 'var(--accent)', opacity: 0.5 }}>{s.section}</p>
                }
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.desc}</span>
                    <div className="flex gap-1">
                      {s.key.split(' / ').map(k => (
                        <kbd key={k} className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-3 text-center" style={{ borderTop: '1px solid var(--border2)' }}>
              <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>Press <kbd style={{ fontFamily: 'monospace', padding: '1px 4px', background: 'var(--bg3)', borderRadius: 3, border: '1px solid var(--border2)' }}>?</kbd> to toggle</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
