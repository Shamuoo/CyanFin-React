import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { UserPlus, UserX, RefreshCw, Shield, ShieldOff } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'

export default function UsersPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', password: '' })
  const [saving, setSaving] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.adminUsers(),
    staleTime: 30_000,
  })
  const users = (data as any)?.users || []

  const disableUser = async (id: string, disabled: boolean) => {
    await api.post('/api/admin/users/disable', { userId: id, disabled }).catch(() => {})
    toast.success(disabled ? 'User disabled' : 'User enabled')
    refetch()
  }

  const createUser = async () => {
    if (!newUser.name || !newUser.password) return
    setSaving(true)
    const r = await api.post<any>('/api/admin/users/create', newUser).catch(() => null)
    setSaving(false)
    if (r?.id) { toast.success(`User ${newUser.name} created`); setShowAdd(false); setNewUser({ name: '', password: '' }); refetch() }
    else toast.error('Failed to create user')
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ background: 'var(--bg)', padding: '24px var(--pad) 48px' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', opacity: 0.5 }}>Users</h1>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-full hover:opacity-70" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <UserPlus size={12} /> New User
          </button>
        </div>
      </div>

      {/* Add user form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-4 space-y-3"
          style={{ background: 'var(--bg2)', border: '1px solid var(--accent)' }}>
          <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>Create Jellyfin User</p>
          {['name', 'password'].map(f => (
            <input key={f} value={(newUser as any)[f]}
              onChange={e => setNewUser(u => ({ ...u, [f]: e.target.value }))}
              placeholder={f === 'name' ? 'Username' : 'Password'}
              type={f === 'password' ? 'password' : 'text'}
              className="w-full px-3 py-2 rounded-xl text-xs outline-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
          ))}
          <div className="flex gap-2">
            <button onClick={createUser} disabled={saving}
              className="flex-1 py-2 rounded-full text-xs font-bold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-full text-xs font-bold"
              style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {isLoading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }} /></div>}

      <div className="space-y-2">
        {users.map((u: any) => (
          <motion.div key={u.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', opacity: u.isDisabled ? 0.5 : 1 }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{ background: 'var(--bg3)', color: u.isAdmin ? 'var(--accent)' : 'var(--muted)' }}>
              {u.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--cream)' }}>{u.name}</p>
                {u.isAdmin && <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--accent)' }}>Admin</span>}
                {u.isDisabled && <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c' }}>Disabled</span>}
              </div>
              {u.lastActivityDate && (
                <p className="text-[9px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                  Last active {new Date(u.lastActivityDate).toLocaleDateString()}
                </p>
              )}
            </div>
            {!u.isAdmin && (
              <button onClick={() => disableUser(u.id, !u.isDisabled)}
                className="p-2 rounded-full hover:opacity-70 flex-shrink-0"
                style={{ color: u.isDisabled ? '#2ecc71' : '#e74c3c' }}
                title={u.isDisabled ? 'Enable user' : 'Disable user'}>
                {u.isDisabled ? <Shield size={16} /> : <ShieldOff size={16} />}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
