import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoginPage() {
  const [tab, setTab] = useState<'password' | 'quickconnect'>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qcCode, setQcCode] = useState('')
  const [qcSecret, setQcSecret] = useState('')
  const [qcPolling, setQcPolling] = useState(false)
  const { setUser, setOnboarded } = useStore()
  const navigate = useNavigate()

  const { data: serverInfo } = useQuery({
    queryKey: ['server-info-login'],
    queryFn: () => api.publicInfo(),
    retry: false,
    staleTime: 10_000,
  })

  const handleLogin = async () => {
    if (!username || !password) { setError('Enter username and password'); return }
    setLoading(true); setError('')
    try {
      const result = await api.login(username, password)
      setUser(result.user); navigate('/')
    } catch(e: any) { setError(e.message || 'Login failed') }
    finally { setLoading(false) }
  }

  const startQuickConnect = async () => {
    setError(''); setLoading(true)
    try {
      const result = await api.quickConnectInitiate()
      setQcCode(result.code)
      setQcSecret(result.secret)
      setQcPolling(true)
    } catch(e: any) { setError('Quick Connect not available on this server') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!qcPolling || !qcSecret) return
    const interval = setInterval(async () => {
      try {
        const result = await api.quickConnectCheck(qcSecret)
        if (result.authorized && result.user) {
          clearInterval(interval)
          setQcPolling(false)
          setUser(result.user); navigate('/')
        }
      } catch { clearInterval(interval); setQcPolling(false) }
    }, 2000)
    const timeout = setTimeout(() => { clearInterval(interval); setQcPolling(false); setError('Quick Connect expired') }, 120_000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [qcPolling, qcSecret, setUser, navigate])

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl tracking-[0.5em] mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</h1>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Jellyfin Home Theater</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex" style={{ borderBottom: '1px solid var(--border2)' }}>
            {(['password', 'quickconnect'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                className="flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-all"
                style={{ color: tab === t ? 'var(--accent)' : 'var(--muted)', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent' }}>
                {t === 'password' ? 'Sign In' : 'Quick Connect'}
              </button>
            ))}
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {tab === 'password' ? (
                <motion.div key="password" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  {['Username', 'Password'].map((label, i) => (
                    <div key={label} className="mb-4">
                      <label className="block text-[8px] font-bold tracking-[0.2em] uppercase mb-1.5" style={{ color: 'var(--muted)' }}>{label}</label>
                      <input
                        type={i === 1 ? 'password' : 'text'}
                        value={i === 0 ? username : password}
                        onChange={e => i === 0 ? setUsername(e.target.value) : setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        autoComplete={i === 0 ? 'username' : 'current-password'}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                      />
                    </div>
                  ))}
                  {error && <p className="text-[11px] text-center mb-3" style={{ color: '#e74c3c' }}>{error}</p>}
                  <button onClick={handleLogin} disabled={loading}
                    className="w-full py-3 rounded-lg text-sm font-bold tracking-[0.3em] uppercase transition-all hover:opacity-85 disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)' }}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="qc" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="text-center">
                  {!qcCode ? (
                    <>
                      <p className="text-sm mb-4" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                        Use Quick Connect to sign in from the Jellyfin mobile app or web interface.
                      </p>
                      {error && <p className="text-[11px] mb-3" style={{ color: '#e74c3c' }}>{error}</p>}
                      <button onClick={startQuickConnect} disabled={loading}
                        className="w-full py-3 rounded-lg text-sm font-bold tracking-[0.3em] uppercase transition-all hover:opacity-85 disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)' }}>
                        {loading ? 'Initiating…' : 'Get Code'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--muted)' }}>Enter this code in Jellyfin</p>
                      <div className="text-5xl font-bold tracking-[0.4em] my-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                        {qcCode}
                      </div>
                      <div className="flex items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} />
                        <span className="text-xs">Waiting for approval…</span>
                      </div>
                      <button onClick={() => { setQcCode(''); setQcSecret(''); setQcPolling(false) }}
                        className="mt-4 text-xs" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                        Cancel
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Server info + setup link */}
        <div className="mt-5 text-center space-y-2">
          {serverInfo?.configured ? (
            <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.35 }}>
              {(serverInfo as any).JELLYFIN_URL || 'Connected'}
            </p>
          ) : (
            <p className="text-[10px] font-bold" style={{ color: '#e67e22' }}>
              ⚠ No Jellyfin server configured
            </p>
          )}
          <button
            onClick={() => { setOnboarded(false); navigate('/setup') }}
            className="text-[9px] tracking-wide transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)', opacity: 0.45, display: 'block', margin: '0 auto' }}>
            ⚙ Setup wizard / Change server
          </button>
        </div>

      </div>
    </div>
  )
}
