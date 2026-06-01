import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server, Zap, RefreshCw, Plus, Trash2, Shield,
  Activity, Wifi, WifiOff, Settings, ChevronDown,
  ArrowUpDown, CheckCircle, XCircle, Clock, Database,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ServerEntry {
  id: string; name: string; url: string; apiKey?: string; token?: string
  priority: number; enabled: boolean
  ok?: boolean; latency?: number; speedMbps?: number; version?: string
  serverName?: string; isActive?: boolean; consecutiveFails?: number; lastCheck?: number
}
interface HAStatus {
  jellyfin: ServerEntry[]; plex: ServerEntry[]
  activeJfId: string; mode: string; isOffline: boolean
  lastCheck: number; uptime: number
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length < 2) return null
  const max = Math.max(...points, 1)
  const W = 64, H = 20
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * W},${H - (v / max) * H}`).join(' ')
  const color = points[points.length - 1] < 50 ? '#2ecc71' : points[points.length - 1] < 150 ? '#f39c12' : '#e74c3c'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity={0.7} />
    </svg>
  )
}

function StatusDot({ ok, size = 8 }: { ok?: boolean; size?: number }) {
  return (
    <span className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
        style={{ background: '#2ecc71' }} />}
      <span className="relative inline-flex rounded-full"
        style={{ width: size, height: size, background: ok ? '#2ecc71' : ok === false ? '#e74c3c' : '#888' }} />
    </span>
  )
}

function LatencyBar({ ms }: { ms?: number | null }) {
  if (!ms) return <span style={{ color: 'var(--muted)', fontSize: 10 }}>—</span>
  const color = ms < 30 ? '#2ecc71' : ms < 100 ? '#f39c12' : '#e74c3c'
  const pct   = Math.min(100, (ms / 300) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-full overflow-hidden" style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ color, fontSize: 10, fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>{ms}ms</span>
    </div>
  )
}

function SpeedBadge({ mbps }: { mbps?: number | null }) {
  if (mbps == null) return <span style={{ color: 'var(--muted)', fontSize: 10 }}>—</span>
  const color = mbps > 10 ? '#2ecc71' : mbps > 2 ? '#f39c12' : '#e74c3c'
  return <span style={{ color, fontSize: 11, fontWeight: 700 }}>{mbps > 0 ? `${mbps} Mbps` : '—'}</span>
}

function ServerCard({
  server, type, isActive, onForce, onRemove, onSpeedTest, onToggle,
}: {
  server: ServerEntry; type: 'jellyfin' | 'plex'; isActive: boolean
  onForce: () => void; onRemove: () => void; onSpeedTest: () => void; onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [testing, setTesting] = useState(false)

  const handleSpeedTest = async () => {
    setTesting(true)
    await onSpeedTest()
    setTesting(false)
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: isActive ? 'rgba(201,168,76,0.06)' : 'var(--bg2)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}` }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <StatusDot ok={server.ok} size={10} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{server.name}</p>
            {isActive && (
              <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Active</span>
            )}
            {!server.enabled && (
              <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>Disabled</span>
            )}
          </div>
          <p className="text-[9px] truncate mt-0.5" style={{ color: 'var(--muted)', opacity: 0.5 }}>{server.url}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <LatencyBar ms={server.latency} />
          <Sparkline points={(server as any).latencyHistory || []} />
        </div>
        <button onClick={() => setExpanded(e => !e)} className="p-1 hover:opacity-70 ml-1">
          <ChevronDown size={14} style={{ color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* Speed bar */}
      {server.speedMbps != null && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <Zap size={10} style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <SpeedBadge mbps={server.speedMbps} />
          {server.version && <span className="text-[9px] ml-auto" style={{ color: 'var(--muted)', opacity: 0.35 }}>v{server.version}</span>}
        </div>
      )}

      {/* Expanded details + actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}>
            <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border2)' }}>
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  ['Latency', server.latency ? `${server.latency}ms` : '—'],
                  ['Speed',   server.speedMbps != null ? `${server.speedMbps} Mbps` : '—'],
                  ['Fails',   String(server.consecutiveFails || 0)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl p-2 text-center" style={{ background: 'var(--bg3)' }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>{v}</p>
                    <p className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--muted)', opacity: 0.4 }}>{l}</p>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {type === 'jellyfin' && !isActive && server.ok && (
                  <button onClick={onForce}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                    <CheckCircle size={10} /> Set Active
                  </button>
                )}
                <button onClick={handleSpeedTest} disabled={!server.ok || testing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80 disabled:opacity-30"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  {testing ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                  {testing ? 'Testing…' : 'Speed Test'}
                </button>
                <button onClick={onToggle}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  {server.enabled ? <WifiOff size={10} /> : <Wifi size={10} />}
                  {server.enabled ? 'Disable' : 'Enable'}
                </button>
                {!isActive && (
                  <button onClick={onRemove}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80 ml-auto"
                    style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', color: '#e74c3c' }}>
                    <Trash2 size={10} /> Remove
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AddServerModal({ type, onClose, onAdd }: { type: 'jellyfin' | 'plex'; onClose: () => void; onAdd: (s: any) => void }) {
  const [form, setForm] = useState({ name: '', url: '', apiKey: '', token: '' })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const test = async () => {
    if (!form.url) return
    setTesting(true)
    const r = await api.post<any>('/api/servers/ping', {
      url: form.url, apiKey: form.apiKey || undefined, token: form.token || undefined,
    }).catch(() => null)
    setTestResult(r)
    setTesting(false)
  }

  const add = () => {
    if (!form.url) return
    onAdd({ ...form, id: `${type}-${Date.now()}`, priority: 99, enabled: true })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border2)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Add {type === 'jellyfin' ? 'Jellyfin' : 'Plex'} Server</p>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}>✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {(['name', 'url', type === 'jellyfin' ? 'apiKey' : 'token'] as const).map(field => (
            <div key={field}>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                {field === 'apiKey' ? 'API Key' : field === 'token' ? 'Plex Token' : field.charAt(0).toUpperCase() + field.slice(1)}
              </p>
              <input value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={field === 'url' ? 'http://192.168.1.100:8096' : ''}
                type={field === 'apiKey' || field === 'token' ? 'password' : 'text'}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
            </div>
          ))}

          {/* Test result */}
          {testResult && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: testResult.ok ? 'rgba(46,204,113,0.08)' : 'rgba(231,76,60,0.08)' }}>
              {testResult.ok ? <CheckCircle size={12} color="#2ecc71" /> : <XCircle size={12} color="#e74c3c" />}
              <span className="text-[10px]" style={{ color: testResult.ok ? '#2ecc71' : '#e74c3c' }}>
                {testResult.ok ? `Online · ${testResult.latency}ms${testResult.speedMbps ? ` · ${testResult.speedMbps} Mbps` : ''}` : 'Unreachable'}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={test} disabled={!form.url || testing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold disabled:opacity-30"
            style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            {testing ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />} Test
          </button>
          <button onClick={add} disabled={!form.url}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold disabled:opacity-30"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <Plus size={11} /> Add Server
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServersPage() {
  const qc = useQueryClient()
  const [addModal, setAddModal] = useState<'jellyfin' | 'plex' | null>(null)
  const [checking, setChecking] = useState(false)
  const [speedTesting, setSpeedTesting] = useState(false)

  const { data, isLoading } = useQuery<HAStatus>({
    queryKey: ['ha-status'],
    queryFn: () => api.get('/api/servers/status'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const status = data as HAStatus | undefined

  // Editable server lists (from status)
  const [jfList, setJfList] = useState<ServerEntry[]>([])
  const [plexList, setPlexList] = useState<ServerEntry[]>([])
  useEffect(() => {
    if (status?.jellyfin) setJfList(status.jellyfin.map(s => ({ ...s, apiKey: s.apiKey || '' })))
    if (status?.plex)     setPlexList(status.plex.map(s => ({ ...s, token: s.token || '' })))
  }, [status?.jellyfin?.length, status?.plex?.length])

  const save = async (jf = jfList, px = plexList) => {
    await api.post('/api/servers/save', { jellyfin: jf, plex: px })
    qc.invalidateQueries({ queryKey: ['ha-status'] })
  }

  const check = async () => {
    setChecking(true)
    await api.get('/api/servers/check')
    qc.invalidateQueries({ queryKey: ['ha-status'] })
    setChecking(false)
    toast.success('Health check complete')
  }

  const speedTestAll = async () => {
    setSpeedTesting(true)
    await api.get('/api/servers/speedtest')
    qc.invalidateQueries({ queryKey: ['ha-status'] })
    setSpeedTesting(false)
    toast.success('Speed tests complete')
  }

  const setMode = async (mode: string) => {
    await api.post('/api/servers/mode', { mode })
    qc.invalidateQueries({ queryKey: ['ha-status'] })
  }

  const forceActive = async (serverId: string) => {
    await api.post('/api/servers/force', { serverId })
    qc.invalidateQueries({ queryKey: ['ha-status'] })
    toast.success('Active server updated')
  }

  const speedTestOne = async (server: ServerEntry) => {
    const r = await api.post<any>('/api/servers/ping', { url: server.url, apiKey: server.apiKey, token: server.token })
    const updated = (server.apiKey != null ? jfList : plexList).map(s => s.id === server.id ? { ...s, speedMbps: r?.speedMbps } : s)
    if (server.apiKey != null) setJfList(updated)
    else setPlexList(updated)
  }

  const onlineJf = status?.jellyfin.filter(s => s.ok).length ?? 0
  const totalJf  = status?.jellyfin.length ?? 0
  const onlinePx = status?.plex.filter(s => s.ok).length ?? 0

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '0 0 80px' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-6 pb-4" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl tracking-[0.3em] uppercase font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.7 }}>
              Servers
            </h1>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>
              {totalJf} Jellyfin · {status?.plex.length ?? 0} Plex · {status?.isOffline ? '⚠ Offline' : `${onlineJf + onlinePx} online`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={check} disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold disabled:opacity-50 hover:opacity-80"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
              <RefreshCw size={11} className={checking ? 'animate-spin' : ''} /> Check
            </button>
            <button onClick={speedTestAll} disabled={speedTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold disabled:opacity-50 hover:opacity-80"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
              <Zap size={11} className={speedTesting ? 'animate-spin' : ''} />
              {speedTesting ? 'Testing…' : 'Speed Test All'}
            </button>
          </div>
        </div>

        {/* Status overview bar */}
        <div className="grid grid-cols-4 gap-2">
          {[
            ['Active', status?.jellyfin.find(s => s.id === status?.activeJfId)?.name ?? '—', Server],
            ['Mode',   status?.mode ?? '—', ArrowUpDown],
            ['Online', `${onlineJf + onlinePx}/${totalJf + (status?.plex.length ?? 0)}`, Activity],
            ['Uptime', status?.uptime ? `${Math.floor(status.uptime / 3600)}h` : '—', Clock],
          ].map(([label, val, Icon]: any) => (
            <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
              <Icon size={12} className="mx-auto mb-1" style={{ color: 'var(--accent)', opacity: 0.6 }} />
              <p className="text-xs font-bold truncate" style={{ color: 'var(--cream)' }}>{val}</p>
              <p className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--muted)', opacity: 0.35 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* Load balancing mode */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--muted)', opacity: 0.4 }}>
              Load Balancing
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['fastest',       '⚡ Fastest',       'Always route to lowest-latency server'],
              ['round-robin',   '🔄 Round Robin',   'Distribute requests across all online servers'],
              ['primary-first', '🥇 Primary First', 'Use highest-priority server, fail over only if down'],
              ['manual',        '🔧 Manual',        'You control which server is active'],
            ].map(([id, label, desc]) => (
              <button key={id} onClick={() => setMode(id)}
                className="p-3 rounded-xl text-left transition-all hover:opacity-80"
                style={{ background: status?.mode === id ? 'rgba(201,168,76,0.1)' : 'var(--bg2)', border: `1px solid ${status?.mode === id ? 'var(--accent)' : 'var(--border2)'}` }}>
                <p className="text-[11px] font-bold" style={{ color: status?.mode === id ? 'var(--accent)' : 'var(--cream)' }}>{label}</p>
                <p className="text-[9px] mt-0.5 leading-snug" style={{ color: 'var(--muted)', opacity: 0.5 }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Jellyfin servers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                Jellyfin
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>
                {onlineJf}/{totalJf} online
              </span>
            </div>
            <button onClick={() => setAddModal('jellyfin')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold hover:opacity-80"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--accent)' }}>
              <Plus size={10} /> Add
            </button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : (
            <div className="space-y-2">
              {(status?.jellyfin ?? []).map(s => (
                <ServerCard key={s.id} server={s} type="jellyfin"
                  isActive={s.id === status?.activeJfId}
                  onForce={() => forceActive(s.id)}
                  onRemove={() => { const next = jfList.filter(x => x.id !== s.id); setJfList(next); save(next) }}
                  onSpeedTest={() => speedTestOne(s)}
                  onToggle={() => { const next = jfList.map(x => x.id === s.id ? { ...x, enabled: !x.enabled } : x); setJfList(next); save(next) }} />
              ))}
              {(status?.jellyfin?.length ?? 0) === 0 && (
                <p className="text-center text-sm py-6" style={{ color: 'var(--muted)', opacity: 0.3 }}>No Jellyfin servers. Add one above.</p>
              )}
            </div>
          )}
        </div>

        {/* Plex servers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--muted)', opacity: 0.4 }}>Plex</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>
                {onlinePx}/{status?.plex.length ?? 0} online
              </span>
            </div>
            <button onClick={() => setAddModal('plex')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold hover:opacity-80"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--accent)' }}>
              <Plus size={10} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {(status?.plex ?? []).map(s => (
              <ServerCard key={s.id} server={s} type="plex" isActive={false}
                onForce={() => {}}
                onRemove={() => { const next = plexList.filter(x => x.id !== s.id); setPlexList(next); save(undefined, next) }}
                onSpeedTest={() => speedTestOne(s)}
                onToggle={() => { const next = plexList.map(x => x.id === s.id ? { ...x, enabled: !x.enabled } : x); setPlexList(next); save(undefined, next) }} />
            ))}
            {(status?.plex?.length ?? 0) === 0 && (
              <p className="text-center text-sm py-4" style={{ color: 'var(--muted)', opacity: 0.3 }}>No Plex servers configured.</p>
            )}
          </div>
        </div>

        {/* Last check */}
        {status?.lastCheck && (
          <p className="text-center text-[9px] pb-2" style={{ color: 'var(--muted)', opacity: 0.25 }}>
            Last health check {new Date(status.lastCheck).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Add server modal */}
      <AnimatePresence>
        {addModal && (
          <AddServerModal type={addModal} onClose={() => setAddModal(null)}
            onAdd={s => {
              if (addModal === 'jellyfin') { const next = [...jfList, s]; setJfList(next); save(next) }
              else { const next = [...plexList, s]; setPlexList(next); save(undefined, next) }
              toast.success(`${s.name} added`)
            }} />
        )}
      </AnimatePresence>
    </div>
  )
}
