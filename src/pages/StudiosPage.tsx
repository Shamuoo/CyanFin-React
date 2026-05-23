import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Building2 } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'

export default function StudiosPage() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [search, setSearch] = useState('')
  const { setDetailItemId } = useStore()

  const { data: studios = [], isLoading } = useQuery({
    queryKey: ['studios'],
    queryFn: () => api.studios(),
    staleTime: 10 * 60_000,
  })

  const { data: items = [], isLoading: loadItems } = useQuery({
    queryKey: ['studio-items', selected?.id],
    queryFn: () => api.studioItems(selected!.id),
    enabled: !!selected,
    staleTime: 5 * 60_000,
  })

  const filteredStudios = (studios as any[]).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key="items" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-2 mb-6 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--muted)' }}>
              <ArrowLeft size={16} />
              <span className="text-sm font-bold" style={{ color: 'var(--cream)' }}>{selected.name}</span>
            </button>
            {loadItems
              ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
              : (items as any[]).length === 0
                ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)', opacity: 0.3 }}>No content found</p>
                : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                    {(items as any[]).map(item => (
                      <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />
                    ))}
                  </div>
            }
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Studios</h1>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>{(studios as any[]).length} studios</p>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter studios…"
                className="px-3 py-2 rounded-full text-xs outline-none"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)', width: 160 }} />
            </div>

            {isLoading
              ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
              : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {filteredStudios.map((s: any, i: number) => (
                    <motion.button key={s.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.01, 0.4) }}
                      onClick={() => setSelected(s)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl text-center hover:bg-white/5 transition-all group"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                      {/* Studio logo or thumbnail */}
                      {s.logoUrl || s.thumbUrl || s.imageUrl
                        ? <div className="w-full h-16 flex items-center justify-center rounded-lg overflow-hidden mb-1"
                            style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <img
                              src={s.logoUrl || s.thumbUrl || s.imageUrl}
                              alt={s.name}
                              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                              style={{ filter: 'brightness(0.9)' }}
                            />
                          </div>
                        : <div className="w-full h-16 flex items-center justify-center rounded-lg mb-1"
                            style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <Building2 size={24} style={{ color: 'var(--muted)', opacity: 0.3 }} />
                          </div>
                      }
                      <p className="text-xs font-bold truncate w-full" style={{ color: 'var(--cream)' }}>{s.name}</p>
                    </motion.button>
                  ))}
                </div>
            }
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
