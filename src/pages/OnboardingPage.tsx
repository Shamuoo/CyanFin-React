import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import api from '@/lib/api'
import type { Theme, Layout, Mode } from '@/types'

const themes: { id: Theme; label: string; gradient: string }[] = [
  { id: 'cinema', label: 'Cinema', gradient: 'linear-gradient(135deg,#0a0804,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#050810,#4a9eff)' },
  { id: 'ember', label: 'Ember', gradient: 'linear-gradient(135deg,#0d0805,#e8602a)' },
  { id: 'arctic', label: 'Arctic', gradient: 'linear-gradient(135deg,#e8eef5,#1a6fd4)' },
  { id: 'neon', label: 'Neon', gradient: 'linear-gradient(135deg,#060608,#00ffe0)' },
]

export default function OnboardingPage() {
  const store = useStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({ JELLYFIN_URL: '', TMDB_API_KEY: '', ANTHROPIC_API_KEY: '', JELLYSEERR_URL: '', JELLYSEERR_API_KEY: '', RADARR_URL: '', RADARR_API_KEY: '', SONARR_URL: '', SONARR_API_KEY: '', DISCORD_WEBHOOK_URL: '' })

  const handleDone = async () => {
    setSaving(true)
    const toSave = Object.fromEntries(Object.entries(config).filter(([,v]) => v.trim()))
    if (Object.keys(toSave).length) await api.saveConfig(toSave).catch(() => {})
    store.setOnboarded(true)
    navigate('/')
  }

  return (
    <div className="h-screen overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl tracking-[0.5em] mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>CyanFin</h1>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Setup</p>
        </div>

        {/* Theme */}
        <Section title="Theme">
          <div className="grid grid-cols-5 gap-2">
            {themes.map(t => (
              <button key={t.id} onClick={() => store.setTheme(t.id)}
                className="h-10 rounded-lg transition-all" title={t.label}
                style={{ background: t.gradient, border: store.theme === t.id ? '2px solid white' : '2px solid transparent' }} />
            ))}
          </div>
        </Section>

        {/* Layout */}
        <Section title="Layout">
          <div className="grid grid-cols-3 gap-2">
            {[{ id: 'desktop' as Layout, icon: '🖥', label: 'Desktop' }, { id: 'tv' as Layout, icon: '📺', label: 'TV' }, { id: 'mobile' as Layout, icon: '📱', label: 'Mobile' }].map(l => (
              <button key={l.id} onClick={() => store.setLayout(l.id)}
                className="py-3 rounded-lg transition-all"
                style={{ background: store.layout === l.id ? 'var(--subtle)' : 'transparent', border: `1px solid ${store.layout === l.id ? 'var(--border)' : 'var(--border2)'}`, color: store.layout === l.id ? 'var(--accent)' : 'var(--muted)' }}>
                <div className="text-xl mb-1">{l.icon}</div>
                <div className="text-[9px] font-bold tracking-wide uppercase">{l.label}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Mode */}
        <Section title="Mode">
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'advanced' as Mode, desc: 'All features, badges, library tools' }, { id: 'simple' as Mode, desc: 'Clean browsing only' }].map(m => (
              <button key={m.id} onClick={() => store.setMode(m.id)}
                className="py-3 px-4 rounded-lg text-left transition-all"
                style={{ background: store.mode === m.id ? 'var(--subtle)' : 'transparent', border: `1px solid ${store.mode === m.id ? 'var(--border)' : 'var(--border2)'}` }}>
                <div className="text-xs font-bold tracking-wide uppercase mb-1" style={{ color: store.mode === m.id ? 'var(--accent)' : 'var(--muted)' }}>{m.id}</div>
                <div className="text-[9px]" style={{ color: 'var(--muted)' }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
          {[
            { key: 'JELLYFIN_URL', label: 'Jellyfin URL', placeholder: 'http://192.168.1.x:8096' },
            { key: 'TMDB_API_KEY', label: 'TMDB API Key', placeholder: 'Optional — trailers & Coming Soon', secret: true },
            { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-... (optional — AI metadata fix)', secret: true },
            { key: 'JELLYSEERR_URL', label: 'Jellyseerr URL', placeholder: 'http://192.168.1.x:5055' },
            { key: 'JELLYSEERR_API_KEY', label: 'Jellyseerr API Key', placeholder: '••••••••', secret: true },
            { key: 'RADARR_URL', label: 'Radarr URL', placeholder: 'http://192.168.1.x:7878' },
            { key: 'RADARR_API_KEY', label: 'Radarr API Key', placeholder: '••••••••', secret: true },
            { key: 'SONARR_URL', label: 'Sonarr URL', placeholder: 'http://192.168.1.x:8989' },
            { key: 'SONARR_API_KEY', label: 'Sonarr API Key', placeholder: '••••••••', secret: true },
            { key: 'DISCORD_WEBHOOK_URL', label: 'Discord Webhook', placeholder: 'https://discord.com/api/webhooks/...' },
          ].map(f => (
            <div key={f.key} className="mb-3">
              <label className="block text-[8px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: 'var(--muted)' }}>{f.label}</label>
              <input type={f.secret ? 'password' : 'text'} value={config[f.key as keyof typeof config]}
                onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
            </div>
          ))}
          <p className="text-[9px] mt-4 p-3 rounded" style={{ color: 'var(--muted)', background: 'var(--subtle)', lineHeight: 1.7 }}>
            These values are saved to the server config. Env vars always take priority.
          </p>
        </Section>

        <button onClick={handleDone} disabled={saving}
          className="w-full py-3.5 rounded-lg text-sm font-bold tracking-[0.3em] uppercase mt-6 transition-all hover:opacity-85"
          style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-display)' }}>
          {saving ? 'Saving…' : 'Get Started →'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.6 }}>{title}</p>
      {children}
    </div>
  )
}
