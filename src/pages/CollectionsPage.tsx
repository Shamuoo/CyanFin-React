import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Search, Pencil, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import type { MediaItem } from '@/types'

function CollectionCard({ col, onClick }: { col: MediaItem; onClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="cursor-pointer group rounded-xl overflow-hidden"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}
      onClick={onClick}>
      {col.backdropUrl || col.posterUrl
        ? <img src={col.backdropUrl || col.posterUrl || ''} alt={col.title}
            className="w-full object-cover transition-transform group-hover:scale-105"
            style={{ height: 120 }} />
        : <div className="w-full flex items-center justify-center"
            style={{ height: 120, background: 'var(--bg3)', fontSize: 32 }}>📦</div>
      }
      <div className="p-3 flex items-center justify-between">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{col.title}</p>
        <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      </div>
    </motion.div>
  )
}

function CreateCollectionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const result = await api.createCollection(name.trim(), [])
      toast.success(`Collection "${name}" created`)
      onCreated(result.id)
    } catch(e: any) { toast.error(e.message) }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-bold mb-4" style={{ color: 'var(--cream)' }}>New Collection</p>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="e.g. Friday Night Picks"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-4"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
          autoFocus />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-full text-sm hover:opacity-70"
            style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
            Cancel
          </button>
          <button onClick={create} disabled={!name.trim() || loading}
            className="flex-1 py-2 rounded-full text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            {loading ? '…' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function CollectionDetail({ colId, colName, onBack }: { colId: string; colName: string; onBack: () => void }) {
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<MediaItem[]>([])
  const { setDetailItemId } = useStore()
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['collection-items', colId],
    queryFn: () => api.collectionItems(colId),
    staleTime: 30_000,
  })

  const doSearch = async () => {
    if (!searchQ.trim()) return
    setSearching(true)
    const results = await api.search(searchQ).catch(() => [])
    setSearchResults(results.filter((r: MediaItem) => !items.find(i => i.id === r.id)))
    setSearching(false)
  }

  const addItem = async (itemId: string) => {
    await api.addToCollection(colId, [itemId])
    qc.invalidateQueries({ queryKey: ['collection-items', colId] })
    qc.invalidateQueries({ queryKey: ['collections'] })
    toast.success('Added to collection')
    setSearchResults(prev => prev.filter(r => r.id !== itemId))
  }

  const removeItem = async (itemId: string) => {
    await api.removeFromCollection(colId, [itemId])
    qc.invalidateQueries({ queryKey: ['collection-items', colId] })
    qc.invalidateQueries({ queryKey: ['collections'] })
    toast.info('Removed from collection')
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="hover:opacity-70" style={{ color: 'var(--muted)' }}>← Back</button>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.06em' }}>{colName}</h2>
      </div>

      {/* Add items */}
      <div className="flex gap-2 mb-5">
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Search your library to add..."
          className="flex-1 px-3 py-2 rounded-full text-sm outline-none"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
        <button onClick={doSearch} disabled={searching}
          className="px-4 py-2 rounded-full text-sm font-bold hover:opacity-80"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          <Search size={14} />
        </button>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
          {searchResults.slice(0, 6).map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border2)' }}>
              {r.posterUrl && <img src={r.posterUrl} alt="" className="w-7 h-10 rounded object-cover flex-shrink-0" />}
              <p className="flex-1 text-sm truncate" style={{ color: 'var(--muted)' }}>{r.title}</p>
              <button onClick={() => addItem(r.id)}
                className="flex-shrink-0 text-[9px] px-3 py-1 rounded-full font-bold hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Current items */}
      <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>
        Items ({(items as MediaItem[]).length})
      </p>
      {isLoading && <div className="text-center py-8" style={{ color: 'var(--muted)' }}>Loading…</div>}
      <div className="space-y-1">
        {(items as MediaItem[]).map((item: MediaItem) => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg group hover:bg-white/5 cursor-pointer"
            onClick={() => setDetailItemId(item.id)}>
            {item.posterUrl && <img src={item.posterUrl} alt="" className="w-7 h-10 rounded object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{item.title}</p>
              <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>{item.year} · {item.type}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); removeItem(item.id) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:opacity-70"
              style={{ color: '#e74c3c' }}>
              <X size={13} />
            </button>
          </div>
        ))}
        {!isLoading && (items as MediaItem[]).length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)', opacity: 0.3 }}>
            Search above to add movies and shows
          </p>
        )}
      </div>
    </div>
  )
}

export default function CollectionsPage() {
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const qc = useQueryClient()

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.collections() as Promise<MediaItem[]>,
    staleTime: 60_000,
  })

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>
          Collections
        </h1>
        {!selected && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <Plus size={13} /> New
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <CollectionDetail colId={selected.id} colName={selected.name} onBack={() => setSelected(null)} />
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {isLoading && <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Loading…</div>}
            {!isLoading && (collections as MediaItem[]).length === 0 && (
              <div className="text-center py-20" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                <p className="text-sm mb-2">No collections yet</p>
                <p className="text-xs">Create one to group your favourite movies and shows</p>
              </div>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {(collections as MediaItem[]).map((col: MediaItem, i: number) => (
                <motion.div key={col.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <CollectionCard col={col} onClick={() => setSelected({ id: col.id, name: col.title ?? '' })} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {creating && (
        <CreateCollectionModal
          onClose={() => setCreating(false)}
          onCreated={id => {
            setCreating(false)
            qc.invalidateQueries({ queryKey: ['collections'] })
            setSelected({ id, name: '' })
          }}
        />
      )}
    </div>
  )
}
