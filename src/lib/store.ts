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
  pureBlack: boolean  // OLED toggle — forces #000 backgrounds on any theme
  showSS: boolean
  playSounds: boolean
  screensaverDelay: number
  mode: Mode
  setMode: (m: Mode) => void
  jellyfinUrl: string

  // Generic setter

  // Customisation
  accentColor: string | null   // null = use theme default
  skipLength: 10 | 30 | 5     // seconds to skip forward/back
  autoplayNext: boolean        // auto-play next episode
  resumeThreshold: number      // % watched before showing as "resume" (default 5)
  showClock: boolean           // show clock in nav
  compactMode: boolean
  cardSize: 'small' | 'medium' | 'large'
  listView: boolean
  maxBitrate: number
  preferredSubLang: string
  customCSS: string
  heroTrailerAutoplay: boolean
  heroStyle: 'cinematic' | 'minimal' | 'spotlight'
  show3D: boolean
  traktConnected: boolean
  sidebarWidth: number
  ageFilter: string
  parentalPin: string
  parentalRating: string
  fontStyle: 'default' | 'rounded' | 'mono' | 'serif'
  subtitleSize: number
  subtitleColor: string
  subtitleBg: boolean
  profilePins: Record<string, string>
  customBg: boolean         // tighter card spacing

  // Setter shortcuts
  setAccentColor: (c: string | null) => void
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
      pureBlack: false,
      showSS: true,
      playSounds: true,
      screensaverDelay: 5,
      mode: 'advanced' as Mode,
      setMode: (mode) => set({ mode }),
      jellyfinUrl: '',
      accentColor: null,
      skipLength: 10 as (10 | 30 | 5),
      autoplayNext: true,
      resumeThreshold: 5,
      showClock: false,
      compactMode: false,
      cardSize: 'medium',
      maxBitrate: 0,
      preferredSubLang: '',  // e.g. 'eng' — auto-select this subtitle language
      customCSS: '',
      heroTrailerAutoplay: true,
      heroStyle: 'cinematic' as const,
      show3D: false,
      traktConnected: false,
      sidebarWidth: 200,
      ageFilter: '',
      parentalPin: '',
      parentalRating: '',  // 'G'|'PG'|'PG-13'|'R'|'NC-17'|''  // 0 = no limit, otherwise Mbps
      listView: false,
      fontStyle: 'default',
      subtitleSize: 100,      // % of default
      subtitleColor: '#ffffff',
      subtitleBg: true,       // dark background behind subs
      profilePins: {} as Record<string, string>,  // userId → hashed PIN
      customBg: false,  // whether a custom background is active
      setAccentColor: (accentColor: string | null) => set({ accentColor }),

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
