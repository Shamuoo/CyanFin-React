import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

type Listener = (toast: ToastItem) => void
const listeners: Listener[] = []

// Global toast function — call from anywhere
export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = Math.random().toString(36).slice(2)
  const item: ToastItem = { id, type, message, duration }
  listeners.forEach(l => l(item))
}
toast.success = (msg: string) => toast(msg, 'success')
toast.error   = (msg: string) => toast(msg, 'error', 6000)
toast.warn    = (msg: string) => toast(msg, 'warning')
toast.info    = (msg: string) => toast(msg, 'info')

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const COLORS = {
  success: { bg: 'rgba(46,204,113,0.12)',  border: 'rgba(46,204,113,0.3)',  icon: '#2ecc71' },
  error:   { bg: 'rgba(231,76,60,0.12)',   border: 'rgba(231,76,60,0.3)',   icon: '#e74c3c' },
  warning: { bg: 'rgba(243,156,18,0.12)',  border: 'rgba(243,156,18,0.3)',  icon: '#f39c12' },
  info:    { bg: 'rgba(201,168,76,0.10)',  border: 'rgba(201,168,76,0.25)', icon: 'var(--accent)' },
}

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const Icon = ICONS[item.type]
  const col  = COLORS[item.type]

  useEffect(() => {
    const t = setTimeout(() => onRemove(item.id), item.duration ?? 4000)
    return () => clearTimeout(t)
  }, [item.id, item.duration, onRemove])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl max-w-sm"
      style={{ background: col.bg, border: `1px solid ${col.border}`, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
      <Icon size={15} style={{ color: col.icon, flexShrink: 0, marginTop: 1 }} />
      <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(240,232,213,0.85)' }}>{item.message}</p>
      <button onClick={() => onRemove(item.id)} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} className="hover:opacity-70">
        <X size={12} />
      </button>
    </motion.div>
  )
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((item: ToastItem) => {
    setToasts(prev => [...prev.slice(-4), item]) // max 5
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    listeners.push(add)
    return () => { const i = listeners.indexOf(add); if (i >= 0) listeners.splice(i, 1) }
  }, [add])

  return (
    <div className="fixed bottom-6 right-6 z-[500] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard item={t} onRemove={remove} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
