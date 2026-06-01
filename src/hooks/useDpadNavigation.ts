import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])'

function getVisible(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => !el.closest('[aria-hidden]') && el.offsetParent !== null && el.offsetWidth > 0)
}

function nearest(els: HTMLElement[], from: DOMRect, dir: 'left'|'right'|'up'|'down'): HTMLElement | null {
  const cx = from.left + from.width / 2
  const cy = from.top  + from.height / 2
  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const el of els) {
    const r = el.getBoundingClientRect()
    const ex = r.left + r.width / 2
    const ey = r.top  + r.height / 2
    const dx = ex - cx
    const dy = ey - cy

    const inDir = dir === 'right' ? dx > 4 :
                  dir === 'left'  ? dx < -4 :
                  dir === 'down'  ? dy > 4 :
                                    dy < -4
    if (!inDir) continue

    const primary = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy)
    const perp    = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    const score   = primary + perp * 0.3

    if (score < bestScore) { bestScore = score; best = el }
  }
  return best
}

export function useDpadNavigation(enabled = true) {
  const enabled$ = useRef(enabled)
  enabled$.current = enabled

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!enabled$.current) return
      // Skip when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Enter / OK — click focused element
      if (e.key === 'Enter') {
        const focused = document.activeElement as HTMLElement
        if (focused && focused !== document.body) {
          focused.click()
          e.preventDefault()
        }
        return
      }

      // Back / BrowserBack — go back
      if (e.key === 'Escape' || e.key === 'BrowserBack' || e.key === 'GoBack') {
        window.history.back()
        e.preventDefault()
        return
      }

      const DIRS: Record<string, 'left'|'right'|'up'|'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right',
        ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = DIRS[e.key]
      if (!dir) return

      const focused = document.activeElement as HTMLElement
      const els = getVisible()
      if (!els.length) return

      // If nothing focused yet, focus first visible element
      if (!focused || focused === document.body) {
        els[0]?.focus()
        e.preventDefault()
        return
      }

      const fromRect = focused.getBoundingClientRect()
      const target = nearest(els.filter(el => el !== focused), fromRect, dir)

      if (target) {
        target.focus()
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
