import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, X, Copy, Check, Play, Pause, Crown } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'

interface Session {
  sessionId: string
  itemId: string
  itemTitle: string
  hostUserId: string
  hostUsername: string
  members: { userId: string; username: string; positionTicks: number; isSynced: boolean }[]
  positionTicks: number
  isPaused: boolean
}

interface Props {
  onClose: () => void
  itemId?: string
  itemTitle?: string
  currentTime?: number
  isPaused?: boolean
  onSeek?: (time: number) => void
  onPause?: (paused: boolean) => void
}

export default function WatchParty({ onClose, itemId, itemTitle, currentTime = 0, isPaused = false, onSeek, onPause }: Props) {
  const { user } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isHost = session?.hostUserId === (user as any)?.id

  // Poll session state every 3 seconds
  useEffect(() => {
    if (!session) return
    const interval = setInterval(async () => {
      try {
        const updated = await api.post<Session>('/CyanFin/WatchParty/Sync', {
          sessionId: session.sessionId,
          positionTicks: Math.round(currentTime * 10_000_000),
          isPaused,
        })
        setSession(updated)
        // If we're not host and out of sync, seek to host position
        if (!isHost && updated) {
          const hostPos = updated.positionTicks / 10_000_000
          if (Math.abs(hostPos - currentTime) > 5) onSeek?.(hostPos)
          if (updated.isPaused !== isPaused) onPause?.(updated.isPaused)
        }
      } catch(e) {}
    }, 3000)
    return () => clearInterval(interval)
  }, [session, currentTime, isPaused, isHost])

  const createSession = async () => {
    if (!itemId) return
    setLoading(true); setError('')
    try {
      const s = await api.post<Session>('/CyanFin/WatchParty/Create', { itemId, itemTitle })
      setSession(s)
    } catch(e: any) { setError(e.message || 'Plugin not installed') }
    finally { setLoading(false) }
  }

  const joinSession = async () => {
    if (!joinCode.trim()) return
    setLoading(true); setError('')
    try {
      const s = await api.post<Session>('/CyanFin/WatchParty/Join', { sessionId: joinCode.trim().toUpperCase(), itemId: itemId || '' })
      setSession(s)
      // Seek to host position
      if (s.positionTicks && onSeek) onSeek(s.positionTicks / 10_000_000)
    } catch(e: any) { setError('Session not found') }
    finally { setLoading(false) }
  }

  const leaveSession = async () => {
    if (!session) return
    await fetch(`/CyanFin/WatchParty/${session.sessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
    setSession(null)
  }

  const copyCode = () => {
    if (!session) return
    navigator.clipboard.writeText(session.sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border2)' }}>
          <div className="flex items-center gap-2">
            <Users size={15} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold tracking-wide" style={{ color: 'var(--cream)' }}>Watch Party</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        <div className="p-5">
          {!session ? (
            // Setup screen
            <div className="space-y-4">
              {itemTitle && (
                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                  Watching: <span style={{ color: 'var(--cream)' }}>{itemTitle}</span>
                </p>
              )}
              <button onClick={createSession} disabled={loading || !itemId}
                className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all hover:opacity-85 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                {loading ? 'Creating…' : 'Create Party'}
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>or join</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
              </div>
              <div className="flex gap-2">
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code" maxLength={8}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-center font-bold tracking-[0.3em] outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                  onKeyDown={e => e.key === 'Enter' && joinSession()} />
                <button onClick={joinSession} disabled={loading || !joinCode}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-85 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--cream)', border: '1px solid var(--border)' }}>
                  Join
                </button>
              </div>
              {error && <p className="text-[11px] text-center" style={{ color: '#e74c3c' }}>{error}</p>}
              <p className="text-[9px] text-center" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                Requires CyanFin Plugin installed on Jellyfin
              </p>
            </div>
          ) : (
            // Active session
            <div className="space-y-4">
              {/* Session code */}
              <div className="text-center">
                <p className="text-[9px] tracking-widest uppercase mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Session Code</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-bold tracking-[0.3em]"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                    {session.sessionId}
                  </span>
                  <button onClick={copyCode} className="transition-all hover:opacity-70">
                    {copied ? <Check size={16} color="#2ecc71" /> : <Copy size={16} style={{ color: 'var(--muted)' }} />}
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Share this code with friends</p>
              </div>

              {/* Members */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                <p className="text-[8px] tracking-widest uppercase" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                  {session.members.length} watching
                </p>
                {session.members.map(m => (
                  <div key={m.userId} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'var(--subtle)', color: 'var(--accent)' }}>
                      {m.username[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs flex-1" style={{ color: 'var(--cream)' }}>{m.username}</span>
                    {m.userId === session.hostUserId && <Crown size={12} style={{ color: 'var(--accent)' }} />}
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.isSynced ? '#2ecc71' : '#e67e22' }} />
                  </div>
                ))}
              </div>

              {/* Host controls */}
              {isHost && (
                <div className="flex gap-2">
                  <button onClick={() => onPause?.(!isPaused)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--cream)', border: '1px solid var(--border)' }}>
                    {isPaused ? <><Play size={12} /> Play</> : <><Pause size={12} /> Pause</>}
                  </button>
                </div>
              )}

              <button onClick={leaveSession}
                className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:opacity-80"
                style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)' }}>
                {isHost ? 'End Party' : 'Leave Party'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
