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
