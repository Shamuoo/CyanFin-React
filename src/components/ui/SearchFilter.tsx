import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, X } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from './MediaCard'

const GENRES = ['Action','Adventure','Animation','Comedy','Crime','Documentary',
  'Drama','Fantasy','History','Horror','Music','Mystery','Romance',
  'Science Fiction','Thriller','Western']

const YEARS = Array.from({ length: 35 }, (_, i) => String(new Date().getFullYear() - i))

export default function SearchFilter() {
  const { setDetailItemId } = useStore()
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState({
    genre: '', year: '', minRating: '', unwatched: '', type: 'Movie,Series'
  })
  const [applied, setApplied] = useState<typeof filters | null>(null)

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search-filter', applied],
    queryFn: () => api.searchFilter(Object.fromEntries(Object.entries(applied!).filter(([,v]) => v))),
    enabled: !!applied,
    staleTime: 2 * 60_000,
  })

  const set = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))
  const hasFilters = Object.values(filters).some(v => !!v && v !== 'Movie,Series')
  const items = results as any[]

  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
      style={{ background: active ? 'var(--accent)' : 'var(--subtle)', color: active ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${active ? 'transparent' : 'var(--border2)'}` }}>
      {label}
    </button>
  )

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80"
        style={{ background: hasFilters ? 'rgba(201,168,76,0.1)' : 'var(--subtle)', color: hasFilters ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${hasFilters ? 'var(--border)' : 'var(--border2)'}` }}>
        <Filter size={12} /> Filter {hasFilters && '·'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-5"
            style={{ width: 360, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>Filter Library</p>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--muted)' }}><X size={14} /></button>
            </div>

            {/* Type */}
            <p className="text-[8px] tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Type</p>
            <div className="flex gap-2 mb-4">
              {[['Movie,Series','All'],['Movie','Movies'],['Series','Shows']].map(([v,l]) => (
                pill(l, filters.type === v, () => set('type', v))
              ))}
            </div>

            {/* Genre */}
            <p className="text-[8px] tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Genre</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {GENRES.map(g => pill(g, filters.genre === g, () => set('genre', filters.genre === g ? '' : g)))}
            </div>

            {/* Year */}
            <p className="text-[8px] tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Year</p>
            <div className="flex gap-2 mb-4 items-center">
              <select value={filters.year} onChange={e => set('year', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                <option value="">Any year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Rating */}
            <p className="text-[8px] tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Min Rating</p>
            <div className="flex gap-2 mb-4">
              {['','5','6','7','8','9'].map(r => pill(r || 'Any', filters.minRating === r, () => set('minRating', r)))}
            </div>

            {/* Unwatched */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Unwatched only</p>
              <button onClick={() => set('unwatched', filters.unwatched === '1' ? '' : '1')}
                className="relative rounded-full flex-shrink-0"
                style={{ width: 36, height: 20, background: filters.unwatched === '1' ? 'var(--accent)' : 'var(--border2)' }}>
                <span className="absolute top-0.5 rounded-full transition-all"
                  style={{ width: 16, height: 16, background: 'white', left: filters.unwatched === '1' ? 18 : 2 }} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => { setFilters({ genre:'',year:'',minRating:'',unwatched:'',type:'Movie,Series' }); setApplied(null) }}
                className="flex-1 py-2 rounded-full text-xs hover:opacity-70"
                style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                Clear
              </button>
              <button onClick={() => { setApplied({...filters}); setOpen(false) }}
                className="flex-1 py-2 rounded-full text-xs font-bold hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {applied && (
        <div className="mt-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--muted)', opacity: 0.4 }}>
              No results for these filters
            </p>
          )}
          {items.length > 0 && (
            <>
              <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>
                {items.length} results
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                {items.map(item => (
                  <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
