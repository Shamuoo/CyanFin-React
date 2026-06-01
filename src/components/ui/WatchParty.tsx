import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Send, X, Smile } from 'lucide-react'

interface Props {
  itemId: string
  onClose: () => void
  onSeek:  (ms: number) => void
  onPlay:  () => void
  onPause: () => void
  getCurrentMs: () => number
  username: string
}

const REACTIONS = ['👏','😂','😱','❤️','🍿','🔥','💀','🎉']

export default function WatchParty({ itemId, onClose, onSeek, onPlay, onPause, getCurrentMs, username }: Props) {
  const ws = useRef<WebSocket | null>(null)
  const [members, setMembers] = useState<{ userId: string; username: string }[]>([])
  const [chat, setChat] = useState<{ from: string; text?: string; emoji?: string; ts: number; type: string }[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [reactions, setReactions] = useState<{ emoji: string; id: number }[]>([])
  const chatRef = useRef<HTMLDivElement>(null)
  const suppressRef = useRef(false)

  const roomId = `room-${itemId}`

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${location.host}/ws/party`)
    ws.current = socket

    socket.onopen = () => {
      setConnected(true)
      socket.send(JSON.stringify({ type: 'join', roomId, itemId, userId: username, username }))
    }
    socket.onclose = () => setConnected(false)
    socket.onerror = () => setConnected(false)

    socket.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'room') {
          setMembers(msg.members || [])
        } else if (msg.type === 'joined') {
          setMembers(m => [...m.filter(x => x.userId !== msg.userId), { userId: msg.userId, username: msg.username }])
          setChat(c => [...c, { from: 'system', text: `${msg.username} joined`, ts: Date.now(), type: 'system' }])
        } else if (msg.type === 'left') {
          setMembers(m => m.filter(x => x.userId !== msg.userId))
          setChat(c => [...c, { from: 'system', text: `${msg.username} left`, ts: Date.now(), type: 'system' }])
        } else if (msg.type === 'play') {
          suppressRef.current = true
          onSeek(msg.positionMs); onPlay()
          setTimeout(() => { suppressRef.current = false }, 500)
        } else if (msg.type === 'pause') {
          suppressRef.current = true
          onSeek(msg.positionMs); onPause()
          setTimeout(() => { suppressRef.current = false }, 500)
        } else if (msg.type === 'seek') {
          suppressRef.current = true
          onSeek(msg.positionMs)
          setTimeout(() => { suppressRef.current = false }, 500)
        } else if (msg.type === 'chat') {
          setChat(c => [...c, msg])
          setTimeout(() => chatRef.current?.scrollTo(0, 99999), 50)
        } else if (msg.type === 'reaction') {
          const id = Date.now()
          setReactions(r => [...r, { emoji: msg.emoji, id }])
          setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2500)
        }
      } catch {}
    }

    return () => { socket.close() }
  }, [roomId])

  const send = useCallback((msg: object) => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(msg))
  }, [])

  const syncPlay  = () => { if (!suppressRef.current) send({ type: 'play',  positionMs: getCurrentMs() }) }
  const syncPause = () => { if (!suppressRef.current) send({ type: 'pause', positionMs: getCurrentMs() }) }
  const syncSeek  = (ms: number) => { if (!suppressRef.current) send({ type: 'seek', positionMs: ms }) }

  const sendChat = () => {
    if (!input.trim()) return
    send({ type: 'chat', text: input.trim() })
    setInput('')
  }

  const sendReaction = (emoji: string) => send({ type: 'reaction', emoji })

  // sync functions exposed via props, not window globals

  return (
    <div className="fixed bottom-24 right-4 z-40 w-72 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', maxHeight: '60vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border2)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: connected ? '#2ecc71' : '#e74c3c' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--cream)' }}>Watch Party</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>
            <Users size={9} className="inline mr-0.5" />{members.length}
          </span>
        </div>
        <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={14} /></button>
      </div>

      {/* Members */}
      <div className="flex gap-1.5 px-4 py-2 flex-wrap" style={{ borderBottom: '1px solid var(--border2)' }}>
        {members.map(m => (
          <span key={m.userId} className="text-[9px] px-2 py-0.5 rounded-full"
            style={{ background: m.username === username ? 'var(--accent)' : 'var(--subtle)', color: m.username === username ? 'var(--bg)' : 'var(--muted)' }}>
            {m.username}
          </span>
        ))}
      </div>

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ minHeight: 120, maxHeight: 200 }}>
        {chat.map((m, i) => (
          <p key={i} className="text-[10px]" style={{ color: m.type === 'system' ? 'rgba(255,255,255,0.25)' : 'var(--muted)' }}>
            {m.type !== 'system' && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{m.from}: </span>}
            {m.text || m.emoji}
          </p>
        ))}
      </div>

      {/* Reactions */}
      <div className="flex gap-1 px-3 py-1 overflow-x-auto scrollbar-hide" style={{ borderTop: '1px solid var(--border2)' }}>
        {REACTIONS.map(e => (
          <button key={e} onClick={() => sendReaction(e)} className="text-base hover:scale-125 transition-transform flex-shrink-0">{e}</button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 px-3 py-2" style={{ borderTop: '1px solid var(--border2)' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendChat()}
          placeholder="Message…" className="flex-1 px-2 py-1.5 rounded-lg text-[10px] outline-none"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--cream)' }} />
        <button onClick={sendChat} style={{ color: 'var(--accent)' }}><Send size={13} /></button>
      </div>

      {/* Floating reactions */}
      <div className="fixed bottom-48 right-8 pointer-events-none" style={{ zIndex: 50 }}>
        <AnimatePresence>
          {reactions.map(r => (
            <motion.div key={r.id} initial={{ opacity: 1, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -80, scale: 1.5 }} exit={{ opacity: 0 }} transition={{ duration: 2.5 }}
              className="text-3xl absolute">{r.emoji}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
