export interface MediaItem {
  id: string
  title: string
  year?: number
  type: string
  seriesName?: string
  seriesId?: string
  seasonId?: string
  indexNumber?: number
  parentIndexNumber?: number
  genre?: string
  genres?: string[]
  rating?: string
  score?: number
  overview?: string
  tagline?: string
  runtime?: number
  qualities?: string[]
  audio?: string
  versionCount?: number
  studios?: string[]
  cast?: CastMember[]
  director?: string
  posterUrl?: string
  backdropUrl?: string
  backdropUrls?: string[]
  thumbUrl?: string
  logoUrl?: string
  userData?: UserData
  extras?: ExtraItem[]
}

export interface CastMember {
  id: string
  name: string
  role?: string
  imageTag?: string
}

export interface UserData {
  PlayedPercentage?: number
  PlayCount?: number
  IsFavorite?: boolean
  LastPlayedDate?: string
  PlaybackPositionTicks?: number
}

export interface ExtraItem {
  id: string
  title: string
  type?: string
  runtime?: number
  thumbUrl?: string
}

export interface User {
  id: string
  name: string
  isAdmin?: boolean
}

export interface AudioStream {
  index: number
  codec: string
  language?: string
  title: string
  channels?: number
  isDefault?: boolean
}

export interface SubtitleStream {
  index: number
  codec: string
  language?: string
  title: string
  isDefault?: boolean
}

export interface MediaSource {
  id: string
  name: string
  container?: string
  size?: number
  videoCodec?: string
  audioStreams: AudioStream[]
  subtitleStreams: SubtitleStream[]
}

export interface PlaybackInfo {
  streamUrl: string
  hlsUrl?: string
  playSessionId?: string
  mediaSourceId?: string
  playMethod: string
  container?: string
  mediaSources?: MediaSource[]
}

export interface NowPlaying {
  item: MediaItem
  positionTicks: number
  runtimeTicks: number
  isPaused: boolean
  sessionUser?: string
  allUsers?: { user: string; title: string; isPaused: boolean; device: string }[]
  trailerKey?: string
}

export interface Stats {
  movies: number
  shows: number
  episodes: number
  songs: number
}

export type Theme = 'cinema' | 'midnight' | 'ember' | 'arctic' | 'neon'
export type Layout = 'desktop' | 'tv' | 'mobile'
export type Mode = 'advanced' | 'simple'
