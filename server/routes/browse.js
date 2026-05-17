'use strict';
/**
 * Browse routes — library listing, search, home rows
 */
const jf = require('../jellyfin');
const { mapItem, dedup } = require('./media');

async function handleBrowse(pathname, query, session) {
  const token = session.token;
  const userId = session.userId;

  // ── Recently Added ──────────────────────────────────────────────────────────
  if (pathname === '/api/recently-added') {
    const data = await jf.get(
      `/Users/${userId}/Items/Latest?MediaType=Video&Limit=24` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return dedup((Array.isArray(data) ? data : data.Items || []).map(i => mapItem(i, token)));
  }

  // ── Continue Watching ───────────────────────────────────────────────────────
  if (pathname === '/api/continue-watching') {
    const data = await jf.get(
      `/Users/${userId}/Items/Resume?MediaTypes=Video&Limit=12` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Popular ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/popular') {
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true` +
      `&SortBy=PlayCount,CommunityRating&SortOrder=Descending&Limit=20` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Watch History ───────────────────────────────────────────────────────────
  if (pathname === '/api/history') {
    const data = await jf.get(
      `/Users/${userId}/Items?Filters=IsPlayed&Recursive=true&IncludeItemTypes=Movie,Episode` +
      `&SortBy=DatePlayed&SortOrder=Descending&Limit=20` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Movies ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/movies') {
    const sort = query.sort || 'SortName';
    const order = query.order || 'Ascending';
    const genre = query.genre ? `&Genres=${encodeURIComponent(query.genre)}` : '';
    const start = parseInt(query.start || '0');
    const limit = parseInt(query.limit || '50');
    const search = query.search ? `&SearchTerm=${encodeURIComponent(query.search)}` : '';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true` +
      `&SortBy=${sort}&SortOrder=${order}&StartIndex=${start}&Limit=${limit}` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags` +
      genre + search,
      token
    );
    return { items: (data.Items || []).map(i => mapItem(i, token)), total: data.TotalRecordCount || 0 };
  }

  // ── TV Shows ────────────────────────────────────────────────────────────────
  if (pathname === '/api/shows') {
    const sort = query.sort || 'SortName';
    const order = query.order || 'Ascending';
    const genre = query.genre ? `&Genres=${encodeURIComponent(query.genre)}` : '';
    const start = parseInt(query.start || '0');
    const limit = parseInt(query.limit || '50');
    const search = query.search ? `&SearchTerm=${encodeURIComponent(query.search)}` : '';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true` +
      `&SortBy=${sort}&SortOrder=${order}&StartIndex=${start}&Limit=${limit}` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,ImageTags,BackdropImageTags` +
      genre + search,
      token
    );
    return { items: (data.Items || []).map(i => mapItem(i, token)), total: data.TotalRecordCount || 0 };
  }

  // ── Seasons ─────────────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/shows\/[^/]+\/seasons$/)) {
    const showId = pathname.split('/')[3];
    const data = await jf.get(
      `/Shows/${showId}/Seasons?userId=${userId}&fields=Overview,ImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Episodes ────────────────────────────────────────────────────────────────
  if (pathname.match(/^\/api\/shows\/[^/]+\/seasons\/[^/]+\/episodes$/)) {
    const parts = pathname.split('/');
    const showId = parts[3];
    const seasonId = parts[5];
    const data = await jf.get(
      `/Shows/${showId}/Episodes?seasonId=${seasonId}&userId=${userId}` +
      `&fields=Overview,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Next Episode ────────────────────────────────────────────────────────────
  if (pathname === '/api/next-episode') {
    const { seriesId, parentIndexNumber, indexNumber } = query;
    if (!seriesId) return { hasNext: false };
    const data = await jf.get(
      `/Shows/${seriesId}/Episodes?userId=${userId}&fields=ImageTags,UserData`,
      token
    );
    const eps = data.Items || [];
    const curIdx = eps.findIndex(e =>
      e.ParentIndexNumber == parentIndexNumber && e.IndexNumber == indexNumber
    );
    if (curIdx === -1 || curIdx >= eps.length - 1) return { hasNext: false };
    return { hasNext: true, episode: mapItem(eps[curIdx + 1], token) };
  }

  // ── Collections / Box Sets ──────────────────────────────────────────────────
  if (pathname === '/api/collections') {
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

  // ── Best 3D ─────────────────────────────────────────────────────────────────
  if (pathname === '/api/best-3d') {
    const keywords = ['Avatar', 'How to Train Your Dragon', 'Life of Pi', 'Gravity', 'Interstellar', 'Mad Max'];
    const results = await Promise.all(
      keywords.map(kw => jf.get(
        `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(kw)}&IncludeItemTypes=Movie&Recursive=true&Limit=3` +
        `&fields=MediaStreams,ImageTags,BackdropImageTags`,
        token
      ).then(d => (d.Items || []).filter(i => (i.Video3DFormat || '') !== '')).catch(() => []))
    );
    return dedup(results.flat().map(i => mapItem(i, token))).slice(0, 15);
  }

  // ── Libraries ───────────────────────────────────────────────────────────────
  if (pathname === '/api/libraries') {
    const data = await jf.get(`/Users/${userId}/Views`, token);
    return (data.Items || []).map(l => ({
      id: l.Id, name: l.Name,
      type: l.CollectionType || l.Type,
      imageUrl: l.ImageTags?.Primary ? jf.imageUrl(l.Id, 'Primary', { token, maxWidth: 400 }) : null,
    }));
  }

  // ── Genres ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/genres') {
    const type = query.type || 'Movie';
    const data = await jf.get(
      `/Genres?userId=${userId}&IncludeItemTypes=${type}&SortBy=SortName&Limit=100`,
      token
    );
    return (data.Items || []).map(g => ({ id: g.Id, name: g.Name }));
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/search') {
    const q = query.q || '';
    if (!q) return [];
    const data = await jf.get(
      `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(q)}&Recursive=true&Limit=20` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Random ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/random') {
    const count = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=0&EnableTotalRecordCount=true`,
      token
    );
    const total = count.TotalRecordCount || 100;
    const startIndex = Math.floor(Math.random() * Math.max(0, total - 1));
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&StartIndex=${startIndex}&Limit=1` +
      `&fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,ImageTags,BackdropImageTags`,
      token
    );
    return (data.Items || []).map(i => mapItem(i, token));
  }

  // ── Now Playing ─────────────────────────────────────────────────────────────
  if (pathname === '/api/now-playing') {
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

  // ── Music Albums ─────────────────────────────────────────────────────────────
  if (pathname === '/api/music/albums') {
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=MusicAlbum&Recursive=true&SortBy=SortName&Limit=100` +
      `&fields=ImageTags`,
      token
    );
    return (data.Items || []).map(i => ({
      id: i.Id, title: i.Name, artist: i.AlbumArtist || i.Artists?.[0],
      year: i.ProductionYear,
      imageUrl: i.ImageTags?.Primary ? `/proxy/image?id=${i.Id}&type=Primary&w=400` : null,
    }));
  }

  // ── Music Tracks ─────────────────────────────────────────────────────────────
  if (pathname === '/api/music/tracks') {
    const albumId = query.albumId;
    if (!albumId) return [];
    const data = await jf.get(
      `/Users/${userId}/Items?ParentId=${albumId}&IncludeItemTypes=Audio&SortBy=IndexNumber&Limit=100` +
      `&fields=MediaStreams`,
      token
    );
    return (data.Items || []).map(i => ({
      id: i.Id, title: i.Name, artist: i.AlbumArtist || i.Artists?.[0],
      album: i.Album, trackNumber: i.IndexNumber, duration: i.RunTimeTicks,
      streamUrl: jf.audioUrl(i.Id, token),
    }));
  }

  return null;
}

module.exports = { handleBrowse };
