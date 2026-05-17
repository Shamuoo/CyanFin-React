import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Server, Tv, Loader, Database } from 'lucide-react'
import api from '@/lib/api'

function Card({ title, children, fullWidth, action }: { title: string; children: React.ReactNode; fullWidth?: boolean; action?: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-5 ${fullWidth ? 'col-span-full' : ''}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--accent)', opacity: 0.5 }}>{title}</p>
        {action}
      </div>
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

function StatusDot({ ok }: { ok?: boolean }) {
  return <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ background: ok === true ? '#2ecc71' : ok === false ? '#e74c3c' : '#666' }} />
}

function fmtUptime(s?: number) {
  if (!s) return '—'
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

export default function HealthPage() {
  const qc = useQueryClient()
  const [switching, setSwitching] = useState(false)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [refreshMsg, setRefreshMsg] = useState('')

  const { data: health, refetch: refetchHealth, isFetching: fetchingHealth } = useQuery({
    queryKey: ['health'], queryFn: api.health.bind(api), staleTime: 30_000,
  })
  const { data: sys, refetch: refetchSys } = useQuery({
    queryKey: ['system-stats'], queryFn: api.systemStats.bind(api), staleTime: 30_000,
  })
  const { data: intCfg } = useQuery({
    queryKey: ['integrations-config'], queryFn: api.integrationsConfig.bind(api),
  })
  const { data: serverStatus, refetch: refetchServers } = useQuery({
    queryKey: ['servers-status'], queryFn: api.serversStatus.bind(api), refetchInterval: 30_000,
  })

  const h = health as any
  const s = sys as any
  const ss = serverStatus as any

  const latency = h?.latency ?? 0
  const latencyColor = latency < 50 ? '#2ecc71' : latency < 200 ? '#f39c12' : '#e74c3c'
  const cpuColor = (s?.cpuPercent ?? 0) > 80 ? '#e74c3c' : (s?.cpuPercent ?? 0) > 50 ? '#f39c12' : '#2ecc71'
  const ramColor = (s?.ramPercent ?? 0) > 85 ? '#e74c3c' : (s?.ramPercent ?? 0) > 60 ? '#f39c12' : '#2ecc71'

  const switchServer = async (server: 'primary' | 'backup' | 'plex') => {
    setSwitching(true)
    await api.serversSwitch(server as 'primary' | 'backup')
    await refetchServers()
    qc.invalidateQueries({ queryKey: ['health'] })
    setSwitching(false)
  }

  const doRefresh = async (type: string) => {
    setRefreshing(type); setRefreshMsg('')
    try {
      let r: any
      if (type === 'scan')   r = await api.libScan()
      else if (type === 'meta')   r = await (api as any).libRefreshAllMeta()
      else if (type === 'images') r = await (api as any).libRefreshAllImages()
      setRefreshMsg(r?.message || 'Triggered')
    } catch(e: any) { setRefreshMsg(e.message) }
    setRefreshing(null)
    setTimeout(() => setRefreshMsg(''), 5000)
  }

  const servers = [
    ss?.primary && { key: 'primary', label: 'Jellyfin (Primary)', type: 'jf', ...ss.primary, isActive: ss?.source === 'jellyfin' && ss?.active === 'primary' },
    ss?.backup  && { key: 'backup',  label: 'Jellyfin (Backup)',  type: 'jf', ...ss.backup,  isActive: ss?.source === 'jellyfin' && ss?.active === 'backup' },
    ss?.plex    && { key: 'plex',    label: 'Plex',               type: 'px', ...ss.plex,    isActive: ss?.source === 'plex' },
  ].filter(Boolean) as any[]

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '24px var(--pad) 48px' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Health</h1>
          <button onClick={() => { refetchHealth(); refetchSys(); api.serversCheck().then(() => refetchServers()) }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <RefreshCw size={12} className={fetchingHealth ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Servers */}
          {servers.length > 0 && (
            <Card title={`Servers — ${ss?.source === 'plex' ? '🟠 PLEX FALLBACK' : ss?.mode || 'fastest'} mode`} fullWidth>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {servers.map((srv: any) => (
                  <div key={srv.key} className="rounded-xl p-4"
                    style={{ background: srv.isActive ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${srv.isActive ? 'var(--accent)' : 'var(--border2)'}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      {srv.type === 'px'
                        ? <Tv size={13} style={{ color: '#e5a00d' }} />
                        : <Server size={13} style={{ color: srv.isActive ? 'var(--accent)' : 'var(--muted)' }} />}
                      <StatusDot ok={srv.ok} />
                      <span className="text-xs font-bold flex-1 truncate" style={{ color: srv.isActive ? 'var(--accent)' : 'var(--cream)' }}>{srv.label}</span>
                      {srv.isActive && <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--accent)' }}>Active</span>}
                    </div>
                    <p className="text-[9px] truncate mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>{srv.url}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold" style={{ color: srv.ok ? '#2ecc71' : '#e74c3c' }}>
                        {srv.ok ? `${srv.latency}ms` : 'Unreachable'}
                      </span>
                      {!srv.isActive && (
                        <button onClick={() => switchServer(srv.key as 'primary' | 'backup' | 'plex')} disabled={switching || !srv.ok}
                          className="text-[8px] px-2.5 py-1 rounded-full font-bold uppercase transition-all hover:opacity-80 disabled:opacity-30"
                          style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                          {switching ? '…' : 'Use This'}
                        </button>
                      )}
                    </div>
                    {(srv.name || srv.version) && (
                      <p className="text-[8px] mt-1.5" style={{ color: 'var(--muted)', opacity: 0.35 }}>
                        {srv.name}{srv.version ? ` v${srv.version}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Library Actions */}
          <Card title="Library Actions" fullWidth>
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                { key: 'scan',   label: 'Scan Libraries' },
                { key: 'meta',   label: 'Refresh All Metadata' },
                { key: 'images', label: 'Refresh All Images' },
              ].map(btn => (
                <button key={btn.key} onClick={() => doRefresh(btn.key)} disabled={!!refreshing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  {refreshing === btn.key
                    ? <Loader size={11} className="animate-spin" />
                    : <Database size={11} />}
                  {btn.label}
                </button>
              ))}
            </div>
            {refreshMsg && <p className="text-[10px] mt-2" style={{ color: '#2ecc71' }}>{refreshMsg}</p>}
          </Card>

          {/* CyanFin */}
          <Card title="CyanFin">
            <Row label="Version" value={h?.cyanFinVersion ? `v${h.cyanFinVersion}` : 'v0.14.0'} />
            {h?.github && <Row label="Latest Release" value={h.github.latestRelease} color={h.github.isLatest ? '#2ecc71' : '#f39c12'} />}
            {h?.github && !h.github.isLatest && <Row label="Update Available" value="↗ GitHub" color="#f39c12" />}
          </Card>

          {/* Connection */}
          <Card title="Jellyfin Connection">
            <Row label="Latency" value={`${latency}ms`} color={latencyColor} />
            <Bar pct={(latency / 500) * 100} color={latencyColor} />
            <Row label="Server" value={h?.serverName} />
            <Row label="Version" value={h?.version} />
            <Row label="OS" value={h?.os} />
          </Card>

          {/* Sessions */}
          <Card title="Sessions">
            <Row label="Active" value={h?.activeSessions} color={h?.activeSessions > 0 ? '#2ecc71' : undefined} />
            <Row label="Connected" value={h?.totalSessions} />
            <Row label="Transcoding" value={h?.transcoding} color={h?.transcoding > 0 ? '#f39c12' : '#2ecc71'} />
            {(h?.nowPlaying || []).map((sp: any) => (
              <div key={sp.user} className="mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
                <p className="text-[9px] mb-0.5" style={{ color: 'var(--accent)', opacity: 0.6 }}>{sp.user} · {sp.device}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{sp.title}</p>
                <div className="h-0.5 rounded mt-1" style={{ background: 'var(--border2)' }}>
                  <div style={{ width: `${sp.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </Card>

          {/* CPU */}
          {s?.cpuPercent !== undefined && (
            <Card title={`CPU${s.cpuCores ? ` · ${s.cpuCores} cores` : ''}`}>
              <Row label="Usage" value={`${s.cpuPercent}%`} color={cpuColor} />
              <Bar pct={s.cpuPercent} color={cpuColor} />
              <Row label="Load 1m / 5m" value={`${s.load1} / ${s.load5}`} />
              <Row label="Uptime" value={fmtUptime(s.uptimeSeconds)} />
            </Card>
          )}

          {/* RAM */}
          {s?.ramPercent !== undefined && (
            <Card title="Memory">
              <Row label="Used / Total" value={`${s.ramUsed} / ${s.ramTotal} MB`} color={ramColor} />
              <Bar pct={s.ramPercent} color={ramColor} />
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
                ['Jellyseerr', (intCfg as any).jellyseerr], ['Radarr', (intCfg as any).radarr],
                ['Sonarr', (intCfg as any).sonarr], ['Discord', (intCfg as any).discord],
                ['Anthropic', (intCfg as any).anthropic], ['TMDB', (intCfg as any).tmdb],
                ['Plex', ss?.plex?.ok],
              ].map(([name, active]) => (
                <Row key={String(name)} label={String(name)} value={active ? '✓' : '—'} color={active ? '#2ecc71' : 'rgba(240,232,213,0.2)'} />
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
      </div>
    </div>
  )
}
