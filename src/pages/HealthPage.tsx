import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Server, Tv, Loader, Database, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--accent)', opacity: 0.5 }}>{children}</p>
}

function Card({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-full' : ''} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 12, padding: 20 }}>
      {children}
    </div>
  )
}

function MetaRow({ label, value, color }: { label: string; value?: string | number | null; color?: string }) {
  if (value == null) return null
  return (
    <div className="flex justify-between items-center mb-2">
      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-[10px] font-bold font-mono" style={{ color: color || 'rgba(240,232,213,0.65)' }}>{value}</span>
    </div>
  )
}

function UsageBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 rounded-full mb-3 mt-1" style={{ background: 'var(--border2)' }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

function latencyColor(ms?: number | null) {
  if (!ms) return '#666'
  return ms < 50 ? '#2ecc71' : ms < 200 ? '#f39c12' : '#e74c3c'
}

function usageColor(pct: number) {
  return pct > 85 ? '#e74c3c' : pct > 60 ? '#f39c12' : '#2ecc71'
}

function fmtUptime(s?: number) {
  if (!s) return null
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

// ── Server Card ───────────────────────────────────────────────────────────────

function ServerCard({ srv, isActive, onSwitch, switching }: {
  srv: any; isActive: boolean; onSwitch: () => void; switching: boolean
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: isActive ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}`, transition: 'all 0.2s' }}>

      {/* Header */}
      <div className="flex items-center gap-2">
        {srv.type === 'plex'
          ? <Tv size={14} style={{ color: '#e5a00d', flexShrink: 0 }} />
          : <Server size={14} style={{ color: isActive ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }} />
        }
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: srv.ok ? '#2ecc71' : '#e74c3c' }} />
        <span className="text-xs font-bold flex-1 truncate" style={{ color: isActive ? 'var(--accent)' : 'var(--cream)' }}>{srv.label}</span>
        {isActive && <CheckCircle size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
      </div>

      {/* URL */}
      <p className="text-[9px] truncate" style={{ color: 'var(--muted)', opacity: 0.4 }}>{srv.url}</p>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono font-bold" style={{ color: srv.ok ? latencyColor(srv.latency) : '#e74c3c' }}>
          {srv.ok ? `${srv.latency}ms` : 'Offline'}
        </span>
        {srv.name && <span className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>{srv.name}</span>}
        {srv.version && <span className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.3 }}>v{srv.version}</span>}
      </div>

      {/* Switch button */}
      {!isActive && (
        <button onClick={onSwitch} disabled={switching}
          className="w-full py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-40 mt-1"
          style={{ background: srv.type === 'plex' ? '#e5a00d' : 'var(--accent)', color: srv.type === 'plex' ? '#000' : 'var(--bg)' }}>
          {switching ? '…' : `Use ${srv.type === 'plex' ? 'Plex' : 'This'}`}
        </button>
      )}
      {isActive && (
        <div className="w-full py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide text-center"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
          Active Source
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const qc = useQueryClient()
  const [switching, setSwitching] = useState(false)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [refreshMsg, setRefreshMsg] = useState('')

  const { data: health, refetch: refetchHealth, isFetching } = useQuery({
    queryKey: ['health'], queryFn: api.health.bind(api), staleTime: 30_000,
  })
  const { data: sys, refetch: refetchSys } = useQuery({
    queryKey: ['system-stats'], queryFn: api.systemStats.bind(api), staleTime: 30_000,
  })
  const { data: intCfg } = useQuery({
    queryKey: ['integrations-config'], queryFn: api.integrationsConfig.bind(api),
  })
  const { data: sync, refetch: refetchSync } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.syncStatus(),
    staleTime: 5 * 60_000,
  })

  const [speedTesting, setSpeedTesting] = useState(false)
  const { data: adminSess } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => api.adminSessions(),
    refetchInterval: 15_000, staleTime: 10_000,
  })

  const { data: allServers, refetch: refetchAll } = useQuery({
    queryKey: ['all-servers'],
    queryFn: () => api.get<any>('/api/servers/all'),
    staleTime: 30_000,
  })

  const runSpeedTest = async () => {
    setSpeedTesting(true)
    await api.get('/api/servers/speedtest').then(r => {
      qc.setQueryData(['all-servers'], r)
    }).catch(() => {})
    setSpeedTesting(false)
  }

  const { data: ss, refetch: refetchServers } = useQuery({
    queryKey: ['servers-status'], queryFn: api.serversStatus.bind(api), refetchInterval: 30_000,
  })

  const h  = health as any
  const s  = sys as any
  const st = ss as any

  const refreshAll = () => { refetchHealth(); refetchSys(); refetchSync(); refetchAll(); api.serversCheck().then(() => refetchServers()) }

  const switchTo = async (server: 'primary' | 'backup' | 'plex') => {
    setSwitching(true)
    await api.serversSwitch(server as any).catch(() => {})
    await refetchServers()
    toast.info(`Switched to ${server}`)
    qc.invalidateQueries({ queryKey: ['recently-added'] })
    qc.invalidateQueries({ queryKey: ['popular'] })
    setSwitching(false)
  }

  const doRefresh = async (type: string) => {
    setRefreshing(type); setRefreshMsg('')
    try {
      const r: any = type === 'scan' ? await api.libScan()
        : type === 'meta'   ? await (api as any).libRefreshAllMeta()
        : await (api as any).libRefreshAllImages()
      toast.success(r?.message || 'Triggered')
    setRefreshMsg(r?.message || 'Triggered — this may take a while')
    } catch(e: any) { toast.error(e.message || 'Failed'); setRefreshMsg(e.message || 'Failed') }
    setRefreshing(null)
    setTimeout(() => setRefreshMsg(''), 6000)
  }

  // Build server list from status
  const activeSource = st?.source || 'jellyfin'
  const activeServer = st?.active || 'primary'

  const servers = [
    st?.primary && {
      key: 'primary', type: 'jf', label: 'Jellyfin Primary',
      url: st.primary.url, ok: st.primary.ok, latency: st.primary.latency,
      name: st.primary.name, version: st.primary.version,
      isActive: activeSource === 'jellyfin' && activeServer === 'primary',
    },
    st?.backup && {
      key: 'backup', type: 'jf', label: 'Jellyfin Backup',
      url: st.backup.url, ok: st.backup.ok, latency: st.backup.latency,
      name: st.backup.name, version: st.backup.version,
      isActive: activeSource === 'jellyfin' && activeServer === 'backup',
    },
    st?.plex && {
      key: 'plex', type: 'plex', label: 'Plex',
      url: st.plex.url, ok: st.plex.ok, latency: st.plex.latency,
      name: null, version: null,
      isActive: activeSource === 'plex',
    },
  ].filter(Boolean) as any[]

  const cpuPct = s?.cpuPercent ?? 0
  const ramPct = s?.ramPercent ?? 0

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '24px var(--pad) 48px' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Health</h1>
          <button onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh All
          </button>
        </div>

        {/* Active source banner */}
        {activeSource === 'plex' && (
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{ background: 'rgba(229,160,13,0.12)', border: '1px solid rgba(229,160,13,0.3)' }}>
            <Tv size={16} style={{ color: '#e5a00d' }} />
            <div>
              <p className="text-xs font-bold" style={{ color: '#e5a00d' }}>Plex Fallback Active</p>
              <p className="text-[9px]" style={{ color: 'rgba(229,160,13,0.6)' }}>Jellyfin unreachable — serving content from Plex</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* ── Servers ── */}
          {servers.length > 0 && (
            <Card fullWidth>
              <SectionTitle>Media Servers — {st?.mode || 'fastest'} failover mode</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                {servers.map(srv => (
                  <ServerCard key={srv.key} srv={srv} isActive={srv.isActive}
                    onSwitch={() => switchTo(srv.key)} switching={switching} />
                ))}
              </div>
              <p className="text-[8px] mt-2" style={{ color: 'var(--muted)', opacity: 0.3 }}>
                Auto-failover checks every 30s. Jellyfin → Backup Jellyfin → Plex.
              </p>
            </Card>
          )}

          {/* ── Library Actions ── */}
          <Card fullWidth>
            <SectionTitle>Library Actions — {servers.find((s:any) => s.isActive)?.label || 'Active Server'}</SectionTitle>
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                { key: 'scan',   label: 'Scan Libraries' },
                { key: 'meta',   label: 'Refresh All Metadata' },
                { key: 'images', label: 'Refresh All Images' },
              ].map(btn => (
                <button key={btn.key} onClick={() => doRefresh(btn.key)} disabled={!!refreshing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  {refreshing === btn.key ? <Loader size={11} className="animate-spin" /> : <Database size={11} />}
                  {btn.label}
                </button>
              ))}
            </div>
            {refreshMsg && <p className="text-[10px] mt-1" style={{ color: '#2ecc71' }}>{refreshMsg}</p>}
          </Card>

          {/* ── CyanFin ── */}
          <Card>
            <SectionTitle>CyanFin</SectionTitle>
            <MetaRow label="Version" value={h?.cyanFinVersion ? `v${h.cyanFinVersion}` : 'v0.14.0'} />
            {h?.github && <MetaRow label="Latest" value={h.github.latestRelease} color={h.github.isLatest ? '#2ecc71' : '#f39c12'} />}
            {h?.github && !h.github.isLatest && <MetaRow label="" value="↗ Update available" color="#f39c12" />}
          </Card>

          {/* ── Jellyfin Connection ── */}
          <Card>
            <SectionTitle>Jellyfin</SectionTitle>
            <MetaRow label="Server" value={h?.serverName} />
            <MetaRow label="Version" value={h?.version} />
            <MetaRow label="OS" value={h?.os} />
            <MetaRow label="Latency" value={h?.latency != null ? `${h.latency}ms` : null} color={latencyColor(h?.latency)} />
          </Card>

          {/* ── Sessions ── */}
          <Card>
            <SectionTitle>Sessions</SectionTitle>
            <MetaRow label="Active" value={h?.activeSessions} color={(h?.activeSessions || 0) > 0 ? '#2ecc71' : undefined} />
            <MetaRow label="Total Connected" value={h?.totalSessions} />
            <MetaRow label="Transcoding" value={h?.transcoding} color={(h?.transcoding || 0) > 0 ? '#f39c12' : '#2ecc71'} />
            {(h?.nowPlaying || []).map((sp: any, i: number) => (
              <div key={i} className="mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
                <p className="text-[9px]" style={{ color: 'var(--accent)', opacity: 0.6 }}>{sp.user} · {sp.device}</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--muted)' }}>{sp.title}</p>
                <div className="h-0.5 rounded mt-1.5" style={{ background: 'var(--border2)' }}>
                  <div style={{ width: `${sp.progress || 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </Card>

          {/* ── CPU ── */}
          {s?.cpuPercent !== undefined && (
            <Card>
              <SectionTitle>CPU {s.cpuCores ? `· ${s.cpuCores} cores` : ''}</SectionTitle>
              <MetaRow label="Usage" value={`${cpuPct}%`} color={usageColor(cpuPct)} />
              <UsageBar pct={cpuPct} color={usageColor(cpuPct)} />
              <MetaRow label="Load 1m / 5m" value={`${s.load1 ?? '—'} / ${s.load5 ?? '—'}`} />
              <MetaRow label="Uptime" value={fmtUptime(s.uptimeSeconds)} />
            </Card>
          )}

          {/* ── RAM ── */}
          {s?.ramPercent !== undefined && (
            <Card>
              <SectionTitle>Memory</SectionTitle>
              <MetaRow label="Used / Total" value={`${s.ramUsed} / ${s.ramTotal} MB`} color={usageColor(ramPct)} />
              <UsageBar pct={ramPct} color={usageColor(ramPct)} />
            </Card>
          )}

          {/* ── Disks ── */}
          {s?.disks?.length > 0 && (
            <Card>
              <SectionTitle>Storage</SectionTitle>
              {s.disks.map((d: any) => {
                const pct = parseInt(d.percent) || 0
                const col = usageColor(pct > 90 ? 100 : pct)
                return (
                  <div key={d.mount} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px]" style={{ color: 'var(--muted)' }}>{d.mount}</span>
                      <span className="text-[9px] font-mono" style={{ color: col }}>{d.percent}</span>
                    </div>
                    <UsageBar pct={pct} color={col} />
                    <p className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.3 }}>{d.used} used of {d.size}</p>
                  </div>
                )
              })}
            </Card>
          )}

          {/* ── Libraries ── */}
          {h?.libraries?.length > 0 && (
            <Card>
              <SectionTitle>Libraries</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5">
                {h.libraries.map((l: any) => (
                  <div key={l.name} className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
                    <p className="text-[8px]" style={{ color: 'var(--accent)', opacity: 0.4 }}>{l.type || 'media'}</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{l.name}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Integrations ── */}
          {intCfg && (
            <Card>
              <SectionTitle>Integrations</SectionTitle>
              {[
                ['Jellyseerr', (intCfg as any).jellyseerr],
                ['Radarr',     (intCfg as any).radarr],
                ['Sonarr',     (intCfg as any).sonarr],
                ['Discord',    (intCfg as any).discord],
                ['Anthropic',  (intCfg as any).anthropic],
                ['TMDB',       (intCfg as any).tmdb],
                ['Plex',       st?.plex?.ok],
              ].map(([name, ok]) => (
                <MetaRow key={String(name)} label={String(name)} value={ok ? '✓ Connected' : '—'} color={ok ? '#2ecc71' : 'rgba(255,255,255,0.15)'} />
              ))}
            </Card>
          )}

          {/* ── Plugins ── */}
          {h?.plugins?.length > 0 && (
            <Card>
              <SectionTitle>Plugins ({h.plugins.length})</SectionTitle>
              {h.plugins.map((p: any) => <MetaRow key={p.name} label={p.name} value={p.version} />)}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
