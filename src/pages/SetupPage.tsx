import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader, CheckCircle, AlertCircle, ChevronRight, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'

const THEMES = [
  { id: 'cinema',   label: 'Cinema',   g: 'linear-gradient(135deg,#080604,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', g: 'linear-gradient(135deg,#040408,#4a9eff)' },
  { id: 'ember',    label: 'Ember',    g: 'linear-gradient(135deg,#0a0503,#ff6b35)' },
  { id: 'arctic',   label: 'Arctic',   g: 'linear-gradient(135deg,#050810,#64c8ff)' },
  { id: 'neon',     label: 'Neon',     g: 'linear-gradient(135deg,#030303,#00ff88)' },
  { id: 'rose',     label: 'Rose',     g: 'linear-gradient(135deg,#080406,#ff6b9d)' },
  { id: 'mocha',    label: 'Mocha',    g: 'linear-gradient(135deg,#1e1e2e,#cba6f7)' },
  { id: 'amoled',   label: 'Amoled',   g: 'linear-gradient(135deg,#000000,#00e5ff)' },
  { id: 'sunset',   label: 'Sunset',   g: 'linear-gradient(135deg,#0d0906,#ff8c42)' },
]

type Screen = 'welcome' | 'jellyfin' | 'optional' | 'theme' | 'saving' | 'done'

