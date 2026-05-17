'use strict';
/**
 * CyanFin Plex Client — full content fallback support
 * When Jellyfin is unreachable, CyanFin serves content from Plex
 */
const http  = require('http');
const https = require('https');
const cfg   = require('./config');

const HEADERS = (token) => ({
  'X-Plex-Token':             token || cfg.get('PLEX_TOKEN') || '',
  'X-Plex-Client-Identifier': 'cyanfin',
  'X-Plex-Product':           'CyanFin',
  'X-Plex-Version':           '0.14.0',
  'Accept':                   'application/json',
});

function getBase() { return (cfg.get('PLEX_URL') || '').replace(/\/$/, ''); }
function getToken() { return cfg.get('PLEX_TOKEN') || ''; }

function request(path, token, method = 'GET', body = null) {
  const base = getBase();
  const tok  = token || getToken();
  if (!base) return Promise.reject(new Error('Plex URL not configured'));

  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const hdrs = HEADERS(tok);
    if (bodyStr) { hdrs['Content-Type'] = 'application/json'; hdrs['Content-Length'] = Buffer.byteLength(bodyStr); }

    try {
      const parsed = new URL(base + path);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method, headers: hdrs, timeout: 12000,
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ data: JSON.parse(d), status: res.statusCode }); }
          catch { resolve({ data: null, raw: d, status: res.statusCode }); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Plex timeout')); });
      if (bodyStr) req.write(bodyStr);
      req.end();
    } catch(e) { reject(e); }
  });
}

const get = (path, token) => request(path, token).then(r => r.data);

// ── Image & stream URLs ───────────────────────────────────────────────────────

function thumbUrl(plexPath, w = 400, h = 600) {
  if (!plexPath) return null;
  const tok = getToken();
  return `/proxy/plex-image?path=${encodeURIComponent(plexPath)}&w=${w}&h=${h}&t=${encodeURIComponent(tok)}`;
}

function artUrl(plexPath) {
  if (!plexPath) return null;
  return thumbUrl(plexPath, 1920, 1080);
}

function directStreamUrl(ratingKey, token) {
  const base = getBase();
  const tok  = token || getToken();
  return `${base}/library/parts/${ratingKey}/0/file.mkv?X-Plex-Token=${tok}`;
}

function hlsStreamUrl(ratingKey, token) {
  const base = getBase();
  const tok  = token || getToken();
  // Universal transcode — works on all clients
  return `${base}/video/:/transcode/universal/start.m3u8?` +
    `path=${encodeURIComponent(`/library/metadata/${ratingKey}`)}` +
    `&mediaIndex=0&partIndex=0&protocol=hls&fastSeek=1` +
    `&directPlay=0&directStream=1&copyts=1` +
    `&X-Plex-Client-Identifier=cyanfin` +
    `&X-Plex-Product=CyanFin` +
    `&X-Plex-Token=${tok}`;
}

// ── Map Plex → CyanFin MediaItem ─────────────────────────────────────────────

function mapItem(item) {
  const type = item.type === 'movie' ? 'Movie'
    : item.type === 'show'    ? 'Series'
    : item.type === 'season'  ? 'Season'
    : item.type === 'episode' ? 'Episode'
    : item.type || 'Movie';

  const qualities = (item.Media || []).map(m => {
    const res = String(m.videoResolution || '');
    if (res === '4k' || res === '2160') return '4K';
    if (res === '1080') return '1080p';
    if (res === '720')  return '720p';
    return 'SD';
  }).filter((v, i, a) => a.indexOf(v) === i);

  const media = item.Media?.[0];
  const part  = media?.Part?.[0];

  return {
    id:          `plex_${item.ratingKey}`,
    plexKey:     item.ratingKey,
    plexPartKey: part?.key,          // e.g. /library/parts/1234/...
    title:       item.title,
    year:        item.year || null,
    type,
    overview:    item.summary || null,
    tagline:     item.tagline || null,
    score:       item.audienceRating || item.rating || null,
    rating:      item.contentRating || null,
    runtime:     media?.duration ? Math.round(media.duration / 60000) : null,
    runTimeTicks: media?.duration ? media.duration * 10000 : null,
    genre:       item.Genre?.[0]?.tag || null,
    genres:      (item.Genre || []).map(g => g.tag),
    qualities,
    audio: media?.audioProfile || null,
    director: item.Director?.[0]?.tag || null,
    cast: (item.Role || []).slice(0, 15).map(r => ({ id: String(r.id), name: r.tag, role: r.role || null, imageUrl: null })),
    indexNumber:       item.index        || null,
    parentIndexNumber: item.parentIndex  || null,
    seriesId:    item.grandparentRatingKey ? `plex_${item.grandparentRatingKey}` : null,
    seriesName:  item.grandparentTitle    || null,
    seasonName:  item.parentTitle         || null,
    posterUrl:   thumbUrl(item.thumb),
    thumbUrl:    thumbUrl(item.thumb),
    backdropUrl: artUrl(item.art || item.parentArt || item.grandparentArt),
    logoUrl:     null,
    userData:    {
      played:                !!item.viewCount,
      playedPercentage:      item.viewOffset && media?.duration ? Math.round((item.viewOffset / media.duration) * 100) : 0,
      playbackPositionTicks: item.viewOffset ? item.viewOffset * 10000 : 0,
      isFavorite:            false,
    },
    externalIds: {
      Imdb: (item.Guid || []).find(g => g.id?.startsWith('imdb://'))?.id?.replace('imdb://', '') || null,
      Tmdb: (item.Guid || []).find(g => g.id?.startsWith('tmdb://'))?.id?.replace('tmdb://', '') || null,
    },
    _source: 'plex',
  };
}

