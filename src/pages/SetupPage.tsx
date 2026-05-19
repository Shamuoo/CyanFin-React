import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, Shield, Palette, Zap, ChevronRight, Check, Tv, Key, ArrowLeft, Wifi, HardDrive } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'

const STEPS = [
  { id: 'welcome',      icon: Zap,      title: 'Welcome to CyanFin' },
  { id: 'jellyfin',     icon: Server,   title: 'Connect Jellyfin' },
  { id: 'backup',       icon: Shield,   title: 'High Availability' },
  { id: 'plex',         icon: Tv,       title: 'Plex Fallback' },
  { id: 'integrations', icon: Key,      title: 'Integrations' },
  { id: 'appearance',   icon: Palette,  title: 'Appearance' },
  { id: 'done',         icon: Check,    title: 'All done' },
]

const THEMES = [
  { id: 'cinema',   label: 'Cinema',   gradient: 'linear-gradient(135deg,#0a0804,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#050810,#4a9eff)' },
  { id: 'ember',    label: 'Ember',    gradient: 'linear-gradient(135deg,#0d0805,#e8602a)' },
  { id: 'arctic',   label: 'Arctic',   gradient: 'linear-gradient(135deg,#e8eef5,#1a6fd4)' },
  { id: 'neon',     label: 'Neon',     gradient: 'linear-gradient(135deg,#060608,#00ffe0)' },
  { id: 'rose',     label: 'Rose',     gradient: 'linear-gradient(135deg,#0d0608,#e84393)' },
  { id: 'forest',   label: 'Forest',   gradient: 'linear-gradient(135deg,#060d08,#4caf7d)' },
  { id: 'slate',    label: 'Slate',    gradient: 'linear-gradient(135deg,#0a0b0e,#8b9cf4)' },
  { id: 'mocha',    label: 'Mocha',    gradient: 'linear-gradient(135deg,#1e1e2e,#cba6f7)' },
]