export default function SetupPage() {
  const store = useStore()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [error, setError] = useState('')

  // Core fields — stored separately, never loaded from server (avoids masked value bug)
  const [jellyfinUrl,    setJellyfinUrl]    = useState('')
  const [jellyfinApiKey, setJellyfinApiKey] = useState('')
  const [jellyfinServers, setJellyfinServers] = useState<{url:string; apiKey:string; name:string}[]>([])
  const [plexUrl,    setPlexUrl]    = useState('')
  const [plexToken,  setPlexToken]  = useState('')
  const [tmdbKey,    setTmdbKey]    = useState('')

  // Test state
  const [testing, setTesting]       = useState(false)
  const [testOk,  setTestOk]        = useState(false)
  const [testMsg, setTestMsg]       = useState('')
  const [serverName, setServerName] = useState('')

  const testJellyfin = async (url: string) => {
    if (!url.trim()) return
    setTesting(true); setTestOk(false); setTestMsg(''); setError('')
    try {
      const r = await api.testJellyfin(url.trim()) as any
      setTestOk(true)
      setServerName(r?.name || r?.ServerName || 'Jellyfin')
      setTestMsg(`Connected to ${r?.name || r?.ServerName || 'Jellyfin'}`)
    } catch (e: any) {
      setTestOk(false)
      setTestMsg(e?.message || 'Could not connect — check the URL and port')
      setError(e?.message || 'Connection failed')
    }
    setTesting(false)
  }

  const saveAndContinue = async () => {
    setScreen('saving')
    setError('')
    try {
      // Build the JELLYFIN_SERVERS array
      const primaryServer = {
        id: 'jf-primary',
        name: serverName || 'Primary',
        url:    jellyfinUrl.trim().replace(/\/$/, ''),
        apiKey: jellyfinApiKey.trim(),
        priority: 0,
        enabled: true,
      }
      const extraServers = jellyfinServers.map((s, i) => ({
        id: `jf-${i+2}`,
        name: s.name || `Server ${i+2}`,
        url:    s.url.trim().replace(/\/$/, ''),
        apiKey: s.apiKey.trim(),
        priority: i + 1,
        enabled: true,
      }))
      const allServers = [primaryServer, ...extraServers]

      // Build config payload — only include fields the user actually filled in
      const payload: Record<string, string> = {
        JELLYFIN_URL:     primaryServer.url,
        JELLYFIN_API_KEY: primaryServer.apiKey,
        JELLYFIN_SERVERS: JSON.stringify(allServers),
      }
      if (plexUrl.trim())   payload.PLEX_URL   = plexUrl.trim()
      if (plexToken.trim()) payload.PLEX_TOKEN  = plexToken.trim()
      if (tmdbKey.trim())   payload.TMDB_API_KEY = tmdbKey.trim()

      // Save directly to the config save endpoint
      const res = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || `Save failed (${res.status})`)
      }

      localStorage.setItem('cf_setup_saved', String(Date.now()))
      store.setOnboarded(true)
      setScreen('done')
    } catch (e: any) {
      setError(e.message || 'Save failed')
      setScreen('jellyfin')
    }
  }

  const goHome = () => {
    window.location.replace('/login')
  }

  // ── Screens ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-lg font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
          CyanFin
        </p>
        {screen !== 'welcome' && screen !== 'saving' && screen !== 'done' && (
          <button onClick={goHome} className="text-xs hover:opacity-70" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            Skip setup →
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">

          {/* ── WELCOME ─────────────────────────────────────────────────── */}
          {screen === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <span style={{ fontSize: 36 }}>🎬</span>
              </div>
              <h1 className="text-4xl font-bold tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--cream)', fontFamily: 'var(--font-display)' }}>
                CyanFin
              </h1>
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Self-hosted media client for Jellyfin &amp; Plex</p>
              <p className="text-xs mb-10" style={{ color: 'var(--muted)', opacity: 0.4 }}>Let's connect to your server. This takes about 60 seconds.</p>
              <button onClick={() => setScreen('jellyfin')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold hover:opacity-90 active:scale-98"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                Get started <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ── JELLYFIN ────────────────────────────────────────────────── */}
          {screen === 'jellyfin' && (
            <motion.div key="jellyfin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md">
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--cream)' }}>Jellyfin Server</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--muted)', opacity: 0.5 }}>Enter your Jellyfin server URL and test the connection.</p>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)' }}>
                  <AlertCircle size={14} color="#e74c3c" className="flex-shrink-0 mt-0.5" />
                  <p className="text-xs" style={{ color: '#e74c3c' }}>{error}</p>
                </div>
              )}

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                    Server URL *
                  </label>
                  <input value={jellyfinUrl}
                    onChange={e => { setJellyfinUrl(e.target.value); setTestOk(false); setTestMsg('') }}
                    onBlur={e => { if (e.target.value) testJellyfin(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter') testJellyfin(jellyfinUrl) }}
                    placeholder="http://192.168.1.125:8096"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg2)', border: `1px solid ${testOk ? '#2ecc71' : 'var(--border2)'}`, color: 'var(--cream)' }} />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                    API Key <span style={{ opacity: 0.4 }}>(optional)</span>
                  </label>
                  <input value={jellyfinApiKey} onChange={e => setJellyfinApiKey(e.target.value)}
                    placeholder="From Jellyfin Dashboard → Admin → API Keys"
                    type="password"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                </div>
              </div>

              {/* Test result */}
              <div className="mb-4 min-h-[32px] flex items-center gap-2">
                {testing && <><Loader size={13} className="animate-spin" style={{ color: 'var(--muted)' }} /><span className="text-xs" style={{ color: 'var(--muted)' }}>Testing connection…</span></>}
                {!testing && testOk && <><CheckCircle size={13} color="#2ecc71" /><span className="text-xs" style={{ color: '#2ecc71' }}>{testMsg}</span></>}
                {!testing && testMsg && !testOk && <><AlertCircle size={13} color="#e74c3c" /><span className="text-xs" style={{ color: '#e74c3c' }}>{testMsg}</span></>}
              </div>

              {/* Extra servers */}
              {jellyfinServers.map((s, i) => (
                <div key={i} className="mb-3 p-3 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>Server {i + 2}</p>
                    <button onClick={() => setJellyfinServers(prev => prev.filter((_, j) => j !== i))}
                      style={{ color: '#e74c3c' }}><Trash2 size={12} /></button>
                  </div>
                  <input value={s.name} onChange={e => setJellyfinServers(prev => prev.map((x,j) => j===i ? {...x,name:e.target.value} : x))}
                    placeholder="Name (e.g. NAS 2)" className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-2"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                  <input value={s.url} onChange={e => setJellyfinServers(prev => prev.map((x,j) => j===i ? {...x,url:e.target.value} : x))}
                    placeholder="http://192.168.1.126:8096" className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-2"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                  <input value={s.apiKey} onChange={e => setJellyfinServers(prev => prev.map((x,j) => j===i ? {...x,apiKey:e.target.value} : x))}
                    placeholder="API Key" type="password" className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                </div>
              ))}

              <button onClick={() => setJellyfinServers(prev => [...prev, { url:'', apiKey:'', name:'' }])}
                className="flex items-center gap-1.5 text-xs mb-6 hover:opacity-70"
                style={{ color: 'var(--muted)', opacity: 0.5 }}>
                <Plus size={12} /> Add another Jellyfin server
              </button>

              <div className="flex gap-3">
                <button onClick={() => testJellyfin(jellyfinUrl)} disabled={!jellyfinUrl || testing}
                  className="px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-30 hover:opacity-80"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  {testing ? <Loader size={14} className="animate-spin" /> : 'Test'}
                </button>
                <button onClick={() => setScreen('optional')} disabled={!jellyfinUrl}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-30 hover:opacity-90"
                  style={{ background: jellyfinUrl ? 'var(--accent)' : 'var(--bg2)', color: jellyfinUrl ? 'var(--bg)' : 'var(--muted)', border: jellyfinUrl ? 'none' : '1px solid var(--border2)' }}>
                  Continue <ChevronRight size={16} />
                </button>
              </div>

              <p className="text-center text-[9px] mt-3" style={{ color: 'var(--muted)', opacity: 0.3 }}>
                You can change all settings later in Settings → Server
              </p>
            </motion.div>
          )}

          {/* ── OPTIONAL ────────────────────────────────────────────────── */}
          {screen === 'optional' && (
            <motion.div key="optional" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md">
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--cream)' }}>Optional Services</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--muted)', opacity: 0.5 }}>All optional. Skip if you don't use these.</p>

              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)', opacity: 0.6 }}>Plex</p>
                  <input value={plexUrl} onChange={e => setPlexUrl(e.target.value)} placeholder="Plex URL  (http://…:32400)"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-2"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                  <input value={plexToken} onChange={e => setPlexToken(e.target.value)} placeholder="Plex Token" type="password"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)', opacity: 0.6 }}>TMDB — trailers, ratings, trending</p>
                  <input value={tmdbKey} onChange={e => setTmdbKey(e.target.value)} placeholder="TMDB API Key (themoviedb.org → Settings → API)" type="password"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setScreen('jellyfin')}
                  className="px-5 py-3 rounded-xl text-sm font-bold hover:opacity-70"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>← Back</button>
                <button onClick={() => setScreen('theme')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold hover:opacity-90"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── THEME ───────────────────────────────────────────────────── */}
          {screen === 'theme' && (
            <motion.div key="theme" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md">
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--cream)' }}>Pick a theme</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--muted)', opacity: 0.5 }}>You can change this any time in Settings.</p>

              <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => store.setTheme(t.id as any)}
                    className="rounded-2xl p-4 text-center transition-all hover:scale-105 active:scale-98"
                    style={{ background: t.g, border: `2px solid ${store.theme === t.id ? 'white' : 'transparent'}`, boxShadow: store.theme === t.id ? '0 0 0 3px rgba(255,255,255,0.15)' : 'none' }}>
                    <p className="text-xs font-bold" style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{t.label}</p>
                    {store.theme === t.id && <p style={{ fontSize: 10, color: 'white', opacity: 0.8 }}>✓</p>}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setScreen('optional')}
                  className="px-5 py-3 rounded-xl text-sm font-bold hover:opacity-70"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>← Back</button>
                <button onClick={saveAndContinue}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold hover:opacity-90"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Save &amp; Launch <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SAVING ──────────────────────────────────────────────────── */}
          {screen === 'saving' && (
            <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="w-full max-w-md text-center">
              <Loader size={40} className="animate-spin mx-auto mb-6" style={{ color: 'var(--accent)' }} />
              <p className="text-lg font-bold" style={{ color: 'var(--cream)' }}>Saving configuration…</p>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Connecting to your Jellyfin server</p>
            </motion.div>
          )}

          {/* ── DONE ────────────────────────────────────────────────────── */}
          {screen === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(46,204,113,0.15)', border: '2px solid #2ecc71' }}>
                <CheckCircle size={36} color="#2ecc71" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--cream)' }}>You're all set!</h2>
              <p className="text-sm mb-8" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                Connected to {serverName || 'Jellyfin'}. Sign in to start watching.
              </p>
              <button onClick={goHome}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold hover:opacity-90"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                Sign In <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
