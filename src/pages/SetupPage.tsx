import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, Server, Key, Film, Palette, Loader, AlertCircle, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'

type Status = 'idle' | 'testing' | 'ok' | 'error'

function Field({ label, value, onChange, type = 'text', placeholder = '', hint = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; hint?: string
}) {
  return (
    <div className="mb-4">
      <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)', opacity: 0.5 }}>{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
        style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
      {hint && <p className="text-[9px] mt-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>{hint}</p>}
    </div>
  )
}

function TestButton({ label, onTest, disabled }: { label: string; onTest: () => void; disabled?: boolean }) {
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState('')
  const run = async () => {
    setStatus('testing')
    try {
      const r = await onTest() as any
      setStatus('ok')
      setMsg(r?.name || r?.message || 'Connected')
    } catch (e: any) {
      setStatus('error')
      setMsg(e?.message || 'Failed')
    }
  }
  return (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={run} disabled={disabled || status === 'testing'}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold disabled:opacity-40 hover:opacity-80"
        style={{ background: status === 'ok' ? 'rgba(46,204,113,0.15)' : 'var(--subtle)', border: `1px solid ${status === 'ok' ? '#2ecc71' : 'var(--border2)'}`, color: status === 'ok' ? '#2ecc71' : 'var(--muted)' }}>
        {status === 'testing' ? <Loader size={11} className="animate-spin" /> : status === 'ok' ? <CheckCircle size={11} /> : status === 'error' ? <AlertCircle size={11} /> : null}
        Test {label}
      </button>
      {msg && <p className="text-[10px]" style={{ color: status === 'ok' ? '#2ecc71' : '#e74c3c' }}>{msg}</p>}
    </div>
  )
}

const STEPS = [
  { id: 'jellyfin', title: 'Jellyfin Server',   icon: Server, required: true  },
  { id: 'plex',     title: 'Plex (optional)',    icon: Film,   required: false },
  { id: 'extras',   title: 'API Keys',           icon: Key,    required: false },
  { id: 'theme',    title: 'Appearance',         icon: Palette,required: false },
  { id: 'done',     title: 'Ready',              icon: Check,  required: false },
]

const THEMES = [
  { id: 'cinema',   label: 'Cinema',   gradient: 'linear-gradient(135deg,#080604,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#040408,#4a9eff)' },
  { id: 'ember',    label: 'Ember',    gradient: 'linear-gradient(135deg,#0a0503,#ff6b35)' },
  { id: 'arctic',   label: 'Arctic',   gradient: 'linear-gradient(135deg,#050810,#64c8ff)' },
  { id: 'neon',     label: 'Neon',     gradient: 'linear-gradient(135deg,#030303,#00ff88)' },
  { id: 'rose',     label: 'Rose',     gradient: 'linear-gradient(135deg,#080406,#ff6b9d)' },
  { id: 'mocha',    label: 'Mocha',    gradient: 'linear-gradient(135deg,#1e1e2e,#cba6f7)' },
  { id: 'amoled',   label: 'Amoled',   gradient: 'linear-gradient(135deg,#000000,#00e5ff)' },
  { id: 'sunset',   label: 'Sunset',   gradient: 'linear-gradient(135deg,#0d0906,#ff8c42)' },
]

