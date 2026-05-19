import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader, Zap, Server, Tv } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'

type JFServer  = { id: string; name: string; url: string; apiKey: string; priority: number; enabled: boolean }
type PlexServer = { id: string; name: string; url: string; token: string; priority: number; enabled: boolean }

const EMPTY_JF: JFServer   = { id: '', name: '', url: '', apiKey: '', priority: 1, enabled: true }
const EMPTY_PX: PlexServer = { id: '', name: '', url: '', token: '', priority: 1, enabled: true }

function uid() { return Math.random().toString(36).slice(2, 8) }

function StatusDot({ ok }: { ok?: boolean }) {
  if (ok === undefined) return <div className="w-2 h-2 rounded-full" style={{ background: 'var(--border2)' }} />
  return <div className="w-2 h-2 rounded-full" style={{ background: ok ? '#2ecc71' : '#e74c3c' }} />
}

export default function ServerManager() {
  const qc = useQueryClient()
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [addingJF, setAddingJF] = useState(false)
  const [addingPX, setAddingPX] = useState(false)
  const [newJF, setNewJF] = useState<JFServer>({...EMPTY_JF})
  const [newPX, setNewPX] = useState<PlexServer>({...EMPTY_PX})

  const { data: cfg, refetch: refetchCfg } = useQuery({
    queryKey: ['config'], queryFn: api.config.bind(api), staleTime: 2_000,
  })
  const { data: allStatus } = useQuery({
    queryKey: ['all-servers'], queryFn: () => api.get<any>('/api/servers/all'),
    refetchInterval: 30_000, staleTime: 15_000,
  })

  const c = (cfg as any) || {}

  // Parse server arrays from config
  let jfServers: JFServer[] = []
  let plexServers: PlexServer[] = []
  try { jfServers = JSON.parse(c.JELLYFIN_SERVERS || '[]') } catch {
    if (c.JELLYFIN_URL) jfServers = [{ id: 'primary', name: 'Primary', url: c.JELLYFIN_URL, apiKey: c.JELLYFIN_API_KEY || '', priority: 1, enabled: true }]
    if (c.JELLYFIN_BACKUP_URL) jfServers.push({ id: 'backup', name: 'Backup', url: c.JELLYFIN_BACKUP_URL, apiKey: c.JELLYFIN_BACKUP_API_KEY || c.JELLYFIN_API_KEY || '', priority: 2, enabled: true })
  }
  try { plexServers = JSON.parse(c.PLEX_SERVERS || '[]') } catch {
    if (c.PLEX_URL && c.PLEX_TOKEN) plexServers = [{ id: 'plex-primary', name: 'Plex', url: c.PLEX_URL, token: c.PLEX_TOKEN, priority: 1, enabled: true }]
  }

  const getStatus = (id: string) => {
    const all = allStatus as any
    const found = [...(all?.jellyfin || []), ...(all?.plex || [])].find(s => s.id === id)
    return found
  }

  const saveJF = async (servers: JFServer[]) => {
    await api.saveConfig({ JELLYFIN_SERVERS: JSON.stringify(servers) })
    qc.invalidateQueries({ queryKey: ['config'] })
    qc.invalidateQueries({ queryKey: ['all-servers'] })
    refetchCfg()
    toast.success('Servers saved')
  }
  const savePlex = async (servers: PlexServer[]) => {
    await api.saveConfig({ PLEX_SERVERS: JSON.stringify(servers) })
    qc.invalidateQueries({ queryKey: ['config'] })
    qc.invalidateQueries({ queryKey: ['all-servers'] })
    refetchCfg()
    toast.success('Plex servers saved')
  }

  const testServer = async (id: string, url: string, apiKey?: string) => {
    setTesting(t => ({ ...t, [id]: true }))
    try {
      const r = await api.testJellyfin(url)
      toast[r.ok ? 'success' : 'error'](r.ok ? `✓ ${r.serverName || url}` : `✗ ${r.error || 'Unreachable'}`)
    } catch { toast.error('Test failed') }
    setTesting(t => ({ ...t, [id]: false }))
  }

  const [speedTesting, setSpeedTesting] = useState(false)
  const runSpeedTest = async () => {
    setSpeedTesting(true)
    await api.get('/api/servers/speedtest').then(r => qc.setQueryData(['all-servers'], r)).catch(() => {})
    setSpeedTesting(false)
  }

  const label = (s: { name?: string; url: string }) => s.name || s.url

  return (
    <div>
      {/* Speed test button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--accent)', opacity: 0.5 }}>Servers</p>
        <button onClick={runSpeedTest} disabled={speedTesting}
          className="flex items-center gap-1.5 text-[9px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wide hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
          {speedTesting ? <Loader size={10} className="animate-spin" /> : <Zap size={10} />}
          Speed Test
        </button>
      </div>

      {/* Jellyfin servers */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <Server size={11} /> Jellyfin
          </p>
          <button onClick={() => setAddingJF(true)}
            className="text-[9px] px-2 py-1 rounded-full hover:opacity-80"
            style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
            + Add
          </button>
        </div>

        <div className="space-y-2">
          {jfServers.map(srv => {
            const st = getStatus(srv.id)
            return (
              <div key={srv.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
                <StatusDot ok={st?.ok} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--cream)' }}>{label(srv)}</p>
                  <p className="text-[8px] truncate" style={{ color: 'var(--muted)' }}>{srv.url}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] flex-shrink-0">
                  {st?.latency && <span style={{ color: st.latency < 80 ? '#2ecc71' : st.latency < 300 ? '#f39c12' : '#e74c3c' }}>{st.latency}ms</span>}
                  {st?.speedMbps != null && <span style={{ color: 'var(--accent)' }}>{st.speedMbps}Mb</span>}
                  <button onClick={() => testServer(srv.id, srv.url, srv.apiKey)} disabled={testing[srv.id]}
                    className="px-2 py-0.5 rounded text-[8px] hover:opacity-70"
                    style={{ background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                    {testing[srv.id] ? '…' : 'Test'}
                  </button>
                  <button onClick={() => saveJF(jfServers.filter(s => s.id !== srv.id))}
                    className="hover:opacity-70 p-0.5" style={{ color: '#e74c3c' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {addingJF && (
          <div className="mt-2 p-3 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="space-y-2 mb-3">
              {[
                { key: 'name',   ph: 'Name (e.g. "Home Server")' },
                { key: 'url',    ph: 'URL (e.g. http://192.168.1.125:8096)' },
                { key: 'apiKey', ph: 'API Key' },
              ].map(f => (
                <input key={f.key} value={(newJF as any)[f.key]} onChange={e => setNewJF(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  className="w-full px-2.5 py-2 rounded-lg text-[11px] outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddingJF(false)}
                className="flex-1 py-1.5 rounded-full text-[10px] hover:opacity-70"
                style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                Cancel
              </button>
              <button onClick={() => {
                if (!newJF.url) return
                const s = { ...newJF, id: uid(), priority: jfServers.length + 1 }
                saveJF([...jfServers, s])
                setNewJF({...EMPTY_JF})
                setAddingJF(false)
              }}
                className="flex-1 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plex servers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <Tv size={11} /> Plex
          </p>
          <button onClick={() => setAddingPX(true)}
            className="text-[9px] px-2 py-1 rounded-full hover:opacity-80"
            style={{ background: 'rgba(229,160,13,0.08)', color: '#e5a00d', border: '1px solid rgba(229,160,13,0.2)' }}>
            + Add
          </button>
        </div>

        <div className="space-y-2">
          {plexServers.map(srv => {
            const st = getStatus(srv.id)
            return (
              <div key={srv.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
                <StatusDot ok={st?.ok} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--cream)' }}>{label(srv)}</p>
                  <p className="text-[8px] truncate" style={{ color: 'var(--muted)' }}>{srv.url}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {st?.latency && <span className="text-[8px]" style={{ color: 'var(--muted)' }}>{st.latency}ms</span>}
                  <button onClick={() => savePlex(plexServers.filter(s => s.id !== srv.id))}
                    className="hover:opacity-70 p-0.5" style={{ color: '#e74c3c' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {addingPX && (
          <div className="mt-2 p-3 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="space-y-2 mb-3">
              {[
                { key: 'name',  ph: 'Name (e.g. "Home Plex")' },
                { key: 'url',   ph: 'Plex URL (e.g. http://192.168.1.125:32400)' },
                { key: 'token', ph: 'Plex Token' },
              ].map(f => (
                <input key={f.key} value={(newPX as any)[f.key]} onChange={e => setNewPX(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  className="w-full px-2.5 py-2 rounded-lg text-[11px] outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddingPX(false)}
                className="flex-1 py-1.5 rounded-full text-[10px] hover:opacity-70"
                style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>Cancel</button>
              <button onClick={() => {
                if (!newPX.url) return
                const s = { ...newPX, id: uid(), priority: plexServers.length + 1 }
                savePlex([...plexServers, s])
                setNewPX({...EMPTY_PX})
                setAddingPX(false)
              }}
                className="flex-1 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80"
                style={{ background: '#e5a00d', color: '#000' }}>Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
