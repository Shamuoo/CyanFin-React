import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import api from '@/lib/api'

function Card({ title, children, fullWidth }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={`rounded-xl p-5 ${fullWidth ? 'col-span-full' : ''}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)' }}>
      <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value?: string | number | null; color?: string }) {
  return (
    <div className="flex justify-between items-center mb-2">
      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-[10px] font-bold font-mono" style={{ color: color || 'rgba(240,232,213,0.65)' }}>{value ?? '—'}</span>
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 rounded-full mt-1 mb-3" style={{ background: 'var(--border2)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

function fmtUptime(s?: number) {
  if (!s) return '—'
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

export default function HealthPage() {
  const { data: health, refetch: refetchHealth, isFetching: fetchingHealth } = useQuery({
    queryKey: ['health'], queryFn: api.health.bind(api), staleTime: 30_000,
  })
  const { data: sys, refetch: refetchSys } = useQuery({
    queryKey: ['system-stats'], queryFn: api.systemStats.bind(api), staleTime: 30_000,
  })
  const { data: intCfg } = useQuery({
    queryKey: ['integrations-config'], queryFn: api.integrationsConfig.bind(api),
  })

  const h = health as any
  const s = sys as any

  const latency = h?.latency ?? 0
  const latencyColor = latency < 50 ? '#2ecc71' : latency < 200 ? '#f39c12' : '#e74c3c'
  const cpuColor = (s?.cpuPercent ?? 0) > 80 ? '#e74c3c' : (s?.cpuPercent ?? 0) > 50 ? '#f39c12' : '#2ecc71'
  const ramColor = (s?.ramPercent ?? 0) > 85 ? '#e74c3c' : (s?.ramPercent ?? 0) > 60 ? '#f39c12' : '#2ecc71'

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '24px var(--pad) 48px' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Health</h1>
          <button onClick={() => { refetchHealth(); refetchSys() }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <RefreshCw size={12} className={fetchingHealth ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CyanFin */}
          <Card title="CyanFin">
            <Row label="Version" value={h?.cyanFinVersion ? `v${h.cyanFinVersion}` : 'v0.11.1'} />
            {h?.github && <Row label="Latest Release" value={h.github.latestRelease} color={h.github.isLatest ? '#2ecc71' : '#f39c12'} />}
            {h?.github && !h.github.isLatest && <Row label="Update Available" value="↗ GitHub" color="#f39c12" />}
          </Card>

          {/* Connection */}
          <Card title="Connection">
            <Row label="Latency" value={`${latency}ms`} color={latencyColor} />
            <Bar pct={(latency / 500) * 100} color={latencyColor} />
            <Row label="Server" value={h?.serverName} />
            <Row label="Version" value={h?.version} />
            <Row label="OS" value={h?.os} />
            <Row label="Local Address" value={h?.localAddress} />
          </Card>

          {/* Sessions */}
          <Card title="Sessions">
            <Row label="Active" value={h?.activeSessions} color={h?.activeSessions > 0 ? '#2ecc71' : undefined} />
            <Row label="Connected" value={h?.totalSessions} />
            <Row label="Transcoding" value={h?.transcoding} color={h?.transcoding > 0 ? '#f39c12' : '#2ecc71'} />
            {(h?.nowPlaying || []).map((s: any) => (
              <div key={s.user} className="mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
                <p className="text-[9px] mb-0.5" style={{ color: 'var(--accent)', opacity: 0.6 }}>{s.user} · {s.device}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{s.title}</p>
                <div className="h-0.5 rounded mt-1" style={{ background: 'var(--border2)' }}>
                  <div style={{ width: `${s.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </Card>

          {/* CPU */}
          {s?.cpuPercent !== undefined && (
            <Card title={`CPU${s.cpuModel ? ` · ${s.cpuCores}c` : ''}`}>
              <Row label="Usage" value={`${s.cpuPercent}%`} color={cpuColor} />
              <Bar pct={s.cpuPercent} color={cpuColor} />
              <Row label="Load 1m / 5m" value={`${s.load1} / ${s.load5}`} />
              <Row label="Uptime" value={fmtUptime(s.uptimeSeconds)} />
              {s.cpuModel && <Row label="Model" value={s.cpuModel.substring(0, 30)} />}
            </Card>
          )}

          {/* RAM */}
          {s?.ramPercent !== undefined && (
            <Card title="Memory">
              <Row label="Used / Total" value={`${s.ramUsed} / ${s.ramTotal} MB`} color={ramColor} />
              <Bar pct={s.ramPercent} color={ramColor} />
              <Row label="Usage" value={`${s.ramPercent}%`} color={ramColor} />
            </Card>
          )}

          {/* Disks */}
          {s?.disks && s.disks.length > 0 && (
            <Card title="Storage">
              {s.disks.map((d: any) => {
                const pct = parseInt(d.percent) || 0
                const col = pct > 90 ? '#e74c3c' : pct > 75 ? '#f39c12' : '#2ecc71'
                return (
                  <div key={d.mount} className="mb-3">
                    <p className="text-[8px] mb-1" style={{ color: 'var(--muted)' }}>{d.mount}</p>
                    <Row label={`${d.used} / ${d.size}`} value={d.percent} color={col} />
                    <Bar pct={pct} color={col} />
                  </div>
                )
              })}
            </Card>
          )}

          {/* Libraries */}
          {h?.libraries && h.libraries.length > 0 && (
            <Card title="Libraries" fullWidth>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {h.libraries.map((l: any) => (
                  <div key={l.name} className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
                    <p className="text-[8px] mb-1" style={{ color: 'var(--accent)', opacity: 0.5 }}>{l.type || 'media'}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{l.name}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Integrations */}
          {intCfg && (
            <Card title="Integrations">
              {[
                ['Jellyseerr', intCfg.jellyseerr], ['Radarr', intCfg.radarr],
                ['Sonarr', intCfg.sonarr], ['Discord', intCfg.discord],
                ['Anthropic AI', intCfg.anthropic], ['TMDB', intCfg.tmdb],
              ].map(([name, active]) => (
                <Row key={String(name)} label={String(name)} value={active ? '✓ Connected' : '✗ Not set'} color={active ? '#2ecc71' : 'rgba(240,232,213,0.25)'} />
              ))}
            </Card>
          )}

          {/* Plugins */}
          {h?.plugins && h.plugins.length > 0 && (
            <Card title={`Plugins (${h.plugins.length})`}>
              {h.plugins.map((p: any) => <Row key={p.name} label={p.name} value={p.version} />)}
            </Card>
          )}
        </div>

        {/* Activity log */}
        {h?.recentActivity && h.recentActivity.length > 0 && (
          <div className="mt-4">
            <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>Recent Activity</p>
            <div className="space-y-2">
              {h.recentActivity.map((a: any, i: number) => {
                const col = a.severity === 'Error' ? '#e74c3c' : a.severity === 'Warning' ? '#f39c12' : 'var(--muted)'
                return (
                  <div key={i} className="flex justify-between items-start gap-4 py-2" style={{ borderBottom: '1px solid var(--border2)' }}>
                    <span className="text-[10px] flex-1" style={{ color: col }}>{a.name}</span>
                    <span className="text-[9px] font-mono flex-shrink-0" style={{ color: 'rgba(240,232,213,0.25)' }}>
                      {a.date ? new Date(a.date).toLocaleString() : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
