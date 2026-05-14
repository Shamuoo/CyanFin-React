import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useStore } from '@/lib/store'

interface Props { onClose: () => void }

export default function SearchOverlay({ onClose }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const { setDetailItemId } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: results = [] } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => api.search(debouncedQ),
    enabled: debouncedQ.length >= 2,
  })

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center pt-16 px-6"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Input */}
      <div className="w-full max-w-2xl relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search movies, shows, music…"
          className="w-full py-4 pl-12 pr-12 text-base outline-none rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--cream)' }}
        />
        {q && <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}><X size={16} /></button>}
      </div>

      {/* Results */}
      <div className="w-full max-w-2xl overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {results.map(item => (
          <button key={item.id} onClick={() => { setDetailItemId(item.id); onClose() }}
            className="w-full flex gap-3 p-3 rounded-lg text-left transition-all hover:bg-white/5 mb-1">
            <img src={item.posterUrl} alt="" className="w-10 h-[60px] object-cover rounded flex-shrink-0"
              style={{ background: 'var(--bg3)' }} onError={e => (e.currentTarget.style.display = 'none')} />
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{item.title}</p>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {[item.type, item.year, item.genre].filter(Boolean).join(' · ')}
              </p>
              {item.overview && <p className="text-[10px] line-clamp-2" style={{ color: 'var(--muted)', opacity: 0.7 }}>{item.overview}</p>}
            </div>
          </button>
        ))}
        {debouncedQ.length >= 2 && results.length === 0 && (
          <p className="text-center py-10 text-sm italic" style={{ color: 'var(--muted)' }}>No results for "{debouncedQ}"</p>
        )}
      </div>
    </motion.div>
  )
}
