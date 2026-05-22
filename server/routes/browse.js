

const tmdb = require('../tmdb');
'use strict';
const fs   = require('fs');
const path = require('path');
const jf   = require('../jellyfin');
const plex = require('../plexClient');
const sm   = require('../serverManager');
const { mapItem, dedup } = require('./media');

// ── Offline cache ──────────────────────────────────────────────────────────────
function getCacheFile(userId, key) {
  try {
    const cfg = require('../config');
    const cacheDir = cfg.getCachePath('cache');
    return path.join(cacheDir, `library_${userId}_${key}.json`);
  } catch { return null; }
}

function readCache(userId, key) {
  try {
    const f = getCacheFile(userId, key);
    if (!f || !fs.existsSync(f)) return null;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    return { data: data.data, ts: data.ts, stale: true };
  } catch { return null; }
}

function writeCache(userId, key, data) {
  try {
    const f = getCacheFile(userId, key);
    if (!f) return;
    fs.writeFileSync(f, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* ignore */ }
}

// Wraps a fetch with cache fallback
async function withCache(userId, key, fetchFn) {
  try {
    const result = await fetchFn();
    writeCache(userId, key, result);
    return result;
  } catch(e) {
    if (e.status === 401 || e.status === 403) throw e; // don't serve stale on auth errors
    const cached = readCache(userId, key);
    if (cached) {
      console.log(`[offline] Serving cached ${key} for user ${userId}`);
      return cached.data;
    }
    throw e;
  }
}



// ── Source-aware fetch ────────────────────────────────────────────────────────

function usePlex() { return sm.isPlexFallback(); }


// ── Offline cache ─────────────────────────────────────────────────────────────
// Wraps any fetch: on success caches to disk, on failure returns cached data
function withCache(userId, key, fetchFn) {
  const cfg = require('../config');
  const cacheDir = cfg.getCachePath('cache');
  const cacheFile = require('path').join(cacheDir, `lib_${String(userId).slice(0,8)}_${key.replace(/[^a-z0-9]/gi,'_')}.json`);
  const fs = require('fs');

  return fetchFn()
    .then(data => {
      try { fs.writeFileSync(cacheFile, JSON.stringify({ ts: Date.now(), data })); } catch {}
      return data;
    })
    .catch(err => {
      if (err?.status === 401 || String(err?.message).includes('Unauthorized')) throw err;
      try {
        if (fs.existsSync(cacheFile)) {
          const { data } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          console.log(`[offline] Serving cached ${key}`);
          return data;
        }
      } catch {}
      throw err;
    });
}

async function handleBrowse(pathname, query, session) {
  const token  = sm.getActiveToken(session);
  const userId = session.userId;
  const fromPlex = usePlex();

  // ── Recently Added ─────────────────────────────────────────────────────────
  if (pathname === '/api/recently-added') {
    if (fromPlex) return plex.getRecentlyAdded(24).catch(() => []);


      const data = await jf.get(
        `/Users/${userId}/Items/Latest?MediaType=Video&Limit=24` +
        `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
        token
      );
      return dedup((Array.isArray(data) ? data : data.Items || []).map(i => mapItem(i, token)));
  }

  // ── Instant mix (radio from a track) ────────────────────────────────────────
  if (pathname.match(/^\/api\/items\/[^/]+\/instant-mix$/)) {
    const trackId = pathname.split('/')[3];
    const data = await jf.get(
      `/Audio/${trackId}/InstantMix?userId=${userId}&Limit=30&fields=MediaStreams,ParentId`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Next Up (new episodes for shows you watch) ───────────────────────────────
  if (pathname === '/api/next-up') {
    const data = await jf.get(
      `/Shows/NextUp?UserId=${userId}&Limit=20&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags&ImageTypeLimit=1`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Advanced search with filters ─────────────────────────────────────────────
  if (pathname === '/api/search-filter') {
    const { q = '', genre = '', year = '', minRating = '', maxRating = '',
            quality = '', unwatched = '', type = 'Movie,Episode,Series', limit = '50' } = query;
    let url = `/Users/${userId}/Items?Recursive=true&IncludeItemTypes=${encodeURIComponent(type)}&Limit=${limit}` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags` +
      `&SortBy=SortName&SortOrder=Ascending`;
    if (q)          url += `&SearchTerm=${encodeURIComponent(q)}`;
    if (genre)      url += `&Genres=${encodeURIComponent(genre)}`;
    if (year)       url += `&Years=${year}`;
    if (minRating)  url += `&MinCommunityRating=${minRating}`;
    if (unwatched === '1') url += '&Filters=IsUnplayed';
    const data = await jf.get(url, token);
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Because you watched (personalised row from recent history) ─────────────
  if (pathname === '/api/because-you-watched') {
    try {
      // Get last 5 watched items
      const history = await jf.get(
        `/Users/${userId}/Items?Filters=IsPlayed&SortBy=DatePlayed&SortOrder=Descending&Recursive=true&IncludeItemTypes=Movie,Series&Limit=5&fields=Genres,ProviderIds`,
        token
      );
      const recent = (history.Items || []).slice(0, 5);
      if (!recent.length) return { rows: [] };

      // For each recent item, get similar items
      const rows = await Promise.all(recent.slice(0, 3).map(async item => {
        const similar = await jf.get(
          `/Items/${item.Id}/Similar?userId=${userId}&Limit=12&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags`,
          token
        ).catch(() => ({ Items: [] }));
        const items = (similar.Items || []).map(i => mapItem(i, token));
        if (!items.length) return null;
        return { title: `Because you watched ${item.Name}`, items };
      }));

      return { rows: rows.filter(Boolean) };
    } catch { return { rows: [] }; }
  }


  // ── People directory ─────────────────────────────────────────────────────────
  if (pathname === '/api/people') {
    const { limit = '60', q = '' } = query;
    const url = `/Persons?Limit=${limit}${q ? `&SearchTerm=${encodeURIComponent(q)}` : ''}&SortBy=SortName&fields=PrimaryImageAspectRatio,Overview`;
    const data = await jf.get(url, token);
    return (data.Items || []).map(p => ({
      id: p.Id, name: p.Name, type: p.Type || 'Person',
      imageUrl: p.PrimaryImageTag ? `/proxy/image?id=${p.Id}&type=Primary&w=200` : null,
      overview: p.Overview || null,
    }));
  }

  // ── Studios ───────────────────────────────────────────────────────────────────
  if (pathname === '/api/studios') {
    const data = await jf.get(`/Studios?UserId=${userId}&Limit=40&SortBy=SortName`, token);
    return (data.Items || []).map(s => ({
      id: s.Id, name: s.Name,
      imageUrl: s.PrimaryImageTag ? `/proxy/image?id=${s.Id}&type=Primary&w=200` : null,
    }));
  }

  // ── Studio content ────────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/studios\/[^/]+\/items$/)) {
    const studioId = pathname.split('/')[3];
    const data = await jf.get(
      `/Users/${userId}/Items?StudioIds=${studioId}&Recursive=true&IncludeItemTypes=Movie,Series&Limit=50&SortBy=SortName&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── TMDB Trending (filter to owned) ──────────────────────────────────────────
  if (pathname === '/api/trending') {
    const cfg = require('../config');
    const tmdbKey = cfg.get('TMDB_API_KEY');
    if (!tmdbKey) return [];
    const https = require('https');
    const tmdbData = await new Promise(resolve => {
      const req = https.request({
        hostname: 'api.themoviedb.org',
        path: `/3/trending/all/week?api_key=${tmdbKey}`,
        method: 'GET', timeout: 8000,
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      });
      req.on('error', () => resolve({}));
      req.on('timeout', () => { req.destroy(); resolve({}); });
      req.end();
    });
    const titles = (tmdbData.results || []).map(t => t.title || t.name).filter(Boolean);
    if (!titles.length) return [];
    // Search each trending item in Jellyfin library
    const found = await Promise.all(titles.slice(0, 10).map(title =>
      jf.get(`/Users/${userId}/Items?SearchTerm=${encodeURIComponent(title)}&Recursive=true&IncludeItemTypes=Movie,Series&Limit=1&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags`, token)
        .then(d => d.Items?.[0] ? mapItem(d.Items[0], token) : null)
        .catch(() => null)
    ));
    return found.filter(Boolean);
  }

  // ── Random unwatched movie ────────────────────────────────────────────────────
  if (pathname === '/api/random-unwatched') {
    const data = await jf.get(
      `/Users/${userId}/Items?Filters=IsUnplayed&IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=1&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    const item = data.Items?.[0];
    return item ? mapItem(item, token) : null;
  }

  // ── Watch history ──────────────────────────────────────────────────────────────
  if (pathname === '/api/watch-history') {
    const limit = parseInt(query.limit || '100');
    const data = await jf.get(
      `/Users/${userId}/Items?Filters=IsPlayed&SortBy=DatePlayed&SortOrder=Descending` +
      `&Recursive=true&IncludeItemTypes=Movie,Episode&Limit=${limit}` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Continue Watching ──────────────────────────────────────────────────────
  if (pathname === '/api/continue-watching') {
    if (fromPlex) return plex.getContinueWatching(12).catch(() => []);
    return withCache(userId, 'continue-watching', async () => {
      const data = await jf.get(
        `/Users/${userId}/Items/Resume?MediaTypes=Video&Limit=12` +
        `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
        token
      );
      return (data.Items || []).map(i => mapItem(i, token));
    });
  }

  // ── Popular ────────────────────────────────────────────────────────────────
  if (pathname === '/api/popular') {
    if (fromPlex) return plex.getPopular(20).catch(() => []);
    return withCache(userId, 'popular', async () => {
      const data = await jf.get(
        `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true` +
        `&SortBy=PlayCount,CommunityRating&SortOrder=Descending&Limit=20` +
        `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
        token
      );
      return (data.Items || []).map(i => mapItem(i, token));
    });
  }

  // ── Watch History ──────────────────────────────────────────────────────────
  if (pathname === '/api/history') {
    if (fromPlex) {
      // Plex doesn't have a simple "history" endpoint — use onDeck as proxy
      return plex.getContinueWatching(20).catch(() => []);
    }
    const data = await jf.get(
      `/Users/${userId}/Items?Filters=IsPlayed&Recursive=true&IncludeItemTypes=Movie,Episode` +
      `&SortBy=DatePlayed&SortOrder=Descending&Limit=20` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Movies ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/movies') {
    const sort  = query.sort || 'SortName';
    const order = query.order || 'Ascending';
    const start = parseInt(query.start || '0');
    const limit = parseInt(query.limit || '50');
    const genre = query.genre;
    const search = query.search;

    if (fromPlex) {
      const plexSort = sort === 'CommunityRating' ? 'rating' : sort === 'DateCreated' ? 'addedAt' : 'titleSort';
      const plexOrder = order === 'Descending' ? 'desc' : 'asc';
      return plex.getMovies({ sort: plexSort, order: plexOrder, start, limit, genre, search }).catch(() => ({ items: [], total: 0 }));
    }

    const genreParam  = genre  ? `&Genres=${encodeURIComponent(genre)}`  : '';
    const searchParam = search ? `&SearchTerm=${encodeURIComponent(search)}` : '';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true` +
      `&SortBy=${sort}&SortOrder=${order}&StartIndex=${start}&Limit=${limit}` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags` +
      genreParam + searchParam,
      token
    );
    return { items: (data.Items || []).map(i => mapItem(i, token)), total: data.TotalRecordCount || 0 };
  }

  // ── TV Shows ───────────────────────────────────────────────────────────────
  if (pathname === '/api/shows') {
    const sort  = query.sort || 'SortName';
    const order = query.order || 'Ascending';
    const start = parseInt(query.start || '0');
    const limit = parseInt(query.limit || '50');
    const genre = query.genre;
    const search = query.search;

    if (fromPlex) {
      const plexSort = sort === 'DateCreated' ? 'addedAt' : 'titleSort';
      const plexOrder = order === 'Descending' ? 'desc' : 'asc';
      return plex.getShows({ sort: plexSort, order: plexOrder, start, limit, genre, search }).catch(() => ({ items: [], total: 0 }));
    }

    const genreParam  = genre  ? `&Genres=${encodeURIComponent(genre)}`  : '';
    const searchParam = search ? `&SearchTerm=${encodeURIComponent(search)}` : '';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true` +
      `&SortBy=${sort}&SortOrder=${order}&StartIndex=${start}&Limit=${limit}` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,ImageTags,BackdropImageTags` +
      genreParam + searchParam,
      token
    );
    return { items: (data.Items || []).map(i => mapItem(i, token)), total: data.TotalRecordCount || 0 };
  }

  // ── Seasons ────────────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/shows\/[^/]+\/seasons$/)) {
    const showId = pathname.split('/')[3];
    if (fromPlex || showId.startsWith('plex_')) {
      return plex.getSeasons(showId).catch(() => []);
    }
    const data = await jf.get(`/Shows/${showId}/Seasons?userId=${userId}&fields=Overview,ImageTags`, token);
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Episodes ───────────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/shows\/[^/]+\/seasons\/[^/]+\/episodes$/)) {
    const parts    = pathname.split('/');
    const showId   = parts[3];
    const seasonId = parts[5];
    if (fromPlex || seasonId.startsWith('plex_')) {
      return plex.getEpisodes(seasonId).catch(() => []);
    }
    const data = await jf.get(
      `/Shows/${showId}/Episodes?seasonId=${seasonId}&userId=${userId}` +
      `&fields=Overview,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Next Episode ───────────────────────────────────────────────────────────
  if (pathname === '/api/next-episode') {
    const { seriesId, parentIndexNumber, indexNumber } = query;
    if (!seriesId) return { hasNext: false };

    if (fromPlex || String(seriesId).startsWith('plex_')) {
      // Get all episodes from all seasons of the Plex show
      const seasons = await plex.getSeasons(seriesId).catch(() => []);
      const curSeason = parseInt(parentIndexNumber);
      const curEp     = parseInt(indexNumber);
      let allEps = [];
      for (const season of seasons) {
        const eps = await plex.getEpisodes(season.id).catch(() => []);
        allEps = [...allEps, ...eps];
      }
      const curIdx = allEps.findIndex(e => e.parentIndexNumber === curSeason && e.indexNumber === curEp);
      if (curIdx === -1 || curIdx >= allEps.length - 1) return { hasNext: false };
      return { hasNext: true, episode: allEps[curIdx + 1] };
    }

    const data = await jf.get(`/Shows/${seriesId}/Episodes?userId=${userId}&fields=ImageTags,UserData`, token);
    const eps = data.Items || [];
    const curIdx = eps.findIndex(e => e.ParentIndexNumber == parentIndexNumber && e.IndexNumber == indexNumber);
    if (curIdx === -1 || curIdx >= eps.length - 1) return { hasNext: false };
    return { hasNext: true, episode: mapItem(eps[curIdx + 1], token) };
  }


  // ── Create collection ────────────────────────────────────────────────────────
  if (pathname === '/api/collections/create' && req.method === 'POST') {
    const { name, ids } = req._body || {};
    if (!name) return { error: 'Name required' };
    // Create the collection
    const result = await jf.post(`/Collections?Name=${encodeURIComponent(name)}&Ids=${(ids||[]).join(',')}`, {}, token);
    return { id: result.Id, name, success: true };
  }

  // ── Add to collection ────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/collections\/[^/]+\/add$/) && req.method === 'POST') {
    const colId = pathname.split('/')[3];
    const { ids } = req._body || {};
    if (!ids?.length) return { error: 'No item ids' };
    await jf.post(`/Collections/${colId}/Items?Ids=${ids.join(',')}`, {}, token);
    return { success: true };
  }

  // ── Remove from collection ───────────────────────────────────────────────────
  if (pathname.match(/^\/api\/collections\/[^/]+\/remove$/) && req.method === 'POST') {
    const colId = pathname.split('/')[3];
    const { ids } = req._body || {};
    if (!ids?.length) return { error: 'No item ids' };
    await jf.del(`/Collections/${colId}/Items?Ids=${ids.join(',')}`, token);
    return { success: true };
  }

  // ── Collections ────────────────────────────────────────────────────────────
  if (pathname === '/api/collections') {
    if (fromPlex) return []; // Plex has playlists, not box sets — skip for now
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=BoxSet&Recursive=true` +
      `&SortBy=SortName&fields=ImageTags,BackdropImageTags&Limit=50`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  if (pathname.match(/^\/api\/collections\/[^/]+\/items$/)) {
    const colId = pathname.split('/')[3];
    const data = await jf.get(
      `/Users/${userId}/Items?ParentId=${colId}` +
      `&fields=Overview,ImageTags,MediaSources,BackdropImageTags&SortBy=SortName`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Libraries ──────────────────────────────────────────────────────────────
  if (pathname === '/api/libraries') {
    if (fromPlex) {
      const libs = await plex.getLibraries().catch(() => []);
      return libs.map(l => ({ id: String(l.id), name: l.name, type: l.type, imageUrl: null }));
    }
    const data = await jf.get(`/Users/${userId}/Views`, token);
    return (data.Items || []).map(l => ({
      id: l.Id, name: l.Name, type: l.CollectionType || l.Type,
      imageUrl: l.ImageTags?.Primary ? `/proxy/image?id=${l.Id}&type=Primary&w=400` : null,
    }));
  }

  // ── Genres ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/genres') {
    if (fromPlex) return []; // skip for now
    const type = query.type || 'Movie';
    const data = await jf.get(`/Genres?userId=${userId}&IncludeItemTypes=${type}&SortBy=SortName&Limit=100`, token);
    return (data.Items || []).map(g => ({ id: g.Id, name: g.Name }));
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/search') {
    const q = query.q || '';
    if (!q) return [];
    if (fromPlex) return plex.search(q, 20).catch(() => []);
    const data = await jf.get(
      `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(q)}&Recursive=true&Limit=20` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Now Playing ────────────────────────────────────────────────────────────
  if (pathname === '/api/now-playing') {
    if (fromPlex) return null; // Plex sessions via separate API
    const sessions = await jf.get('/Sessions', token);
    const active = (Array.isArray(sessions) ? sessions : sessions.Items || [])
      .filter(s => s.NowPlayingItem && ['Movie','Episode','Video'].includes(s.NowPlayingItem.Type));
    if (!active.length) return null;
    const s = active[0];
    const item = s.NowPlayingItem;
    return {
      item: mapItem(item, token),
      positionTicks: s.PlayState?.PositionTicks || 0,
      runtimeTicks: item.RunTimeTicks || 0,
      isPaused: s.PlayState?.IsPaused || false,
      allSessions: active.map(x => ({ user: x.UserName, userId: x.UserId })),
    };
  }

  // ── Best 3D ────────────────────────────────────────────────────────────────
  if (pathname === '/api/best-3d') {
    if (fromPlex) return [];
    const keywords = ['Avatar', 'How to Train Your Dragon', 'Life of Pi', 'Gravity', 'Interstellar'];
    const results = await Promise.all(
      keywords.map(kw => jf.get(
        `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(kw)}&IncludeItemTypes=Movie&Recursive=true&Limit=3` +
        `&fields=MediaStreams,ImageTags,BackdropImageTags`,
        token
      ).then(d => (d.Items || []).filter(i => (i.Video3DFormat || '') !== '')).catch(() => []))
    );
    return dedup(results.flat().map(i => mapItem(i, token))).slice(0, 15);
  }

  // ── Random ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/random') {
    if (fromPlex) {
      const r = await plex.getMovies({ sort: 'random', order: 'asc', start: 0, limit: 1 }).catch(() => ({ items: [] }));
      return r.items || [];
    }
    const count = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token);
    const total = count.TotalRecordCount || 100;
    const startIndex = Math.floor(Math.random() * Math.max(0, total - 1));
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&StartIndex=${startIndex}&Limit=1` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }



  // ── Trailer (TMDB YouTube key) ────────────────────────────────────────────────
  if (pathname === '/api/trailer') {
    const { tmdbId, type = 'movie' } = query;
    if (!tmdbId) return { trailerKey: null };
    try {
      const cfg = require('../config');
      const tmdbKey = cfg.get('TMDB_API_KEY');
      if (!tmdbKey) return { trailerKey: null, error: 'No TMDB key' };
      const https = require('https');
      const data = await new Promise(resolve => {
        const req = https.request({
          hostname: 'api.themoviedb.org',
          path: `/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/videos?api_key=${tmdbKey}`,
          method: 'GET', timeout: 8000,
        }, res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
        });
        req.on('error', () => resolve({}));
        req.on('timeout', () => { req.destroy(); resolve({}); });
        req.end();
      });
      const trailer = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
        || (data.results || []).find(v => v.site === 'YouTube');
      return { trailerKey: trailer?.key || null };
    } catch(e) { return { trailerKey: null }; }
  }

  // ── Filmography (person's titles in library) ──────────────────────────────────
  if (pathname.match(/^\/api\/person\/[^/]+\/films$/)) {
    const personId = pathname.split('/')[3];
    const data = await jf.get(
      `/Items?PersonIds=${personId}&Recursive=true&IncludeItemTypes=Movie,Series&Limit=30` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,ImageTags,BackdropImageTags` +
      `&userId=${userId}&SortBy=ProductionYear&SortOrder=Descending`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Wikipedia person summary ──────────────────────────────────────────────────
  if (pathname === '/api/wikipedia') {
    const { name } = query;
    if (!name) return null;
    // Check cache first
    const cfg = require('../config');
    const cacheDir = cfg.getCachePath('cache');
    const fs = require('fs');
    const cacheFile = require('path').join(cacheDir, `wiki_${name.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.json`);
    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile,'utf8'));
        if (Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000) return cached.data;
      } catch {}
    }
    try {
      const https = require('https');
      const encodedName = encodeURIComponent(name.replace(/ /g,'_'));
      const data = await new Promise(resolve => {
        const req = https.request({
          hostname: 'en.wikipedia.org',
          path: `/api/rest_v1/page/summary/${encodedName}`,
          method: 'GET',
          headers: { 'User-Agent': 'CyanFin/0.16 (home theater app)' },
          timeout: 8000,
        }, res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
      });
      if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
      const result = {
        extract: data.extract,
        thumbnail: data.thumbnail?.source || null,
        url: data.content_urls?.desktop?.page || null,
        description: data.description || null,
      };
      // Cache it
      fs.writeFileSync(cacheFile, JSON.stringify({ ts: Date.now(), data: result }));
      return result;
    } catch(e) { return null; }
  }

  // ── Trickplay BIF proxy ───────────────────────────────────────────────────────
  if (pathname === '/api/trickplay') {
    const { id, width = '320' } = query;
    if (!id) return null;
    // Try Jellyfin trickplay endpoint (10.9+ or CyanFin Plugin)
    try {
      const data = await jf.get(`/Videos/${id}/Trickplay/${width}/GetBIF`, token);
      return { available: true };
    } catch { return { available: false }; }
  }

  // ── Watchlist ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/watchlist') {
    // Store watchlist as Jellyfin playlist named "CyanFin Watchlist"
    try {
      const lists = await jf.get(`/Users/${userId}/Views?api_key=${token}`);
      // Try to get or create a playlist
      const playlists = await jf.get(`/Playlists?userId=${userId}&api_key=${token}`).catch(() => ({ Items: [] }));
      const wl = (playlists.Items || []).find(p => p.Name === 'CyanFin Watchlist');
      if (!wl) return [];
      const items = await jf.get(`/Playlists/${wl.Id}/Items?userId=${userId}&api_key=${token}`);
      return (items.Items || []).map(i => mapItem(i, token));
    } catch { return []; }
  }

  if (pathname === '/api/user/watchlist' && req.method === 'POST') {
    const { itemId, action } = req._body || {};
    if (!itemId) return { error: 'No itemId' };
    try {
      const playlists = await jf.get(`/Playlists?userId=${userId}&api_key=${token}`).catch(() => ({ Items: [] }));
      let wl = (playlists.Items || []).find(p => p.Name === 'CyanFin Watchlist');
      if (!wl && action === 'add') {
        // Create the watchlist playlist
        const created = await jf.post(`/Playlists?Name=CyanFin+Watchlist&UserId=${userId}&api_key=${token}`, {});
        wl = { Id: created.Id };
      }
      if (!wl) return { error: 'No watchlist' };
      if (action === 'add') await jf.post(`/Playlists/${wl.Id}/Items?Ids=${itemId}&UserId=${userId}&api_key=${token}`, {});
      else await jf.del(`/Playlists/${wl.Id}/Items?EntryIds=${itemId}&api_key=${token}`, token);
      return { ok: true };
    } catch(e) { return { error: e.message }; }
  }

  // ── Upcoming Movies (TMDB) ──────────────────────────────────────────────────
  if (pathname === '/api/upcoming/movies') {
    try {
      const data = await tmdb.upcoming();
      return (data.results || []).slice(0, 20).map(m => ({
        id: m.id,
        title: m.title,
        releaseDate: m.release_date,
        posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : null,
        score: m.vote_average,
        overview: m.overview,
      }));
    } catch(e) { return []; }
  }

  // ── Upcoming TV Shows (TMDB) ────────────────────────────────────────────────
  if (pathname === '/api/upcoming/shows') {
    try {
      const cfg = require('../config');
      const tmdbKey = cfg.get('TMDB_API_KEY');
      if (!tmdbKey) return [];
      const https = require('https');
      const data = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.themoviedb.org',
          path: `/3/tv/on_the_air?api_key=${tmdbKey}&language=en-US&page=1`,
          method: 'GET', timeout: 8000,
        }, res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
        });
        req.on('error', () => resolve({}));
        req.on('timeout', () => { req.destroy(); resolve({}); });
        req.end();
      });
      return ((data.results || []).slice(0, 20)).map(s => ({
        id: s.id,
        title: s.name,
        releaseDate: s.first_air_date,
        posterUrl: s.poster_path ? `https://image.tmdb.org/t/p/w200${s.poster_path}` : null,
        score: s.vote_average,
        overview: s.overview,
      }));
    } catch(e) { return []; }
  }

  // ── Similar / More like this ────────────────────────────────────────────────
  if (pathname.match(/^\/api\/items\/[^/]+\/similar$/)) {
    const itemId = pathname.split('/')[3];
    if (itemId.startsWith('plex_')) return [];
    const data = await jf.get(
      `/Items/${itemId}/Similar?userId=${userId}&Limit=12` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Music ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/music/albums') {
    if (fromPlex) return [];
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=MusicAlbum&Recursive=true&SortBy=SortName&Limit=100&fields=ImageTags`, token);
    return (data.Items || []).map(i => ({
      id: i.Id, title: i.Name, artist: i.AlbumArtist || i.Artists?.[0],
      year: i.ProductionYear, imageUrl: i.ImageTags?.Primary ? `/proxy/image?id=${i.Id}&type=Primary&w=400` : null,
    }));
  }

  if (pathname === '/api/music/tracks') {
    if (fromPlex) return [];
    const albumId = query.albumId;
    if (!albumId) return [];
    const data = await jf.get(`/Users/${userId}/Items?ParentId=${albumId}&IncludeItemTypes=Audio&SortBy=IndexNumber&Limit=100&fields=MediaStreams`, token);
    return (data.Items || []).map(i => ({
      id: i.Id, title: i.Name, artist: i.AlbumArtist || i.Artists?.[0],
      album: i.Album, trackNumber: i.IndexNumber, duration: i.RunTimeTicks,
      streamUrl: `${jf.getBaseUrl()}/Audio/${i.Id}/universal?api_key=${session.token}&MaxStreamingBitrate=10000000&Container=opus,mp3,aac`,
    }));
  }

  return null;
}

module.exports = { handleBrowse };
