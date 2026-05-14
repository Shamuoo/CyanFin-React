import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import api from '@/lib/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, jellyfinUrl } = useStore()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!username || !password) { setError('Enter username and password'); return }
    setLoading(true); setError('')
    try {
      const result = await api.login(username, password)
      setUser(result.user)
      navigate('/')
    } catch(e: any) {
      setError(e.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm p-10 rounded-2xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl tracking-[0.5em] mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</h1>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Jellyfin Home Theater</p>
        </div>
        {['Username', 'Password'].map((label, i) => (
          <div key={label} className="mb-4">
            <label className="block text-[8px] font-bold tracking-[0.2em] uppercase mb-1.5" style={{ color: 'var(--muted)' }}>{label}</label>
            <input
              type={i === 1 ? 'password' : 'text'}
              value={i === 0 ? username : password}
              onChange={e => i === 0 ? setUsername(e.target.value) : setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete={i === 0 ? 'username' : 'current-password'}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
            />
          </div>
        ))}
        {error && <p className="text-[11px] text-center mb-3" style={{ color: 'var(--red)' }}>{error}</p>}
        <button onClick={handleLogin} disabled={loading}
          className="w-full py-3 rounded-lg text-sm font-bold tracking-[0.3em] uppercase mt-2 transition-all hover:opacity-85 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)' }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        {jellyfinUrl && <p className="text-center text-[9px] mt-4" style={{ color: 'var(--muted)' }}>{jellyfinUrl}</p>}
      </div>
    </div>
  )
}