// ── Library browsing ──────────────────────────────────────────────────────────

async function getLibraries() {
  const data = await get('/library/sections');
  return (data?.MediaContainer?.Directory || []).map(l => ({
    id: l.key,
    name: l.title,
    type: l.type,   // 'movie' | 'show' | 'music'
    uuid: l.uuid,
  }));
}

async function getLibraryItems(sectionId, opts = {}) {
  const { sort = 'titleSort', order = 'asc', start = 0, limit = 50, genre } = opts;
  let path = `/library/sections/${sectionId}/all?sort=${sort}:${order}&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${limit}&includeGuids=1`;
  if (genre) path += `&genre=${encodeURIComponent(genre)}`;
  const data = await get(path);
  const items = (data?.MediaContainer?.Metadata || []).map(mapItem);
  return { items, total: data?.MediaContainer?.totalSize || items.length };
}

async function getRecentlyAdded(limit = 20) {
  const data = await get(`/library/recentlyAdded?X-Plex-Container-Size=${limit}&includeGuids=1`);
  return (data?.MediaContainer?.Metadata || []).map(mapItem);
}

async function getContinueWatching(limit = 12) {
  const data = await get(`/library/onDeck?X-Plex-Container-Size=${limit}&includeGuids=1`);
  return (data?.MediaContainer?.Metadata || []).map(mapItem);
}

async function getPopular(limit = 20) {
  // Plex doesn't have a "popular" endpoint — use most played
  const data = await get(`/library/all?sort=viewCount:desc&X-Plex-Container-Size=${limit}&includeGuids=1`);
  return (data?.MediaContainer?.Metadata || []).map(mapItem);
}

async function getMovies(opts = {}) {
  const libs = await getLibraries();
  const movieLib = libs.find(l => l.type === 'movie');
  if (!movieLib) return { items: [], total: 0 };
  return getLibraryItems(movieLib.id, opts);
}

async function getShows(opts = {}) {
  const libs = await getLibraries();
  const showLib = libs.find(l => l.type === 'show');
  if (!showLib) return { items: [], total: 0 };
  return getLibraryItems(showLib.id, { ...opts, sort: opts.sort || 'titleSort' });
}

async function getSeasons(showKey) {
  const key = showKey.replace('plex_', '');
  const data = await get(`/library/metadata/${key}/children?includeGuids=1`);
  return (data?.MediaContainer?.Metadata || []).map(mapItem);
}

async function getEpisodes(seasonKey) {
  const key = seasonKey.replace('plex_', '');
  const data = await get(`/library/metadata/${key}/children?includeGuids=1`);
  return (data?.MediaContainer?.Metadata || []).map(mapItem);
}

async function getItem(key) {
  const k = String(key).replace('plex_', '');
  const data = await get(`/library/metadata/${k}?includeGuids=1&includeConcerts=1&includeExtras=1`);
  const item = data?.MediaContainer?.Metadata?.[0];
  if (!item) return null;
  return mapItem(item);
}

async function search(query, limit = 15) {
  const data = await get(`/search?query=${encodeURIComponent(query)}&limit=${limit}&includeGuids=1`);
  return (data?.MediaContainer?.Metadata || []).map(mapItem);
}

// ── Playback ──────────────────────────────────────────────────────────────────

