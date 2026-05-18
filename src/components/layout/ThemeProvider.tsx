import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/lib/store'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, layout, pureBlack } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-layout', layout)
    document.documentElement.setAttribute('data-oled', String(pureBlack))
  }, [theme, layout, pureBlack])

  return <>{children}</>
}
