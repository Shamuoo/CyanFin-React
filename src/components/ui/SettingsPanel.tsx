import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Theme, Layout, Mode } from '@/types'

const themes: { id: Theme; label: string; gradient: string }[] = [
  { id: 'cinema', label: 'Cinema', gradient: 'linear-gradient(135deg,#0a0804,#c9a84c)' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#050810,#4a9eff)' },
  { id: 'ember', label: 'Ember', gradient: 'linear-gradient(135deg,#0d0805,#e8602a)' },
  { id: 'arctic', label: 'Arctic', gradient: 'linear-gradient(135deg,#e8eef5,#1a6fd4)' },
  { id: 'neon', label: 'Neon', gradient: 'linear-gradient(135deg,#060608,#00ffe0)' },
]

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const store = useStore()

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-80 z-50 overflow-y-auto scrollbar-hide"
      style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--border2)' }}>
      <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border2)' }}>
        <span className="text-xs font-bold tracking-[0.4em] uppercase" style={{ color: 'var(--accent)' }}>Settings</span>
        <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={18} /></button>
      </div>

      <div className="p-5 space-y-6">
        {/* Theme */}
        <div>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Theme</p>
          <div className="grid grid-cols-5 gap-2">
            {themes.map(t => (
              <button key={t.id} onClick={() => store.setTheme(t.id)}
                className="h-8 rounded transition-all"
                style={{ background: t.gradient, border: store.theme === t.id ? '2px solid white' : '2px solid transparent' }}
                title={t.label} />
            ))}
          </div>
        </div>

        {/* Layout */}
        <div>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Layout</p>
          <div className="flex gap-2">
            {(['desktop','tv','mobile'] as Layout[]).map(l => (
              <button key={l} onClick={() => store.setLayout(l)}
                className="flex-1 py-2 text-xs font-bold tracking-wide uppercase rounded transition-all"
                style={{ background: store.layout === l ? 'var(--subtle)' : 'transparent', color: store.layout === l ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${store.layout === l ? 'var(--border)' : 'var(--border2)'}` }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Mode</p>
          <div className="flex gap-2">
            {(['advanced','simple'] as Mode[]).map(m => (
              <button key={m} onClick={() => store.setMode(m)}
                className="flex-1 py-2 text-xs font-bold tracking-wide uppercase rounded transition-all"
                style={{ background: store.mode === m ? 'var(--subtle)' : 'transparent', color: store.mode === m ? 'var(--accent)' : 'var(--muted)', border: `1px solid ${store.mode === m ? 'var(--border)' : 'var(--border2)'}` }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)', opacity: 0.5 }}>Features</p>
          {[
            { key: 'showWeather' as const, label: 'Weather' },
            { key: 'showMusic' as const, label: 'Music tab' },
            { key: 'showSS' as const, label: 'Screensaver' },
            { key: 'playSounds' as const, label: 'Sounds' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
              <button onClick={() => store.setSetting(key, !store[key])}
                className="w-10 h-5 rounded-full relative transition-colors"
                style={{ background: store[key] ? 'var(--accent)' : 'var(--bg3)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: store[key] ? '22px' : '2px' }} />
              </button>
            </div>
          ))}
        </div>

        {/* City */}
        <div>
          <p className="text-[8px] font-bold tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--accent)', opacity: 0.5 }}>Weather City</p>
          <input value={store.city} onChange={e => store.setSetting('city', e.target.value)}
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
            placeholder="Brisbane" />
        </div>
      </div>
    </motion.div>
  )
}