async function getPlaybackInfo(ratingKey) {
  const k = String(ratingKey).replace('plex_', '');
  const data = await get(`/library/metadata/${k}?includeGuids=1`);
  const item = data?.MediaContainer?.Metadata?.[0];
  if (!item) throw new Error('Plex item not found');

  const media = item.Media?.[0];
  const part  = media?.Part?.[0];
  const base  = getBase();
  const tok   = getToken();

  // Try direct stream first, HLS fallback
  const streamUrl = part?.key
    ? `${base}${part.key}?X-Plex-Token=${tok}`
    : directStreamUrl(k, tok);
  const hlsUrl = hlsStreamUrl(k, tok);

  return {
    streamUrl,
    hlsUrl,
    mediaSources: [{
      id: String(media?.id || k),
      name: `${media?.videoResolution || 'Direct'}`,
      container: media?.container || 'mkv',
      videoCodec: media?.videoCodec,
      bitrate: media?.bitrate,
      streamUrl,
      hlsUrl,
      audioStreams: (media?.Part?.[0]?.Stream || [])
        .filter(s => s.streamType === 2)
        .map(s => ({ index: s.index, title: `${s.language || ''} ${s.codec || ''} ${s.channels ? s.channels + 'ch' : ''}`.trim(), codec: s.codec, channels: s.channels, language: s.language, isDefault: s.selected === 1 })),
      subtitleStreams: (media?.Part?.[0]?.Stream || [])
        .filter(s => s.streamType === 3)
        .map(s => ({ index: s.index, title: `${s.language || ''} ${s.codec || ''}`.trim(), language: s.language, isDefault: s.selected === 1, codec: s.codec })),
    }],
  };
}

// Report playback to Plex (so it tracks watch progress)
async function reportPlaybackStart(ratingKey, positionMs = 0) {
  const k = String(ratingKey).replace('plex_', '');
  await request(`/:/timeline?ratingKey=${k}&key=/library/metadata/${k}&state=playing&time=${positionMs}&duration=0&X-Plex-Client-Identifier=cyanfin`).catch(() => {});
}

async function reportPlaybackProgress(ratingKey, positionMs, durationMs, isPaused) {
  const k = String(ratingKey).replace('plex_', '');
  const state = isPaused ? 'paused' : 'playing';
  await request(`/:/timeline?ratingKey=${k}&key=/library/metadata/${k}&state=${state}&time=${positionMs}&duration=${durationMs}&X-Plex-Client-Identifier=cyanfin`).catch(() => {});
}

async function reportPlaybackStop(ratingKey, positionMs, durationMs) {
  const k = String(ratingKey).replace('plex_', '');
  await request(`/:/timeline?ratingKey=${k}&key=/library/metadata/${k}&state=stopped&time=${positionMs}&duration=${durationMs}&X-Plex-Client-Identifier=cyanfin`).catch(() => {});
}

// ── Image proxy ───────────────────────────────────────────────────────────────
// Call this from index.js to proxy Plex images through CyanFin
async function proxyImage(res, plexPath, w, h) {
  const base = getBase();
  const tok  = getToken();
  if (!base || !plexPath) { res.writeHead(404); res.end(); return; }

  const url = `${base}/photo/:/transcode?url=${encodeURIComponent(plexPath)}&width=${w}&height=${h}&minSize=1&X-Plex-Token=${tok}`;
  const parsed = new URL(url);
  const lib = parsed.protocol === 'https:' ? https : http;

  const req = lib.request(url, { headers: HEADERS(tok) }, proxyRes => {
    res.writeHead(proxyRes.statusCode || 200, {
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    });
    proxyRes.pipe(res);
  });
  req.on('error', () => { res.writeHead(502); res.end(); });
  req.end();
}

// Find Plex item matching a Jellyfin item by IMDB/TMDB ID
async function findMatchByProviderIds(providerIds) {
  const imdbId = providerIds?.Imdb;
  const tmdbId = providerIds?.Tmdb;
  if (!imdbId && !tmdbId) return null;

  const libs = await getLibraries().catch(() => []);
  for (const lib of libs) {
    if (!['movie', 'show'].includes(lib.type)) continue;
    const guid = imdbId ? `imdb://${imdbId}` : `tmdb://${tmdbId}`;
    const data = await get(`/library/sections/${lib.id}/all?guid=${encodeURIComponent(guid)}&includeGuids=1`).catch(() => null);
    const match = data?.MediaContainer?.Metadata?.[0];
    if (match) return mapItem(match);
  }
  return null;
}

async function ping() {
  const base = getBase();
  const tok  = getToken();
  if (!base || !tok) return { ok: false, error: 'Not configured' };
  try {
    const start = Date.now();
    const r = await request('/identity', tok);
    return { ok: r.status < 400, latency: Date.now() - start };
  } catch(e) { return { ok: false, error: e.message }; }
}

module.exports = {
  get, request, mapItem,
  getLibraries, getLibraryItems, getMovies, getShows,
  getRecentlyAdded, getContinueWatching, getPopular,
  getSeasons, getEpisodes, getItem, search,
  getPlaybackInfo,
  reportPlaybackStart, reportPlaybackProgress, reportPlaybackStop,
  proxyImage, findMatchByProviderIds, ping,
  thumbUrl, artUrl, hlsStreamUrl, directStreamUrl,
};
