import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { AppSettings, Theme, Layout, Mode } from '@/types'

const DEFAULTS: AppSettings = {
  theme: 'cinema', layout: 'desktop', mode: 'advanced',
  city: 'Brisbane', units: 'C', ssDelay: 300,
  weather: true, trailer: true, ss: true, sounds: true,
  showMusic: true, hr12: false,
}

interface SettingsContextType {
  settings: AppSettings
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  setTheme: (theme: Theme) => void
  setLayout: (layout: Layout) => void
  setMode: (mode: Mode) => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cf-settings') || '{}')
      return { ...DEFAULTS, ...saved }
    } catch { return DEFAULTS }
  })

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    const app = document.getElementById('app')
    if (app) {
      app.setAttribute('data-mode', settings.mode)
      if (settings.layout !== 'desktop') app.setAttribute('data-layout', settings.layout)
      else app.removeAttribute('data-layout')
    }
  }, [settings.theme, settings.mode, settings.layout])

  const save = (next: AppSettings) => {
    setSettings(next)
    localStorage.setItem('cf-settings', JSON.stringify(next))
  }

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    save({ ...settings, [key]: value })

  const setTheme = (theme: Theme) => save({ ...settings, theme })
  const setLayout = (layout: Layout) => save({ ...settings, layout })
  const setMode = (mode: Mode) => save({ ...settings, mode })

  return (
    <SettingsContext.Provider value={{ settings, set, setTheme, setLayout, setMode }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider')
  return ctx
}
