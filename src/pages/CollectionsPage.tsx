import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import MediaCard from '@/components/ui/MediaCard'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

export default function CollectionsPage() {
  const { setDetailItemId } = useStore()
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data: cols, isLoading } = useQuery({
    queryKey: ['collections-list'],
    queryFn: () => api.collections(),
    staleTime: 5 * 60_000,
  })

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['collection-items', activeId],
    queryFn: () => api.collectionItems(activeId!),
    enabled: !!activeId,
    staleTime: 5 * 60_000,
  })

  const collections = (cols || []) as any[]
  const colItems = (items as any)?.items || []
  const activeCol = collections.find(c => c.id === activeId)

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      {activeId ? (
        <>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setActiveId(null)} className="p-1.5 rounded-full hover:opacity-70" style={{ color: 'var(--muted)' }}>
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>
              {activeCol?.name}
            </h1>
          </div>
          {loadingItems
            ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
            : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 28vw), 1fr))' }}>
                {colItems.map((item: any) => <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />)}
              </div>
          }
        </>
      ) : (
        <>
          <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Collections</h1>
          {isLoading
            ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
            : collections.length === 0
              ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)', opacity: 0.25 }}>No collections. Create one from any film's detail page.</p>
              : <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 40vw), 1fr))' }}>
                  {collections.map((col: any) => (
                    <motion.button key={col.id} onClick={() => setActiveId(col.id)}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl overflow-hidden text-left hover:scale-[1.02] transition-transform"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                      {col.imageUrl
                        ? <img src={col.imageUrl} alt={col.name} className="w-full object-cover" style={{ height: 100 }} />
                        : <div className="w-full flex items-center justify-center text-3xl" style={{ height: 100, background: 'var(--bg3)' }}>📦</div>
                      }
                      <div className="p-3">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{col.name}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>{col.count} items</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
          }
        </>
      )}
    </div>
  )
}
