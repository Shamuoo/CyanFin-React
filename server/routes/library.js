const jf = require('../jellyfin');

function qualityFromVideo(v) {
  if (!v) return null;
  const w = v.Width || 0, h = v.Height || 0;
  if (w >= 3840 || h >= 2160) return '4K';
  if (w >= 1920 || h >= 1080) return '1080p';
  if (w >= 1280 || h >= 720) return '720p';
  if (w >= 640 || h >= 480) return '480p';
  return 'SD';
}

function audioLabel(streams) {
  if (!streams) return null;
  const a = streams.find(s => s.Type === 'Audio' && s.IsDefault) || streams.find(s => s.Type === 'Audio');
  if (!a) return 'None';
  const spatial = (a.AudioSpatialFormat || '').toLowerCase();
  if (spatial.includes('atmos')) return 'Atmos';
  const profile = (a.Profile || '').toLowerCase();
  if (profile.includes('truehd')) return 'TrueHD';
  if (profile.includes('dts-hd ma')) return 'DTS-HD MA';
  const codec = (a.Codec || '').toLowerCase();
  if (codec === 'dts') return 'DTS';
  if (codec === 'eac3') return 'DD+';
  if (codec === 'ac3') return 'DD';
  if (codec === 'aac') return 'AAC';
  return codec.toUpperCase() || 'Unknown';
}

// Configurable thresholds
let thresholds = { sd: '720p', upgrade: '1080p', audio: 'DD' };

