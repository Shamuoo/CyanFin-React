import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'

function fmtDate(str?: string) {
  if (!str) return ''
  return new Date(str).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(str?: string) {
  if (!str) return null
  const diff = Math.ceil((new Date(str).getTime() - Date.now()) / 86_400_000)
  return diff
}

export default function UpcomingPage() {
  const { setDetailItemId } = useStore()
  const { data: movies, isLoading: loadM } = useQuery({
    queryKey: ['upcoming-movies'],
    queryFn: () => api.get<any>('/api/upcoming/movies'),
    staleTime: 6 * 60 * 60_000,
  })
  const { data: shows } = useQuery({
    queryKey: ['upcoming-shows'],
    queryFn: () => api.get<any>('/api/upcoming/shows'),
    staleTime: 6 * 60 * 60_000,
  })

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div className="mb-10">
      <h2 className="text-[9px] font-bold tracking-[0.4em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>{title}</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {items.map((item: any, i: number) => {
          const days = daysUntil(item.releaseDate)
          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}
              onClick={() => item.jellyfinId && setDetailItemId(item.jellyfinId)}>
              {item.posterUrl
                ? <img src={item.posterUrl} alt={item.title} className="rounded-lg flex-shrink-0 object-cover" style={{ width: 48, height: 72, background: 'var(--bg3)' }} />
                : <div className="rounded-lg flex-shrink-0" style={{ width: 48, height: 72, background: 'var(--bg3)' }} />
              }
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{item.title}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmtDate(item.releaseDate)}</p>
                {days !== null && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold self-start"
                    style={{ background: days <= 7 ? 'rgba(201,168,76,0.15)' : 'var(--subtle)', color: days <= 7 ? 'var(--accent)' : 'var(--muted)' }}>
                    {days <= 0 ? 'Out now' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                  </span>
                )}
              </div>
              {item.score && (
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{Math.round(item.score * 10)}%</span>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )

  const movieItems = Array.isArray(movies) ? movies : []
  const showItems  = Array.isArray(shows)  ? shows  : []

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Upcoming</h1>

      {loadM && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      {movieItems.length > 0 && <Section title="Movies" items={movieItems} />}
      {showItems.length  > 0 && <Section title="TV Shows" items={showItems} />}

      {!loadM && movieItems.length === 0 && showItems.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--muted)', opacity: 0.4 }}>
          <p className="text-sm">No upcoming releases found</p>
          <p className="text-xs mt-1">Add a TMDB API key in Settings to enable this</p>
        </div>
      )}
    </div>
  )
}
