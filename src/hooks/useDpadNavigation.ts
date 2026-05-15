import { useEffect } from 'react'

// D-pad navigation for Android TV / remote controls
export function useDpadNavigation() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const focused = document.activeElement as HTMLElement
      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.closest('[aria-hidden]') && el.offsetParent !== null)

      if (!focusables.length) return

      const idx = focusables.indexOf(focused)

      switch(e.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          e.preventDefault()
          const next = focusables[idx + 1] || focusables[0]
          next?.focus()
          break
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          e.preventDefault()
          const prev = focusables[idx - 1] || focusables[focusables.length - 1]
          prev?.focus()
          break
        }
        case 'Enter':
        case ' ':
          if (focused && focused !== document.body) {
            e.preventDefault()
            focused.click()
          }
          break
        case 'Backspace':
        case 'XF86Back': // Android TV back button
          e.preventDefault()
          window.history.back()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
