import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/lib/store'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, layout } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-layout', layout)
  }, [theme, layout])

  return <>{children}</>
}
