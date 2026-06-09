import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import MediaCard from '@/components/ui/MediaCard'

export default function MoviesFiltered4K() {
  const { setDetailItemId } = useStore()
  const { data, isLoading } = useQuery({
    queryKey: ['movies-4k'],
    queryFn: () => api.movies4k(),
    staleTime: 10 * 60_000,
  })
  const items = (data as any)?.items || []
  const total = (data as any)?.total || 0

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>4K Movies</h1>
          {total > 0 && <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.3 }}>{total} 4K films in library</p>}
        </div>
      </div>
      {isLoading
        ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>
        : items.length === 0
          ? <p className="text-sm py-16 text-center" style={{ color: 'var(--muted)', opacity: 0.25 }}>No 4K movies found.<br/>Jellyfin needs MediaStreams with width ≥ 3840.</p>
          : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 28vw), 1fr))' }}>
              {items.map((item: any) => <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} />)}
            </div>
      }
    </div>
  )
}
