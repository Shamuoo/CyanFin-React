import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X, CheckCircle, XCircle, Loader } from 'lucide-react'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import ServerManager from '@/components/ui/ServerManager'
import type { Theme, Layout, Mode } from '@/types'

const themes: { id: Theme; label: string; gradient: string }[] = [
  { id: 'cinema',   label: 'Cinema',   gradient: 'linear-gradient(135deg,#0a0804,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#050810,#4a9eff)' },
  { id: 'ember',    label: 'Ember',    gradient: 'linear-gradient(135deg,#0d0805,#e8602a)' },
  { id: 'arctic',   label: 'Arctic',   gradient: 'linear-gradient(135deg,#e8eef5,#1a6fd4)' },
  { id: 'neon',     label: 'Neon',     gradient: 'linear-gradient(135deg,#060608,#00ffe0)' },
  { id: 'rose',     label: 'Rose',     gradient: 'linear-gradient(135deg,#0d0608,#e84393)' },
  { id: 'forest',   label: 'Forest',   gradient: 'linear-gradient(135deg,#060d08,#4caf7d)' },
  { id: 'slate',    label: 'Slate',    gradient: 'linear-gradient(135deg,#0a0b0e,#8b9cf4)' },
  { id: 'mocha',    label: 'Mocha',    gradient: 'linear-gradient(135deg,#1e1e2e,#cba6f7)' },
  { id: 'fluent',   label: 'Fluent',   gradient: 'linear-gradient(135deg,#0a0c10,#0078d4)' },
  { id: 'sakura',   label: 'Sakura',   gradient: 'linear-gradient(135deg,#0e0a0f,#ff6eb4)' },
  { id: 'amoled',   label: 'Amoled',   gradient: 'linear-gradient(135deg,#000000,#00e5ff)' },
  { id: 'sunset',   label: 'Sunset',   gradient: 'linear-gradient(135deg,#0d0906,#ff8c42)' },
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
  const [tab, setTab] = useState<'appearance' | 'playback' | 'servers' | 'integrations'>('appearance')
  const [intValues, setIntValues] = useState<Record<string, string>>({})

  // Load current config values from server
  useEffect(() => {
    api.config().then((cfg: any) => {
      const vals: Record<string, string> = {}
      integrationFields.forEach(f => {
        if (cfg[f.key] || cfg[f.key.toLowerCase()]) {
          vals[f.key] = cfg[f.key] || cfg[f.key.toLowerCase()] || ''
        }
      })
      // Also check common keys
      const keyMap: Record<string, string> = {
        JELLYFIN_BACKUP_URL: cfg.JELLYFIN_BACKUP_URL || '',
        PLEX_URL: cfg.PLEX_URL || cfg.plexUrl || '',
        PLEX_TOKEN: cfg.PLEX_TOKEN || '',
        TMDB_API_KEY: cfg.TMDB_API_KEY || cfg.tmdbKey || '',
        ANTHROPIC_API_KEY: cfg.ANTHROPIC_API_KEY || '',
        GEMINI_API_KEY: cfg.GEMINI_API_KEY || '',
        OMDB_API_KEY: cfg.OMDB_API_KEY || '',
        OLLAMA_URL: cfg.OLLAMA_URL || '',
        OLLAMA_MODEL: cfg.OLLAMA_MODEL || '',
        STREAMYSTATS_URL: cfg.STREAMYSTATS_URL || '',
        JELLYSEERR_URL: cfg.JELLYSEERR_URL || '',
        JELLYSEERR_API_KEY: cfg.JELLYSEERR_API_KEY || '',
        RADARR_URL: cfg.RADARR_URL || '',
        RADARR_API_KEY: cfg.RADARR_API_KEY || '',
        SONARR_URL: cfg.SONARR_URL || '',
        SONARR_API_KEY: cfg.SONARR_API_KEY || '',
        DISCORD_WEBHOOK_URL: cfg.DISCORD_WEBHOOK_URL || '',
        JELLYFIN_BACKUP_API_KEY: cfg.JELLYFIN_BACKUP_API_KEY || '',
        JELLYFIN_MODE: cfg.JELLYFIN_MODE || '',
      }
      setIntValues(prev => ({ ...keyMap, ...prev }))
    }).catch(() => {})
  }, [])
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
          {(['appearance', 'playback', 'servers', 'integrations'] as const).map(t => (
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
              <div className="grid grid-cols-3 gap-2 mb-1">
                {themes.map(t => (
                  <button key={t.id} onClick={() => store.setTheme(t.id)}
                    className="flex flex-col items-center gap-1 pb-1 group"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <div className="w-full h-7 rounded-lg transition-all"
                      style={{ background: t.gradient, border: store.theme === t.id ? '2px solid white' : '2px solid var(--border2)', outline: store.theme === t.id ? '1px solid rgba(255,255,255,0.3)' : 'none' }} />
                    <span className="text-[8px] font-bold" style={{ color: store.theme === t.id ? 'var(--accent)' : 'var(--muted)', opacity: store.theme === t.id ? 1 : 0.5 }}>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Accent colour */}
              <SectionTitle>Accent Colour</SectionTitle>
              <div className="flex items-center gap-3 mb-4">
                <input type="color" value={store.accentColor || '#c9a84c'}
                  onChange={e => store.setAccentColor(e.target.value)}
                  className="rounded cursor-pointer flex-shrink-0"
                  style={{ width: 36, height: 36, border: '1px solid var(--border2)', background: 'none', padding: 2 }} />
                <p className="text-xs flex-1" style={{ color: 'var(--muted)' }}>
                  {store.accentColor ? store.accentColor : 'Using theme default'}
                </p>
                {store.accentColor && (
                  <button onClick={() => store.setAccentColor(null)}
                    className="text-[9px] px-2 py-1 rounded hover:opacity-70"
                    style={{ color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                    Reset
                  </button>
                )}
              </div>

              {/* OLED toggle */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>OLED Mode</p>
                  <p className="text-[9px]" style={{ color: 'var(--muted)' }}>Pure black backgrounds</p>
                </div>
                <button onClick={() => store.setSetting('pureBlack' as any, !(store as any).pureBlack)}
                  className="relative rounded-full transition-all flex-shrink-0"
                  style={{ width: 40, height: 22, background: (store as any).pureBlack ? 'var(--accent)' : 'var(--border2)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: 'white', left: (store as any).pureBlack ? 20 : 2 }} />
                </button>
              </div>

              {/* Custom background */}
              <SectionTitle>Background Image</SectionTitle>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex-1 text-center py-2 rounded-lg cursor-pointer text-xs font-bold uppercase tracking-wide hover:opacity-80"
                    style={{ background: 'var(--subtle)', border: '1px dashed var(--border2)', color: 'var(--muted)' }}>
                    Upload Image
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      await api.uploadBackground(file)
                      store.setSetting('customBg' as any, true)
                    }} />
                  </label>
                  {(store as any).customBg && (
                    <button onClick={async () => { await api.deleteBackground(); store.setSetting('customBg' as any, false) }}
                      className="px-3 py-2 rounded-lg text-xs hover:opacity-80"
                      style={{ background: 'var(--subtle)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                      Remove
                    </button>
                  )}
                </div>
                {(store as any).customBg && (
                  <div className="w-full h-16 rounded-lg bg-cover bg-center"
                    style={{ backgroundImage: 'url(/api/config/background)', border: '1px solid var(--border2)', opacity: 0.7 }} />
                )}
                <p className="text-[8px] mt-1" style={{ color: 'var(--muted)', opacity: 0.4 }}>Shown as a subtle overlay behind all content</p>
              </div>

              <SectionTitle>Content Rating Filter</SectionTitle>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[['','All'],['G','G'],['PG','PG'],['PG-13','PG-13'],['R','R'],['NC-17','NC-17']].map(([v,l]) => (
                  <button key={v} onClick={() => store.setSetting('ageFilter' as any, v)}
                    className="px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all"
                    style={{ background: (store as any).ageFilter === v ? 'var(--accent)' : 'var(--subtle)', color: (store as any).ageFilter === v ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(store as any).ageFilter === v ? 'transparent' : 'var(--border2)'}` }}>
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-[8px] mb-4" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                Hides content rated above the selected level. Applied to all browse queries.
              </p>

              <SectionTitle>3D Content</SectionTitle>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>Show 3D Movies</p>
                  <p className="text-[9px]" style={{ color: 'var(--muted)' }}>Show "Best in 3D" row on home</p>
                </div>
                <button onClick={() => store.setSetting('show3D' as any, !(store as any).show3D)}
                  className="relative rounded-full flex-shrink-0"
                  style={{ width: 40, height: 22, background: (store as any).show3D ? 'var(--accent)' : 'var(--border2)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: 'white', left: (store as any).show3D ? 20 : 2 }} />
                </button>
              </div>

              <SectionTitle>Home Hero Style</SectionTitle>
              <div className="flex gap-2 mb-4">
                {([['cinematic','🎬 Cinematic'],['minimal','◻ Minimal'],['spotlight','✦ Spotlight']] as const).map(([id,label]) => (
                  <button key={id} onClick={() => store.setSetting('heroStyle' as any, id)}
                    className="flex-1 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all"
                    style={{ background: (store as any).heroStyle === id ? 'var(--accent)' : 'var(--subtle)', color: (store as any).heroStyle === id ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(store as any).heroStyle === id ? 'transparent' : 'var(--border2)'}` }}>
                    {label}
                  </button>
                ))}
              </div>

              <SectionTitle>Sidebar Width</SectionTitle>
              <div className="flex items-center gap-3 mb-4">
                <input type="range" min="140" max="280" step="10"
                  value={(store as any).sidebarWidth || 200}
                  onChange={e => store.setSetting('sidebarWidth' as any, parseInt(e.target.value))}
                  className="flex-1" style={{ accentColor: 'var(--accent)' }} />
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--muted)' }}>{(store as any).sidebarWidth || 200}px</span>
              </div>

              <SectionTitle>Custom CSS</SectionTitle>
              <textarea value={(store as any).customCSS || ''}
                onChange={e => store.setSetting('customCSS' as any, e.target.value)}
                placeholder="/* Your custom styles here */"
                className="w-full h-24 px-3 py-2 rounded-lg text-[10px] font-mono outline-none resize-none mb-4"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />

              <SectionTitle>Font Style</SectionTitle>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[['default','Default'],['rounded','Rounded'],['mono','Mono'],['serif','Serif']].map(([id,label]) => (
                  <button key={id} onClick={() => store.setSetting('fontStyle' as any, id)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{ background: (store as any).fontStyle === id ? 'var(--accent)' : 'var(--subtle)', color: (store as any).fontStyle === id ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(store as any).fontStyle === id ? 'transparent' : 'var(--border2)'}` }}>
                    {label}
                  </button>
                ))}
              </div>

              <SectionTitle>Card Size</SectionTitle>
              <div className="flex gap-2 mb-4">
                {([['small','Small'],['medium','Medium'],['large','Large']] as const).map(([id,label]) => (
                  <button key={id} onClick={() => store.setSetting('cardSize' as any, id)}
                    className="flex-1 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{ background: (store as any).cardSize === id ? 'var(--accent)' : 'var(--subtle)', color: (store as any).cardSize === id ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(store as any).cardSize === id ? 'transparent' : 'var(--border2)'}` }}>
                    {label}
                  </button>
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
                {(['claude', 'gemini', 'ollama'] as const).map(p => (
                  <button key={p} onClick={() => store.setSetting('aiProvider', p)}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded transition-all"
                    style={{ background: store.aiProvider === p ? 'var(--subtle)' : 'transparent', color: store.aiProvider === p ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${store.aiProvider === p ? 'var(--border)' : 'var(--border2)'}` }}>
                    {p === 'claude' ? '✦ Claude' : p === 'gemini' ? '◆ Gemini' : '⬡ Ollama'}
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

          {tab === 'appearance' && store.theme && (
            /* backup/restore at bottom of appearance tab */
            <></>
          )}

          {/* Backup/Restore - accessible from servers tab footer */}

          {tab === 'playback' && (
            <>
              <SectionTitle>Skip Length</SectionTitle>
              <div className="flex gap-2 mb-4">
                {([5, 10, 30] as const).map(s => {
                  const active = (store as any).skipLength === s
                  return (
                    <button key={s} onClick={() => store.setSetting('skipLength' as any, s)}
                      className="flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded transition-all"
                      style={{ background: active ? 'var(--subtle)' : 'transparent', color: active ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${active ? 'var(--border)' : 'var(--border2)'}` }}>
                      {s}s
                    </button>
                  )
                })}
              </div>

              <SectionTitle>Autoplay Next Episode</SectionTitle>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Auto-advance at episode end</p>
                <button onClick={() => store.setSetting('autoplayNext' as any, !(store as any).autoplayNext)}
                  className="relative rounded-full flex-shrink-0"
                  style={{ width: 40, height: 22, background: (store as any).autoplayNext ? 'var(--accent)' : 'var(--border2)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: 'white', left: (store as any).autoplayNext ? 20 : 2 }} />
                </button>
              </div>

              <SectionTitle>Preferred Subtitle Language</SectionTitle>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[['','None'],['eng','English'],['fre','French'],['ger','German'],['spa','Spanish'],['jpn','Japanese'],['kor','Korean']].map(([v,l]) => (
                  <button key={v} onClick={() => store.setSetting('preferredSubLang' as any, v)}
                    className="px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: (store as any).preferredSubLang === v ? 'var(--accent)' : 'var(--subtle)', color: (store as any).preferredSubLang === v ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(store as any).preferredSubLang === v ? 'transparent' : 'var(--border2)'}` }}>
                    {l}
                  </button>
                ))}
              </div>

              <SectionTitle>Max Streaming Quality</SectionTitle>
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {[[0,'Auto'],[2,'2 Mbps'],[4,'4 Mbps'],[8,'8 Mbps'],[20,'20 Mbps'],[40,'40 Mbps']].map(([v,l]) => (
                  <button key={v} onClick={() => store.setSetting('maxBitrate' as any, v)}
                    className="px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all"
                    style={{ background: (store as any).maxBitrate === v ? 'var(--accent)' : 'var(--subtle)', color: (store as any).maxBitrate === v ? 'var(--bg)' : 'var(--muted)', border: `1px solid ${(store as any).maxBitrate === v ? 'transparent' : 'var(--border2)'}` }}>
                    {l}
                  </button>
                ))}
              </div>

              <SectionTitle>Resume Threshold</SectionTitle>
              <p className="text-[9px] mb-2" style={{ color: 'var(--muted)' }}>
                Show "Resume" if watched more than {(store as any).resumeThreshold}%
              </p>
              <input type="range" min="1" max="20" step="1"
                value={(store as any).resumeThreshold}
                onChange={e => store.setSetting('resumeThreshold' as any, parseInt(e.target.value))}
                className="w-full mb-4" style={{ accentColor: 'var(--accent)' }} />

              <SectionTitle>Subtitles</SectionTitle>
              <p className="text-[9px] mb-1" style={{ color: 'var(--muted)' }}>Size: {(store as any).subtitleSize}%</p>
              <input type="range" min="60" max="160" step="10"
                value={(store as any).subtitleSize}
                onChange={e => store.setSetting('subtitleSize' as any, parseInt(e.target.value))}
                className="w-full mb-3" style={{ accentColor: 'var(--accent)' }} />
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>Subtitle colour</p>
                </div>
                <input type="color" value={(store as any).subtitleColor}
                  onChange={e => store.setSetting('subtitleColor' as any, e.target.value)}
                  className="rounded cursor-pointer flex-shrink-0 ml-auto"
                  style={{ width: 32, height: 32, border: '1px solid var(--border2)', background: 'none', padding: 2 }} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Background behind subs</p>
                <button onClick={() => store.setSetting('subtitleBg' as any, !(store as any).subtitleBg)}
                  className="relative rounded-full flex-shrink-0"
                  style={{ width: 40, height: 22, background: (store as any).subtitleBg ? 'var(--accent)' : 'var(--border2)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: 'white', left: (store as any).subtitleBg ? 20 : 2 }} />
                </button>
              </div>

              <SectionTitle>Interface</SectionTitle>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Show clock in nav</p>
                <button onClick={() => store.setSetting('showClock' as any, !(store as any).showClock)}
                  className="relative rounded-full flex-shrink-0"
                  style={{ width: 40, height: 22, background: (store as any).showClock ? 'var(--accent)' : 'var(--border2)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: 'white', left: (store as any).showClock ? 20 : 2 }} />
                </button>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Compact card spacing</p>
                <button onClick={() => store.setSetting('compactMode' as any, !(store as any).compactMode)}
                  className="relative rounded-full flex-shrink-0"
                  style={{ width: 40, height: 22, background: (store as any).compactMode ? 'var(--accent)' : 'var(--border2)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all"
                    style={{ width: 18, height: 18, background: 'white', left: (store as any).compactMode ? 20 : 2 }} />
                </button>
              </div>
            </>
          )}

          {tab === 'servers' && (
            <>
            <ServerManager />
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border2)' }}>
              <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.4 }}>Backup & Restore</p>
              <div className="flex gap-2">
                <button onClick={async () => {
                  const blob = await api.exportConfig()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url
                  a.download = `cyanfin-backup-${new Date().toISOString().slice(0,10)}.json`
                  a.click(); URL.revokeObjectURL(url)
                }}
                  className="flex-1 py-2 rounded-full text-xs font-bold hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  ↓ Export Config
                </button>
                <label className="flex-1 py-2 rounded-full text-xs font-bold text-center cursor-pointer hover:opacity-80"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  ↑ Import Config
                  <input type="file" accept=".json" className="hidden" onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return
                    const r = await api.importConfig(f)
                    if (r.ok) { import('@/components/ui/Toast').then(m => (m as any).toast?.success('Config restored — reload to apply')) }
                  }} />
                </label>
              </div>
            </div>
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

              <ServerManager />
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
