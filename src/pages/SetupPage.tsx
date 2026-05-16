import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, ChevronLeft, Server, Tv, Key, Palette, SkipForward } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'

const THEMES = [
  { id: 'cinema', label: 'Cinema', color: '#c9a84c' },
  { id: 'midnight', label: 'Midnight', color: '#5da8f0' },
  { id: 'ember', label: 'Ember', color: '#e8784a' },
  { id: 'arctic', label: 'Arctic', color: '#2ecc71' },
  { id: 'neon', label: 'Neon', color: '#00ffcc' },
] as const

const STEPS = ['Welcome', 'Jellyfin', 'Plex', 'Integrations', 'Appearance', 'Done']

export default function SetupPage() {
  const { setOnboarded, setTheme, theme } = useStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [testMsg, setTestMsg] = useState('')

  const [form, setForm] = useState({
    JELLYFIN_URL: '',
    PLEX_URL: '',
    PLEX_TOKEN: '',
    TMDB_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    GEMINI_API_KEY: '',
    OMDB_API_KEY: '',
    JELLYSEERR_URL: '',
    JELLYSEERR_API_KEY: '',
    RADARR_URL: '',
    RADARR_API_KEY: '',
    SONARR_URL: '',
    SONARR_API_KEY: '',
    DISCORD_WEBHOOK_URL: '',
    OLLAMA_URL: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const testJellyfin = async () => {
    if (!form.JELLYFIN_URL) return
    setTesting(true); setTestResult(null)
    try {
      await api.saveConfig({ JELLYFIN_URL: form.JELLYFIN_URL.replace(/\/$/, '') })
      const r = await fetch(`${form.JELLYFIN_URL.replace(/\/$/, '')}/System/Info/Public`).then(r => r.json())
      setTestResult('ok')
      setTestMsg(`Connected to ${r.ServerName || 'Jellyfin'} v${r.Version || ''}`)
    } catch(e: any) {
      setTestResult('fail')
      setTestMsg('Could not connect. Check the URL and make sure Jellyfin is running.')
    }
    setTesting(false)
  }

  const saveAndFinish = async () => {
    setSaving(true)
    const toSave: Record<string, string> = {}
    Object.entries(form).forEach(([k, v]) => { if (v.trim()) toSave[k] = v.trim() })
    await api.saveConfig(toSave).catch(() => {})
    setOnboarded(true)
    navigate('/')
  }

  const inp = (key: string, label: string, placeholder: string, secret = false, hint = '') => (
    <div className="mb-4">
      <label className="block text-[9px] font-bold tracking-[0.2em] uppercase mb-1.5" style={{ color: 'var(--muted)' }}>{label}</label>
      <input type={secret ? 'password' : 'text'} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        placeholder={placeholder} autoComplete="off"
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
        style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
      {hint && <p className="text-[9px] mt-1" style={{ color: 'var(--muted)', opacity: 0.5 }}>{hint}</p>}
    </div>
  )

  const stepContent = [
    // 0: Welcome
    <div key="welcome" className="text-center">
      <div className="text-6xl mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', letterSpacing: '0.3em' }}>CYANFIN</div>
      <p className="text-sm mb-2" style={{ color: 'var(--cream)' }}>Your personal home theater frontend</p>
      <p className="text-xs leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--muted)' }}>
        Let's get you set up. You'll connect your Jellyfin server, add optional integrations, and choose your theme. This only takes a minute.
      </p>
    </div>,

    // 1: Jellyfin
    <div key="jellyfin">
      <div className="flex items-center gap-2 mb-4">
        <Server size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Jellyfin Server</h2>
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>Your main media server. Required to log in and browse your library.</p>
      {inp('JELLYFIN_URL', 'Jellyfin URL', 'http://192.168.1.x:8096', false, 'The IP and port of your Jellyfin instance on your local network')}
      <button onClick={testJellyfin} disabled={testing || !form.JELLYFIN_URL}
        className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:opacity-85 disabled:opacity-40 mb-3"
        style={{ background: testResult === 'ok' ? 'rgba(46,204,113,0.15)' : testResult === 'fail' ? 'rgba(231,76,60,0.1)' : 'var(--subtle)', color: testResult === 'ok' ? '#2ecc71' : testResult === 'fail' ? '#e74c3c' : 'var(--muted)', border: `1px solid ${testResult === 'ok' ? 'rgba(46,204,113,0.3)' : testResult === 'fail' ? 'rgba(231,76,60,0.25)' : 'var(--border)'}` }}>
        {testing ? 'Testing…' : testResult === 'ok' ? '✓ Connected' : testResult === 'fail' ? '✗ Failed' : 'Test Connection'}
      </button>
      {testMsg && <p className="text-[10px] text-center mb-3" style={{ color: testResult === 'ok' ? '#2ecc71' : '#e74c3c' }}>{testMsg}</p>}
    </div>,

    // 2: Plex
    <div key="plex">
      <div className="flex items-center gap-2 mb-4">
        <Tv size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Plex Server <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>optional</span></h2>
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>Add a Plex server as a backup or second source. CyanFin can monitor its status alongside Jellyfin.</p>
      {inp('PLEX_URL', 'Plex URL', 'http://192.168.1.x:32400', false, 'Your Plex Media Server address')}
      {inp('PLEX_TOKEN', 'Plex Token', 'Your X-Plex-Token', true, 'Sign into plex.tv → open any media → check Network tab for X-Plex-Token')}
    </div>,

    // 3: Integrations
    <div key="integrations">
      <div className="flex items-center gap-2 mb-4">
        <Key size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Integrations <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>all optional</span></h2>
      </div>
      <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 340 }}>
        <p className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--accent)', opacity: 0.4 }}>AI</p>
        {inp('ANTHROPIC_API_KEY', 'Anthropic (Claude)', 'sk-ant-...', true, 'claude.ai → API keys')}
        {inp('GEMINI_API_KEY', 'Gemini', 'AIza...', true, 'aistudio.google.com')}
        {inp('OLLAMA_URL', 'Ollama (local AI)', 'http://localhost:11434', false, 'If you run Ollama locally')}
        <p className="text-[9px] font-bold tracking-widest uppercase mb-2 mt-4" style={{ color: 'var(--accent)', opacity: 0.4 }}>Ratings</p>
        {inp('TMDB_API_KEY', 'TMDB', 'API key from themoviedb.org', true)}
        {inp('OMDB_API_KEY', 'OMDB', 'API key from omdbapi.com (RT + Metacritic)', true)}
        <p className="text-[9px] font-bold tracking-widest uppercase mb-2 mt-4" style={{ color: 'var(--accent)', opacity: 0.4 }}>Media Management</p>
        {inp('JELLYSEERR_URL', 'Jellyseerr URL', 'http://192.168.1.x:5055')}
        {inp('JELLYSEERR_API_KEY', 'Jellyseerr API Key', '', true)}
        {inp('RADARR_URL', 'Radarr URL', 'http://192.168.1.x:7878')}
        {inp('RADARR_API_KEY', 'Radarr API Key', '', true)}
        {inp('SONARR_URL', 'Sonarr URL', 'http://192.168.1.x:8989')}
        {inp('SONARR_API_KEY', 'Sonarr API Key', '', true)}
        {inp('DISCORD_WEBHOOK_URL', 'Discord Webhook', 'https://discord.com/api/webhooks/...')}
      </div>
    </div>,

    // 4: Appearance
    <div key="appearance">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--cream)' }}>Choose your theme</h2>
      </div>
      <div className="grid grid-cols-5 gap-2 mb-6">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id as any)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
            style={{ background: theme === t.id ? 'rgba(255,255,255,0.08)' : 'transparent', border: `2px solid ${theme === t.id ? t.color : 'var(--border2)'}` }}>
            <div className="w-6 h-6 rounded-full" style={{ background: t.color }} />
            <span className="text-[8px] font-bold tracking-wide uppercase" style={{ color: theme === t.id ? t.color : 'var(--muted)' }}>{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-center" style={{ color: 'var(--muted)', opacity: 0.5 }}>You can change this anytime in Settings</p>
    </div>,

    // 5: Done
    <div key="done" className="text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(46,204,113,0.15)', border: '2px solid rgba(46,204,113,0.3)' }}>
        <Check size={28} color="#2ecc71" />
      </div>
      <h2 className="text-xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', letterSpacing: '0.1em' }}>You're all set</h2>
      <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>CyanFin is ready. Sign in with your Jellyfin account to get started.</p>
      <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>You can always update these settings later from the Settings panel.</p>
    </div>,
  ]

  const canNext = step === 0 || step === 2 || step === 3 || step === 4 || step === 5 || (step === 1 && !!form.JELLYFIN_URL)
  const isLast = step === STEPS.length - 1

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="rounded-full transition-all"
                style={{ width: i === step ? 24 : 8, height: 8, background: i <= step ? 'var(--accent)' : 'var(--border2)' }} />
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => step > 0 ? setStep(s => s - 1) : null}
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-all hover:opacity-70 ${step === 0 ? 'invisible' : ''}`}
              style={{ color: 'var(--muted)' }}>
              <ChevronLeft size={14} /> Back
            </button>

            <div className="flex gap-2">
              {step > 0 && step < STEPS.length - 1 && (
                <button onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-all hover:opacity-70"
                  style={{ color: 'var(--muted)' }}>
                  <SkipForward size={12} /> Skip
                </button>
              )}
              {isLast ? (
                <button onClick={saveAndFinish} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all hover:opacity-85 disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  {saving ? 'Saving…' : 'Get Started'} <ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all hover:opacity-85 disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Next <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
