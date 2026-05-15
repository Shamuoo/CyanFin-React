import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader, Bot, Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import type { MediaItem } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  items?: MediaItem[]
  action?: { type: string; payload?: any }
}

interface Props {
  onClose: () => void
}

const SUGGESTIONS = [
  'Play something random',
  'Show me my continue watching',
  'Best sci-fi movies',
  'What was added recently?',
  'Show me 4K movies',
]

export default function AINavigator({ onClose }: Props) {
  const { setDetailItemId, setPlayingItem, aiProvider } = useStore()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I can help you find and play anything in your library. What would you like to watch?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post<{ reply: string; items?: MediaItem[]; action?: any }>('/api/ai/navigate', {
        message: text,
        history: messages.slice(-6),
        provider: aiProvider || 'claude',
      })
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.reply,
        items: res.items,
        action: res.action,
      }
      setMessages(prev => [...prev, assistantMsg])

      // Execute action if returned
      if (res.action) {
        if (res.action.type === 'navigate') navigate(res.action.path)
        if (res.action.type === 'play' && res.action.item) {
          const info = await api.playbackInfo(res.action.item.id).catch(() => null)
          if (info) {
            setPlayingItem({ id: res.action.item.id, title: res.action.item.title, streamUrl: info.streamUrl, hlsUrl: info.hlsUrl } as any)
            onClose()
            navigate('/player')
          }
        }
        if (res.action.type === 'detail' && res.action.item) {
          setDetailItemId(res.action.item.id)
          onClose()
        }
      }
    } catch(e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I ran into an error: ${e.message}. Make sure an AI API key is configured in Settings.` }])
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-xl rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border2)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--accent)' }}>AI Navigator</span>
            <span className="text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
              style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
              {aiProvider || 'claude'}
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)' }}>
                  <Bot size={14} style={{ color: 'var(--accent)' }} />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--subtle)',
                    color: msg.role === 'user' ? 'var(--bg)' : 'var(--muted)',
                    border: msg.role === 'assistant' ? '1px solid var(--border2)' : 'none',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  }}>
                  {msg.content}
                </div>
                {/* Result items */}
                {msg.items && msg.items.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 w-full">
                    {msg.items.slice(0, 6).map(item => (
                      <button key={item.id} onClick={() => { setDetailItemId(item.id); onClose() }}
                        className="flex-shrink-0 group text-left">
                        <div className="w-16 rounded overflow-hidden mb-1 transition-transform group-hover:scale-105"
                          style={{ aspectRatio: '2/3', background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                          {item.posterUrl && <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <p className="text-[8px] leading-tight w-16 truncate" style={{ color: 'var(--muted)' }}>{item.title}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: 'var(--subtle)', border: '1px solid var(--border)' }}>
                <Bot size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="px-4 py-3 rounded-2xl" style={{ background: 'var(--subtle)', border: '1px solid var(--border2)' }}>
                <Loader size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="flex gap-2 px-5 pb-2 overflow-x-auto scrollbar-hide flex-shrink-0">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all hover:border-[--accent] hover:text-[--accent]"
                style={{ border: '1px solid var(--border2)', color: 'var(--muted)', background: 'var(--subtle)', whiteSpace: 'nowrap' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border2)' }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask anything — 'play Barbie', 'show sci-fi movies'…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--cream)' }} />
          <button onClick={() => send(input)} disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--bg)', flexShrink: 0 }}>
            <Send size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
