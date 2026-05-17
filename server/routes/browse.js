const tmdb = require('../tmdb');
'use strict';
/**
 * Browse routes — library listing, search, home rows
 * Automatically serves from Plex when Jellyfin is unreachable
 */
const jf   = require('../jellyfin');
const plex = require('../plexClient');
const sm   = require('../serverManager');
const { mapItem, dedup } = require('./media');

// ── Source-aware fetch ────────────────────────────────────────────────────────

function usePlex() { return sm.isPlexFallback(); }

async function handleBrowse(pathname, query, session) {
  const token  = session.token;
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

  // ── Continue Watching ──────────────────────────────────────────────────────
  if (pathname === '/api/continue-watching') {
    if (fromPlex) return plex.getContinueWatching(12).catch(() => []);
    const data = await jf.get(
      `/Users/${userId}/Items/Resume?MediaTypes=Video&Limit=12` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Popular ────────────────────────────────────────────────────────────────
  if (pathname === '/api/popular') {
    if (fromPlex) return plex.getPopular(20).catch(() => []);
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true` +
      `&SortBy=PlayCount,CommunityRating&SortOrder=Descending&Limit=20` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
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
