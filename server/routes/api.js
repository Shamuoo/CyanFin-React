const jf = require('../jellyfin');
const tmdb = require('../tmdb');

// ── Cache ──
const cache = new Map();
function cached(key, ttl, fn) {
  return async (...args) => {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.ok && now - hit.ts < ttl) return hit.data;
    try {
      const data = await fn(...args);
      if (data !== null && data !== undefined) cache.set(key, { ts: now, data, ok: true });
      return data;
    } catch(e) {
      console.error(`[cache:${key}]`, e.message);
      return hit ? hit.data : null;
    }
  };
}

// ── Quality detection ──
function qualityFromVideo(v) {
  if (!v) return null;
  const w = v.Width || 0, h = v.Height || 0;
  if (w >= 3840 || h >= 2160) return '4K';
  if (w >= 1920 || h >= 1080) return '1080p';
  if (w >= 1280 || h >= 720) return '720p';
  if (w >= 640 || h >= 480) return '480p';
  return 'SD';
}

function is3D(streams, source) {
  if (streams && streams.some(s => s.Video3DFormat)) return true;
  const n = (source && source.Name) || '', p = (source && source.Path) || '';
  return /3d|hsbs|h-sbs|mvc/i.test(n) || /3d|hsbs|h-sbs|mvc/i.test(p);
}

function qualitiesFromSource(streams, source) {
  const video = streams && streams.find(s => s.Type === 'Video');
  if (is3D(streams, source)) {
    const w = video ? Math.floor((video.Width || 0) / 2) : 0;
    const h = video ? (video.Height || 0) : 0;
    let res = w >= 1920 || h >= 1080 ? '1080p' : w >= 1280 || h >= 720 ? '720p' : null;
    return [res ? `${res} 3D` : '3D'];
  }
  const res = qualityFromVideo(video);
  return res ? [res] : [];
}


const LANG_FLAGS = {
  eng: '🇬🇧', english: '🇬🇧', fre: '🇫🇷', fra: '🇫🇷', french: '🇫🇷',
  ger: '🇩🇪', deu: '🇩🇪', german: '🇩🇪', spa: '🇪🇸', esp: '🇪🇸', spanish: '🇪🇸',
  jpn: '🇯🇵', japanese: '🇯🇵', kor: '🇰🇷', korean: '🇰🇷', chi: '🇨🇳', zho: '🇨🇳',
  ita: '🇮🇹', italian: '🇮🇹', por: '🇵🇹', portuguese: '🇵🇹', rus: '🇷🇺', russian: '🇷🇺',
  ara: '🇸🇦', arabic: '🇸🇦', hin: '🇮🇳', hindi: '🇮🇳', dut: '🇳🇱', nld: '🇳🇱',
  swe: '🇸🇪', nor: '🇳🇴', fin: '🇫🇮', dan: '🇩🇰', pol: '🇵🇱', tur: '🇹🇷',
  und: '🌐', mul: '🌐',
};
function langFlag(lang) {
  if (!lang) return '';
  return LANG_FLAGS[lang.toLowerCase()] || '';
}
function audioFromStreams(streams) {
  if (!streams) return null;
  const a = streams.find(s => s.Type === 'Audio' && s.IsDefault && s.Language === 'eng')
    || streams.find(s => s.Type === 'Audio' && s.IsDefault)
    || streams.find(s => s.Type === 'Audio');
  if (!a) return null;
  const spatial = (a.AudioSpatialFormat || '').toLowerCase();
  if (spatial.includes('atmos')) return 'Atmos';
  if (spatial.includes('dtsx') || spatial.includes('dts:x')) return 'DTS:X';
  const profile = (a.Profile || '').toLowerCase();
  if (profile.includes('atmos')) return 'Atmos';
  if (profile.includes('truehd')) return 'TrueHD';
  if (profile.includes('dts-hd ma')) return 'DTS-HD MA';
  if (profile.includes('dts-hd')) return 'DTS-HD';
  const codec = (a.Codec || '').toLowerCase();
  if (codec === 'dts') return 'DTS';
  if (codec === 'eac3') return 'DD+';
  if (codec === 'ac3') return 'DD';
  if (codec === 'aac') return 'AAC';
  if (codec === 'flac') return 'FLAC';
  if (codec === 'mp3') return 'MP3';
  return null;
}

