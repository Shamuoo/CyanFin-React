import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import MediaCard from '@/components/ui/MediaCard'
import { useStore } from '@/lib/store'
import type { MediaItem } from '@/types'

export default function MoviesPage() {
  const { setDetailItemId } = useStore()
  const [sort, setSort] = useState('SortName')
  const [order, setOrder] = useState('Ascending')
  const [genre, setGenre] = useState('')
  const [start, setStart] = useState(0)
  const [allItems, setAllItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['movies', sort, order, genre, start],
    queryFn: () => api.movies({ sort, order, genre, start }),
    staleTime: 30_000,
  })
  const { data: genres = [] } = useQuery({ queryKey: ['genres-movie'], queryFn: () => api.genres('Movie') })

  useEffect(() => {
    if (!data) return
    setTotal(data.total)
    setAllItems(prev => start === 0 ? data.items : [...prev, ...data.items])
  }, [data, start])

  useEffect(() => { setStart(0); setAllItems([]) }, [sort, order, genre])

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const handler = () => { if (!isFetching && allItems.length < total && el.scrollTop + el.clientHeight >= el.scrollHeight - 400) setStart(allItems.length) }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [isFetching, allItems.length, total])

  const sel = 'px-3 py-1.5 rounded text-xs outline-none'
  const selStyle = { background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--cream)' }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div className="pt-6 pb-4" style={{ padding: '24px var(--pad) 12px' }}>
        <div className="flex items-end gap-4 mb-4">
          <h1 className="text-xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Movies</h1>
          <span className="text-[9px] tracking-[0.15em] pb-0.5" style={{ color: 'var(--muted)' }}>{total.toLocaleString()} titles</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={sort} onChange={e => setSort(e.target.value)} className={sel} style={selStyle}>
            {[['SortName','A–Z'],['PremiereDate','Year'],['CommunityRating','Rating'],['DateCreated','Date Added'],['PlayCount','Most Played']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={order} onChange={e => setOrder(e.target.value)} className={sel} style={selStyle}>
            <option value="Ascending">↑ Asc</option><option value="Descending">↓ Desc</option>
          </select>
          <select value={genre} onChange={e => setGenre(e.target.value)} className={sel} style={selStyle}>
            <option value="">All Genres</option>
            {genres.map(g => <option key={typeof g === "string" ? g : g.name} value={typeof g === "string" ? g : g.name}>{typeof g === "string" ? g : g.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 pb-12" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', padding: '0 var(--pad) 48px' }}>
        {allItems.map(item => <MediaCard key={item.id} item={item} onClick={() => setDetailItemId(item.id)} width={130} />)}
      </div>
      {isFetching && <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>}
    </div>
  )
}
