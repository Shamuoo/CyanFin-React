// ── Core media types ──────────────────────────────────────────────────────────

export interface MediaItem {
  id: string
  title: string
  seriesName?: string | null
  year?: number | null
  type: 'Movie' | 'Series' | 'Episode' | 'MusicAlbum' | 'Audio' | 'BoxSet' | string
  overview?: string | null
  tagline?: string | null
  genre?: string | null
  genres?: string[]
  rating?: string | null
  score?: number | null
  runtime?: number | null       // minutes
  runTimeTicks?: number | null
  audio?: string | null
  qualities?: string[]
  cast?: CastMember[]
  director?: string | null
  indexNumber?: number | null
  parentIndexNumber?: number | null
  seriesId?: string | null
  seasonId?: string | null
  seasonName?: string | null
  userData?: UserData | null
  externalIds?: Record<string, string>
  partCount?: number | null
  versionCount?: number | null
  // Capitalized aliases for backward compat
  UserData?: {
    PlayedPercentage?: number
    PlaybackPositionTicks?: number
    IsFavorite?: boolean
    Played?: boolean
  }

  // URLs
  posterUrl?: string | null
  backdropUrl?: string | null
  backdropUrls?: string[]
  thumbUrl?: string | null
  logoUrl?: string | null

  // Detail-only fields
  chapters?: Chapter[]
  extras?: ExtraItem[]
  themeSongUrl?: string | null
  introStart?: number | null
  introEnd?: number | null

  // External ratings
  externalRatings?: ExternalRatings

  // Source identifier
  _source?: 'jellyfin' | 'plex'
  videoBackdropUrl?: string | null
}

export interface CastMember {
  id: string
  name: string
  role?: string | null
  imageTag?: string | null
}

export interface UserData {
  played?: boolean
  playedPercentage?: number
  playbackPositionTicks?: number
  isFavorite?: boolean
}

export interface ExternalRatings {
  imdb?: number | null
  tmdb?: number | null
  rt?: number | null
  metascore?: number | null
  imdbId?: string | null
  tmdbId?: string | null
  imdbUrl?: string | null
  letterboxdUrl?: string | null
}

export interface Chapter {
  name: string
  startPositionTicks: number
  imageTag?: string | null
}

export interface ExtraItem {
  id: string
  title: string
  type?: string | null
  runtime?: number | null
  thumbUrl?: string | null
}

// ── Playback ──────────────────────────────────────────────────────────────────

export interface PlayingItem {
  id: string
  title: string
  streamUrl: string
  hlsUrl?: string | null
  startTime?: number
  mediaSourceId?: string
  seriesId?: string | null
  seasonId?: string | null
  indexNumber?: number | null
  parentIndexNumber?: number | null
}

export interface MediaSource {
  id: string
  name?: string | null
  container?: string | null
  videoCodec?: string | null
  size?: number | null
  bitrate?: number | null
  supportsDirectPlay?: boolean
  supportsDirectStream?: boolean
  streamUrl: string
  hlsUrl?: string
  audioStreams: AudioStream[]
  subtitleStreams: SubtitleStream[]
}

export interface AudioStream {
  index: number
  title: string
  codec?: string
  channels?: number
  language?: string
  isDefault?: boolean
}

export interface SubtitleStream {
  index: number
  title: string
  language?: string
  isDefault?: boolean
  codec?: string
  isExternal?: boolean
}

// ── Browse ────────────────────────────────────────────────────────────────────

export interface BrowseResult {
  items: MediaItem[]
  total: number
}

export interface NowPlaying {
  item: MediaItem
  positionTicks: number
  runtimeTicks: number
  isPaused: boolean
  allSessions?: { user: string; userId: string }[]
  allUsers?: { user: string; userId: string }[]
}

// ── Servers ───────────────────────────────────────────────────────────────────

export interface ServerInfo {
  url: string
  ok: boolean
  latency: number | null
}

export interface ServerStatus {
  active: 'primary' | 'backup'
  mode: 'fastest' | 'primary' | 'backup'
  primary: ServerInfo
  backup: ServerInfo | null
  plex: ServerInfo | null
  lastCheck: number
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface PublicConfig {
  JELLYFIN_URL: string
  JELLYFIN_BACKUP_URL: string
  PLEX_URL: string
  OLLAMA_URL: string
  OLLAMA_MODEL: string
  STREAMYSTATS_URL: string
  JELLYSEERR_URL: string
  RADARR_URL: string
  SONARR_URL: string
  DISCORD_WEBHOOK_URL: string
  JELLYFIN_MODE: string
  // Has-key booleans (secrets masked)
  hasJellyfin: boolean
  hasTmdb: boolean
  hasAnthropic: boolean
  hasGemini: boolean
  hasOllama: boolean
  hasPlex: boolean
  hasJellyseerr: boolean
  hasRadarr: boolean
  hasSonarr: boolean
  hasDiscord: boolean
  hasOmdb: boolean
  version: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

export type Theme = 'cinema' | 'midnight' | 'ember' | 'arctic' | 'neon'
export type Layout = 'desktop' | 'tv' | 'mobile'
export type AIProvider = 'claude' | 'gemini' | 'ollama'

export interface User {
  id: string
  name: string
  isAdmin?: boolean
}

// Backward compatibility
export type Mode = 'simple' | 'advanced'
