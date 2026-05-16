import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, Server, Tv } from 'lucide-react'
import api from '@/lib/api'

type ServerType = 'jellyfin' | 'plex'
type ServerRole = 'primary' | 'backup'

interface ServerDef {
  id: string
  type: ServerType
  role: ServerRole
  url: string
  token?: string
  label: string
}

// Derive server list from current config
function useServers() {
  const { data: cfg } = useQuery({ queryKey: ['config'], queryFn: api.config.bind(api), staleTime: 30_000 })
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['servers-status'], queryFn: api.serversStatus.bind(api), refetchInterval: 30_000,
  })
  const servers: (ServerDef & { ok?: boolean; latency?: number | null; active?: boolean })[] = []

  if (cfg) {
    const c = cfg as any
    if (c.JELLYFIN_URL || c.jellyfinUrl) {
      servers.push({
        id: 'jellyfin-primary', type: 'jellyfin', role: 'primary',
        url: c.JELLYFIN_URL || c.jellyfinUrl, label: 'Jellyfin (Primary)',
        ok: (status as any)?.primary?.ok, latency: (status as any)?.primary?.latency,
        active: (status as any)?.active === 'primary',
      })
    }
    if (c.JELLYFIN_BACKUP_URL) {
      servers.push({
        id: 'jellyfin-backup', type: 'jellyfin', role: 'backup',
        url: c.JELLYFIN_BACKUP_URL, label: 'Jellyfin (Backup)',
        ok: (status as any)?.backup?.ok, latency: (status as any)?.backup?.latency,
        active: (status as any)?.active === 'backup',
      })
    }
    if (c.PLEX_URL) {
      servers.push({
        id: 'plex', type: 'plex', role: 'primary',
        url: c.PLEX_URL, label: 'Plex',
        ok: (status as any)?.plex?.ok, latency: (status as any)?.plex?.latency,
      })
    }
  }
  return { servers, status, refetchStatus }
}

