import type { MediaItem, PlayingItem, MediaSource, NowPlaying, ServerStatus, PublicConfig, BrowseResult, User } from '@/types'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

class ApiClient {
  private async fetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(path, { credentials: 'include', ...opts })

    if (res.status === 401) {
      const isPolling = path.includes('now-playing') || path.includes('servers/status') || path.includes('servers/check')
      if (!isPolling) window.dispatchEvent(new CustomEvent('auth:expired'))
      throw new ApiError('Unauthorized', 401)
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }))
      throw new ApiError(data.error || `HTTP ${res.status}`, res.status)
    }

    const text = await res.text()
    if (!text) return null as T
    try { return JSON.parse(text) as T }
    catch { return text as unknown as T }
  }

  get<T>(path: string) { return this.fetch<T>(path) }

  post<T>(path: string, body: unknown = {}) {
    return this.fetch<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  delete<T>(path: string) { return this.fetch<T>(path, { method: 'DELETE' }) }

  // ── Auth ───────────────────────────────────────────────────────────────────
  login(username: string, password: string) {
    return this.post<{ user: User }>('/api/auth/login', { username, password })
  }
  logout() { return this.post('/api/auth/logout', {}) }
  me() { return this.get<User>('/api/auth/me') }
  quickConnectInitiate() { return this.post<{ code: string; secret: string }>('/api/auth/quick-connect/initiate', {}) }
  quickConnectCheck(secret: string) { return this.get<{ authorized: boolean; user?: User }>(`/api/auth/quick-connect/check?secret=${secret}`) }

  // ── Config ─────────────────────────────────────────────────────────────────
  config() { return this.get<PublicConfig>('/api/config') }
  saveConfig(data: Record<string, string>) { return this.post('/api/config/save', data) }
  publicInfo() { return this.get<{ configured: boolean; version: string }>('/api/public/info') }

  // ── Servers ────────────────────────────────────────────────────────────────
  serversStatus() { return this.get<ServerStatus>('/api/servers/status') }
  serversSwitch(server: 'primary' | 'backup') { return this.post<ServerStatus>('/api/servers/switch', { server }) }
  serversCheck() { return this.get<ServerStatus>('/api/servers/check') }
  testJellyfin(url: string) { return this.get<{ ok: boolean; serverName?: string; version?: string; error?: string }>(`/api/test/jellyfin?url=${encodeURIComponent(url)}`) }
  testPlex(url: string, token: string) { return this.get<{ ok: boolean; error?: string }>(`/api/test/plex?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`) }

  // ── Browse ─────────────────────────────────────────────────────────────────
  recentlyAdded() { return this.get<MediaItem[]>('/api/recently-added') }
  continueWatching() { return this.get<MediaItem[]>('/api/continue-watching') }
  popular() { return this.get<MediaItem[]>('/api/popular') }
  history() { return this.get<MediaItem[]>('/api/history') }
  random() { return this.get<MediaItem[]>('/api/random') }
  best3D() { return this.get<MediaItem[]>('/api/best-3d') }
  nowPlaying() { return this.get<NowPlaying | null>('/api/now-playing') }
  search(q: string) { return this.get<MediaItem[]>(`/api/search?q=${encodeURIComponent(q)}`) }
  genres(type = 'Movie') { return this.get<{ id: string; name: string }[]>(`/api/genres?type=${type}`) }
  libraries() { return this.get<{ id: string; name: string; type: string; imageUrl?: string }[]>('/api/libraries') }

  movies(params: Record<string, string | number> = {}) {
    return this.get<BrowseResult>(`/api/movies?${new URLSearchParams(params as Record<string, string>)}`)
  }
  shows(params: Record<string, string | number> = {}) {
    return this.get<BrowseResult>(`/api/shows?${new URLSearchParams(params as Record<string, string>)}`)
  }
  seasons(showId: string) { return this.get<MediaItem[]>(`/api/shows/${showId}/seasons`) }
  episodes(showId: string, seasonId: string) { return this.get<MediaItem[]>(`/api/shows/${showId}/seasons/${seasonId}/episodes`) }
  nextEpisode(seriesId: string, parentIndexNumber: number, indexNumber: number) {
    return this.get<{ hasNext: boolean; episode?: MediaItem }>(`/api/next-episode?seriesId=${seriesId}&parentIndexNumber=${parentIndexNumber}&indexNumber=${indexNumber}`)
  }
  collections() { return this.get<MediaItem[]>('/api/collections') }
  collectionItems(id: string) { return this.get<MediaItem[]>(`/api/collections/${id}/items`) }

  // ── Music ─────────────────────────────────────────────────────────────────
  albums() { return this.get<any[]>('/api/music/albums') }
  tracks(albumId: string) { return this.get<any[]>(`/api/music/tracks?albumId=${albumId}`) }

  // ── Items ─────────────────────────────────────────────────────────────────
  item(id: string) { return this.get<MediaItem>(`/api/items/${id}`) }
  playbackInfo(id: string, mediaSourceId?: string, audioStreamIndex?: number) {
    const p = new URLSearchParams({ id })
    if (mediaSourceId) p.set('mediaSourceId', mediaSourceId)
    if (audioStreamIndex !== undefined) p.set('audioStreamIndex', String(audioStreamIndex))
    return this.get<{ streamUrl: string; hlsUrl: string; mediaSources: MediaSource[] }>(`/api/playback-info?${p}`)
  }
  introSkip(id: string) { return this.get<{ hasIntro: boolean; introStart?: number; introEnd?: number }>(`/api/intro-skip?id=${id}`) }

  // ── Playback reporting ────────────────────────────────────────────────────
  playbackStart(itemId: string, mediaSourceId?: string, positionTicks = 0) {
    return this.post('/api/playback/start', { itemId, mediaSourceId, positionTicks })
  }
  playbackProgress(itemId: string, positionTicks: number, isPaused: boolean, mediaSourceId?: string) {
    return this.post('/api/playback/progress', { itemId, mediaSourceId, positionTicks, isPaused })
  }
  playbackStop(itemId: string, positionTicks: number, mediaSourceId?: string) {
    return this.post('/api/playback/stop', { itemId, mediaSourceId, positionTicks })
  }

  // ── User actions ──────────────────────────────────────────────────────────
  toggleFavorite(itemId: string, favorite: boolean) { return this.post('/api/user/favorite', { itemId, favorite }) }
  toggleWatched(itemId: string, watched: boolean) { return this.post('/api/user/watched', { itemId, watched }) }

  // ── Stats & Health ────────────────────────────────────────────────────────
  health() { return this.get('/api/health') }
  systemStats() { return this.get('/api/system-stats') }
  watchTime() { return this.get('/api/stats/watch-time') }
  topGenres() { return this.get('/api/stats/top-genres') }
  topMovies() { return this.get('/api/stats/top-movies') }
  statsSummary() { return this.get('/api/stats/summary') }

  // ── Integrations ──────────────────────────────────────────────────────────
  integrationsConfig() { return this.get<Record<string, boolean>>('/api/integrations/config') }
  testIntegration(service: string) { return this.get<{ ok: boolean; message?: string; error?: string }>(`/api/integrations/test?service=${service}`) }
  requestMedia(type: string, id: string) { return this.post('/api/integrations/request', { type, id }) }
  discordNotify(data: Record<string, string>) { return this.post('/api/integrations/discord', data) }

  // ── Library tools ─────────────────────────────────────────────────────────
  libQuality() { return this.get('/api/library/quality-report') }
  libMissing() { return this.get('/api/library/missing-content') }
  libVersions() { return this.get('/api/library/versions-report') }
  libScan() { return this.get('/api/library/scan') }
  libRefreshAll() { return this.get('/api/library/scan') }
  libRefreshMeta(id: string) { return this.get(`/api/library/refresh-metadata?id=${id}`) }
  libRefreshImages(id: string) { return this.get(`/api/library/refresh-images?id=${id}`) }
  libAiFix(itemId: string) { return this.post('/api/library/ai-autofix', { itemId }) }

  // ── AI Navigator ──────────────────────────────────────────────────────────
  aiNavigate(message: string, history: { role: string; content: string }[], provider: string) {
    return this.post<{ reply: string; items?: MediaItem[]; action?: { type: string; path?: string; item?: { id: string; title: string } } }>(
      '/api/ai/navigate', { message, history, provider }
    )
  }

  // ── Weather ───────────────────────────────────────────────────────────────
  weather(city: string, units = 'C') {
    return this.get<{ temp: number; tempF: number; code: number; description: string }>(`/api/weather?city=${encodeURIComponent(city)}&units=${units}`)
  }
}

const api = new ApiClient()
export default api
export { ApiError }
