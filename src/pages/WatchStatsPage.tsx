import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// Try to import recharts, fallback gracefully
let BarChart: any, Bar: any, XAxis: any, YAxis: any, Tooltip: any, ResponsiveContainer: any, PieChart: any, Pie: any, Cell: any
try {
  const rc = require('recharts')
  ;({ BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } = rc)
} catch {}

const COLORS = ['#c9a84c','#3498db','#2ecc71','#e74c3c','#9b59b6','#1abc9c','#e67e22','#f39c12']

export default function WatchStatsPage() {
  const [period, setPeriod] = useState<'week'|'month'|'year'>('month')

  const { data, isLoading } = useQuery({
    queryKey: ['watch-stats', period],
    queryFn: () => api.get<any>(`/api/stats/watch?period=${period}`),
    staleTime: 10 * 60_000,
  })

  const s = data as any

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Watch Stats</h1>
        <div className="flex gap-2">
          {(['week','month','year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
              style={{ background: period === p ? 'var(--accent)' : 'var(--subtle)', color: period === p ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${period === p ? 'transparent' : 'var(--border2)'}` }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>}

      {s && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Hours watched', s.hoursWatched?.toFixed(1) || '0', '⏱'],
              ['Films finished', s.moviesWatched || '0', '🎬'],
              ['Episodes watched', s.episodesWatched || '0', '📺'],
            ].map(([label, val, icon]) => (
              <div key={label} className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                <p style={{ fontSize: 24 }}>{icon}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent)' }}>{val}</p>
                <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          {BarChart && s.byDay?.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)', opacity: 0.4 }}>Hours per day</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={s.byDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="hours" fill="#c9a84c" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Genre pie */}
          {PieChart && s.byGenre?.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)', opacity: 0.4 }}>By genre</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <PieChart width={120} height={120}>
                  <Pie data={s.byGenre} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="count" paddingAngle={2}>
                    {s.byGenre.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
                <div className="space-y-1.5 flex-1">
                  {s.byGenre.slice(0, 6).map((g: any, i: number) => (
                    <div key={g.genre} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <p className="text-[10px] flex-1 truncate" style={{ color: 'var(--muted)' }}>{g.genre}</p>
                      <p className="text-[10px] font-bold" style={{ color: 'var(--cream)' }}>{g.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top actors */}
          {s.topActors?.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }}>Most watched actors</p>
              <div className="space-y-2">
                {s.topActors.slice(0, 8).map((a: any, i: number) => (
                  <div key={a.name} className="flex items-center gap-3">
                    <p className="text-[9px] font-bold w-4" style={{ color: 'var(--muted)', opacity: 0.3 }}>{i+1}</p>
                    <div className="flex-1"><div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}><div style={{ width: `${(a.count / s.topActors[0].count) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} /></div></div>
                    <p className="text-[10px] w-28 truncate text-right" style={{ color: 'var(--cream)' }}>{a.name}</p>
                    <p className="text-[9px] w-6 text-right" style={{ color: 'var(--muted)', opacity: 0.4 }}>{a.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