function Input({ label, value, onChange, placeholder, type = 'text', hint }: any) {
  return (
    <div className="mb-3">
      <label className="block text-[8px] font-bold tracking-[0.2em] uppercase mb-1.5" style={{ color: 'var(--muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
        style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
      {hint && <p className="text-[8px] mt-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>{hint}</p>}
    </div>
  )
}

function TestBtn({ label, onTest }: { label: string; onTest: () => Promise<boolean> }) {
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const test = async () => {
    setState('testing')
    const ok = await onTest().catch(() => false)
    setState(ok ? 'ok' : 'fail')
    setTimeout(() => setState('idle'), 3000)
  }
  return (
    <button onClick={test} className="mb-3 text-[9px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wide hover:opacity-80"
      style={{ background: state === 'ok' ? 'rgba(46,204,113,0.1)' : state === 'fail' ? 'rgba(231,76,60,0.1)' : 'var(--subtle)', color: state === 'ok' ? '#2ecc71' : state === 'fail' ? '#e74c3c' : 'var(--muted)', border: `1px solid ${state === 'ok' ? 'rgba(46,204,113,0.3)' : state === 'fail' ? 'rgba(231,76,60,0.3)' : 'var(--border2)'}` }}>
      {state === 'testing' ? '…' : state === 'ok' ? '✓ Connected' : state === 'fail' ? '✗ Failed' : `Test ${label}`}
    </button>
  )
}

export default function SetupPage() {
  const { setTheme, setOnboarded } = useStore() as any
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const theme = useStore(s => s.theme)

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const testJellyfin = async (url: string) => {
    if (!url) return false
    const r = await api.testJellyfin(url)
    return r.ok
  }

  const testPlex = async () => {
    if (!form.PLEX_URL || !form.PLEX_TOKEN) return false
    const r = await api.testPlex(form.PLEX_URL, form.PLEX_TOKEN)
    return r.ok
  }

  const next = async () => {
    if (step === STEPS.length - 2) {
      // Save config before going to Done
      setSaving(true)
      const toSave: Record<string, string> = {}
      Object.entries(form).forEach(([k, v]) => { if (v) toSave[k] = v })
      await api.saveConfig(toSave).catch(() => {})
      setSaving(false)
    }
    if (step === STEPS.length - 1) {
      setOnboarded(true)
      navigate('/login')
      return
    }
    setStep(s => s + 1)
  }

  const canNext = () => {
    if (step === 1) return !!form.JELLYFIN_URL
    return true
  }

  const stepContent = [
    // 0: Welcome
    <div key="welcome" className="text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ background: 'rgba(201,168,76,0.1)', border: '2px solid rgba(201,168,76,0.2)' }}>
        <Zap size={36} style={{ color: 'var(--accent)' }} />
      </div>
      <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.1em' }}>CyanFin</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        Cinema-quality home theater for Jellyfin.<br />
        Set up takes about 2 minutes.
      </p>
      <div className="grid grid-cols-2 gap-2 text-left">
        {[
          ['🎬', 'Cinematic UI', 'Full-screen detail pages with ratings, trailers, cast'],
          ['🔄', 'HA Failover', 'Primary → Backup Jellyfin → Plex → Offline cache'],
          ['🎨', 'Themes', '9 themes, custom accent colour, OLED mode'],
          ['📱', 'Any device', 'Web, Android TV, Android, iOS, Windows, Mac'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="p-3 rounded-xl" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
            <p className="text-base mb-1">{icon}</p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--cream)' }}>{title}</p>
            <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>,

    // 1: Primary Jellyfin
    <div key="jellyfin">
      <div className="flex items-center gap-2 mb-4">
        <Server size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Primary Jellyfin Server</h2>
      </div>
      <Input label="Jellyfin URL *" value={form.JELLYFIN_URL || ''} onChange={set('JELLYFIN_URL')}
        placeholder="http://192.168.1.x:8096"
        hint="Your Jellyfin server address including port" />
      <TestBtn label="Jellyfin" onTest={() => testJellyfin(form.JELLYFIN_URL)} />
      <Input label="API Key (optional)" value={form.JELLYFIN_API_KEY || ''} onChange={set('JELLYFIN_API_KEY')}
        placeholder="Your Jellyfin API key" type="password"
        hint="Dashboard → API Keys. Only needed for some features." />
      <p className="text-[9px] p-3 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--muted)', opacity: 0.7 }}>
        You'll sign in with your Jellyfin username and password on the next screen — you don't need an API key to use CyanFin.
      </p>
    </div>,

    // 2: Backup / HA
    <div key="backup">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>High Availability <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>optional</span></h2>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        CyanFin automatically fails over: Primary Jellyfin → Backup Jellyfin → Plex → Offline cache.
      </p>
      <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
        <p className="text-[9px] font-bold mb-2" style={{ color: 'var(--accent)', opacity: 0.6 }}>Failover chain</p>
        {['Primary Jellyfin', 'Backup Jellyfin (configure below)', 'Plex (configure next step)', 'Offline cache (automatic)'].map((item, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="text-[9px] w-4" style={{ color: 'var(--muted)', opacity: 0.4 }}>{i + 1}</span>
            <span className="text-[10px]" style={{ color: i === 0 ? '#2ecc71' : 'var(--muted)', opacity: i === 0 ? 1 : 0.6 }}>{item}</span>
          </div>
        ))}
      </div>
      <Input label="Backup Jellyfin URL" value={form.JELLYFIN_BACKUP_URL || ''} onChange={set('JELLYFIN_BACKUP_URL')}
        placeholder="http://192.168.1.x:8096 or remote URL"
        hint="A second Jellyfin instance — could be on another machine or site" />
      {form.JELLYFIN_BACKUP_URL && <TestBtn label="Backup" onTest={() => testJellyfin(form.JELLYFIN_BACKUP_URL)} />}
      <Input label="Backup Jellyfin API Key" value={form.JELLYFIN_BACKUP_API_KEY || ''} onChange={set('JELLYFIN_BACKUP_API_KEY')}
        placeholder="API key for backup server" type="password" />
      <div className="mt-2" style={{ borderTop: '1px solid var(--border2)', paddingTop: 12 }}>
        <Input label="Backup CyanFin URL" value={form.CYANFIN_BACKUP_URL || ''} onChange={set('CYANFIN_BACKUP_URL')}
          placeholder="http://second-machine:3002"
          hint="If you run CyanFin on two machines, the client will switch automatically" />
        <div className="flex gap-2 mt-2">
          <label className="text-[8px] font-bold tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Failover mode</label>
          {(['fastest','primary','backup'] as const).map(m => (
            <button key={m} onClick={() => set('JELLYFIN_MODE')(m)}
              className="px-2 py-1 text-[8px] font-bold uppercase rounded-full transition-all"
              style={{ background: (form.JELLYFIN_MODE || 'fastest') === m ? 'var(--accent)' : 'var(--subtle)', color: (form.JELLYFIN_MODE || 'fastest') === m ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(form.JELLYFIN_MODE || 'fastest') === m ? 'transparent' : 'var(--border2)'}` }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // 3: Plex
    <div key="plex">
      <div className="flex items-center gap-2 mb-4">
        <Tv size={16} style={{ color: '#e5a00d' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Plex <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>optional fallback</span></h2>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        When both Jellyfin servers are unreachable, CyanFin automatically serves content from Plex.
      </p>
      <Input label="Plex URL" value={form.PLEX_URL || ''} onChange={set('PLEX_URL')}
        placeholder="http://192.168.1.x:32400" />
      <Input label="Plex Token" value={form.PLEX_TOKEN || ''} onChange={set('PLEX_TOKEN')}
        placeholder="Your X-Plex-Token" type="password"
        hint="Sign into plex.tv → open any media → check Network tab for X-Plex-Token" />
      {form.PLEX_URL && form.PLEX_TOKEN && <TestBtn label="Plex" onTest={testPlex} />}
    </div>,

    // 4: Integrations
    <div key="integrations">
      <div className="flex items-center gap-2 mb-4">
        <Key size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Integrations <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>all optional</span></h2>
      </div>
      <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 320 }}>
        <p className="text-[8px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--accent)', opacity: 0.4 }}>Ratings & AI</p>
        <Input label="TMDB API Key" value={form.TMDB_API_KEY || ''} onChange={set('TMDB_API_KEY')}
          placeholder="themoviedb.org — free" type="password"
          hint="Enables trailers, ratings, upcoming releases, cast photos" />
        <Input label="OMDB API Key" value={form.OMDB_API_KEY || ''} onChange={set('OMDB_API_KEY')}
          placeholder="omdbapi.com — free" type="password"
          hint="Adds Rotten Tomatoes + Metacritic scores" />
        <Input label="Anthropic API Key" value={form.ANTHROPIC_API_KEY || ''} onChange={set('ANTHROPIC_API_KEY')}
          placeholder="sk-ant-..." type="password"
          hint="Powers the AI Navigator (⌘I)" />
        <p className="text-[8px] font-bold tracking-widest uppercase mb-2 mt-4" style={{ color: 'var(--accent)', opacity: 0.4 }}>Media Management</p>
        <Input label="Jellyseerr URL" value={form.JELLYSEERR_URL || ''} onChange={set('JELLYSEERR_URL')}
          placeholder="http://192.168.1.x:5055" />
        <Input label="Jellyseerr API Key" value={form.JELLYSEERR_API_KEY || ''} onChange={set('JELLYSEERR_API_KEY')}
          placeholder="" type="password" />
        <Input label="Discord Webhook" value={form.DISCORD_WEBHOOK_URL || ''} onChange={set('DISCORD_WEBHOOK_URL')}
          placeholder="https://discord.com/api/webhooks/..."
          hint="Server up/down alerts" />
      </div>
    </div>,

    // 5: Appearance
    <div key="appearance">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Choose your look</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id as any)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:opacity-80"
            style={{ background: theme === t.id ? 'rgba(255,255,255,0.06)' : 'transparent', border: `2px solid ${theme === t.id ? 'rgba(255,255,255,0.5)' : 'var(--border2)'}` }}>
            <div className="w-8 h-8 rounded-lg" style={{ background: t.gradient }} />
            <span className="text-[8px] font-bold tracking-wide uppercase" style={{ color: theme === t.id ? 'var(--accent)' : 'var(--muted)' }}>{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[9px] text-center" style={{ color: 'var(--muted)', opacity: 0.4 }}>More themes and accent colour customisation in Settings</p>
    </div>,

    // 6: Done
    <div key="done" className="text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: 'rgba(46,204,113,0.12)', border: '2px solid rgba(46,204,113,0.3)' }}>
        <Check size={28} color="#2ecc71" />
      </div>
      <h2 className="text-xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.1em' }}>You're all set</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
        CyanFin is ready. Sign in with your<br />Jellyfin account to get started.
      </p>
      <div className="text-left rounded-xl p-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
        <p className="text-[8px] font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Quick start tips</p>
        {[
          ['?',   'Press ? anywhere for keyboard shortcuts'],
          ['⌘I',  'Open AI Navigator for natural language search'],
          ['⊞',   'Edit button on home to customise rows'],
          ['⚙',   'Settings → Playback for skip length + autoplay'],
        ].map(([key, tip]) => (
          <div key={key} className="flex items-start gap-2 mb-2">
            <kbd className="text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 font-mono"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--accent)' }}>{key}</kbd>
            <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.6 }}>{tip}</p>
          </div>
        ))}
      </div>
    </div>,
  ]

  const StepIcon = STEPS[step].icon

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => i < step && setStep(i)}
              className="rounded-full transition-all"
              style={{ width: i === step ? 24 : 6, height: 6, background: i <= step ? 'var(--accent)' : 'var(--border2)', cursor: i < step ? 'pointer' : 'default' }} />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          {/* Step header */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border2)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(201,168,76,0.1)' }}>
              <StepIcon size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--cream)' }}>{STEPS[step].title}</p>
            <p className="ml-auto text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
              {step + 1} / {STEPS.length}
            </p>
          </div>

          <div className="p-5">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
                {stepContent[step]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-5 pb-5">
            <button onClick={() => step > 0 ? setStep(s => s - 1) : null}
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-all hover:opacity-70 ${step === 0 ? 'invisible' : ''}`}
              style={{ color: 'var(--muted)' }}>
              <ArrowLeft size={13} /> Back
            </button>

            <div className="flex items-center gap-2">
              {step > 0 && step < STEPS.length - 1 && (
                <button onClick={() => setStep(s => s + 1)}
                  className="text-xs hover:opacity-70 px-3 py-2"
                  style={{ color: 'var(--muted)', opacity: 0.5 }}>
                  Skip
                </button>
              )}
              <button onClick={next} disabled={!canNext() || saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)' }}>
                {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Sign in →' : 'Next'} {step < STEPS.length - 1 && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
