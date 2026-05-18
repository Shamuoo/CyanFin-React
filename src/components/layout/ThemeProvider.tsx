import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/lib/store'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, layout, pureBlack, accentColor } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-layout', layout)
    document.documentElement.setAttribute('data-oled', String(pureBlack))
    // Custom accent colour
    if (accentColor) {
      document.documentElement.style.setProperty('--accent', accentColor)
      document.documentElement.style.setProperty('--accent2', accentColor + 'cc')
      document.documentElement.style.setProperty('--border', accentColor + '26')
    } else {
      document.documentElement.style.removeProperty('--accent')
      document.documentElement.style.removeProperty('--accent2')
      document.documentElement.style.removeProperty('--border')
    }
  }, [theme, layout, pureBlack, accentColor])

  return <>{children}</>
}
