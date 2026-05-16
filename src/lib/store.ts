import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, Layout, Mode, User } from '@/types'

interface AppState {
  // Auth
  user: User | null
  setUser: (user: User | null) => void

  // Settings
  theme: Theme
  layout: Layout
  mode: Mode
  city: string
  units: 'C' | 'F'
  ssDelay: number
  showWeather: boolean
  showTrailer: boolean
  showSS: boolean
  playSounds: boolean
  showMusic: boolean
  jellyfinUrl: string
  aiProvider: 'claude' | 'gemini' | 'ollama'

  setTheme: (t: Theme) => void
  setLayout: (l: Layout) => void
  setMode: (m: Mode) => void
  setSetting: <K extends keyof AppState>(key: K, value: AppState[K]) => void

  // Player
  playingItem: { id: string; title: string; streamUrl: string; startTime?: number } | null
  setPlayingItem: (item: AppState['playingItem']) => void

  // Detail
  detailItemId: string | null
  setDetailItemId: (id: string | null) => void

  // Onboarded
  onboarded: boolean
  setOnboarded: (v: boolean) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

      theme: 'cinema',
      layout: 'desktop',
      mode: 'advanced',
      city: 'Brisbane',
      units: 'C',
      ssDelay: 300,
      showWeather: true,
      showTrailer: true,
      showSS: true,
      playSounds: true,
      showMusic: true,
      jellyfinUrl: '',
      aiProvider: 'claude',

      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      setMode: (mode) => set({ mode }),
      setSetting: (key, value) => set({ [key]: value } as Partial<AppState>),

      playingItem: null,
      setPlayingItem: (playingItem) => set({ playingItem }),

      detailItemId: null,
      setDetailItemId: (detailItemId) => set({ detailItemId }),

      onboarded: false,
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'cyanfin-store',
      partialize: (state) => ({
        theme: state.theme,
        layout: state.layout,
        mode: state.mode,
        city: state.city,
        units: state.units,
        ssDelay: state.ssDelay,
        showWeather: state.showWeather,
        showTrailer: state.showTrailer,
        showSS: state.showSS,
        playSounds: state.playSounds,
        showMusic: state.showMusic,
        onboarded: state.onboarded,
        jellyfinUrl: state.jellyfinUrl,
        aiProvider: state.aiProvider,
      }),
    }
  )
)
