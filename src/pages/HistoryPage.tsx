import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Clock, Film, Tv } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import type { MediaItem } from '@/types'

function fmtDate(str?: string) {
  if (!str) return ''
  const d = new Date(str)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  if (days < 30) return `${Math.floor(days/7)}w ago`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(items: MediaItem[]) {
  const groups: Record<string, MediaItem[]> = {}
  for (const item of items) {
    const key = fmtDate((item as any).lastPlayedDate || (item as any).userData?.lastPlayedDate)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return Object.entries(groups)
}

export default function HistoryPage() {
  const { setDetailItemId } = useStore()
  const [limit, setLimit] = useState(100)

  const { data = [], isLoading } = useQuery({
    queryKey: ['watch-history', limit],
    queryFn: () => api.watchHistory(limit),
    staleTime: 2 * 60_000,
  })

  const items = data as MediaItem[]
  const groups = groupByDate(items)

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-[0.4em] uppercase"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>
            Watch History
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            {items.length} titles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[50,100,250].map(n => (
            <button key={n} onClick={() => setLimit(n)}
              className="text-[9px] px-2.5 py-1.5 rounded-full font-bold uppercase tracking-wide transition-all"
              style={{ background: limit === n ? 'var(--accent)' : 'var(--subtle)', color: limit === n ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${limit === n ? 'transparent' : 'var(--border2)'}` }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--muted)', opacity: 0.3 }}>
          <Clock size={36} className="mx-auto mb-3" />
          <p className="text-sm">Nothing watched yet</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(([date, groupItems]) => (
          <div key={date}>
            <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-2"
              style={{ color: 'var(--accent)', opacity: 0.4 }}>{date}</p>
            <div className="space-y-1">
              {groupItems.map((item, i) => (
                <motion.button key={item.id + i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setDetailItemId(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5 group">
                  {/* Poster */}
                  <div className="w-8 h-11 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--bg3)' }}>
                    {item.posterUrl
                      ? <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          {item.type === 'Movie' ? <Film size={12} style={{ color: 'var(--muted)' }} /> : <Tv size={12} style={{ color: 'var(--muted)' }} />}
                        </div>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: 'var(--cream)' }}>
                      {item.type === 'Episode' ? (item as any).seriesName || item.title : item.title}
                    </p>
                    {item.type === 'Episode' && (
                      <p className="text-[9px]" style={{ color: 'var(--muted)' }}>
                        {item.title} · S{String((item as any).parentIndexNumber||0).padStart(2,'0')}E{String((item as any).indexNumber||0).padStart(2,'0')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: item.type === 'Movie' ? 'rgba(201,168,76,0.08)' : 'rgba(93,173,226,0.08)', color: item.type === 'Movie' ? 'var(--accent)' : 'var(--blue)' }}>
                      {item.type === 'Episode' ? 'Episode' : 'Movie'}
                    </span>
                    {item.year && <span className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>{item.year}</span>}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
