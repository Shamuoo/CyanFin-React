'use strict';
/**
 * Item detail, playback info, user actions
 */
const jf = require('../jellyfin');
const { mapItem, formatAudio } = require('./media');
const cfg = require('../config');

const FIELDS = 'Overview,Taglines,Genres,OfficialRating,CommunityRating,People,MediaStreams,MediaSources,Studios,Tags,ExternalUrls,ProviderIds,BackdropImageTags,ImageTags,Chapters,PartCount';

async function handleItems(pathname, query, session, req) {
  const token = session.token;
  const userId = session.userId;

  // ── Item Detail ─────────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/items\/[^/]+$/) && req.method !== 'POST') {
    const itemId = pathname.split('/')[3];
    const [data, themeSongs, extras, introData] = await Promise.all([
      jf.get(`/Items/${itemId}?userId=${userId}&fields=${FIELDS}`, token),
      jf.get(`/Items/${itemId}/ThemeMedia?userId=${userId}&InheritFromParent=true`, token).catch(() => ({})),
      jf.get(`/Users/${userId}/Items/${itemId}/SpecialFeatures`, token).catch(() => []),
      jf.get(`/Episode/GetIntros?itemId=${itemId}&userId=${userId}`, token).catch(() => null),
    ]);

    const mapped = mapItem(data, token);

    // Theme song
    const themes = (themeSongs.ThemeVideos || themeSongs.ThemeSongs || {}).Items || [];
    if (themes.length) {
      mapped.themeSongUrl = jf.audioUrl(themes[0].Id, token);
    }

    // Chapters
    mapped.chapters = (data.Chapters || []).map(ch => ({
      name: ch.Name || '',
      startPositionTicks: ch.StartPositionTicks || 0,
      imageTag: ch.ImageTag || null,
    }));

    // Intro skip
    if (introData?.Items?.length) {
      mapped.introStart = introData.Items[0].StartPositionTicks;
      mapped.introEnd   = introData.Items[0].EndPositionTicks;
    }

    // Extras
    const extrasArr = Array.isArray(extras) ? extras : extras.Items || [];
    mapped.extras = extrasArr.map(e => ({
      id: e.Id, title: e.Name, type: e.ExtraType || e.Type,
      runtime: e.RunTimeTicks,
      thumbUrl: e.ImageTags?.Primary ? jf.imageUrl(e.Id, 'Primary', { token, maxWidth: 400 }) : null,
    }));

    // External ratings (TMDB + OMDB)
    const providerIds = data.ProviderIds || {};
    const imdbId = providerIds.Imdb;
    const tmdbId = providerIds.Tmdb;
    let tmdbScore = null, rtScore = null, metascore = null;

    if (tmdbId) {
      const tmdbKey = cfg.get('TMDB_API_KEY');
      if (tmdbKey) {
        const mediaType = data.Type === 'Series' ? 'tv' : 'movie';
        const res = await httpGet(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}`).catch(() => null);
        if (res?.vote_average) tmdbScore = Math.round(res.vote_average * 10);
      }
    }

    if (imdbId) {
      const omdbKey = cfg.get('OMDB_API_KEY');
      if (omdbKey) {
        const res = await httpGet(`https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`).catch(() => null);
        if (res?.Ratings) {
          const rt = res.Ratings.find(r => r.Source === 'Rotten Tomatoes');
          if (rt) rtScore = parseInt(rt.Value);
          const mc = res.Ratings.find(r => r.Source === 'Metacritic');
          if (mc) metascore = parseInt(mc.Value);
        }
      }
    }

    mapped.externalRatings = {
      imdb: data.CommunityRating ? Math.round(data.CommunityRating * 10) / 10 : null,
      tmdb: tmdbScore,
      rt: rtScore,
      metascore,
      imdbId,
      tmdbId,
      imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
      letterboxdUrl: imdbId ? `https://letterboxd.com/film/${imdbId}/` : null,
    };

    return mapped;
  }

  // ── Playback Info ───────────────────────────────────────────────────────────
  if (pathname === '/api/playback-info') {
    const itemId = query.id;
    const mediaSourceId = query.mediaSourceId;
    const audioStreamIndex = query.audioStreamIndex ? parseInt(query.audioStreamIndex) : undefined;
    if (!itemId) return { error: 'No id' };

    const info = await jf.post(`/Items/${itemId}/PlaybackInfo?userId=${userId}`, {
      DeviceProfile: {
        DirectPlayProfiles: [
          { Type: 'Video', Container: 'mp4,mkv,avi,mov,webm,ts,m2ts,mpegts' },
          { Type: 'Audio', Container: 'mp3,aac,flac,opus,ogg' },
        ],
        TranscodingProfiles: [
          { Type: 'Video', Container: 'ts', Protocol: 'hls', VideoCodec: 'h264', AudioCodec: 'aac,mp3' },
        ],
        SubtitleProfiles: [
          { Method: 'External', Format: 'vtt' },
          { Method: 'External', Format: 'srt' },
        ],
        ResponseProfiles: [],
        CodecProfiles: [],
        ContainerProfiles: [],
      },
      MediaSourceId: mediaSourceId,
      AudioStreamIndex: audioStreamIndex,
    }, token);

    const sources = (info.MediaSources || []).map(s => ({
      id: s.Id,
      name: s.Name || s.Container,
      container: s.Container,
      videoCodec: (s.MediaStreams || []).find(ms => ms.Type === 'Video')?.Codec,
      size: s.Size,
      bitrate: s.Bitrate,
      supportsDirectPlay: s.SupportsDirectPlay,
      supportsDirectStream: s.SupportsDirectStream,
      streamUrl: jf.streamUrl(itemId, token) + (s.Id ? `&mediaSourceId=${s.Id}` : ''),
      hlsUrl: jf.hlsUrl(itemId, token) + (s.Id ? `&mediaSourceId=${s.Id}` : ''),
      audioStreams: (s.MediaStreams || [])
        .filter(ms => ms.Type === 'Audio')
        .map(ms => ({
          index: ms.Index,
          title: formatAudio(ms) || ms.DisplayTitle || ms.Codec,
          codec: ms.Codec,
          channels: ms.Channels,
          language: ms.Language,
          isDefault: ms.IsDefault,
        })),
      subtitleStreams: (s.MediaStreams || [])
        .filter(ms => ms.Type === 'Subtitle')
        .map(ms => ({
          index: ms.Index,
          title: ms.DisplayTitle || ms.Language || ms.Codec,
          language: ms.Language,
          isDefault: ms.IsDefault,
          codec: ms.Codec,
          isExternal: ms.IsExternal,
        })),
    }));

    const primary = sources.find(s => s.id === mediaSourceId) || sources[0];
    return {
      streamUrl: primary?.streamUrl || jf.streamUrl(itemId, token),
      hlsUrl: primary?.hlsUrl || jf.hlsUrl(itemId, token),
      mediaSources: sources,
    };
  }

  // ── Intro Skip ──────────────────────────────────────────────────────────────
  if (pathname === '/api/intro-skip') {
    const itemId = query.id;
    if (!itemId) return { hasIntro: false };
    // Try Intro Skipper plugin first
    const plugin = await jf.get(`/Episode/GetIntros?itemId=${itemId}&userId=${userId}`, token).catch(() => null);
    if (plugin?.Items?.length) {
      return { hasIntro: true, introStart: plugin.Items[0].StartPositionTicks, introEnd: plugin.Items[0].EndPositionTicks };
    }
    // Fallback to segment API
    const segs = await jf.get(`/MediaSegments/${itemId}`, token).catch(() => null);
    const intro = segs?.Items?.find(s => s.Type === 'Intro');
    if (intro) return { hasIntro: true, introStart: intro.StartTicks, introEnd: intro.EndTicks };
    return { hasIntro: false };
  }

  // ── Playback reporting ──────────────────────────────────────────────────────
  if (pathname === '/api/playback/start' && req.method === 'POST') {
    const { itemId, mediaSourceId, positionTicks = 0, audioStreamIndex, subtitleStreamIndex } = req._body || {};
    if (!itemId) return { error: 'No itemId' };
    await jf.post('/Sessions/Playing', {
      ItemId: itemId, MediaSourceId: mediaSourceId,
      PositionTicks: positionTicks, IsPaused: false, IsMuted: false,
      AudioStreamIndex: audioStreamIndex, SubtitleStreamIndex: subtitleStreamIndex,
      PlayMethod: 'DirectPlay', RepeatMode: 'RepeatNone',
    }, token).catch(() => {});
    return { ok: true };
  }

  if (pathname === '/api/playback/progress' && req.method === 'POST') {
    const { itemId, mediaSourceId, positionTicks = 0, isPaused, isMuted, volumeLevel, audioStreamIndex, subtitleStreamIndex } = req._body || {};
    if (!itemId) return { error: 'No itemId' };
    await jf.post('/Sessions/Playing/Progress', {
      ItemId: itemId, MediaSourceId: mediaSourceId,
      PositionTicks: positionTicks, IsPaused: isPaused || false, IsMuted: isMuted || false,
      VolumeLevel: volumeLevel || 100, AudioStreamIndex: audioStreamIndex,
      SubtitleStreamIndex: subtitleStreamIndex, PlayMethod: 'DirectPlay',
      RepeatMode: 'RepeatNone', EventName: isPaused ? 'pause' : 'timeupdate',
    }, token).catch(() => {});
    return { ok: true };
  }

  if (pathname === '/api/playback/stop' && req.method === 'POST') {
    const { itemId, mediaSourceId, positionTicks = 0 } = req._body || {};
    if (!itemId) return { error: 'No itemId' };
    await jf.post('/Sessions/Playing/Stopped', {
      ItemId: itemId, MediaSourceId: mediaSourceId,
      PositionTicks: positionTicks, PlayMethod: 'DirectPlay',
    }, token).catch(() => {});
    return { ok: true };
  }

  // ── User actions ─────────────────────────────────────────────────────────────
  if (pathname === '/api/user/favorite' && req.method === 'POST') {
    const { itemId, favorite } = req._body || {};
    if (!itemId) return { error: 'No itemId' };
    if (favorite) {
      await jf.post(`/Users/${userId}/FavoriteItems/${itemId}`, {}, token);
    } else {
      await jf.del(`/Users/${userId}/FavoriteItems/${itemId}`, token).catch(() => {});
    }
    return { ok: true };
  }

  if (pathname === '/api/user/watched' && req.method === 'POST') {
    const { itemId, watched } = req._body || {};
    if (!itemId) return { error: 'No itemId' };
    if (watched) {
      await jf.post(`/Users/${userId}/PlayedItems/${itemId}`, {}, token);
    } else {
      await jf.del(`/Users/${userId}/PlayedItems/${itemId}`, token).catch(() => {});
    }
    return { ok: true };
  }

  return null;
}

// Simple HTTPS GET helper
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(url, { timeout: 5000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = { handleItems };