async function handleLibrary(pathname, query, session, req) {
  const token = session.token;
  const userId = session.userId;

  if (pathname === '/api/library/scan') {
    await jf.post('/Library/Refresh', {}, token);
    return { success: true, message: 'Library scan triggered' };
  }

  if (pathname === '/api/library/refresh-metadata') {
    const { id } = query;
    if (!id) return { error: 'No item ID' };
    await jf.post(`/Items/${id}/Refresh?MetadataRefreshMode=FullRefresh&ImageRefreshMode=FullRefresh&ReplaceAllMetadata=false&ReplaceAllImages=false`, {}, token);
    return { success: true };
  }

  if (pathname === '/api/library/refresh-images') {
    const { id } = query;
    if (!id) return { error: 'No item ID' };
    await jf.post(`/Items/${id}/Refresh?MetadataRefreshMode=None&ImageRefreshMode=FullRefresh&ReplaceAllImages=true`, {}, token);
    return { success: true };
  }

  if (pathname === '/api/library/refresh-all') {
    await jf.post('/Library/Refresh', {}, token);
    return { success: true, message: 'Full refresh triggered' };
  }

  if (pathname === '/api/library/get-item') {
    const { id } = query;
    if (!id) return { error: 'No item ID' };
    return jf.get(`/Items/${id}?userId=${userId}&fields=Overview,Taglines,Genres,OfficialRating,ProductionYear,People,Studios,Tags,ProviderIds`, token);
  }

  if (pathname === '/api/library/thresholds') {
    if (query.sd) thresholds.sd = query.sd;
    if (query.upgrade) thresholds.upgrade = query.upgrade;
    if (query.audio) thresholds.audio = query.audio;
    return thresholds;
  }


  // ── Library management — all servers ──────────────────────────────────────────
  if (pathname === '/api/library/all-servers') {
    const cfg = require('../config');
    const sm = require('../serverManager');
    const http = require('http');
    const https = require('https');

    async function getJfLibraries(baseUrl, apiKey, userId) {
      if (!baseUrl) return null;
      // Use MediaFolders which works with API key alone, fallback to user views
      const urlToTry = userId
        ? `${baseUrl}/Users/${userId}/Views?api_key=${apiKey}`
        : `${baseUrl}/Library/MediaFolders?api_key=${apiKey}`;
      return new Promise(resolve => {
        const url = urlToTry;
        try {
          const t = new URL(url);
          const lib = t.protocol === 'https:' ? https : http;
          const req = lib.request(url, { timeout: 8000 }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => {
              try {
                const items = JSON.parse(d).Items || [];
                resolve(items.map(l => ({
                  id: l.Id, name: l.Name,
                  type: l.CollectionType || 'mixed',
                  imageUrl: l.ImageTags?.Primary ? `/proxy/image?id=${l.Id}&type=Primary&w=200` : null,
                })));
              } catch { resolve([]); }
            });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
          req.end();
        } catch { resolve(null); }
      });
    }

    async function getPlexSections(plexUrl, plexToken) {
      if (!plexUrl || !plexToken) return null;
      return new Promise(resolve => {
        const url = `${plexUrl}/library/sections?X-Plex-Token=${plexToken}`;
        try {
          const t = new URL(url);
          const lib = t.protocol === 'https:' ? https : http;
          const req = lib.request(url, { headers: { Accept: 'application/json' }, timeout: 8000 }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => {
              try {
                const dirs = JSON.parse(d).MediaContainer?.Directory || [];
                resolve(dirs.map(s => ({
                  id: s.key, name: s.title,
                  type: s.type, // 'movie' | 'show' | 'music'
                  count: s.count,
                })));
              } catch { resolve([]); }
            });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
          req.end();
        } catch { resolve(null); }
      });
    }

    const [primary, backup, plexSections] = await Promise.all([
      getJfLibraries(cfg.get('JELLYFIN_URL'), cfg.get('JELLYFIN_API_KEY'), session.userId),
      getJfLibraries(cfg.get('JELLYFIN_BACKUP_URL'), cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY'), session.userId),
      getPlexSections(cfg.get('PLEX_URL'), cfg.get('PLEX_TOKEN')),
    ]);

    // Match libraries across servers by type + name similarity
    const TYPE_MAP = { movies: 'movie', tvshows: 'show', music: 'music', movie: 'movie', show: 'show' };
    const normalizeType = t => TYPE_MAP[(t||'').toLowerCase()] || t;

    const matched = [];
    const primaryLibs = primary || [];

    for (const pLib of primaryLibs) {
      const nType = normalizeType(pLib.type);
      const backupMatch = (backup || []).find(b =>
        normalizeType(b.type) === nType &&
        b.name.toLowerCase().replace(/[^a-z0-9]/g,'') === pLib.name.toLowerCase().replace(/[^a-z0-9]/g,'')
      ) || (backup || []).find(b => normalizeType(b.type) === nType);

      const plexMatch = (plexSections || []).find(p =>
        normalizeType(p.type) === nType
      );

      matched.push({
        type: nType,
        primary: pLib,
        backup: backupMatch || null,
        plex: plexMatch || null,
        synced: !!backupMatch,
      });
    }

    // Add plex-only sections
    for (const ps of (plexSections || [])) {
      const alreadyMatched = matched.find(m => m.plex?.id === ps.id);
      if (!alreadyMatched) {
        matched.push({ type: normalizeType(ps.type), primary: null, backup: null, plex: ps, synced: false });
      }
    }

    return {
      matched,
      primary: { available: !!primary, count: (primary||[]).length },
      backup:  { available: !!backup,  count: (backup||[]).length },
      plex:    { available: !!plexSections, count: (plexSections||[]).length },
    };
  }


  // ── Library sync diff — compare primary vs backup, show missing items ─────────
  if (pathname === '/api/library/sync-diff') {
    const cfg = require('../config');
    const http = require('http');
    const https = require('https');
    const backupUrl = cfg.get('JELLYFIN_BACKUP_URL');
    const backupKey = cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '';
    if (!backupUrl) return { error: 'No backup server configured', items: [] };

    async function getAllItems(baseUrl, apiKey, userId) {
      return new Promise(resolve => {
        const url = `${baseUrl}/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=2000&fields=ProviderIds,ProductionYear&api_key=${apiKey}`;
        try {
          const t = new URL(url);
          const lib2 = t.protocol === 'https:' ? https : http;
          const req = lib2.request(url, { timeout: 15000 }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d).Items || []); } catch { resolve([]); } });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
          req.end();
        } catch { resolve(null); }
      });
    }

    const primaryUrl = cfg.get('JELLYFIN_URL');
    const primaryKey = cfg.get('JELLYFIN_API_KEY') || '';
    const [primaryItems, backupItems] = await Promise.all([
      getAllItems(primaryUrl, primaryKey, session.userId),
      getAllItems(backupUrl, backupKey, session.userId),
    ]);

    if (!primaryItems || !backupItems) {
      return { error: 'Could not reach one or both servers', items: [] };
    }

    // Build backup lookup by IMDB/TMDB
    const backupByImdb = new Set(backupItems.map(i => i.ProviderIds?.Imdb).filter(Boolean));
    const backupByTmdb = new Set(backupItems.map(i => i.ProviderIds?.Tmdb).filter(Boolean));
    const backupByName = new Set(backupItems.map(i => i.Name?.toLowerCase().trim()));

    // Find items on primary that are missing from backup
    const missing = primaryItems.filter(item => {
      const imdb = item.ProviderIds?.Imdb;
      const tmdb = item.ProviderIds?.Tmdb;
      if (imdb && backupByImdb.has(imdb)) return false;
      if (tmdb && backupByTmdb.has(tmdb)) return false;
      if (backupByName.has(item.Name?.toLowerCase().trim())) return false;
      return true;
    }).map(item => ({
      id: item.Id,
      title: item.Name,
      year: item.ProductionYear,
      imdbId: item.ProviderIds?.Imdb,
      tmdbId: item.ProviderIds?.Tmdb,
      posterUrl: item.ImageTags?.Primary ? `/proxy/image?id=${item.Id}&type=Primary&w=200` : null,
    }));

    return {
      primaryCount: primaryItems.length,
      backupCount: backupItems.length,
      missingCount: missing.length,
      items: missing.slice(0, 100), // cap at 100
    };
  }

  if (pathname === '/api/library/quality-report') {
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=300&fields=MediaStreams,ProductionYear&SortBy=SortName`, token);
    const qOrder = ['4K', '1080p', '720p', '480p', 'SD'];
    const sdRank = qOrder.indexOf(thresholds.sd);
    const upgradeRank = qOrder.indexOf(thresholds.upgrade);
    const goodAudio = ['Atmos', 'DTS:X', 'TrueHD', 'DTS-HD MA', 'DTS-HD', 'DTS', 'DD+'];
    const sdItems = [], upgradeItems = [], poorAudioItems = [], noStreamItems = [];
    (data.Items || []).forEach(item => {
      const v = (item.MediaStreams || []).find(s => s.Type === 'Video');
      const q = qualityFromVideo(v);
      const a = audioLabel(item.MediaStreams);
      const base = { id: item.Id, title: item.Name, year: item.ProductionYear, quality: q, audio: a, posterUrl: jf.imageUrl(item.Id, 'Primary', { token, maxWidth: 200 }) };
      if (!item.MediaStreams || !item.MediaStreams.length) { noStreamItems.push(base); return; }
      const rank = qOrder.indexOf(q);
      if (rank >= sdRank) sdItems.push(base);
      else if (rank >= upgradeRank) upgradeItems.push(base);
      if (q && !goodAudio.includes(a)) poorAudioItems.push(base);
    });
    return { sdItems, upgradeItems, poorAudioItems, noStreamItems, thresholds };
  }

  if (pathname === '/api/library/missing-content') {
    const [movies, series] = await Promise.all([
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=300&fields=Overview,ImageTags,BackdropImageTags,ProductionYear&SortBy=SortName`, token),
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true&Limit=100&fields=Overview,ImageTags,BackdropImageTags&SortBy=SortName`, token),
    ]);
    const missingPoster = [], missingBackdrop = [], missingOverview = [];
    [...(movies.Items||[]), ...(series.Items||[])].forEach(item => {
      const base = { id: item.Id, title: item.Name, type: item.Type, year: item.ProductionYear, posterUrl: jf.imageUrl(item.Id, 'Primary', { token, maxWidth: 200 }) };
      if (!item.ImageTags || !item.ImageTags.Primary) missingPoster.push(base);
      if (!item.BackdropImageTags || !item.BackdropImageTags.length) missingBackdrop.push(base);
      if (!item.Overview || item.Overview.trim().length < 10) missingOverview.push(base);
    });
    return { missingPoster, missingBackdrop, missingOverview };
  }

  if (pathname === '/api/library/versions-report') {
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=500&fields=MediaSources,MediaStreams,ProductionYear&SortBy=SortName`, token);
    const multiVersion = [], has3D = [], only2D = [];
    (data.Items || []).forEach(item => {
      const sources = item.MediaSources || [];
      if (sources.length > 1) {
        const qualities = sources.map(src => {
          const v = (src.MediaStreams || []).find(s => s.Type === 'Video');
          const is3d = /3d|hsbs|h-sbs|mvc/i.test(src.Name||'') || /3d|hsbs|h-sbs|mvc/i.test(src.Path||'');
          if (is3d) return '3D';
          return qualityFromVideo(v) || 'Unknown';
        });
        const entry = { id: item.Id, title: item.Name, year: item.ProductionYear, versions: qualities, count: sources.length, posterUrl: jf.imageUrl(item.Id, 'Primary', { token, maxWidth: 200 }) };
        multiVersion.push(entry);
        if (qualities.some(q => q === '3D')) has3D.push(entry);
      } else if (sources.length === 1) {
        const is3d = /3d|hsbs|h-sbs|mvc/i.test(sources[0].Name||'') || /3d|hsbs|h-sbs|mvc/i.test(sources[0].Path||'');
        if (!is3d) only2D.push({ id: item.Id, title: item.Name, year: item.ProductionYear, posterUrl: jf.imageUrl(item.Id, 'Primary', { token, maxWidth: 200 }) });
      }
    });
    return { multiVersion, has3D, only2D: only2D.slice(0, 50) };
  }


  // Refresh all metadata for entire library
  if (pathname === '/api/library/refresh-all-metadata') {
    try {
      // Get all movies and shows, refresh each
      const data = await jf.get(`/Users/${session.userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Limit=500&fields=Id`, token);
      const items = data.Items || [];
      // Trigger full library refresh
      await jf.post('/Library/Refresh', {}, token);
      return { success: true, message: `Library refresh triggered for ${items.length} items` };
    } catch(e) { return { success: false, error: e.message }; }
  }

  // Refresh all images for entire library
  if (pathname === '/api/library/refresh-all-images') {
    try {
      await jf.post('/Library/Refresh', {}, token);
      return { success: true, message: 'Image refresh triggered for all libraries' };
    } catch(e) { return { success: false, error: e.message }; }
  }

  if (pathname === '/api/library/recommended-3d') {
    const known3D = ['Avatar','How to Train Your Dragon','Life of Pi','Gravity',
      'Pacific Rim','Prometheus','The Walk','Hugo','Doctor Strange','Jungle Book',
      'Spider-Man','Spider-Verse','Avengers','Transformers','Alice in Wonderland',
      'Coraline','Up','Monsters Inc','Ice Age','Mad Max','The Martian','Everest',
      'Mission Impossible','Star Wars','Rogue One','Top Gun Maverick','Dune',
      'Interstellar','Thor','Guardians','Black Panther','Ant-Man','Tenet',
      'Dunkirk','1917','Blade Runner','Alita','Aquaman','Ready Player One',
      'Jungle Cruise','Encanto','Moana','Coco','The Lion King','Aladdin','Mulan'];
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=500&fields=MediaSources&SortBy=SortName`, token);
    return (data.Items || []).filter(item => {
      const sources = item.MediaSources || [];
      const has3D = sources.some(s => /3d|hsbs|h-sbs|mvc/i.test(s.Name||'') || /3d|hsbs|h-sbs|mvc/i.test(s.Path||''));
      const isKnown = known3D.some(t => item.Name && item.Name.toLowerCase().includes(t.toLowerCase()));
      return !has3D && isKnown;
    }).map(i => ({
      id: i.Id, title: i.Name,
      posterUrl: jf.imageUrl(i.Id, 'Primary', { token, maxWidth: 400 }),
    }));
  }

  if (pathname === '/api/library/music-report') {
    const [albums, tracks] = await Promise.all([
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=MusicAlbum&Recursive=true&Limit=200&fields=Overview,ImageTags,ProductionYear,AlbumArtist&SortBy=SortName`, token),
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Audio&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token).catch(()=>({TotalRecordCount:0})),
    ]);
    const missingArt = (albums.Items||[]).filter(a=>!a.ImageTags||!a.ImageTags.Primary).map(a=>({ id:a.Id, title:a.Name, artist:a.AlbumArtist, year:a.ProductionYear, posterUrl: jf.imageUrl(a.Id, 'Primary', { token, maxWidth: 200 }) }));
    return { totalAlbums: albums.TotalRecordCount||(albums.Items||[]).length, totalTracks: tracks.TotalRecordCount||0, missingArt };
  }

  return null;
}

// POST: update item metadata
async function handleLibraryPost(pathname, body, session) {
  const token = session.token;
  if (pathname === '/api/library/update-item') {
    const { itemId, updates } = body;
    if (!itemId || !updates) return { error: 'Missing itemId or updates' };
    const current = await jf.get(`/Items/${itemId}?fields=Overview,Taglines,Genres,OfficialRating,ProductionYear,People,Studios,Tags,ProviderIds,DateCreated,PremiereDate`, token);
    const merged = { ...current, ...updates };
    const result = await jf.post(`/Items/${itemId}`, merged, token);
    return { success: true };
  }
  return null;
}

module.exports = { handleLibrary, handleLibraryPost };
