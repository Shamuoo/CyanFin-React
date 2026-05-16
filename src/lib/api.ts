import type { MediaItem, PlaybackInfo, NowPlaying, Stats, User } from '@/types'

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options.headers as Record<string,string> },
      ...options,
    })
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:expired'))
      throw new Error('Unauthorized')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    if (res.status === 204) return null as T
    return res.json()
  }

  get<T>(path: string) { return this.request<T>(path) }
  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) }) }

  // Auth
  login(username: string, password: string) { return this.post<{ user: User }>('/api/auth/login', { username, password }) }
  logout() { return this.get('/api/auth/logout') }
  me() { return this.get<User>('/api/auth/me') }
  config() { return this.get<{ jellyfinUrl: string; version: string; hasJellyseerr: boolean; hasRadarr: boolean; hasSonarr: boolean; hasDiscord: boolean }>('/api/config') }
  saveConfig(data: Record<string, string>) { return this.post('/api/config/save', data) }

  // Media
  nowPlaying() { return this.get<NowPlaying | null>('/api/now-playing') }
  recentlyAdded() { return this.get<MediaItem[]>('/api/recently-added') }
  continueWatching() { return this.get<MediaItem[]>('/api/continue-watching') }
  popular() { return this.get<MediaItem[]>('/api/popular') }
  history() { return this.get<MediaItem[]>('/api/history') }
  random() { return this.get<MediaItem | null>('/api/random') }
  comingSoon() { return this.get<MediaItem[]>('/api/coming-soon') }
  onThisDay() { return this.get<MediaItem[]>('/api/on-this-day') }
  best3D() { return this.get<MediaItem[]>('/api/best-3d') }
  stats() { return this.get<Stats>('/api/stats') }
  weather(city: string) { return this.get<{ temp: string; tempF: string; desc: string; code: number; city: string }>(`/api/weather?city=${encodeURIComponent(city)}`) }
  search(q: string) { return this.get<MediaItem[]>(`/api/search?q=${encodeURIComponent(q)}`) }
  genres(type = 'Movie') { return this.get<string[]>(`/api/genres?type=${type}`) }
  item(id: string) { return this.get<MediaItem>(`/api/items/${id}`) }
  playbackInfo(id: string, mediaSourceId?: string, audioStreamIndex?: number) { return this.get<PlaybackInfo>(`/api/playback-info?id=${id}${mediaSourceId ? '&mediaSourceId='+mediaSourceId : ''}${audioStreamIndex !== undefined ? '&audioStreamIndex='+audioStreamIndex : ''}`) }

  // Movies
  movies(params: Record<string, string | number> = {}) { return this.get<{ total: number; items: MediaItem[] }>(`/api/movies?${new URLSearchParams(params as Record<string,string>)}`) }

  // TV
  shows(params: Record<string, string | number> = {}) { return this.get<{ total: number; items: MediaItem[] }>(`/api/shows?${new URLSearchParams(params as Record<string,string>)}`) }
  seasons(showId: string) { return this.get<MediaItem[]>(`/api/shows/${showId}/seasons`) }
  episodes(showId: string, seasonId: string) { return this.get<MediaItem[]>(`/api/shows/${showId}/seasons/${seasonId}/episodes`) }

  // Music
  albums(artistId?: string) { return this.get<{ id: string; title: string; artist: string; year: number; imageUrl: string }[]>(`/api/music/albums${artistId ? `?artistId=${artistId}` : ''}`) }
  tracks(albumId: string) { return this.get<{ id: string; title: string; trackNumber: number; duration: number; artist: string; album: string; streamUrl: string }[]>(`/api/music/tracks?albumId=${albumId}`) }

  // Stats
  watchTime(days = 30) { return this.get<{ date: string; minutes: number }[]>(`/api/stats/watch-time?days=${days}`) }
  topGenres() { return this.get<{ genre: string; count: number }[]>('/api/stats/top-genres') }
  topMovies() { return this.get<{ id: string; title: string; playCount: number; posterUrl: string }[]>('/api/stats/top-movies') }
  statsSummary() { return this.get<{ moviesWatched: number; episodesWatched: number; songsPlayed: number; estimatedHours: number }>('/api/stats/summary') }

  // Health
  health() { return this.get<Record<string, unknown>>('/api/health') }
  systemStats() { return this.get<Record<string, unknown>>('/api/system-stats') }

  // Integrations
  integrationsConfig() { return this.get<Record<string, boolean>>('/api/integrations/config') }
  requestMedia(mediaType: string, tmdbId: string) { return this.post('/api/integrations/request', { mediaType, tmdbId }) }
  discordNotify(data: Record<string, string>) { return this.post('/api/integrations/discord-notify', data) }
  testIntegration(service: string) { return this.get<{ ok: boolean; message?: string; error?: string }>(`/api/integrations/test?service=${service}`) }

  // Next episode
  nextEpisode(seriesId: string, seasonId: string, indexNumber: number, parentIndexNumber: number) {
    return this.get<{ hasNext: boolean; episode?: import('@/types').MediaItem }>(`/api/next-episode?seriesId=${seriesId}&seasonId=${seasonId}&indexNumber=${indexNumber}&parentIndexNumber=${parentIndexNumber}`)
  }

  // Multi-server management
  serversStatus() { return this.get<any>('/api/servers/status') }
  serversSwitch(server: 'primary' | 'backup') { return this.post('/api/servers/switch', { server }) }
  serversCheck() { return this.get('/api/servers/check') }

  // User actions
  toggleFavorite(itemId: string, favorite: boolean) { return this.post('/api/user/favorite', { itemId, favorite }) }
  toggleWatched(itemId: string, watched: boolean) { return this.post('/api/user/watched', { itemId, watched }) }

  // Collections
  collections() { return this.get<MediaItem[]>('/api/collections') }
  collectionItems(id: string) { return this.get<MediaItem[]>(`/api/collections/${id}/items`) }
  introSkip(id: string) { return this.get<{ hasIntro: boolean; introStart?: number; introEnd?: number }>(`/api/intro-skip?id=${id}`) }

  // Quick Connect
  quickConnectInitiate() { return this.post<{ code: string; secret: string }>('/api/auth/quick-connect/initiate', {}) }
  quickConnectCheck(secret: string) { return this.get<{ authorized: boolean; user?: { id: string; name: string } }>(`/api/auth/quick-connect/check?secret=${secret}`) }

  // Library
  libQuality() { return this.get<Record<string, unknown>>('/api/library/quality-report') }
  libMissing() { return this.get<Record<string, unknown>>('/api/library/missing-content') }
  libVersions() { return this.get<Record<string, unknown>>('/api/library/versions-report') }
  libRefreshAll() { return this.get('/api/library/refresh-all') }
  libScan() { return this.get('/api/library/scan') }
  libRefreshMeta(id: string) { return this.get(`/api/library/refresh-metadata?id=${id}`) }
  libRefreshImages(id: string) { return this.get(`/api/library/refresh-images?id=${id}`) }
  libUpdateItem(itemId: string, updates: Record<string, unknown>) { return this.post('/api/library/update-item', { itemId, updates }) }
  libAiFix(itemId: string) { return this.post<{ success: boolean; suggestion?: Record<string, unknown>; error?: string }>('/api/library/ai-autofix', { itemId }) }

  imageUrl(id: string, type = 'Primary', w = 600) { return `/proxy/image?id=${id}&type=${type}&w=${w}` }
}

export const api = new ApiClient()
export default api
