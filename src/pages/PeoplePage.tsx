import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import api from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export default function PeoplePage() {
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  const { data = [], isLoading } = useQuery({
    queryKey: ['people', q],
    queryFn: () => api.people(q),
    staleTime: 5 * 60_000,
  })

  const people = data as any[]

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>People</h1>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…"
            className="pl-8 pr-4 py-2 rounded-full text-xs outline-none"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)', width: 180 }} />
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
        {people.map((p, i) => (
          <motion.button key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
            onClick={() => navigate(`/person/${p.id}`, { state: { name: p.name, imageTag: p.imageUrl ? 'yes' : null } })}
            className="flex flex-col items-center gap-2 group">
            <div className="rounded-full overflow-hidden" style={{ width: 72, height: 72, background: 'var(--bg3)', border: '2px solid var(--border2)', transition: 'border-color 0.2s' }}>
              {p.imageUrl
                ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: 'var(--accent)' }}>{p.name[0]}</div>
              }
            </div>
            <p className="text-[9px] font-bold text-center leading-tight" style={{ color: 'var(--muted)' }}>{p.name}</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
