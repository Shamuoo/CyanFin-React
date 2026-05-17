import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <p className="text-[8px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--muted)', opacity: 0.5 }}>{label}</p>
      <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', letterSpacing: '0.05em' }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color = 'var(--accent)' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-[10px] w-28 truncate flex-shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--subtle)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] w-8 text-right flex-shrink-0 font-mono" style={{ color: 'var(--muted)' }}>{value}</span>
    </div>
  )
}

export default function StatsPage() {
  const { data: summary, isLoading: loadSum } = useQuery({ queryKey: ['stats-summary'], queryFn: () => api.statsSummary() as Promise<any>, staleTime: 5 * 60_000 })
  const { data: watchTime } = useQuery({ queryKey: ['stats-watchtime'], queryFn: () => api.watchTime() as Promise<any>, staleTime: 5 * 60_000 })
  const { data: genres } = useQuery({ queryKey: ['stats-genres'], queryFn: () => api.topGenres() as Promise<any>, staleTime: 5 * 60_000 })
  const { data: topMovies } = useQuery({ queryKey: ['stats-movies'], queryFn: () => api.topMovies() as Promise<any>, staleTime: 5 * 60_000 })

  const s = summary as any
  const wt = watchTime as any
  const g = Array.isArray(genres) ? genres : []
  const tm = Array.isArray(topMovies) ? topMovies : []
  const wtArr = Array.isArray(wt) ? wt : []
  const maxHours = wtArr.length ? Math.max(...wtArr.map((d: any) => d[1] || 0), 1) : 1

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Stats</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-8 md:grid-cols-4">
        <StatCard label="Movies Watched" value={s?.moviesWatched || 0} />
        <StatCard label="Episodes Watched" value={s?.episodesWatched || 0} />
        <StatCard label="Hours Watched" value={s?.hoursWatched || 0} sub="total" />
        <StatCard label="Library Items" value={s?.totalItems || 0} />
      </div>

      {/* Watch time chart */}
      {wtArr.length > 0 && (
        <div className="mb-8 rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[8px] font-bold tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>Watch Time (last 30 days)</p>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {wtArr.slice(-30).map((d: any, i: number) => (
              <div key={i} className="flex-1 rounded-sm transition-all hover:opacity-80" title={`${d[1] || 0}h`}
                style={{ height: `${Math.max(4, ((d[1] || 0) / maxHours) * 80)}px`, background: 'var(--accent)', opacity: 0.7 + ((d[1] || 0) / maxHours) * 0.3 }} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top genres */}
        {g.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[8px] font-bold tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>Top Genres</p>
            {g.slice(0, 8).map((genre: any, i: number) => (
              <BarRow key={i} label={genre.name || genre[0]} value={genre.count || genre[1] || 0} max={g[0]?.count || g[0]?.[1] || 1} />
            ))}
          </div>
        )}

        {/* Top movies */}
        {tm.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[8px] font-bold tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>Most Watched</p>
            {tm.slice(0, 8).map((movie: any, i: number) => (
              <div key={i} className="flex items-center gap-2 mb-2.5">
                <span className="text-[9px] w-4 text-right flex-shrink-0 font-mono" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                {movie.posterUrl && <img src={movie.posterUrl} alt="" className="w-6 h-9 object-cover rounded flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] truncate" style={{ color: 'var(--cream)' }}>{movie.title || movie[0]}</p>
                  <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{movie.playCount || movie[1] || 0} plays</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!s && !loadSum && (
        <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
          <p>No stats available yet. Start watching something!</p>
        </div>
      )}
    </div>
  )
}