export default function ServerManager() {
  const qc = useQueryClient()
  const { servers, refetchStatus } = useServers()
  const [showAdd, setShowAdd] = useState(false)
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [checking, setChecking] = useState(false)
  const [mode, setMode] = useState<'fastest' | 'primary' | 'backup'>('fastest')

  // Add server form
  const [form, setForm] = useState({ type: 'jellyfin' as ServerType, role: 'backup' as ServerRole, url: '', token: '' })

  const testServer = async (server: typeof servers[0]) => {
    setTesting(t => ({ ...t, [server.id]: true }))
    try {
      if (server.type === 'jellyfin') {
        const r = await fetch(`/api/test/jellyfin?url=${encodeURIComponent(server.url)}`).then(r => r.json())
        setTestResult(t => ({ ...t, [server.id]: { ok: r.ok, msg: r.ok ? `${r.serverName} v${r.version}` : r.error || 'Failed' } }))
      } else {
        const r = await api.testIntegration('plex')
        setTestResult(t => ({ ...t, [server.id]: { ok: r.ok, msg: r.message || r.error || '' } }))
      }
    } catch(e: any) {
      setTestResult(t => ({ ...t, [server.id]: { ok: false, msg: e.message } }))
    }
    setTesting(t => ({ ...t, [server.id]: false }))
  }

  const removeServer = async (server: typeof servers[0]) => {
    const updates: Record<string, string> = {}
    if (server.id === 'jellyfin-backup') { updates.JELLYFIN_BACKUP_URL = ''; updates.JELLYFIN_BACKUP_API_KEY = '' }
    if (server.id === 'plex') { updates.PLEX_URL = ''; updates.PLEX_TOKEN = '' }
    await api.saveConfig(updates)
    qc.invalidateQueries({ queryKey: ['config'] })
    qc.invalidateQueries({ queryKey: ['servers-status'] })
  }

  const switchTo = async (role: 'primary' | 'backup') => {
    await api.serversSwitch(role)
    refetchStatus()
  }

  const addServer = async () => {
    if (!form.url) return
    const updates: Record<string, string> = {}
    if (form.type === 'jellyfin' && form.role === 'primary') { updates.JELLYFIN_URL = form.url.replace(/\/$/, '') }
    if (form.type === 'jellyfin' && form.role === 'backup') { updates.JELLYFIN_BACKUP_URL = form.url.replace(/\/$/, '') }
    if (form.type === 'plex') { updates.PLEX_URL = form.url.replace(/\/$/, ''); if (form.token) updates.PLEX_TOKEN = form.token }
    await api.saveConfig(updates)
    qc.invalidateQueries({ queryKey: ['config'] })
    qc.invalidateQueries({ queryKey: ['servers-status'] })
    setShowAdd(false)
    setForm({ type: 'jellyfin', role: 'backup', url: '', token: '' })
  }

  const checkAll = async () => {
    setChecking(true)
    await api.serversCheck()
    refetchStatus()
    setChecking(false)
  }

  const saveMode = async (m: 'fastest' | 'primary' | 'backup') => {
    setMode(m)
    await api.saveConfig({ JELLYFIN_MODE: m })
  }

  const statusDot = (ok?: boolean) => (
    <span className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: ok === true ? '#2ecc71' : ok === false ? '#e74c3c' : '#666' }} />
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--accent)', opacity: 0.5 }}>Media Servers</p>
        <div className="flex gap-2">
          <button onClick={checkAll} disabled={checking}
            className="flex items-center gap-1 text-[8px] px-2 py-1 rounded-full transition-all hover:opacity-70"
            style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
            <RefreshCw size={8} className={checking ? 'animate-spin' : ''} /> Check All
          </button>
          <button onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1 text-[8px] px-2 py-1 rounded-full transition-all hover:opacity-70"
            style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none' }}>
            <Plus size={8} /> Add Server
          </button>
        </div>
      </div>

      {/* Server list */}
      <div className="space-y-2 mb-4">
        {servers.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            No servers configured. Add one to get started.
          </p>
        )}
        {servers.map(srv => (
          <div key={srv.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${srv.active ? 'var(--accent)' : 'var(--border2)'}` }}>
            <div className="flex items-center gap-2">
              {srv.type === 'plex'
                ? <Tv size={14} style={{ color: '#e5a00d', flexShrink: 0 }} />
                : <Server size={14} style={{ color: srv.active ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }} />
              }
              {statusDot(srv.ok)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: srv.active ? 'var(--accent)' : 'var(--cream)' }}>{srv.label}</span>
                  {srv.active && <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--accent)' }}>Active</span>}
                  {srv.latency && <span className="text-[8px]" style={{ color: 'var(--muted)' }}>{srv.latency}ms</span>}
                </div>
                <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{srv.url}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {/* Test */}
                <button onClick={() => testServer(srv)}
                  className="text-[8px] px-2 py-1 rounded-full transition-all hover:opacity-80"
                  style={{ border: '1px solid var(--border2)', color: testResult[srv.id]?.ok === true ? '#2ecc71' : testResult[srv.id]?.ok === false ? '#e74c3c' : 'var(--muted)' }}>
                  {testing[srv.id] ? <Loader size={8} className="animate-spin" /> :
                   testResult[srv.id]?.ok === true ? <CheckCircle size={8} /> :
                   testResult[srv.id]?.ok === false ? <XCircle size={8} /> : 'Test'}
                </button>
                {/* Switch to (Jellyfin only) */}
                {srv.type === 'jellyfin' && !srv.active && (
                  <button onClick={() => switchTo(srv.role)}
                    className="text-[8px] px-2 py-1 rounded-full transition-all hover:opacity-80"
                    style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    Use
                  </button>
                )}
                {/* Remove (not primary Jellyfin) */}
                {srv.id !== 'jellyfin-primary' && (
                  <button onClick={() => removeServer(srv)}
                    className="text-[8px] px-2 py-1 rounded-full transition-all hover:opacity-80"
                    style={{ border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c' }}>
                    <Trash2 size={8} />
                  </button>
                )}
              </div>
            </div>
            {testResult[srv.id]?.msg && (
              <p className="text-[8px] mt-1.5 ml-10" style={{ color: testResult[srv.id]?.ok ? '#2ecc71' : '#e74c3c' }}>
                {testResult[srv.id].msg}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Failover mode (only show if backup exists) */}
      {servers.some(s => s.id === 'jellyfin-backup') && (
        <div className="mb-4">
          <p className="text-[8px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.4 }}>Failover Mode</p>
          <div className="flex gap-1.5">
            {(['fastest', 'primary', 'backup'] as const).map(m => (
              <button key={m} onClick={() => saveMode(m)}
                className="flex-1 py-1.5 text-[8px] font-bold uppercase rounded-full transition-all"
                style={{ background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border2)'}` }}>
                {m}
              </button>
            ))}
          </div>
          <p className="text-[8px] mt-1.5" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            Fastest = auto-pick lowest latency · Primary/Backup = always prefer one
          </p>
        </div>
      )}

      {/* Add server form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl p-4 mb-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
              <p className="text-[8px] font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Add Server</p>

              {/* Type picker */}
              <div className="flex gap-2 mb-3">
                {(['jellyfin', 'plex'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    className="flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all"
                    style={{ background: form.type === t ? 'rgba(255,255,255,0.08)' : 'transparent', color: form.type === t ? 'var(--cream)' : 'var(--muted)', border: `1px solid ${form.type === t ? 'var(--border)' : 'var(--border2)'}` }}>
                    {t === 'jellyfin' ? '🎬 Jellyfin' : '🟠 Plex'}
                  </button>
                ))}
              </div>

              {/* Role picker (Jellyfin only) */}
              {form.type === 'jellyfin' && (
                <div className="flex gap-2 mb-3">
                  {(['primary', 'backup'] as const).map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                      className="flex-1 py-1 text-[8px] font-bold uppercase rounded-lg transition-all"
                      style={{ background: form.role === r ? 'rgba(255,255,255,0.06)' : 'transparent', color: form.role === r ? 'var(--cream)' : 'var(--muted)', border: `1px solid ${form.role === r ? 'var(--border)' : 'var(--border2)'}` }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder={form.type === 'jellyfin' ? 'http://192.168.1.x:8096' : 'http://192.168.1.x:32400'}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-2"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />

              {form.type === 'plex' && (
                <input value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                  placeholder="X-Plex-Token" type="password"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-2"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
              )}

              <div className="flex gap-2">
                <button onClick={addServer} disabled={!form.url}
                  className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:opacity-85 disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Add
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