function mapItem(i, token) {
  const sources = i.MediaSources || [];
  const qOrder = ['4K', '4K 3D', '1080p 3D', '1080p', '720p 3D', '720p', '3D', '480p', 'SD'];
  const qualitySet = new Set();
  if (sources.length > 0) {
    sources.forEach(src => qualitiesFromSource(src.MediaStreams, src).forEach(q => qualitySet.add(q)));
  } else {
    qualitiesFromSource(i.MediaStreams, null).forEach(q => qualitySet.add(q));
  }
  const qualities = Array.from(qualitySet).sort((a, b) => {
    const ai = qOrder.indexOf(a), bi = qOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const people = i.People || [];
  return {
    id: i.Id,
    title: i.Name,
    originalTitle: i.OriginalTitle,
    year: i.ProductionYear,
    type: i.Type,
    seriesName: i.SeriesName,
    seriesId: i.SeriesId,
    seasonId: i.SeasonId,
    indexNumber: i.IndexNumber,
    parentIndexNumber: i.ParentIndexNumber,
    genre: (i.Genres || []).slice(0, 2).join(' / '),
    genres: i.Genres || [],
    rating: i.OfficialRating,
    score: i.CommunityRating,
    overview: i.Overview,
    tagline: i.Taglines ? (i.Taglines[0] || '') : '',
    runtime: i.RunTimeTicks,
    qualities,
    audio: audioFromStreams(i.MediaStreams),
    versionCount: sources.length || 1,
    studios: (i.Studios || []).map(s => s.Name),
    cast: people.filter(p => p.Type === 'Actor').slice(0, 8).map(p => ({
      id: p.Id, name: p.Name, role: p.Role, imageTag: p.PrimaryImageTag || null,
    })),
    director: (people.find(p => p.Type === 'Director') || {}).Name || null,
    posterUrl: jf.imageUrl(i.Id, 'Primary', { token, maxWidth: 800 }),
    backdropUrl: jf.imageUrl(i.Id, 'Backdrop/0', { token, maxWidth: 1920 }),
    backdropUrl2: jf.imageUrl(i.Id, 'Backdrop/1', { token, maxWidth: 1920 }),
    backdropCount: (i.BackdropImageTags || []).length,
    thumbUrl: i.ImageTags && i.ImageTags.Thumb ? jf.imageUrl(i.Id, 'Thumb', { token }) : null,
    logoUrl: i.ImageTags && i.ImageTags.Logo ? jf.imageUrl(i.Id, 'Logo', { token, maxWidth: 600 }) : null,
    userData: i.UserData || null,
  };
}

function dedup(items) {
  const map = new Map();
  items.forEach(item => {
    const key = `${item.title}__${item.year}`;
    if (map.has(key)) {
      const ex = map.get(key);
      const allQ = [...new Set([...ex.qualities, ...item.qualities])];
      const qOrder = ['4K', '4K 3D', '1080p 3D', '1080p', '720p 3D', '720p', '3D', '480p', 'SD'];
      ex.qualities = allQ.sort((a, b) => (qOrder.indexOf(a) === -1 ? 99 : qOrder.indexOf(a)) - (qOrder.indexOf(b) === -1 ? 99 : qOrder.indexOf(b)));
      ex.versionCount = (ex.versionCount || 1) + 1;
    } else {
      map.set(key, { ...item });
    }
  });
  return Array.from(map.values());
}

// ── Route handlers ──
async function handleApi(pathname, query, session) {
  const token = session.token;
  const userId = session.userId;

  // Now playing
  if (pathname === '/api/now-playing') {
    const sessions = await jf.get('/Sessions', token);
    const active = (sessions || []).filter(s => s.NowPlayingItem && ['Movie','Episode','Video'].includes(s.NowPlayingItem.Type));
    if (!active.length) return null;
    const playing = active.find(s => !s.PlayState.IsPaused) || active[0];
    const item = playing.NowPlayingItem;
    let full = item;
    try { full = await jf.get(`/Items/${item.Id}?fields=Overview,Taglines,Genres,OfficialRating,CommunityRating,People,MediaStreams,Studios`, token); } catch(e) {}
    const mapped = mapItem({ ...full, MediaStreams: full.MediaStreams || [] }, token);
    let trailerKey = null, castPhotos = [];
    try {
      const t = await tmdb.getTrailer(item.Name, item.ProductionYear, item.Type === 'Movie' ? 'movie' : 'tv');
      if (t) { trailerKey = t.trailerKey; castPhotos = t.cast.map(c => c.photo); }
    } catch(e) {}
    return {
      item: mapped,
      positionTicks: playing.PlayState.PositionTicks || 0,
      runtimeTicks: full.RunTimeTicks || 0,
      isPaused: playing.PlayState.IsPaused || false,
      sessionUser: playing.UserName || '',
      allUsers: active.map(s => ({ user: s.UserName, title: s.NowPlayingItem.Name, isPaused: s.PlayState.IsPaused, device: s.DeviceName })),
      trailerKey, castPhotos,
    };
  }

  // Recently added
  if (pathname === '/api/recently-added') {
    const data = await jf.get(`/Users/${userId}/Items/Latest?MediaType=Video&IncludeItemTypes=Movie&Limit=24&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,People,MediaStreams,MediaSources`, token);
    return dedup((data || []).map(i => mapItem(i, token))).slice(0, 12);
  }

  // Continue watching
  if (pathname === '/api/continue-watching') {
    const data = await jf.get(`/Users/${userId}/Items/Resume?MediaType=Video&Limit=12&fields=Overview,Genres,ProductionYear,OfficialRating,UserData,MediaStreams,MediaSources`, token);
    return dedup((data.Items || []).map(i => mapItem(i, token))).slice(0, 8);
  }

  // Popular
  if (pathname === '/api/popular') {
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&SortBy=CommunityRating&SortOrder=Descending&Limit=24&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,People,MediaStreams,MediaSources&Recursive=true`, token);
    const items = (data.Items || []).filter(i => i.CommunityRating >= 7).map(i => mapItem(i, token));
    return dedup(items).slice(0, 12);
  }

  // History
  if (pathname === '/api/history') {
    const data = await jf.get(`/Users/${userId}/Items?SortBy=DatePlayed&SortOrder=Descending&Filters=IsPlayed&IncludeItemTypes=Movie&Recursive=true&Limit=24&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,UserData,MediaStreams,MediaSources`, token);
    return dedup((data.Items || []).map(i => ({ ...mapItem(i, token), playedDate: i.UserData && i.UserData.LastPlayedDate }))).slice(0, 12);
  }

  // Stats
  if (pathname === '/api/stats') {
    const [movies, shows, episodes, music] = await Promise.all([
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token),
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token),
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Episode&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token),
      jf.get(`/Users/${userId}/Items?IncludeItemTypes=Audio&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token).catch(() => ({ TotalRecordCount: 0 })),
    ]);
    return { movies: movies.TotalRecordCount || 0, shows: shows.TotalRecordCount || 0, episodes: episodes.TotalRecordCount || 0, songs: music.TotalRecordCount || 0 };
  }

  // Random
  if (pathname === '/api/random') {
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&SortBy=Random&Limit=1&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,People,Taglines,MediaStreams,MediaSources`, token);
    const item = (data.Items || [])[0];
    return item ? mapItem(item, token) : null;
  }

  // Coming soon (TMDB)
  if (pathname === '/api/coming-soon') {
    return cached('coming-soon', 60 * 60 * 1000, tmdb.getUpcoming)();
  }

  // On this day (TMDB)
  if (pathname === '/api/on-this-day') {
    return cached('on-this-day', 60 * 60 * 1000, tmdb.getOnThisDay)();
  }

  // Search
  if (pathname === '/api/search') {
    const q = query.q || '';
    if (q.length < 2) return [];
    const data = await jf.get(`/Users/${userId}/Items?SearchTerm=${encodeURIComponent(q)}&IncludeItemTypes=Movie,Series,Episode,Audio&Recursive=true&Limit=24&SortBy=SortName&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,People,MediaStreams`, token);
    const lower = q.toLowerCase();
    return (data.Items || []).filter(i => i.Name && i.Name.toLowerCase().includes(lower)).slice(0, 16).map(i => mapItem(i, token));
  }

  // All movies (paginated)
  if (pathname === '/api/movies') {
    const { sort = 'SortName', order = 'Ascending', genre = '', start = '0' } = query;
    let ep = `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,MediaSources&Limit=96&StartIndex=${start}&SortBy=${sort}&SortOrder=${order}`;
    if (genre) ep += `&Genres=${encodeURIComponent(genre)}`;
    const data = await jf.get(ep, token);
    const items = dedup((data.Items || []).map(i => mapItem(i, token)));
    return { total: data.TotalRecordCount || 0, items: items.slice(0, 48) };
  }

  // TV Shows
  if (pathname === '/api/shows') {
    const { sort = 'SortName', order = 'Ascending', genre = '', start = '0' } = query;
    let ep = `/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,ImageTags&Limit=48&StartIndex=${start}&SortBy=${sort}&SortOrder=${order}`;
    if (genre) ep += `&Genres=${encodeURIComponent(genre)}`;
    const data = await jf.get(ep, token);
    return { total: data.TotalRecordCount || 0, items: (data.Items || []).map(i => mapItem(i, token)) };
  }

  // Show seasons
  if (pathname.match(/^\/api\/shows\/[^/]+\/seasons$/)) {
    const showId = pathname.split('/')[3];
    const data = await jf.get(`/Shows/${showId}/Seasons?userId=${userId}&fields=Overview,ImageTags`, token);
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // Season episodes
  if (pathname.match(/^\/api\/shows\/[^/]+\/seasons\/[^/]+\/episodes$/)) {
    const parts = pathname.split('/');
    const showId = parts[3], seasonId = parts[5];
    const data = await jf.get(`/Shows/${showId}/Episodes?seasonId=${seasonId}&userId=${userId}&fields=Overview,MediaStreams,MediaSources,UserData,ImageTags`, token);
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // Music - artists
  if (pathname === '/api/music/artists') {
    const data = await jf.get(`/Artists?userId=${userId}&Recursive=true&fields=Overview,ImageTags&SortBy=SortName&Limit=100`, token);
    return (data.Items || []).map(i => ({ id: i.Id, name: i.Name, overview: i.Overview, imageUrl: jf.imageUrl(i.Id, 'Primary', { token }) }));
  }

  // Music - albums
  if (pathname === '/api/music/albums') {
    const artist = query.artistId;
    let ep = `/Users/${userId}/Items?IncludeItemTypes=MusicAlbum&Recursive=true&SortBy=ProductionYear&SortOrder=Descending&fields=Overview,ProductionYear,AlbumArtist,ImageTags&Limit=50`;
    if (artist) ep += `&ArtistIds=${artist}`;
    const data = await jf.get(ep, token);
    return (data.Items || []).map(i => ({ id: i.Id, title: i.Name, artist: i.AlbumArtist, year: i.ProductionYear, imageUrl: jf.imageUrl(i.Id, 'Primary', { token }) }));
  }

  // Music - tracks
  if (pathname === '/api/music/tracks') {
    const albumId = query.albumId;
    if (!albumId) return [];
    const data = await jf.get(`/Users/${userId}/Items?ParentId=${albumId}&IncludeItemTypes=Audio&SortBy=ParentIndexNumber,IndexNumber&fields=Overview,MediaStreams&Limit=100`, token);
    return (data.Items || []).map(i => ({
      id: i.Id, title: i.Name, trackNumber: i.IndexNumber, duration: i.RunTimeTicks,
      artist: i.AlbumArtist, album: i.Album,
      streamUrl: jf.audioUrl(i.Id, token),
    }));
  }

  // Genres
  if (pathname === '/api/genres') {
    const type = query.type || 'Movie';
    const data = await jf.get(`/Genres?IncludeItemTypes=${type}&Recursive=true&Limit=100`, token);
    return (data.Items || []).map(g => g.Name).sort();
  }

  // Item detail
  if (pathname.match(/^\/api\/items\/[^/]+$/)) {
    const itemId = pathname.split('/')[3];
    const [data, extras, themeSongs, introSkip, chaptersData] = await Promise.all([
      jf.get(`/Items/${itemId}?userId=${userId}&fields=Overview,Taglines,Genres,OfficialRating,CommunityRating,People,MediaStreams,MediaSources,Studios,Tags,ExternalUrls,ProviderIds,BackdropImageTags,ImageTags,PartCount`, token),
      jf.get(`/Users/${userId}/Items/${itemId}/SpecialFeatures`, token).catch(() => []),
      jf.get(`/Items/${itemId}/ThemeMedia?userId=${userId}&InheritFromParent=true`, token).catch(() => ({})),
      jf.get(`/Episode/GetIntros?itemId=${itemId}&userId=${userId}`, token).catch(() => null),
      jf.get(`/Items/${itemId}/PlaybackInfo?userId=${userId}`, token).catch(() => null),
    ]);
    const mapped = mapItem(data, token);

    // All backdrop URLs
    mapped.backdropUrls = (data.BackdropImageTags || []).map((_, idx) =>
      jf.imageUrl(data.Id, `Backdrop/${idx}`, { token, maxWidth: 1920 })
    );
    if (!mapped.backdropUrls.length && mapped.backdropUrl) mapped.backdropUrls = [mapped.backdropUrl];

    // Video backdrop (muted autoplay behind detail)
    const videoBackdrops = (extras.Items || (Array.isArray(extras) ? extras : [])).filter(e =>
      e.ExtraType === 'BackdropVideo' || e.ExtraType === 'ThemeVideo'
    );
    if (videoBackdrops.length) {
      mapped.videoBackdropUrl = jf.directUrl(videoBackdrops[0].Id, token);
    }

    // Theme song (plays when detail opens)
    const themes = themeSongs.ThemeVideos || themeSongs.ThemeSongs || [];
    if (themes && themes.Items && themes.Items.length) {
      mapped.themeSongUrl = jf.audioUrl(themes.Items[0].Id, token);
      mapped.themeSongId = themes.Items[0].Id;
    }

    // Intro skip data (from Intro Skipper plugin)
    if (introSkip && introSkip.Items && introSkip.Items.length) {
      mapped.introStart = introSkip.Items[0].StartPositionTicks;
      mapped.introEnd = introSkip.Items[0].EndPositionTicks;
    }

    // External ratings from ProviderIds + TMDB + OMDB
    const providerIds = data.ProviderIds || {};
    const imdbId = providerIds.Imdb;
    const tmdbId = providerIds.Tmdb;
    const imdbRating = data.CommunityRating;

    let tmdbScore = null, rtScore = null, rtAudScore = null, metascore = null;

    // Fetch TMDB score
    if (tmdbId) {
      try {
        const tmdbKey = require('../config').get('TMDB_API_KEY');
        if (tmdbKey) {
          const mediaType = data.Type === 'Series' ? 'tv' : 'movie';
          const res = await new Promise((resolve, reject) => {
            const https = require('https');
            const req = https.request({
              hostname: 'api.themoviedb.org',
              path: `/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}`,
              timeout: 5000,
            }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } }); });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
          });
          if (res && res.vote_average) tmdbScore = Math.round(res.vote_average * 10);
        }
      } catch(e) {}
    }

    // Fetch OMDB for RT + Metascore (uses IMDB ID)
    if (imdbId) {
      try {
        const omdbKey = require('../config').get('OMDB_API_KEY');
        if (omdbKey) {
          const res = await new Promise((resolve, reject) => {
            const https = require('https');
            const req = https.request({
              hostname: 'www.omdbapi.com',
              path: `/?i=${imdbId}&apikey=${omdbKey}`,
              timeout: 5000,
            }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } }); });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
          });
          if (res && res.Ratings) {
            const rt = res.Ratings.find(r => r.Source === 'Rotten Tomatoes');
            if (rt) rtScore = parseInt(rt.Value);
            const mc = res.Ratings.find(r => r.Source === 'Metacritic');
            if (mc) metascore = parseInt(mc.Value);
          }
        }
      } catch(e) {}
    }

    // Letterboxd link (constructed from IMDB/TMDB)
    const letterboxdUrl = imdbId ? `https://letterboxd.com/film/${imdbId}/` : null;
    const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : null;

    mapped.externalRatings = {
      imdb: imdbRating ? Math.round(imdbRating * 10) / 10 : null,
      tmdb: tmdbScore,
      rt: rtScore || null,
      metascore: metascore || null,
      imdbId,
      tmdbId,
      letterboxdUrl,
      imdbUrl,
    };

    // Chapters
    mapped.chapters = (data.Chapters || []).map(ch => ({
      name: ch.Name || '',
      startPositionTicks: ch.StartPositionTicks || 0,
      imageTag: ch.ImageTag || null,
    }));

    // Part count for multi-part items (box sets)
    mapped.partCount = data.PartCount || null;

    // Extras
    mapped.extras = (Array.isArray(extras) ? extras : (extras.Items || [])).filter(e =>
      e.ExtraType !== 'BackdropVideo' && e.ExtraType !== 'ThemeVideo'
    ).map(e => ({
      id: e.Id, title: e.Name, type: e.ExtraType || e.Type,
      runtime: e.RunTimeTicks,
      thumbUrl: e.ImageTags && e.ImageTags.Primary ? jf.imageUrl(e.Id, 'Primary', { token, maxWidth: 400 }) : null,
    }));

    return mapped;
  }



  // ── Playback session reporting (so Jellyfin knows what's playing) ──

  // Report playback started
  if (pathname === '/api/playback/start' && req.method === 'POST') {
    const { itemId, mediaSourceId, audioStreamIndex, subtitleStreamIndex, positionTicks = 0 } = body;
    if (!itemId) return { error: 'No itemId' };
    await jf.post(`/Sessions/Playing`, {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      AudioStreamIndex: audioStreamIndex,
      SubtitleStreamIndex: subtitleStreamIndex,
      PositionTicks: positionTicks,
      IsPaused: false,
      IsMuted: false,
      PlayMethod: 'DirectPlay',
      RepeatMode: 'RepeatNone',
    }, token).catch(e => console.warn('[playback/start]', e.message));
    return { ok: true };
  }

  // Report playback progress
  if (pathname === '/api/playback/progress' && req.method === 'POST') {
    const { itemId, mediaSourceId, positionTicks, isPaused, isMuted, volumeLevel, audioStreamIndex, subtitleStreamIndex } = body;
    if (!itemId) return { error: 'No itemId' };
    await jf.post(`/Sessions/Playing/Progress`, {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      PositionTicks: positionTicks || 0,
      IsPaused: isPaused || false,
      IsMuted: isMuted || false,
      VolumeLevel: volumeLevel || 100,
      AudioStreamIndex: audioStreamIndex,
      SubtitleStreamIndex: subtitleStreamIndex,
      PlayMethod: 'DirectPlay',
      RepeatMode: 'RepeatNone',
      EventName: isPaused ? 'pause' : 'timeupdate',
    }, token).catch(e => console.warn('[playback/progress]', e.message));
    return { ok: true };
  }

  // Report playback stopped + save position
  if (pathname === '/api/playback/stop' && req.method === 'POST') {
    const { itemId, mediaSourceId, positionTicks } = body;
    if (!itemId) return { error: 'No itemId' };
    await jf.post(`/Sessions/Playing/Stopped`, {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      PositionTicks: positionTicks || 0,
      PlayMethod: 'DirectPlay',
    }, token).catch(e => console.warn('[playback/stop]', e.message));
    return { ok: true };
  }

  // Toggle favourite
  if (pathname === '/api/user/favorite' && req.method === 'POST') {
    const { itemId, favorite } = body;
    if (!itemId) return { error: 'No itemId' };
    if (favorite) {
      await jf.post(`/Users/${userId}/FavoriteItems/${itemId}`, {}, token);
    } else {
      await fetch(`${process.env.JELLYFIN_URL || require('./config').get('JELLYFIN_URL')}/Users/${userId}/FavoriteItems/${itemId}?api_key=${token}`, { method: 'DELETE' }).catch(() => {});
    }
    return { success: true, favorite };
  }

  // Toggle watched / played
  if (pathname === '/api/user/watched' && req.method === 'POST') {
    const { itemId, watched } = body;
    if (!itemId) return { error: 'No itemId' };
    if (watched) {
      await jf.post(`/Users/${userId}/PlayedItems/${itemId}`, {}, token);
    } else {
      await fetch(`${process.env.JELLYFIN_URL || require('./config').get('JELLYFIN_URL')}/Users/${userId}/PlayedItems/${itemId}?api_key=${token}`, { method: 'DELETE' }).catch(() => {});
    }
    return { success: true, watched };
  }


  // Next episode — for auto-play after current episode ends
  if (pathname === '/api/next-episode') {
    const { seriesId, seasonId, indexNumber, parentIndexNumber } = query;
    if (!seriesId) return null;
    try {
      // Get all episodes in the series
      const data = await jf.get(
        `/Shows/${seriesId}/Episodes?userId=${userId}&fields=ImageTags,UserData&EnableImages=true`,
        token
      );
      const episodes = data.Items || [];
      const currentIdx = episodes.findIndex(ep =>
        ep.ParentIndexNumber == parentIndexNumber && ep.IndexNumber == indexNumber
      );
      if (currentIdx === -1 || currentIdx >= episodes.length - 1) return { hasNext: false };
      const next = episodes[currentIdx + 1];
      return {
        hasNext: true,
        episode: mapItem(next, token),
      };
    } catch(e) { return { hasNext: false }; }
  }

  // Collections / Box Sets
  if (pathname === '/api/collections') {
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=BoxSet&Recursive=true&SortBy=SortName&fields=ImageTags,BackdropImageTags&Limit=50`, token);
    return (data.Items || []).map(i => ({
      id: i.Id, title: i.Name, type: i.Type,
      posterUrl: i.ImageTags && i.ImageTags.Primary ? jf.imageUrl(i.Id, 'Primary', { token, maxWidth: 400 }) : null,
      backdropUrl: i.BackdropImageTags && i.BackdropImageTags.length ? jf.imageUrl(i.Id, 'Backdrop/0', { token, maxWidth: 1920 }) : null,
    }));
  }

  // Collection items
  if (pathname.match(/^\/api\/collections\/[^/]+\/items$/)) {
    const colId = pathname.split('/')[3];
    const data = await jf.get(`/Users/${userId}/Items?ParentId=${colId}&fields=Overview,ImageTags,MediaSources,BackdropImageTags&SortBy=SortName`, token);
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // Intro Skipper - get intro data for an episode (uses dedicated plugin endpoint)
  if (pathname === '/api/intro-skip') {
    const itemId = query.id;
    if (!itemId) return null;
    // Try Intro Skipper plugin endpoint first
    const pluginResult = await jf.get(`/Episode/GetIntros?itemId=${itemId}&userId=${userId}`, token).catch(() => null);
    if (pluginResult && pluginResult.Items && pluginResult.Items.length) {
      return {
        hasIntro: true,
        introStart: pluginResult.Items[0].StartPositionTicks,
        introEnd: pluginResult.Items[0].EndPositionTicks,
      };
    }
    // Fall back to Jellyfin's built-in segments API
    const segResult = await jf.get(`/MediaSegments/${itemId}`, token).catch(() => null);
    if (segResult && segResult.Items && segResult.Items.length) {
      const intro = segResult.Items.find(s => s.Type === 'Intro');
      if (intro) return { hasIntro: true, introStart: intro.StartTicks, introEnd: intro.EndTicks };
    }
    return { hasIntro: false };
  }

  // PlaybackInfo - negotiate stream URL with Jellyfin (like official client)
  if (pathname === '/api/playback-info') {
    const itemId = query.id;
    if (!itemId) return { error: 'No id' };

    // Post a device profile that tells Jellyfin what the browser supports
    // This is the standard browser profile - supports H264/AAC in MP4/WebM
    const deviceProfile = {
      DeviceProfile: {
        MaxStreamingBitrate: 140000000,
        MaxStaticBitrate: 140000000,
        MusicStreamingTranscodingBitrate: 192000,
        DirectPlayProfiles: [
          { Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'vorbis,opus' },
          { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc,vp8,vp9,av1', AudioCodec: 'aac,mp3,ac3,eac3,flac,vorbis,opus,alac,dts,truehd' },
          { Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc,vp8,vp9,av1', AudioCodec: 'aac,mp3,ac3,eac3,flac,vorbis,opus,alac,dts,truehd' },
          { Container: 'mov', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3' },
          { Container: 'mp3', Type: 'Audio' },
          { Container: 'aac', Type: 'Audio' },
          { Container: 'flac', Type: 'Audio' },
          { Container: 'opus', Type: 'Audio' },
        ],
        TranscodingProfiles: [
          { Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3,ac3', Protocol: 'hls', EstimateContentLength: false, EnableMpegtsM2TsMode: false, TranscodeSeekInfo: 'Auto', CopyTimestamps: false, Context: 'Streaming', EnableSubtitlesInManifest: false, MaxAudioChannels: '6', MinSegments: 1, SegmentLength: 3, BreakOnNonKeyFrames: true },
          { Container: 'aac', Type: 'Audio', AudioCodec: 'aac', Protocol: 'http', Context: 'Streaming', MaxAudioChannels: '2' },
          { Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Protocol: 'http', Context: 'Streaming', MaxAudioChannels: '2' },
        ],
        ContainerProfiles: [],
        CodecProfiles: [
          { Type: 'Video', Codec: 'h264', Conditions: [
            { Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false },
            { Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline|high 10', IsRequired: false },
            { Condition: 'EqualsAny', Property: 'VideoRangeType', Value: 'SDR', IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '52', IsRequired: false },
            { Condition: 'NotEquals', Property: 'IsInterlaced', Value: 'true', IsRequired: false },
          ]},
        ],
        SubtitleProfiles: [
          { Format: 'vtt', Method: 'External' },
          { Format: 'ass', Method: 'External' },
          { Format: 'ssa', Method: 'External' },
        ],
      },
    };

    const mediaSourceId = query.mediaSourceId || itemId;
    const audioStreamIndex = query.audioStreamIndex ? parseInt(query.audioStreamIndex) : undefined;
    const subtitleStreamIndex = query.subtitleStreamIndex ? parseInt(query.subtitleStreamIndex) : undefined;

    try {
      const info = await jf.post(
        `/Items/${itemId}/PlaybackInfo?userId=${userId}&StartTimeTicks=0&IsPlayback=true&AutoOpenLiveStream=true&MediaSourceId=${mediaSourceId}`,
        deviceProfile,
        token
      );

      if (!info || !info.MediaSources || !info.MediaSources.length) {
        return { error: 'No media sources returned' };
      }

      // Find matching source or use first
      const source = info.MediaSources.find(s => s.Id === mediaSourceId) || info.MediaSources[0];
      const playSessionId = info.PlaySessionId;
      const resolvedSourceId = source.Id;

      // Always build a direct stream URL - most reliable for browser
      // Static=true = direct play the file as-is
      let directUrl = process.env.JELLYFIN_URL + '/Videos/' + itemId + '/stream?api_key=' + token + '&Static=true&MediaSourceId=' + resolvedSourceId;
      if (audioStreamIndex !== undefined) directUrl += '&AudioStreamIndex=' + audioStreamIndex;

      // HLS transcode URL as fallback (when browser can't play the container/codec)
      let hlsUrl = null;
      if (source.TranscodingUrl) {
        hlsUrl = process.env.JELLYFIN_URL + source.TranscodingUrl;
      } else {
        hlsUrl = process.env.JELLYFIN_URL + '/Videos/' + itemId + '/master.m3u8?api_key=' + token + '&MediaSourceId=' + resolvedSourceId + '&VideoCodec=h264&AudioCodec=aac&TranscodingProtocol=hls&MaxStreamingBitrate=20000000';
      }

      // Return all media sources so client can show version picker
      const mediaSources = info.MediaSources.map(s => ({
        id: s.Id,
        name: s.Name || s.Container,
        container: s.Container,
        size: s.Size,
        videoCodec: (s.MediaStreams || []).find(ms => ms.Type === 'Video')?.Codec,
        audioStreams: (s.MediaStreams || []).filter(ms => ms.Type === 'Audio').map(ms => ({
          index: ms.Index,
          codec: ms.Codec,
          language: ms.Language,
          title: formatAudioStream(ms) || ms.DisplayTitle || ms.Codec || '?',
          channels: ms.Channels,
          isDefault: ms.IsDefault,
        })),
        subtitleStreams: (s.MediaStreams || []).filter(ms => ms.Type === 'Subtitle').map(ms => ({
          index: ms.Index,
          codec: ms.Codec,
          language: ms.Language,
          title: ms.DisplayTitle || ms.Language || 'Subtitle',
          isDefault: ms.IsDefault,
        })),
      }));

      return {
        // Primary URL - always direct stream first
        streamUrl: directUrl,
        // HLS fallback for incompatible containers
        hlsUrl,
        playSessionId,
        mediaSourceId: resolvedSourceId,
        playMethod: source.SupportsDirectPlay ? 'DirectPlay' : source.SupportsDirectStream ? 'DirectStream' : 'Transcode',
        container: source.Container,
        mediaSources,
      };
    } catch(e) {
      return {
        streamUrl: process.env.JELLYFIN_URL + '/Videos/' + itemId + '/stream?api_key=' + token + '&Static=true',
        hlsUrl: null,
        playMethod: 'DirectPlay',
        error: e.message,
        mediaSources: [],
      };
    }
  }

  // Weather
  if (pathname === '/api/weather') {
    const city = query.city || 'Brisbane';
    const cacheKey = `weather:${city}`;
    return cached(cacheKey, 15 * 60 * 1000, async () => {
      const data = await new Promise((resolve, reject) => {
        const https = require('https');
        const req = https.request({ hostname: 'wttr.in', path: `/${encodeURIComponent(city)}?format=j1`, method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'CyanFin/0.9' }, timeout: 8000 }, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
        });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
      });
      const cur = data.current_condition[0];
      return { city, temp: cur.temp_C, tempF: cur.temp_F, desc: cur.weatherDesc[0].value, humidity: cur.humidity, feelsLike: cur.FeelsLikeC, code: parseInt(cur.weatherCode) };
    })();
  }

  // Best 3D
  if (pathname === '/api/best-3d') {
    const good3D = ['Avatar','How to Train Your Dragon','Life of Pi','Gravity','Pacific Rim','Prometheus','The Walk','Hugo','Pina','Doctor Strange','Jungle Book','Thor','Spider-Man','Spider-Verse','Avengers','Transformers','Alice in Wonderland','Coraline','Up','Monsters Inc','Ice Age','Rio','Interstellar','Mad Max','The Martian','Everest','Mission Impossible','Star Wars','Rogue One','Top Gun Maverick','Dune'];
    const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=500&fields=MediaSources,MediaStreams&SortBy=SortName`, token);
    return (data.Items || []).filter(item => {
      const sources = item.MediaSources || [];
      return sources.some(s => /3d|hsbs|h-sbs|mvc/i.test(s.Name||'') || /3d|hsbs|h-sbs|mvc/i.test(s.Path||''))
        && good3D.some(t => item.Name && item.Name.toLowerCase().includes(t.toLowerCase()));
    }).map(i => mapItem(i, token));
  }

  // Server health
  if (pathname === '/api/health') {
    const start = Date.now();
    const [info, sessions, activity, libraries, devices, plugins, gh] = await Promise.all([
      jf.get('/System/Info', token),
      jf.get('/Sessions', token),
      jf.get('/System/ActivityLog/Entries?Limit=10', token),
      jf.get('/Library/VirtualFolders', token),
      jf.get('/Devices', token),
      jf.get('/Plugins', token).catch(() => ({ Items: [] })),
      require('https') && new Promise(resolve => {
        const r = require('https').request({ hostname:'api.github.com', path:'/repos/Shamuoo/CyanFin/releases/latest', method:'GET', headers:{'User-Agent':'CyanFin','Accept':'application/json'}, timeout:5000 }, res => {
          let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch{resolve(null);} });
        }); r.on('error',()=>resolve(null)); r.on('timeout',()=>{r.destroy();resolve(null);}); r.end();
      }),
    ]);
    const latency = Date.now() - start;
    const active = (sessions||[]).filter(s=>s.NowPlayingItem);
    return {
      latency, jellyfinUrl: process.env.JELLYFIN_URL,
      cyanFinVersion: process.env.CYANFIN_VERSION || (() => { try { return require('../package.json').version; } catch(e) { return '0.12.3'; } })(),
      github: (gh && gh.tag_name) ? { latestRelease: gh.tag_name, releaseName: gh.name, publishedAt: gh.published_at, isLatest: gh.tag_name === `v${process.env.CYANFIN_VERSION || (() => { try { return require('../package.json').version; } catch(e) { return '0.12.3'; } })()}` } : null,
      serverName: info.ServerName, version: info.Version, os: info.OperatingSystem, arch: info.SystemArchitecture,
      localAddress: info.LocalAddress, wanAddress: info.WanAddress, hasUpdate: info.HasUpdateAvailable,
      activeSessions: active.length, totalSessions: (sessions||[]).length,
      transcoding: active.filter(s=>s.TranscodingInfo).length,
      nowPlaying: active.map(s=>({ user:s.UserName, title:s.NowPlayingItem.Name, device:s.DeviceName, isPaused:s.PlayState.IsPaused, progress: Math.round((s.PlayState.PositionTicks||0)/(s.NowPlayingItem.RunTimeTicks||1)*100) })),
      libraries: (libraries||[]).map(l=>({ name:l.Name, type:l.CollectionType, paths:l.Locations })),
      deviceCount: devices && devices.TotalRecordCount,
      plugins: (plugins.Items||[]).map(p=>({ name:p.Name, version:p.Version })),
      recentActivity: (activity.Items||[]).slice(0,10).map(a=>({ name:a.Name, date:a.Date, severity:a.Severity, overview:a.Overview })),
    };
  }

  // System stats
  if (pathname === '/api/system-stats') {
    const fs = require('fs');
    const stats = {};
    try {
      const parseCpuLine = () => {
        const parts = fs.readFileSync('/proc/stat','utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
        return { idle: parts[3] + (parts[4]||0), total: parts.reduce((a,b)=>a+b,0) };
      };
      const c1 = parseCpuLine();
      await new Promise(r=>setTimeout(r,500));
      const c2 = parseCpuLine();
      const dTotal = c2.total - c1.total;
      const dIdle = c2.idle - c1.idle;
      stats.cpuPercent = dTotal > 0 ? Math.max(0, Math.min(100, Math.round((1 - dIdle/dTotal)*100))) : 0;
      const mem = fs.readFileSync('/proc/meminfo','utf8');
      const memTotal = parseInt(mem.match(/MemTotal:\s+(\d+)/)[1]);
      const memAvail = parseInt(mem.match(/MemAvailable:\s+(\d+)/)[1]);
      stats.ramTotal = Math.round(memTotal/1024); stats.ramUsed = Math.round((memTotal-memAvail)/1024); stats.ramPercent = Math.round((memTotal-memAvail)/memTotal*100);
      try { const {execSync}=require('child_process'); const df=execSync('df -h / 2>/dev/null',{encoding:'utf8'}); const lines=df.trim().split('\n').slice(1); stats.disks=lines.map(l=>{const p=l.trim().split(/\s+/);return{fs:p[0],size:p[1],used:p[2],avail:p[3],percent:p[4],mount:p[5]};}).filter(d=>d.mount); } catch(e){stats.disks=[];}
      const load=fs.readFileSync('/proc/loadavg','utf8').split(' '); stats.load1=parseFloat(load[0]); stats.load5=parseFloat(load[1]); stats.load15=parseFloat(load[2]);
      stats.uptimeSeconds=Math.floor(parseFloat(fs.readFileSync('/proc/uptime','utf8').split(' ')[0]));
      try { const ci=fs.readFileSync('/proc/cpuinfo','utf8'); const m=ci.match(/model name\s*:\s*(.+)/); const c=ci.match(/processor\s*:/g); stats.cpuModel=m?m[1].trim():'Unknown'; stats.cpuCores=c?c.length:1; } catch(e){}
      try { const net=fs.readFileSync('/proc/net/dev','utf8'); stats.network=net.trim().split('\n').slice(2).map(l=>{const p=l.trim().split(/\s+/);return{iface:p[0].replace(':',''),rxBytes:parseInt(p[1]),txBytes:parseInt(p[9])};}).filter(n=>n.iface!=='lo'); } catch(e){stats.network=[];}
    } catch(e){stats.error=e.message;}
    return stats;
  }

  return null;
}

module.exports = { handleApi, mapItem, dedup };
