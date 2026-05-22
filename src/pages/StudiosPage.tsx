import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'

export default function StudiosPage() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const { setDetailItemId } = useStore()

  const { data: studios = [], isLoading } = useQuery({
    queryKey: ['studios'], queryFn: () => api.studios(), staleTime: 10 * 60_000,
  })

  const { data: items = [], isLoading: loadItems } = useQuery({
    queryKey: ['studio-items', selected?.id],
    queryFn: () => api.studioItems(selected!.id),
    enabled: !!selected,
    staleTime: 5 * 60_000,
  })

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key="items" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setSelected(null)} className="flex items-center gap-2 mb-6 hover:opacity-70" style={{ color: 'var(--muted)' }}>
              <ArrowLeft size={16} /> <span className="text-sm font-bold">{selected.name}</span>
            </button>
            {loadItems
              ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
              : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                  {(items as any[]).map(item => <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />)}
                </div>
            }
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Studios</h1>
            {isLoading
              ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
              : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {(studios as any[]).map((s, i) => (
                    <motion.button key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => setSelected(s)}
                      className="p-4 rounded-xl text-left hover:bg-white/5 transition-all group"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{s.name}</p>
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
