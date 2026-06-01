import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Play, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'
import { toast } from '@/components/ui/Toast'

export default function SmartPlaylistsPage() {
  const qc = useQueryClient()
  const { setDetailItemId } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rules, setRules] = useState({ name: 'New Smart Playlist', genre: '', minYear: '', maxYear: '', minRating: '', unwatched: false, type: 'both' })

  const { data } = useQuery({
    queryKey: ['smart-playlists'],
    queryFn: () => api.get<any>('/api/smart-playlists'),
    staleTime: 30_000,
  })
  const playlists = (data as any)?.playlists || []

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['smart-playlist-items', activeId],
    queryFn: () => api.get<any>(`/api/smart-playlists/${activeId}/items`),
    enabled: !!activeId, staleTime: 2 * 60_000,
  })

  const create = async () => {
    if (!rules.name) return
    const r = await api.post<any>('/api/smart-playlists', { name: rules.name, rules: { ...rules } }).catch(() => null)
    if (r?.ok) { toast.success('Playlist created'); qc.invalidateQueries({ queryKey: ['smart-playlists'] }); setShowCreate(false) }
  }

  const remove = async (id: string) => {
    await api.delete(`/api/smart-playlists/${id}`).catch(() => {})
    qc.invalidateQueries({ queryKey: ['smart-playlists'] })
    if (activeId === id) setActiveId(null)
    toast.success('Playlist deleted')
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Smart Playlists</h1>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          <Plus size={12} /> New
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl p-4 mb-5" style={{ background: 'var(--bg2)', border: '1px solid var(--accent)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--cream)' }}>Create Smart Playlist</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Name */}
              <div style={{ gridColumn: '1/-1' }}>
                <input value={rules.name} onChange={e => setRules(r => ({ ...r, name: e.target.value }))}
                  placeholder="Playlist name" className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
              </div>
              {/* Rules */}
              {[
                ['genre', 'Genre', ['Any','Action','Comedy','Drama','Horror','Sci-Fi','Thriller','Documentary','Animation','Romance']],
                ['type', 'Type', ['both','movies','shows']],
              ].map(([k, label, opts]: any) => (
                <div key={k}>
                  <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>{label}</p>
                  <select value={(rules as any)[k]} onChange={e => setRules(r => ({ ...r, [k]: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}>
                    {opts.map((o: string) => <option key={o} value={o === 'Any' ? '' : o}>{o}</option>)}
                  </select>
                </div>
              ))}
              {['minYear','maxYear'].map(k => (
                <div key={k}>
                  <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>{k === 'minYear' ? 'From Year' : 'To Year'}</p>
                  <input type="number" value={(rules as any)[k]} onChange={e => setRules(r => ({ ...r, [k]: e.target.value }))}
                    placeholder={k === 'minYear' ? '1980' : '2024'}
                    className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                </div>
              ))}
              <div>
                <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Min Rating</p>
                <input type="number" step="0.5" min="0" max="10" value={rules.minRating} onChange={e => setRules(r => ({ ...r, minRating: e.target.value }))}
                  placeholder="7.5" className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setRules(r => ({ ...r, unwatched: !r.unwatched }))}
                  className="relative rounded-full"
                  style={{ width: 36, height: 20, background: rules.unwatched ? 'var(--accent)' : 'var(--border2)', flexShrink: 0 }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 16, height: 16, background: 'white', left: rules.unwatched ? 18 : 2 }} />
                </button>
                <p className="text-[9px]" style={{ color: 'var(--muted)' }}>Unwatched only</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={create} className="flex-1 py-1.5 rounded-full text-[10px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Create</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 rounded-full text-[10px] font-bold" style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist list */}
      <div className="space-y-2 mb-6">
        {playlists.length === 0 && <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)', opacity: 0.3 }}>No smart playlists yet.</p>}
        {playlists.map((pl: any) => (
          <motion.div key={pl.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: activeId === pl.id ? 'rgba(201,168,76,0.08)' : 'var(--bg2)', border: `1px solid ${activeId === pl.id ? 'var(--accent)' : 'var(--border2)'}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{pl.name}</p>
              <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                {[pl.rules.genre, pl.rules.minRating && `★${pl.rules.minRating}+`, pl.rules.unwatched && 'unwatched'].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={() => setActiveId(activeId === pl.id ? null : pl.id)}
              className="p-1.5 rounded-full hover:opacity-70" style={{ color: 'var(--accent)' }}>
              <Play size={14} />
            </button>
            <button onClick={() => remove(pl.id)} className="p-1.5 rounded-full hover:opacity-70" style={{ color: '#e74c3c' }}>
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Items */}
      {activeId && (
        <div>
          {loadingItems
            ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
            : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 28vw), 1fr))' }}>
                {((items as any)?.items || []).map((item: any) => (
                  <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}
