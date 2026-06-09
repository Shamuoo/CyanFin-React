import type { MediaItem, PlayingItem, MediaSource, NowPlaying, ServerStatus, PublicConfig, BrowseResult, User } from '@/types'
import { toast } from '@/components/ui/Toast'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// CyanFin multi-server: try backup if primary unreachable
let _cyanfinBase = ''  // empty = use relative URLs (same origin)

async function checkCyanFinServers() {
  const backup = (window as any).__CF_BACKUP__
  if (!backup) return
  try {
    await fetch('/api/public/info', { signal: AbortSignal.timeout(3000) })
  } catch {
    // Primary unreachable — switch to backup
    _cyanfinBase = backup
    console.log('[cyanfin] Switched to backup:', backup)
  }
}

// Inject backup URL from env (set by server in index.html or meta tag)
if (typeof window !== 'undefined') {
  const meta = document.querySelector('meta[name="cf-backup"]')
  if (meta) (window as any).__CF_BACKUP__ = meta.getAttribute('content')
  setTimeout(checkCyanFinServers, 5000)  // check after 5s
}

class ApiClient {
  private async fetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(_cyanfinBase + path, { credentials: 'include', ...opts })

    if (res.status === 401) {
      const isPolling = path.includes('now-playing') || path.includes('servers/status') || path.includes('servers/check')
      if (!isPolling) window.dispatchEvent(new CustomEvent('auth:expired'))
      throw new ApiError('Unauthorized', 401)
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }))
      const err = data.error || `HTTP ${res.status}`
      // Show toast for user-triggered actions (not background polling)
      const isBackground = path.includes('now-playing') || path.includes('servers/') || path.includes('recently-added') || path.includes('popular') || path.includes('history')
      if (!isBackground && res.status !== 404) toast.error(err)
      throw new ApiError(err, res.status)
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
  startDownload(itemId: string, title: string) { return this.post<any>('/api/downloads/start', { itemId, title }) }
  listDownloads() { return this.get<any>('/api/downloads') }
  deleteDownload(filename: string) { return this.delete(`/api/downloads/${encodeURIComponent(filename)}`) }

  getProfiles() { return this.get<any[]>('/api/profiles') }
  switchProfile(username: string, password: string) { return this.post<{ user: any }>('/api/profiles/switch', { username, password }) }

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
  serversSwitch(server: 'primary' | 'backup' | 'plex') { return this.post<ServerStatus>('/api/servers/switch', { server }) }
  serversCheck() { return this.get<ServerStatus>('/api/servers/check') }
  serversMatch(itemId: string, targetServer = 'backup') { return this.post<{ matchId: string | null }>('/api/servers/match', { itemId, targetServer }) }
  testJellyfin(url: string) { return this.get<{ ok: boolean; serverName?: string; version?: string; error?: string }>(`/api/test/jellyfin?url=${encodeURIComponent(url)}`) }
  testPlex(url: string, token: string) { return this.get<{ ok: boolean; error?: string }>(`/api/test/plex?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`) }

  // ── Browse ─────────────────────────────────────────────────────────────────
  recentlyAdded() { return this.get<MediaItem[]>('/api/recently-added') }
  people(q = '', limit = 200, startIndex = 0) { return this.get<any>(`/api/people?q=${encodeURIComponent(q)}&limit=${limit}&startIndex=${startIndex}`) }
  studios() { return this.get<any[]>('/api/studios') }
  studioItems(id: string) { return this.get<any[]>(`/api/studios/${id}/items`) }
  trending() { return this.get<any[]>('/api/trending') }
  randomUnwatched() { return this.get<any>('/api/random-unwatched') }
  changelog() { return this.get<any>('/api/changelog') }
  libRefreshAll() { return this.post('/api/library/refresh-all', {}) }

  watchHistory(limit = 100) { return this.get<any[]>(`/api/watch-history?limit=${limit}`) }
  searchFilter(params: Record<string,string>) {
    const q = new URLSearchParams(params).toString()
    return this.get<any[]>(`/api/search-filter?${q}`)
  }
  exportConfig() { return fetch('/api/config/export', { credentials: 'include' }).then(r => r.blob()) }
  importConfig(file: File) {
    return fetch('/api/config/import', { method: 'POST', credentials: 'include', body: file }).then(r => r.json())
  }
  nextUp() { return this.get<any[]>('/api/next-up') }
  continueWatching() { return this.get<MediaItem[]>('/api/continue-watching') }
  popular() { return this.get<MediaItem[]>('/api/popular') }
  history() { return this.get<MediaItem[]>('/api/history') }
  random() { return this.get<MediaItem[]>('/api/random') }
  playlists() { return this.get<any[]>('/api/playlists') }
  playlistItems(id: string) { return this.get<any[]>(`/api/playlists/${id}/items`) }
  createPlaylist(name: string, ids: string[] = []) { return this.post<any>('/api/playlists/create', { name, ids }) }
  addToPlaylist(id: string, ids: string[]) { return this.post<any>(`/api/playlists/${id}/add`, { ids }) }
  removeFromPlaylist(id: string, ids: string[]) { return this.post<any>(`/api/playlists/${id}/remove`, { ids }) }
  lyrics(id: string) { return this.get<any>(`/api/items/${id}/lyrics`) }
  addToWatchlist(itemId: string) { return this.post<any>('/api/watchlist/add', { itemId }) }
  removeFromWatchlist(itemId: string, _: string) { return this.post<any>('/api/watchlist/remove', { itemId }) }
  sharedWatchlist() { return this.get<any>('/api/watchlist/shared') }
  addToSharedWatchlist(itemId: string) { return this.post<any>('/api/watchlist/shared/add', { itemId }) }
  removeFromSharedWatchlist(playlistId: string, entryId: string) { return this.delete(`/api/watchlist/shared/${playlistId}?entryId=${entryId}`) }
  movies3d(start = 0, limit = 40) { return this.get<any>(`/api/movies/3d?start=${start}&limit=${limit}`) }
  movies4k(start = 0, limit = 40, sort = 'CommunityRating') { return this.get<any>(`/api/movies/4k?start=${start}&limit=${limit}&sort=${sort}`) }
  best4k() { return this.get<any[]>('/api/best4k') }
  instantMix(id: string) { return this.get<any[]>(`/api/items/${id}/instant-mix`) }
  similar(id: string) { return this.get<MediaItem[]>(`/api/items/${id}/similar`) }
  trailer(tmdbId: string, type = 'movie') { return this.get<{ trailerKey: string | null }>(`/api/trailer?tmdbId=${tmdbId}&type=${type}`) }
  filmography(personId: string) { return this.get<MediaItem[]>(`/api/person/${personId}/films`) }
  wikipedia(name: string) { return this.get<{ extract: string; thumbnail: string | null; url: string | null; description: string | null } | null>(`/api/wikipedia?name=${encodeURIComponent(name)}`) }
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
  createCollection(name: string, ids: string[]) { return this.post<any>('/api/collections/create', { name, ids }) }
  addToCollection(colId: string, ids: string[]) { return this.post<any>(`/api/collections/${colId}/add`, { ids }) }
  removeFromCollection(colId: string, ids: string[]) { return this.post<any>(`/api/collections/${colId}/remove`, { ids }) }
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
  watchlist() { return this.get<any[]>('/api/watchlist') }

  toggleFavorite(itemId: string, favorite: boolean) { return this.post('/api/user/favorite', { itemId, favorite }) }
  toggleWatched(itemId: string, watched: boolean) { return this.post('/api/user/watched', { itemId, watched }) }

  // ── Stats & Health ────────────────────────────────────────────────────────
  health() { return this.get('/api/health') }
  clusterStats()  { return this.get<any>('/api/cluster/stats') }
  clusterJobs()   { return this.get<any>('/api/cluster/jobs') }
  clusterRole(serverId: string, role: string) { return this.post('/api/cluster/roles', { serverId, role }) }
  clusterScan(serverId: string) { return this.post('/api/cluster/scan', { serverId }) }
  pretranscode(serverId: string, itemId: string, maxBitrate?: number) { return this.post('/api/cluster/pretranscode', { serverId, itemId, maxBitrate }) }
  haStatus()  { return this.get<any>('/api/servers/status') }
  adminUsers() { return this.get<any>('/api/admin/users') }
  adminSessions() { return this.get<any>('/api/admin/sessions') }
  activeSessions() { return this.get<any>('/api/active-sessions') }
  systemStats() { return this.get('/api/system-stats') }
  watchTime() { return this.get('/api/stats/watch-time') }
  topGenres() { return this.get('/api/stats/top-genres') }
  topMovies() { return this.get('/api/stats/top-movies') }
  statsSummary() { return this.get('/api/stats/summary') }
  uploadBackground(file: File) {
    return fetch('/api/config/background', { method: 'POST', credentials: 'include', body: file }).then(r => r.json())
  }
  deleteBackground() { return this.delete('/api/config/background') }

  syncStatus() { return this.get<any>('/api/stats/sync-status') }

  // ── Integrations ──────────────────────────────────────────────────────────
  integrationsConfig() { return this.get<Record<string, boolean>>('/api/integrations/config') }
  testIntegration(service: string) { return this.get<{ ok: boolean; message?: string; error?: string }>(`/api/integrations/test?service=${service}`) }
  requestMedia(type: string, id: string) { return this.post('/api/integrations/request', { type, id }) }
  discordNotify(data: Record<string, string>) { return this.post('/api/integrations/discord', data) }

  // ── Library tools ─────────────────────────────────────────────────────────
  libQuality() { return this.get('/api/library/quality-report') }
  libMissing() { return this.get('/api/library/missing-content') }
  libVersions() { return this.get('/api/library/versions-report') }
  missingEpisodes() { return this.get<any>('/api/library/missing-episodes') }
  metadataIssues(type = 'Movie') { return this.get<any>(`/api/library/metadata-issues?type=${type}`) }
  identifyItem(itemId: string, body: any) { return this.post<any>(`/api/library/identify/${itemId}`, body) }
  autoFixMetadata(itemIds: string[]) { return this.post<any>('/api/library/auto-fix-metadata', { itemIds }) }
  languageAudit(lang = 'eng', type = 'Movie') { return this.get<any>(`/api/library/language-audit?lang=${lang}&type=${type}`) }
  libScan() { return this.get('/api/library/scan') }
  libSyncDiff() { return this.get<any>('/api/library/sync-diff') }
  allServerLibraries() { return this.get<any>('/api/library/all-servers') }
  libRefreshAllMeta() { return this.get('/api/library/refresh-all-metadata') }
  libRefreshAllImages() { return this.get('/api/library/refresh-all-images') }
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
