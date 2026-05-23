import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import api from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export default function PeoplePage() {
  const [q, setQ] = useState('')
  const [startIndex, setStartIndex] = useState(0)
  const PAGE = 100
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['people', q, startIndex],
    queryFn: () => api.get<any>(`/api/people?q=${encodeURIComponent(q)}&limit=${PAGE}&startIndex=${startIndex}`),
    staleTime: 5 * 60_000,
  })

  const d = data as any
  const people = d?.items || []
  const total  = d?.total || 0

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>People</h1>
          {total > 0 && <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>{total} people</p>}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input value={q} onChange={e => { setQ(e.target.value); setStartIndex(0) }}
            placeholder="Search people…"
            className="pl-8 pr-4 py-2 rounded-full text-xs outline-none"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)', width: 180 }} />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {people.map((p: any, i: number) => (
          <motion.button key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.5) }}
            onClick={() => navigate(`/person/${p.id}`, { state: { name: p.name, imageTag: p.imageUrl ? 'yes' : null } })}
            className="flex flex-col items-center gap-2 group text-center">
            {/* Portrait — tall rectangular card like Plex/Infuse */}
            <div className="w-full rounded-xl overflow-hidden"
              style={{ aspectRatio: '2/3', background: 'var(--bg3)', border: '1px solid var(--border2)', transition: 'border-color 0.2s, transform 0.2s' }}>
              {p.imageUrl
                ? <img src={p.imageUrl} alt={p.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
                : <div className="w-full h-full flex items-center justify-center"
                    style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                    {p.name[0]}
                  </div>
              }
            </div>
            <div>
              <p className="text-[10px] font-bold leading-tight" style={{ color: 'var(--cream)' }}>{p.name}</p>
              {p.type && p.type !== 'Person' && (
                <p className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>{p.type}</p>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Pagination */}
      {total > PAGE && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button onClick={() => setStartIndex(Math.max(0, startIndex - PAGE))}
            disabled={startIndex === 0}
            className="px-4 py-2 rounded-full text-xs font-bold disabled:opacity-30 hover:opacity-80"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            ← Prev
          </button>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {startIndex + 1}–{Math.min(startIndex + PAGE, total)} of {total}
          </span>
          <button onClick={() => setStartIndex(startIndex + PAGE)}
            disabled={startIndex + PAGE >= total}
            className="px-4 py-2 rounded-full text-xs font-bold disabled:opacity-30 hover:opacity-80"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
