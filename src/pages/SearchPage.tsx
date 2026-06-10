import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'

const TYPES = ['All', 'Movie', 'Series', 'MusicAlbum', 'Person']

export default function SearchPage() {
  const { setDetailItemId } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')
  const [debouncedQ, setDebouncedQ] = useState('')

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQ, type],
    queryFn: () => api.search(debouncedQ, type === 'All' ? undefined : type),
    enabled: debouncedQ.length >= 2,
    staleTime: 2 * 60_000,
  })

  const items = (data as any)?.items || []
  const total = (data as any)?.total || 0

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Search input */}
      <div className="px-4 pt-6 pb-4 sticky top-0 z-10" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search movies, shows, music, people…"
            className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm outline-none"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
          />
          {q && (
            <button onClick={() => { setQ(''); setDebouncedQ('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              style={{ color: 'var(--muted)' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {/* Type pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
              style={{ background: type === t ? 'var(--accent)' : 'var(--subtle)', color: type === t ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${type === t ? 'transparent' : 'var(--border2)'}` }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
        {debouncedQ.length < 2 && (
          <p className="text-sm text-center pt-16" style={{ color: 'var(--muted)', opacity: 0.25 }}>
            Type at least 2 characters to search
          </p>
        )}

        {debouncedQ.length >= 2 && (isLoading || isFetching) && !items.length && (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
          </div>
        )}

        {debouncedQ.length >= 2 && !isLoading && items.length === 0 && (
          <p className="text-sm text-center pt-16" style={{ color: 'var(--muted)', opacity: 0.25 }}>
            No results for "{debouncedQ}"
          </p>
        )}

        {items.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-[9px] mb-3" style={{ color: 'var(--muted)', opacity: 0.35 }}>
              {total} result{total !== 1 ? 's' : ''} {isFetching ? '· refreshing…' : ''}
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 28vw), 1fr))' }}>
              {items.map((item: any) => (
                <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
