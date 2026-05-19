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

    // Must be in the right direction
    const inDir = dir === 'right' ? dx > 4 :
                  dir === 'left'  ? dx < -4 :
                  dir === 'down'  ? dy > 4 :
                                    dy < -4

    if (!inDir) continue

    // Score: primary axis distance + small penalty for perpendicular drift
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

      const DIRS: Record<string, 'left'|'right'|'up'|'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right',
        ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = DIRS[e.key]
      if (!dir) return

      // Enter / OK button
      if (e.key === 'Enter' || e.key === 'Return') {
        const focused = document.activeElement as HTMLElement
        if (focused && focused !== document.body) { focused.click(); e.preventDefault() }
        return
      }

      const focused = document.activeElement as HTMLElement
      const els = getVisible()
      if (!els.length) return

      const fromRect = focused?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {} }
      const target = nearest(els, fromRect as DOMRect, dir)

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
