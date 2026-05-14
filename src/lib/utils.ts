import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtTime(secs: number): string {
  if (!secs || isNaN(secs)) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtTicks(ticks: number): string {
  return fmtTime(Math.floor((ticks || 0) / 10000000))
}

export function fmtRuntime(ticks: number): string {
  const mins = Math.round(ticks / 600000000)
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function fmtUptime(s: number): string {
  if (!s) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

export const WEATHER_ICONS: Record<number, string> = {
  113: '☀️', 116: '⛅', 119: '☁️', 122: '☁️', 143: '🌫️',
  176: '🌦️', 200: '⛈️', 227: '🌨️', 230: '❄️',
  263: '🌧️', 296: '🌧️', 302: '🌧️', 308: '🌧️',
  356: '⛈️', 386: '⛈️',
}

export function qualityBadgeClass(q: string): string {
  if (q.includes('3D')) return 'badge-3d'
  if (q.startsWith('4K')) return 'badge-4k'
  if (q.includes('1080')) return 'badge-1080'
  if (q.includes('720')) return 'badge-720'
  return 'badge-sd'
}

export function playSound(type: 'click' | 'open' | 'play') {
  try {
    if (!(window as any)._audioCtx) (window as any)._audioCtx = new AudioContext()
    const ctx = (window as any)._audioCtx as AudioContext
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const now = ctx.currentTime
    if (type === 'click') {
      osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.08)
      gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.start(now); osc.stop(now + 0.08)
    } else if (type === 'open') {
      osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now); osc.stop(now + 0.12)
    } else {
      [440, 554, 659].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        const t = now + i * 0.1
        o.frequency.setValueAtTime(freq, t)
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        o.start(t); o.stop(t + 0.3)
      })
    }
  } catch { /* ignore */ }
}
