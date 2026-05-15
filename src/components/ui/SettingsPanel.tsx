import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, CheckCircle, XCircle, Loader } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import type { Theme, Layout, Mode } from '@/types'

const themes: { id: Theme; label: string; gradient: string }[] = [
  { id: 'cinema',   label: 'Cinema',   gradient: 'linear-gradient(135deg,#0a0804,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#050810,#4a9eff)' },
  { id: 'ember',    label: 'Ember',    gradient: 'linear-gradient(135deg,#0d0805,#e8602a)' },
  { id: 'arctic',   label: 'Arctic',   gradient: 'linear-gradient(135deg,#e8eef5,#1a6fd4)' },
  { id: 'neon',     label: 'Neon',     gradient: 'linear-gradient(135deg,#060608,#00ffe0)' },
]

const integrationFields = [
  { key: 'JELLYSEERR_URL',     label: 'Jellyseerr URL',     placeholder: 'http://192.168.1.x:5055',   service: 'jellyseerr' },
  { key: 'JELLYSEERR_API_KEY', label: 'Jellyseerr API Key', placeholder: '••••••••',                  secret: true },
  { key: 'RADARR_URL',         label: 'Radarr URL',         placeholder: 'http://192.168.1.x:7878',   service: 'radarr' },
  { key: 'RADARR_API_KEY',     label: 'Radarr API Key',     placeholder: '••••••••',                  secret: true },
  { key: 'SONARR_URL',         label: 'Sonarr URL',         placeholder: 'http://192.168.1.x:8989',   service: 'sonarr' },
  { key: 'SONARR_API_KEY',     label: 'Sonarr API Key',     placeholder: '••••••••',                  secret: true },
  { key: 'TMDB_API_KEY',       label: 'TMDB API Key',       placeholder: '••••••••',                  secret: true, service: 'tmdb' },
  { key: 'ANTHROPIC_API_KEY',  label: 'Anthropic (AI)',     placeholder: 'sk-ant-...',                secret: true, service: 'anthropic' },
  { key: 'DISCORD_WEBHOOK_URL',label: 'Discord Webhook',    placeholder: 'https://discord.com/api/webhooks/...', service: 'discord' },
  { key: 'STREAMYSTATS_URL', label: 'Streamystats URL',   placeholder: 'http://192.168.1.x:8082',   service: 'streamystats' },
  { key: 'GEMINI_API_KEY',      label: 'Gemini API Key',     placeholder: 'AIza... (Google AI Studio)', secret: true, service: 'gemini' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3 mt-5" style={{ color: 'var(--accent)', opacity: 0.5 }}>{children}</p>
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const [tab, setTab] = useState<'appearance' | 'integrations'>('appearance')
  const [intValues, setIntValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [testResults, setTestResults] = useState<Record<string, 'loading' | 'ok' | 'fail'>>({})
  const [testMessages, setTestMessages] = useState<Record<string, string>>({})

  const testConnection = async (service: string) => {
    setTestResults(prev => ({ ...prev, [service]: 'loading' }))
    try {
      const r = await api.testIntegration(service)
      setTestResults(prev => ({ ...prev, [service]: r.ok ? 'ok' : 'fail' }))
      setTestMessages(prev => ({ ...prev, [service]: r.message || r.error || '' }))
      setTimeout(() => {
        setTestResults(prev => { const n = {...prev}; delete n[service]; return n })
        setTestMessages(prev => { const n = {...prev}; delete n[service]; return n })
      }, 5000)
    } catch(e: any) {
      setTestResults(prev => ({ ...prev, [service]: 'fail' }))
      setTestMessages(prev => ({ ...prev, [service]: e.message }))
    }
  }

  const saveIntegrations = async () => {
    setSaving(true); setSaveStatus('')
    const data = Object.fromEntries(Object.entries(intValues).filter(([,v]) => v.trim()))
    try {
      await api.saveConfig(data)
      setSaveStatus('✓ Saved')
      setIntValues({})
    } catch(e: any) {
      setSaveStatus('✗ ' + e.message)
    } finally { setSaving(false) }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      {/* Panel */}
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="fixed right-0 top-0 bottom-0 w-80 z-[91] flex flex-col overflow-hidden"
        style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--border2)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border2)' }}>
          <span className="text-xs font-bold tracking-[0.4em] uppercase" style={{ color: 'var(--accent)' }}>Settings</span>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border2)' }}>
          {(['appearance', 'integrations'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-[10px] font-bold tracking-widest uppercase transition-all"
              style={{ color: tab === t ? 'var(--accent)' : 'var(--muted)', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5">
          {tab === 'appearance' && (
            <>
              <SectionTitle>Theme</SectionTitle>
              <div className="grid grid-cols-5 gap-2">
                {themes.map(t => (
                  <button key={t.id} onClick={() => store.setTheme(t.id)} title={t.label}
                    className="h-8 rounded-lg transition-all"
                    style={{ background: t.gradient, border: store.theme === t.id ? '2px solid white' : '2px solid transparent', outline: store.theme === t.id ? '1px solid rgba(255,255,255,0.3)' : 'none' }} />
                ))}
              </div>

              <SectionTitle>Layout</SectionTitle>
              <div className="flex gap-2">
                {(['desktop','tv','mobile'] as Layout[]).map(l => (
                  <button key={l} onClick={() => store.setLayout(l)}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded transition-all"
                    style={{ background: store.layout === l ? 'var(--subtle)' : 'transparent', color: store.layout === l ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${store.layout === l ? 'var(--border)' : 'var(--border2)'}` }}>
                    {l}
                  </button>
                ))}
              </div>

              <SectionTitle>Toggles</SectionTitle>
              {([
                { key: 'showWeather' as const, label: 'Weather' },
                { key: 'showMusic' as const,   label: 'Music tab' },
                { key: 'showSS' as const,      label: 'Screensaver' },
                { key: 'playSounds' as const,  label: 'Sounds' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between mb-3">
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
                  <button onClick={() => store.setSetting(key, !store[key])}
                    className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
                    style={{ background: store[key] ? 'var(--accent)' : 'var(--bg3)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                      style={{ left: store[key] ? '22px' : '2px' }} />
                  </button>
                </div>
              ))}

              <SectionTitle>AI Navigator Provider</SectionTitle>
              <div className="flex gap-2 mb-4">
                {(['claude', 'gemini'] as const).map(p => (
                  <button key={p} onClick={() => store.setSetting('aiProvider', p)}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded transition-all"
                    style={{ background: store.aiProvider === p ? 'var(--subtle)' : 'transparent', color: store.aiProvider === p ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${store.aiProvider === p ? 'var(--border)' : 'var(--border2)'}` }}>
                    {p === 'claude' ? '✦ Claude' : '◆ Gemini'}
                  </button>
                ))}
              </div>
              <SectionTitle>Weather City</SectionTitle>
              <input value={store.city} onChange={e => store.setSetting('city', e.target.value)}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                placeholder="Brisbane" />
            </>
          )}

          {tab === 'integrations' && (
            <>
              <p className="text-[9px] leading-relaxed mb-4 p-3 rounded" style={{ color: 'var(--muted)', background: 'var(--subtle)', lineHeight: 1.7 }}>
                Values are saved to the server config. Leave blank to keep existing value. Env vars always take priority.
              </p>

              {integrationFields.map(f => (
                <div key={f.key} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>{f.label}</label>
                    {f.service && (
                      <button onClick={() => testConnection(f.service!)}
                        className="text-[8px] px-2 py-0.5 rounded-full flex items-center gap-1 transition-all hover:opacity-80"
                        style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                        {testResults[f.service] === 'loading' ? <Loader size={8} className="animate-spin" /> :
                         testResults[f.service] === 'ok' ? <><CheckCircle size={8} color="#2ecc71" /><span style={{ color: '#2ecc71' }}>OK</span></> :
                         testResults[f.service] === 'fail' ? <><XCircle size={8} color="#e74c3c" /><span style={{ color: '#e74c3c' }}>Fail</span></> :
                         'Test'}
                      </button>
                    )}
                  </div>
                  <input
                    type={f.secret ? 'password' : 'text'}
                    value={intValues[f.key] || ''}
                    onChange={e => setIntValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded text-xs outline-none"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                  />
                {f.service && testMessages[f.service] && (
                    <p className="text-[8px] mt-1" style={{ color: testResults[f.service] === 'ok' ? '#2ecc71' : '#e74c3c' }}>
                      {testMessages[f.service]}
                    </p>
                  )}
                </div>
              ))}

              <button onClick={saveIntegrations} disabled={saving}
                className="w-full py-2.5 rounded-lg text-xs font-bold tracking-[0.2em] uppercase mt-4 transition-all hover:opacity-85 disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)' }}>
                {saving ? 'Saving…' : '💾 Save Integrations'}
              </button>
              {saveStatus && (
                <p className="text-center text-[10px] mt-2" style={{ color: saveStatus.startsWith('✓') ? '#2ecc71' : '#e74c3c' }}>
                  {saveStatus}
                </p>
              )}
            </>
          )}
        </div>

        {/* User info */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border2)' }}>
          <p className="text-[9px]" style={{ color: 'var(--muted)' }}>Signed in as <span style={{ color: 'var(--cream)', opacity: 0.6 }}>{useStore.getState().user?.name}</span></p>
        </div>
      </motion.div>
    </>
  )
}
