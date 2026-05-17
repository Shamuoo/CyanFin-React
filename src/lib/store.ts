import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Theme, Layout, AIProvider, PlayingItem, Mode } from '@/types'

interface AppState {
  // Auth
  user: User | null
  setUser: (user: User | null) => void

  // Onboarding
  onboarded: boolean
  setOnboarded: (v: boolean) => void

  // Theme / layout
  theme: Theme
  layout: Layout
  setTheme: (t: Theme) => void
  setLayout: (l: Layout) => void

  // Player
  playingItem: PlayingItem | null
  setPlayingItem: (item: PlayingItem | null) => void

  // Detail modal
  detailItemId: string | null
  setDetailItemId: (id: string | null) => void

  // AI
  aiProvider: AIProvider

  // Home sections
  homeSectionOrder: string[]
  homeSectionHidden: string[]
  setHomeSections: (order: string[], hidden: string[]) => void

  // Settings
  showWeather: boolean
  city: string
  units: 'C' | 'F'
  showMusic: boolean
  showSS: boolean
  playSounds: boolean
  screensaverDelay: number
  mode: Mode
  setMode: (m: Mode) => void
  jellyfinUrl: string

  // Generic setter
  setSetting: <K extends keyof AppState>(key: K, value: AppState[K]) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      setUser: (user) => set({ user }),

      // Onboarding
      onboarded: false,
      setOnboarded: (onboarded) => set({ onboarded }),

      // Theme / layout
      theme: 'cinema',
      layout: 'desktop',
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),

      // Player
      playingItem: null,
      setPlayingItem: (playingItem) => set({ playingItem }),

      // Detail modal
      detailItemId: null,
      setDetailItemId: (detailItemId) => set({ detailItemId }),

      // AI
      aiProvider: 'claude',

      // Home sections
      homeSectionOrder: [],
      homeSectionHidden: [],
      setHomeSections: (homeSectionOrder, homeSectionHidden) => set({ homeSectionOrder, homeSectionHidden }),

      // Settings
      showWeather: true,
      city: 'Sydney',
      units: 'C',
      showMusic: true,
  showSS: true,
  playSounds: true,
  screensaverDelay: 5,
  mode: 'advanced' as Mode,
  setMode: (mode) => set({ mode }),
  jellyfinUrl: '',

      setSetting: (key, value) => set({ [key]: value } as Partial<AppState>),
    }),
    {
      name: 'cyanfin-store',
      partialize: (state) => ({
        onboarded:          state.onboarded,
        theme:              state.theme,
        layout:             state.layout,
        aiProvider:         state.aiProvider,
        homeSectionOrder:   state.homeSectionOrder,
        homeSectionHidden:  state.homeSectionHidden,
        showWeather:        state.showWeather,
        city:               state.city,
        units:              state.units,
        showMusic:          state.showMusic,
      }),
    }
  )
)