export default function SetupPage() {
  const store = useStore()
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string,string>>({
    JELLYFIN_URL: '', JELLYFIN_API_KEY: '',
    PLEX_URL: '', PLEX_TOKEN: '',
    TMDB_API_KEY: '',
  })

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  // Load existing config on mount
  useEffect(() => {
    api.get<any>('/api/config').then(cfg => {
      if (cfg && typeof cfg === 'object') {
        setForm(f => ({ ...f, ...cfg }))
      }
    }).catch(() => {})
  }, [])

  const saveStep = async () => {
    setSaving(true)
    try {
      await api.post('/api/config', form)
      localStorage.setItem('cf_setup_saved', String(Date.now()))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const next = async () => {
    await saveStep()
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  const finish = async () => {
    await saveStep()
    store.setOnboarded(true)
    // Force a full page reload so the server re-reads the new config
    // and AuthGuard sees configured=true cleanly
    window.location.replace('/login')
  }

  const canNext = () => {
    if (STEPS[step].id === 'jellyfin') return !!form.JELLYFIN_URL?.trim()
    return true
  }

  const cur = STEPS[step]

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', padding: '24px' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-[0.3em] uppercase mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</h1>
          <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.4 }}>Setup</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="rounded-full transition-all"
              style={{ width: i === step ? 24 : 8, height: 8,
                background: i < step ? 'var(--accent)' : i === step ? 'var(--accent)' : 'var(--border2)',
                opacity: i < step ? 0.5 : 1 }} />
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="rounded-2xl p-6 mb-4"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

            {/* Step header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.1)' }}>
                <cur.icon size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--cream)' }}>{cur.title}</p>
                <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>Step {step + 1} of {STEPS.length}</p>
              </div>
              {!cur.required && <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>Optional</span>}
            </div>

            {/* Jellyfin */}
            {cur.id === 'jellyfin' && <>
              <Field label="Jellyfin URL *" value={form.JELLYFIN_URL || ''} onChange={set('JELLYFIN_URL')}
                placeholder="http://192.168.1.125:8096" hint="Your Jellyfin server address" />
              <Field label="API Key" value={form.JELLYFIN_API_KEY || ''} onChange={set('JELLYFIN_API_KEY')}
                type="password" hint="Dashboard → Admin → API Keys. Leave blank to use username/password only." />
              <TestButton label="Connection" disabled={!form.JELLYFIN_URL}
                onTest={() => api.testJellyfin(form.JELLYFIN_URL)} />
            </>}

            {/* Plex */}
            {cur.id === 'plex' && <>
              <Field label="Plex URL" value={form.PLEX_URL || ''} onChange={set('PLEX_URL')}
                placeholder="http://192.168.1.125:32400" />
              <Field label="Plex Token" value={form.PLEX_TOKEN || ''} onChange={set('PLEX_TOKEN')}
                type="password" hint="Find at plex.tv/claim or in Plex Web developer tools." />
              {form.PLEX_URL && form.PLEX_TOKEN && (
                <TestButton label="Plex" onTest={() => api.testPlex(form.PLEX_URL, form.PLEX_TOKEN)} />
              )}
            </>}

            {/* Extras */}
            {cur.id === 'extras' && <>
              <Field label="TMDB API Key" value={form.TMDB_API_KEY || ''} onChange={set('TMDB_API_KEY')}
                type="password" hint="themoviedb.org → Settings → API. Enables trailers, trending, ratings." />
              <Field label="Jellyseerr URL" value={form.JELLYSEERR_URL || ''} onChange={set('JELLYSEERR_URL')}
                placeholder="http://192.168.1.125:5055" hint="For request management. Optional." />
              <Field label="Trakt Client ID" value={form.TRAKT_CLIENT_ID || ''} onChange={set('TRAKT_CLIENT_ID')}
                type="password" hint="trakt.tv → Settings → API. For scrobbling watch history." />
            </>}

            {/* Theme */}
            {cur.id === 'theme' && <>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }}>Choose a theme</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => store.setTheme(t.id as any)}
                    className="rounded-xl p-3 text-center transition-all hover:scale-105"
                    style={{ background: t.gradient, border: `2px solid ${store.theme === t.id ? 'white' : 'transparent'}` }}>
                    <p className="text-[9px] font-bold" style={{ color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{t.label}</p>
                  </button>
                ))}
              </div>
            </>}

            {/* Done */}
            {cur.id === 'done' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(46,204,113,0.1)' }}>
                  <Check size={32} style={{ color: '#2ecc71' }} />
                </div>
                <p className="text-lg font-bold mb-2" style={{ color: 'var(--cream)' }}>You're all set!</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Config saved. Click below to start using CyanFin.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3">
          {step > 0 && step < STEPS.length - 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-4 py-3 rounded-xl text-xs font-bold hover:opacity-70"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
              ← Back
            </button>
          )}
          {cur.id !== 'done' ? (
            <>
              {!cur.required && (
                <button onClick={() => setStep(s => s + 1)}
                  className="px-4 py-3 rounded-xl text-xs font-bold hover:opacity-70 flex-shrink-0"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  Skip
                </button>
              )}
              <button onClick={next} disabled={!canNext() || saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-40 hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                {saving ? <Loader size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
                {step === STEPS.length - 2 ? 'Save & Finish' : 'Save & Continue'}
                <ChevronRight size={14} />
              </button>
            </>
          ) : (
            <button onClick={finish}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold hover:opacity-80"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              <Check size={14} /> Go to CyanFin
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
