import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/lib/store'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, layout, pureBlack, accentColor, fontStyle } = useStore() as any

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-layout', layout)
    document.documentElement.setAttribute('data-oled', String(pureBlack))
    // Font style
    const fonts: Record<string, string> = {
      default: "'Inter', sans-serif",
      rounded: "'Nunito', 'Inter', sans-serif",
      mono:    "'JetBrains Mono', monospace",
      serif:   "'Georgia', serif",
    }
    document.documentElement.style.setProperty('--font-body', fonts[fontStyle || 'default'])
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
  }, [theme, layout, pureBlack, accentColor, fontStyle])

  return <>{children}</>
}
