import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)' }}>
      <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>{title}</p>
      {children}
    </div>
  )
}

function StatRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between items-center mb-2">
      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className={`text-[11px] font-bold font-mono ${cls || ''}`} style={{ color: cls ? undefined : 'rgba(240,232,213,0.65)' }}>{value || '—'}</span>
    </div>
  )
}

export default function StatsPage() {
  const { data: summary } = useQuery({ queryKey: ['stats-summary'], queryFn: api.statsSummary.bind(api) })
  const { data: watchTime } = useQuery({ queryKey: ['watch-time'], queryFn: () => api.watchTime(30) })
  const { data: genres } = useQuery({ queryKey: ['top-genres'], queryFn: api.topGenres.bind(api) })
  const { data: topMovies } = useQuery({ queryKey: ['top-movies'], queryFn: api.topMovies.bind(api) })

  const maxBar = Math.max(...(watchTime || []).map(d => d.minutes), 1)
  const maxGenre = genres?.[0]?.count || 1

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '24px var(--pad) 48px' }}>
        <h1 className="text-2xl tracking-[0.4em] uppercase mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Statistics</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Movies Watched', value: summary?.moviesWatched, icon: '🎬' },
            { label: 'Episodes Watched', value: summary?.episodesWatched, icon: '📺' },
            { label: 'Songs Played', value: summary?.songsPlayed, icon: '🎵' },
            { label: 'Est. Hours', value: summary?.estimatedHours, icon: '⏱' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)' }}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.7 }}>
                {s.value?.toLocaleString() ?? '—'}
              </div>
              <div className="text-[8px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Watch time chart */}
          {watchTime && watchTime.length > 0 && (
            <Card title="Watch Time — Last 30 Days (minutes)">
              <div className="flex items-end gap-0.5 h-28">
                {watchTime.map(d => (
                  <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: ${d.minutes}min`}>
                    <div className="rounded-sm transition-all hover:opacity-100"
                      style={{ height: `${Math.max(2, (d.minutes / maxBar) * 100)}%`, background: 'var(--accent)', opacity: d.minutes > 0 ? 0.65 : 0.1 }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {[watchTime[0], watchTime[Math.floor(watchTime.length/2)], watchTime[watchTime.length-1]].map(d => (
                  <span key={d?.date} className="text-[8px]" style={{ color: 'var(--muted)' }}>
                    {d ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Top genres */}
          {genres && genres.length > 0 && (
            <Card title="Top Genres">
              {genres.slice(0, 8).map(g => (
                <div key={g.genre} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{g.genre}</span>
                    <span className="text-[10px]" style={{ color: 'var(--accent)' }}>{g.count}</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: 'var(--border2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(g.count / maxGenre) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Top movies */}
        {topMovies && topMovies.length > 0 && (
          <Card title="Most Watched Movies">
            <div className="space-y-3">
              {topMovies.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-xl w-6 text-right" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', opacity: 0.3 }}>{i+1}</span>
                  <img src={m.posterUrl} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" style={{ background: 'var(--bg3)' }} onError={e => (e.currentTarget.style.display = 'none')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: 'rgba(240,232,213,0.7)' }}>{m.title}</p>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{m.playCount} play{m.playCount !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
