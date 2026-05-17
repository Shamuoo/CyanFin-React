'use strict';
const jf = require('../jellyfin');

// ── Audio label ──────────────────────────────────────────────────────────────
const LANG_FLAGS = {
  eng:'🇬🇧', en:'🇬🇧', fre:'🇫🇷', fra:'🇫🇷', ger:'🇩🇪', deu:'🇩🇪',
  spa:'🇪🇸', jpn:'🇯🇵', kor:'🇰🇷', chi:'🇨🇳', zho:'🇨🇳', ita:'🇮🇹',
  por:'🇵🇹', rus:'🇷🇺', ara:'🇸🇦', hin:'🇮🇳', dut:'🇳🇱', nld:'🇳🇱',
  swe:'🇸🇪', nor:'🇳🇴', fin:'🇫🇮', dan:'🇩🇰', pol:'🇵🇱', tur:'🇹🇷',
  und:'🌐', mul:'🌐',
};

function formatAudio(stream) {
  if (!stream) return null;
  const ch = stream.Channels || 0;
  const chLabel = ch >= 8 ? '7.1' : ch >= 6 ? '5.1' : ch === 2 ? '2.0' : ch === 1 ? 'Mono' : '';
  const spatial = (stream.AudioSpatialFormat || '').toLowerCase();
  const profile = (stream.Profile || '').toLowerCase();
  const codec   = (stream.Codec || '').toLowerCase();
  const flag    = LANG_FLAGS[(stream.Language || '').toLowerCase()] || '';

  let format = '';
  if (spatial.includes('atmos') || profile.includes('atmos')) format = 'Atmos';
  else if (spatial.includes('dtsx'))    format = 'DTS:X';
  else if (profile.includes('truehd'))  format = 'TrueHD';
  else if (profile.includes('dts-hd'))  format = 'DTS-HD';
  else if (codec === 'dts')   format = 'DTS';
  else if (codec === 'eac3')  format = 'DD+';
  else if (codec === 'ac3')   format = 'DD';
  else if (codec === 'aac')   format = 'AAC';
  else if (codec === 'flac')  format = 'FLAC';
  else if (codec === 'opus')  format = 'Opus';
  else if (codec === 'mp3')   format = 'MP3';

  const parts = [chLabel, format].filter(Boolean).join(' ');
  return flag ? (parts ? `${parts} ${flag}` : flag) : (parts || null);
}

function defaultAudio(streams) {
  if (!streams) return null;
  const s = streams.find(s => s.Type === 'Audio' && s.IsDefault && s.Language === 'eng')
         || streams.find(s => s.Type === 'Audio' && s.IsDefault)
         || streams.find(s => s.Type === 'Audio');
  return formatAudio(s);
}

// ── Quality from media source ─────────────────────────────────────────────────
function qualityFromSource(src) {
  const qualities = [];
  const height = src.Height || (src.MediaStreams || []).find(s => s.Type === 'Video')?.Height || 0;
  const is3D = (src.Video3DFormat || '') !== '';

  if (height >= 2160 || (src.Name || '').includes('4K')) qualities.push('4K');
  else if (height >= 1080) qualities.push('1080p');
  else if (height >= 720) qualities.push('720p');
  else if (height > 0) qualities.push('SD');

  if (is3D) qualities.push('3D');
  return qualities;
}

// ── Map Jellyfin item to CyanFin MediaItem ────────────────────────────────────
function mapItem(i, token) {
  const sources = i.MediaSources || [];
  const qualitySet = new Set();

  sources.forEach(src => qualityFromSource(src).forEach(q => qualitySet.add(q)));
  if (qualitySet.size === 0 && i.MediaStreams) {
    qualityFromSource({ MediaStreams: i.MediaStreams, Height: i.Height }).forEach(q => qualitySet.add(q));
  }

  const cast = (i.People || [])
    .filter(p => p.Type === 'Actor')
    .slice(0, 20)
    .map(p => ({ id: p.Id, name: p.Name, role: p.Role, imageTag: p.PrimaryImageTag }));

  const director = (i.People || []).find(p => p.Type === 'Director')?.Name || null;

  const runtime = i.RunTimeTicks
    ? Math.round(i.RunTimeTicks / 600_000_000)
    : null;

  return {
    id: i.Id,
    title: i.Name,
    seriesName: i.SeriesName || null,
    year: i.ProductionYear || null,
    type: i.Type,
    overview: i.Overview || null,
    tagline: i.Taglines?.[0] || null,
    genre: i.Genres?.[0] || null,
    genres: i.Genres || [],
    rating: i.OfficialRating || null,
    score: i.CommunityRating ? Math.round(i.CommunityRating * 10) / 10 : null,
    runtime: runtime,
    runTimeTicks: i.RunTimeTicks || null,
    audio: defaultAudio(i.MediaStreams),
    qualities: [...qualitySet],
    cast,
    director,
    indexNumber: i.IndexNumber ?? null,
    parentIndexNumber: i.ParentIndexNumber ?? null,
    seriesId: i.SeriesId || null,
    seasonId: i.ParentId || null,
    seasonName: i.SeasonName || null,
    userData: i.UserData ? {
      played: i.UserData.Played,
      playedPercentage: i.UserData.PlayedPercentage,
      playbackPositionTicks: i.UserData.PlaybackPositionTicks,
      isFavorite: i.UserData.IsFavorite,
    } : null,
    externalIds: i.ProviderIds || {},
    posterUrl:   i.ImageTags?.Primary   ? `/proxy/image?id=${i.Id}&type=Primary&w=400` : null,
    backdropUrl: i.BackdropImageTags?.length ? `/proxy/image?id=${i.Id}&type=Backdrop%2F0&w=1920` : null,
    backdropUrls: (i.BackdropImageTags || []).map((_, idx) => `/proxy/image?id=${i.Id}&type=Backdrop%2F${idx}&w=1920`),
    thumbUrl:    i.ImageTags?.Thumb     ? `/proxy/image?id=${i.Id}&type=Thumb&w=500` : null,
    logoUrl:     i.ImageTags?.Logo      ? `/proxy/image?id=${i.Id}&type=Logo&w=600` : null,
    _source: 'jellyfin',
  };
}

// ── Deduplicate by id ─────────────────────────────────────────────────────────
function dedup(items) {
  const seen = new Set();
  return items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
}

module.exports = { mapItem, dedup, formatAudio, defaultAudio, qualityFromSource, LANG_FLAGS };
