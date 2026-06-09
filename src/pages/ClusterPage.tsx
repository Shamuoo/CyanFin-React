import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Server, Zap, RefreshCw, Play, CheckCircle, XCircle, Clock, Cpu, Database } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'

const ROLES = [
  { id: 'primary',    label: 'Primary',    desc: 'Main browsing + playback',      color: '#c9a84c' },
  { id: 'transcoder', label: 'Transcoder', desc: 'Heavy transcoding / GPU server', color: '#e74c3c' },
  { id: 'scanner',    label: 'Scanner',    desc: 'Library scans + metadata',       color: '#3498db' },
  { id: 'backup',     label: 'Backup',     desc: 'Failover only',                  color: '#888' },
  { id: 'media',      label: 'Media',      desc: 'Storage + direct play only',     color: '#2ecc71' },
]

const JOB_ICONS: Record<string,string> = {
  scan: '🔍', metadata: '✏️', pretranscode: '⚙️', speedtest: '⚡',
}

const STATUS_COLOR: Record<string,string> = {
  queued: '#888', running: '#f39c12', done: '#2ecc71', error: '#e74c3c',
}

function RoleSelector({ serverId, current, onChange }: { serverId: string; current: string; onChange: (role: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-2">
      {ROLES.map(r => (
        <button key={r.id} onClick={() => onChange(r.id)}
          title={r.desc}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold transition-all hover:opacity-80"
          style={{ background: current === r.id ? r.color : 'var(--bg3)', color: current === r.id ? 'white' : 'var(--muted)', border: `1px solid ${current === r.id ? r.color : 'var(--border2)'}` }}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

export default function ClusterPage() {
  const qc = useQueryClient()
  const [pretranscodeForm, setPretranscodeForm] = useState({ serverId: '', itemId: '', bitrate: '8' })
  const [scanning, setScanning] = useState<Record<string,boolean>>({})

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cluster-stats'],
    queryFn: () => api.clusterStats(),
    refetchInterval: 10_000,
    staleTime: 8_000,
  })

  const { data: jobsData } = useQuery({
    queryKey: ['cluster-jobs'],
    queryFn: () => api.clusterJobs(),
    refetchInterval: 5_000,
    staleTime: 3_000,
  })

  const stats    = data as any
  const servers  = stats?.servers || []
  const jobs     = (jobsData as any)?.jobs || []

  const setRole = async (serverId: string, role: string) => {
    await api.clusterRole(serverId, role).catch(() => {})
    qc.invalidateQueries({ queryKey: ['cluster-stats'] })
    toast.success(`${serverId} set to ${role}`)
  }

  const triggerScan = async (serverId: string) => {
    setScanning(s => ({ ...s, [serverId]: true }))
    const r = await api.clusterScan(serverId).catch(() => null) as any
    setScanning(s => ({ ...s, [serverId]: false }))
    if (r?.ok) toast.success(`Library scan queued (job #${r.jobId})`)
    else toast.error('Scan failed')
  }

  const triggerPretranscode = async () => {
    const { serverId, itemId, bitrate } = pretranscodeForm
    if (!serverId || !itemId) return
    const r = await api.pretranscode(serverId, itemId, parseInt(bitrate) * 1_000_000).catch(() => null) as any
    if (r?.ok) toast.success(`Pre-transcode queued (job #${r.jobId})`)
    else toast.error('Failed to queue pre-transcode')
  }

  const activeJfId = stats?.activeJfId

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Cluster</h1>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.3 }}>
            {servers.length} server{servers.length !== 1 ? 's' : ''} · Mode: {stats?.mode || '—'}
          </p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-full hover:opacity-70" style={{ color: 'var(--muted)' }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Server cards */}
      <div className="space-y-3 mb-8">
        {isLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>}
        {servers.map((server: any) => {
          const roleInfo = ROLES.find(r => r.id === (server.role || 'primary')) || ROLES[0]
          const isActive = server.id === activeJfId
          return (
            <motion.div key={server.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4"
              style={{ background: isActive ? 'rgba(201,168,76,0.05)' : 'var(--bg2)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}` }}>
              {/* Row 1: name + status */}
              <div className="flex items-center gap-3 mb-2">
                <div className="relative flex-shrink-0">
                  <Server size={18} style={{ color: server.ok ? 'var(--accent)' : '#666' }} />
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[var(--bg2)]"
                    style={{ background: server.ok ? '#2ecc71' : '#e74c3c' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{server.name}</p>
                    {isActive && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Active</span>}
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${roleInfo.color}20`, color: roleInfo.color, border: `1px solid ${roleInfo.color}40` }}>
                      {roleInfo.label}
                    </span>
                  </div>
                  <p className="text-[9px] truncate" style={{ color: 'var(--muted)', opacity: 0.4 }}>{server.url}</p>
                </div>
                {/* Stats */}
                <div className="flex gap-3 flex-shrink-0 text-right">
                  {server.latency && <div>
                    <p className="text-xs font-bold" style={{ color: server.latency < 30 ? '#2ecc71' : server.latency < 100 ? '#f39c12' : '#e74c3c' }}>{server.latency}ms</p>
                    <p className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.3 }}>ping</p>
                  </div>}
                  {server.speedMbps != null && <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>{server.speedMbps}</p>
                    <p className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.3 }}>Mbps</p>
                  </div>}
                  {server.jobCount > 0 && <div>
                    <p className="text-xs font-bold" style={{ color: '#f39c12' }}>{server.jobCount}</p>
                    <p className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.3 }}>jobs</p>
                  </div>}
                </div>
              </div>

              {/* Role selector */}
              <RoleSelector serverId={server.id} current={server.role || 'primary'} onChange={r => setRole(server.id, r)} />

              {/* Actions */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => triggerScan(server.id)} disabled={!server.ok || scanning[server.id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold disabled:opacity-30 hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  {scanning[server.id] ? <RefreshCw size={9} className="animate-spin" /> : <Database size={9} />}
                  Scan Library
                </button>
                <button onClick={() => setPretranscodeForm(f => ({ ...f, serverId: server.id }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  <Zap size={9} /> Pre-transcode
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Pre-transcode panel */}
      {pretranscodeForm.serverId && (
        <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold mb-3" style={{ color: 'var(--cream)' }}>
            Pre-Transcode on {servers.find((s: any) => s.id === pretranscodeForm.serverId)?.name}
          </p>
          <p className="text-[9px] mb-3" style={{ color: 'var(--muted)', opacity: 0.5 }}>
            Forces Jellyfin to transcode a file ahead of playback so it's ready instantly. Paste the Jellyfin item ID.
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 120px' }}>
            <div>
              <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Item ID</p>
              <input value={pretranscodeForm.itemId} onChange={e => setPretranscodeForm(f => ({ ...f, itemId: e.target.value }))}
                placeholder="e.g. abc123def456"
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Max Mbps</p>
              <input type="number" value={pretranscodeForm.bitrate} onChange={e => setPretranscodeForm(f => ({ ...f, bitrate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setPretranscodeForm(f => ({ ...f, serverId: '' }))}
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>Cancel</button>
            <button onClick={triggerPretranscode} disabled={!pretranscodeForm.itemId}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-30"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              <Zap size={11} /> Queue Pre-Transcode
            </button>
          </div>
        </div>
      )}

      {/* Job queue */}
      <div>
        <p className="text-[9px] font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }}>Job Queue</p>
        {jobs.length === 0
          ? <p className="text-sm text-center py-6" style={{ color: 'var(--muted)', opacity: 0.2 }}>No jobs yet</p>
          : <div className="space-y-1.5">
              {[...jobs].reverse().slice(0, 20).map((job: any) => (
                <div key={job.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                  <span className="text-base flex-shrink-0">{JOB_ICONS[job.type] || '⚙️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold" style={{ color: 'var(--cream)' }}>
                      #{job.id} {job.type} on {servers.find((s: any) => s.id === job.serverId)?.name || job.serverId}
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                      {job.error || (job.completedAt ? `Done in ${Math.round((job.completedAt - job.createdAt)/1000)}s` : job.startedAt ? 'Running…' : 'Queued')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[job.status] || '#888' }} />
                    <span className="text-[9px] font-bold" style={{ color: STATUS_COLOR[job.status] }}>{job.status}</span>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}
