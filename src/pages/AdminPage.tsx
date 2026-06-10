import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RefreshCw, Play } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'

type Tab = 'health' | 'sessions' | 'tasks'

function TabBtn({ id, active, onClick, children }: any) {
  return (
    <button onClick={() => onClick(id)}
      className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-all"
      style={{ color: active ? 'var(--accent)' : 'var(--muted)', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, opacity: active ? 1 : 0.5 }}>
      {children}
    </button>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('health')
  const qc = useQueryClient()

  const { data: sysStats, isLoading: statsLoading } = useQuery({
    queryKey: ['system-stats'], queryFn: () => api.get<any>('/api/system-stats'),
    refetchInterval: 15_000, staleTime: 10_000,
  })
  const { data: sessions } = useQuery({
    queryKey: ['active-sessions'], queryFn: () => api.activeSessions(),
    refetchInterval: 10_000, staleTime: 8_000,
  })
  const { data: tasks } = useQuery({
    queryKey: ['scheduled-tasks'], queryFn: () => api.get<any>('/api/scheduled-tasks'),
    staleTime: 30_000,
  })
  const { data: transcoding } = useQuery({
    queryKey: ['active-transcoding'], queryFn: () => api.get<any>('/api/active-transcoding'),
    refetchInterval: 8_000, staleTime: 6_000,
  })

  const s = sysStats as any
  const activeSessions = (sessions as any) || []
  const taskList = (tasks as any)?.tasks || []
  const transcodeSessions = (transcoding as any)?.sessions || []

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-6 pb-0" style={{ borderBottom: '1px solid var(--border2)' }}>
        <h1 className="text-xl tracking-[0.3em] uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Admin</h1>
        <div className="flex gap-1">
          <TabBtn id="health" active={tab==='health'} onClick={setTab}>System</TabBtn>
          <TabBtn id="sessions" active={tab==='sessions'} onClick={setTab}>Sessions</TabBtn>
          <TabBtn id="tasks" active={tab==='tasks'} onClick={setTab}>Tasks</TabBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-5">

        {/* SYSTEM TAB */}
        {tab === 'health' && (
          <div className="space-y-4">
            {/* Server info */}
            {s?.serverName && (
              <div className="text-center py-2">
                <p className="text-sm font-bold" style={{color:'var(--cream)'}}>{s.serverName}</p>
                <p className="text-[9px]" style={{color:'var(--muted)',opacity:0.4}}>Jellyfin v{s.serverVersion}</p>
              </div>
            )}
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['CPU', `${Math.round(s?.cpu??0)}%`, '#5dade2'],
                ['RAM', `${s?.ramUsed}/${s?.ramTotal} GB`, '#2ecc71'],
                ['Disk free', `${s?.freeGb} GB`, '#9b59b6'],
                ['Uptime', `${s?.uptimeDays}d`, 'var(--accent)'],
              ].map(([label, val, color]) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{background:'var(--bg2)',border:'1px solid var(--border2)'}}>
                  <p className="text-xl font-bold" style={{color: color as string}}>{val || '—'}</p>
                  <p className="text-[8px] uppercase tracking-widest mt-0.5" style={{color:'var(--muted)',opacity:0.4}}>{label}</p>
                </div>
              ))}
            </div>
            {/* Active transcoding */}
            {transcodeSessions.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{color:'var(--muted)',opacity:0.4}}>Active Transcoding</p>
                <div className="space-y-2">
                  {transcodeSessions.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-xl" style={{background:'var(--bg2)',border:'1px solid var(--border2)'}}>
                      <p className="text-xs font-bold" style={{color:'var(--cream)'}}>{s.title}</p>
                      <p className="text-[9px]" style={{color:'var(--muted)',opacity:0.5}}>
                        {s.username} · {s.codec} · {s.width}×{s.height} · {s.bitrate ? `${Math.round(s.bitrate/1000)}kbps` : ''} {s.hardware ? `· ${s.hardware}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SESSIONS TAB */}
        {tab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px]" style={{color:'var(--muted)',opacity:0.4}}>{activeSessions.length} active sessions</p>
              <button onClick={() => qc.invalidateQueries({queryKey:['active-sessions']})} className="p-1 hover:opacity-70" style={{color:'var(--muted)'}}>
                <RefreshCw size={13}/>
              </button>
            </div>
            {activeSessions.length === 0
              ? <p className="text-sm text-center py-8" style={{color:'var(--muted)',opacity:0.2}}>No active sessions</p>
              : <div className="space-y-2">
                  {activeSessions.map((sess: any) => (
                    <div key={sess.id} className="p-3 rounded-xl" style={{background:'var(--bg2)',border:'1px solid var(--border2)'}}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{color:'var(--cream)'}}>{sess.username || sess.UserName}</p>
                        <span className="text-[8px] px-2 py-0.5 rounded-full" style={{background: sess.playing?'rgba(46,204,113,0.15)':'rgba(255,255,255,0.05)', color: sess.playing?'#2ecc71':'var(--muted)'}}>
                          {sess.playing ? '▶ Playing' : 'Idle'}
                        </span>
                      </div>
                      {sess.nowPlayingItem && (
                        <p className="text-[9px] mt-0.5 truncate" style={{color:'var(--muted)',opacity:0.5}}>{sess.nowPlayingItem}</p>
                      )}
                      <p className="text-[8px] mt-0.5" style={{color:'var(--muted)',opacity:0.3}}>{sess.client} · {sess.device}</p>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* TASKS TAB */}
        {tab === 'tasks' && (
          <div className="space-y-2">
            {taskList.length === 0
              ? <p className="text-sm text-center py-8" style={{color:'var(--muted)',opacity:0.2}}>No tasks available</p>
              : taskList.slice(0, 15).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:'var(--bg2)',border:'1px solid var(--border2)'}}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{color:'var(--cream)'}}>{t.name}</p>
                      <p className="text-[8px]" style={{color:'var(--muted)',opacity:0.3}}>
                        {t.category}{t.lastEnd ? ` · ${new Date(t.lastEnd).toLocaleDateString()}` : ''}
                        {t.lastResult ? ` · ${t.lastResult}` : ''}
                      </p>
                    </div>
                    <span className="text-[8px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{background:t.state==='Running'?'rgba(243,156,18,0.15)':'var(--subtle)', color:t.state==='Running'?'#f39c12':'var(--muted)'}}>
                      {t.state}
                    </span>
                    <button onClick={async () => {
                      await api.post(`/api/scheduled-tasks/${t.id}/run`, {}).catch(()=>{})
                      toast.success(`${t.name} started`)
                    }}
                      className="text-[9px] px-2.5 py-1 rounded-full hover:opacity-80 flex-shrink-0"
                      style={{background:'var(--subtle)',border:'1px solid var(--border2)',color:'var(--accent)'}}>
                      ▶ Run
                    </button>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
