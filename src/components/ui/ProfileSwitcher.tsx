import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, User, Plus, Check, Settings } from 'lucide-react'
import api from '@/lib/api'
import { useStore } from '@/lib/store'
import { toast } from '@/components/ui/Toast'

interface Props { onClose: () => void }

function hashPin(pin: string): string {
  let h = 0
  for (let i = 0; i < pin.length; i++) { h = ((h << 5) - h) + pin.charCodeAt(i); h |= 0 }
  return String(Math.abs(h))
}

function Avatar({ profile, size = 64 }: { profile: any; size?: number }) {
  const initials = profile.name?.slice(0,2).toUpperCase() || '?'
  const colors = ['#c9a84c','#4a9eff','#e8602a','#e84393','#4caf7d','#8b9cf4','#cba6f7']
  const color = colors[profile.name?.charCodeAt(0) % colors.length] || colors[0]
  return profile.avatarUrl
    ? <img src={profile.avatarUrl} alt={profile.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size, border: '2px solid rgba(255,255,255,0.1)' }} />
    : <div className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
        style={{ width: size, height: size, background: color + '22', border: `2px solid ${color}44`,
          color, fontSize: size * 0.3, fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
        {initials}
      </div>
}

export default function ProfileSwitcher({ onClose }: Props) {
  const { setUser, profilePins, setSetting } = useStore() as any
  const qc = useQueryClient()
  const [view, setView] = useState<'grid' | 'auth' | 'pinset' | 'manage'>('grid')
  const [selected, setSelected] = useState<any>(null)
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
    staleTime: 60_000,
  })

  const storedPin = selected ? (profilePins as Record<string, string>)?.[selected.id] : null

  const selectProfile = (profile: any) => {
    setSelected(profile); setError(''); setPin(''); setPassword('')
    setView('auth')
  }

  const handleSwitch = async () => {
    if (!selected) return
    if (storedPin && hashPin(pin) !== storedPin) {
      setError('Incorrect PIN'); setPin(''); return
    }
    setLoading(true); setError('')
    try {
      const result = await api.switchProfile(selected.name, password || '')
      setUser(result.user)
      qc.invalidateQueries()
      toast.success(`Switched to ${selected.name}`)
      onClose()
    } catch(e: any) { setError(e.message || 'Incorrect password') }
    setLoading(false)
  }

  const handleSetPin = () => {
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (newPin !== confirmPin) { setError('PINs don\'t match'); return }
    const pins = { ...(profilePins || {}), [selected.id]: hashPin(newPin) }
    setSetting('profilePins', pins)
    toast.success(`PIN set for ${selected.name}`)
    setView('grid'); setNewPin(''); setConfirmPin(''); setError('')
  }

  const removePin = (profileId: string) => {
    const pins = { ...(profilePins || {}) }
    delete pins[profileId]
    setSetting('profilePins', pins)
    toast.info('PIN removed')
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full rounded-2xl overflow-hidden"
        style={{ maxWidth: 420, background: 'var(--bg2)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border2)' }}>
          <div className="flex items-center gap-2">
            {view !== 'grid' && (
              <button onClick={() => { setView('grid'); setError('') }}
                className="text-xs hover:opacity-70 mr-1" style={{ color: 'var(--muted)' }}>←</button>
            )}
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
              {view === 'grid' ? 'Who\'s watching?' : view === 'auth' ? selected?.name : view === 'pinset' ? 'Set PIN' : 'Manage Profiles'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {view === 'grid' && (
              <button onClick={() => setView('manage')}
                className="hover:opacity-70" style={{ color: 'var(--muted)' }}>
                <Settings size={15} />
              </button>
            )}
            <button onClick={onClose} className="hover:opacity-70" style={{ color: 'var(--muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">

            {/* Profile grid */}
            {view === 'grid' && (
              <motion.div key="grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="grid grid-cols-3 gap-4">
                  {(profiles as any[]).map((p: any) => (
                    <button key={p.id} onClick={() => selectProfile(p)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-white/5 group">
                      <div className="relative">
                        <Avatar profile={p} size={72} />
                        {(profilePins as any)?.[p.id] && (
                          <div className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
                            style={{ width: 18, height: 18, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                            <Lock size={9} style={{ color: 'var(--accent)' }} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-center leading-tight" style={{ color: 'var(--cream)' }}>{p.name}</p>
                      {p.isAdmin && <span className="text-[7px] px-1.5 py-0.5 rounded uppercase font-bold"
                        style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--accent)' }}>Admin</span>}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Auth view */}
            {view === 'auth' && selected && (
              <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex flex-col items-center mb-5">
                  <Avatar profile={selected} size={80} />
                  <p className="text-sm font-bold mt-2" style={{ color: 'var(--cream)' }}>{selected.name}</p>
                </div>

                {storedPin ? (
                  <>
                    <p className="text-[9px] text-center mb-3" style={{ color: 'var(--muted)' }}>Enter PIN</p>
                    {/* PIN dots */}
                    <div className="flex justify-center gap-3 mb-4">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="rounded-full transition-all"
                          style={{ width: 12, height: 12, background: pin.length > i ? 'var(--accent)' : 'var(--border2)', border: '1px solid var(--border)' }} />
                      ))}
                    </div>
                    {/* Number pad */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
                        <button key={i} onClick={() => {
                          if (n === '⌫') setPin(p => p.slice(0,-1))
                          else if (n !== '' && pin.length < 4) setPin(p => p + String(n))
                        }}
                          className="py-3 rounded-xl text-sm font-bold transition-all hover:bg-white/10 active:scale-95"
                          style={{ background: n === '' ? 'transparent' : 'var(--subtle)', color: 'var(--cream)', border: n === '' ? 'none' : '1px solid var(--border2)' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {error && <p className="text-xs text-center mb-2" style={{ color: '#e74c3c' }}>{error}</p>}
                    <button onClick={handleSwitch} disabled={pin.length < 4 || loading}
                      className="w-full py-2.5 rounded-full font-bold text-sm disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                      {loading ? '…' : 'Switch'}
                    </button>
                  </>
                ) : selected.hasPassword ? (
                  <>
                    <p className="text-[9px] mb-2" style={{ color: 'var(--muted)' }}>Password</p>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSwitch()}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-3"
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                      placeholder="Enter password" autoFocus />
                    {error && <p className="text-xs mb-2" style={{ color: '#e74c3c' }}>{error}</p>}
                    <button onClick={handleSwitch} disabled={loading}
                      className="w-full py-2.5 rounded-full font-bold text-sm disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                      {loading ? '…' : 'Switch'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-center mb-4" style={{ color: 'var(--muted)', opacity: 0.5 }}>No password required</p>
                    <button onClick={handleSwitch} disabled={loading}
                      className="w-full py-2.5 rounded-full font-bold text-sm disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                      {loading ? '…' : `Switch to ${selected.name}`}
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {/* Set PIN */}
            {view === 'pinset' && selected && (
              <motion.div key="pinset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>New PIN for {selected.name}</p>
                <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                  placeholder="4-6 digit PIN" maxLength={6} />
                <input value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }}
                  placeholder="Confirm PIN" maxLength={6} />
                {error && <p className="text-xs mb-2" style={{ color: '#e74c3c' }}>{error}</p>}
                <button onClick={handleSetPin}
                  className="w-full py-2.5 rounded-full font-bold text-sm"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Set PIN
                </button>
              </motion.div>
            )}

            {/* Manage */}
            {view === 'manage' && (
              <motion.div key="manage" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <p className="text-[9px] mb-3" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                  Set PINs to lock individual profiles. PINs are stored locally on this device.
                </p>
                <div className="space-y-2">
                  {(profiles as any[]).map((p: any) => {
                    const hasPin = !!(profilePins as any)?.[p.id]
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
                        <Avatar profile={p} size={36} />
                        <p className="flex-1 text-sm font-bold" style={{ color: 'var(--cream)' }}>{p.name}</p>
                        {hasPin
                          ? <button onClick={() => removePin(p.id)}
                              className="text-[9px] px-2.5 py-1 rounded-full hover:opacity-70"
                              style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)' }}>
                              Remove PIN
                            </button>
                          : <button onClick={() => { setSelected(p); setView('pinset'); setNewPin(''); setConfirmPin(''); setError('') }}
                              className="text-[9px] px-2.5 py-1 rounded-full hover:opacity-70"
                              style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                              Set PIN
                            </button>
                        }
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
