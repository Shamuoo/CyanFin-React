'use strict';
const jf = require('../jellyfin');

// ── Audio label ──────────────────────────────────────────────────────────────
const LANG_FLAGS = {
  // English
  eng:'🇬🇧', en:'🇬🇧',
  // French
  fre:'🇫🇷', fra:'🇫🇷', fr:'🇫🇷',
  // German
  ger:'🇩🇪', deu:'🇩🇪', de:'🇩🇪',
  // Spanish
  spa:'🇪🇸', es:'🇪🇸',
  // Japanese
  jpn:'🇯🇵', ja:'🇯🇵',
  // Korean
  kor:'🇰🇷', ko:'🇰🇷',
  // Chinese
  chi:'🇨🇳', zho:'🇨🇳', zh:'🇨🇳',
  // Italian
  ita:'🇮🇹', it:'🇮🇹',
  // Portuguese
  por:'🇵🇹', pt:'🇵🇹',
  // Russian
  rus:'🇷🇺', ru:'🇷🇺',
  // Arabic
  ara:'🇸🇦', ar:'🇸🇦',
  // Hindi
  hin:'🇮🇳', hi:'🇮🇳',
  // Dutch
  dut:'🇳🇱', nld:'🇳🇱', nl:'🇳🇱',
  // Swedish
  swe:'🇸🇪', sv:'🇸🇪',
  // Norwegian
  nor:'🇳🇴', nb:'🇳🇴', nn:'🇳🇴',
  // Finnish
  fin:'🇫🇮', fi:'🇫🇮',
  // Danish
  dan:'🇩🇰', da:'🇩🇰',
  // Polish
  pol:'🇵🇱', pl:'🇵🇱',
  // Turkish
  tur:'🇹🇷', tr:'🇹🇷',
  // Czech
  cze:'🇨🇿', ces:'🇨🇿', cs:'🇨🇿',
  // Greek
  gre:'🇬🇷', ell:'🇬🇷', el:'🇬🇷',
  // Hungarian
  hun:'🇭🇺', hu:'🇭🇺',
  // Romanian
  rum:'🇷🇴', ron:'🇷🇴', ro:'🇷🇴',
  // Ukrainian
  ukr:'🇺🇦', uk:'🇺🇦',
  // Thai
  tha:'🇹🇭', th:'🇹🇭',
  // Vietnamese
  vie:'🇻🇳', vi:'🇻🇳',
  // Indonesian
  ind:'🇮🇩', id:'🇮🇩',
  // Malay
  may:'🇲🇾', msa:'🇲🇾', ms:'🇲🇾',
  // Hebrew
  heb:'🇮🇱', he:'🇮🇱',
  // Swedish
  slo:'🇸🇰', slk:'🇸🇰', sk:'🇸🇰',
  // Croatian
  hrv:'🇭🇷', hr:'🇭🇷',
  // Serbian
  srp:'🇷🇸', sr:'🇷🇸',
  // Bulgarian
  bul:'🇧🇬', bg:'🇧🇬',
  // Catalan
  cat:'🇪🇸', ca:'🇪🇸',
  // US English
  'en-us':'🇺🇸', 'en-gb':'🇬🇧', 'en-au':'🇦🇺',
  // Unknown/multi
  und:'🌐', mul:'🌐',
};

function formatAudio(stream) {
  if (!stream) return null;
  const ch = stream.Channels || 0;
  const chLabel = ch >= 8 ? '7.1' : ch >= 6 ? '5.1' : ch === 2 ? '2.0' : ch === 1 ? 'Mono' : '';
  const spatial = (stream.AudioSpatialFormat || '').toLowerCase();
  const profile = (stream.Profile || '').toLowerCase();
  const codec   = (stream.Codec || '').toLowerCase();
  const langCode = (stream.Language || '').toLowerCase();
  // Jellyfin sometimes uses display names instead of codes
  const DISPLAY_FLAGS = {
    english:'🇬🇧', french:'🇫🇷', german:'🇩🇪', spanish:'🇪🇸',
    japanese:'🇯🇵', korean:'🇰🇷', chinese:'🇨🇳', italian:'🇮🇹',
    portuguese:'🇵🇹', russian:'🇷🇺', arabic:'🇸🇦', hindi:'🇮🇳',
    dutch:'🇳🇱', swedish:'🇸🇪', norwegian:'🇳🇴', finnish:'🇫🇮',
    danish:'🇩🇰', polish:'🇵🇱', turkish:'🇹🇷', czech:'🇨🇿',
    thai:'🇹🇭', ukrainian:'🇺🇦', hungarian:'🇭🇺', romanian:'🇷🇴',
    greek:'🇬🇷', hebrew:'🇮🇱', vietnamese:'🇻🇳', indonesian:'🇮🇩',
  };
  const flag = LANG_FLAGS[langCode] || DISPLAY_FLAGS[langCode] || '';

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
  // Build label: codec+channels + flag (or ISO code if no flag)
  if (flag) {
    return parts ? `${parts} ${flag}` : flag;
  }
  // No flag — use short uppercase language code
  const shortCode = langCode.length === 3 ? langCode.toUpperCase()
    : langCode.length === 2 ? langCode.toUpperCase() : '';
  if (shortCode && shortCode !== 'UND') {
    return parts ? `${parts} ${shortCode}` : shortCode;
  }
  return parts || null;
}

function defaultAudio(streams) {
  if (!streams) return null;
  // Prefer default English, then any default, then first audio
  const s = streams.find(s => s.Type === 'Audio' && s.IsDefault)
         || streams.find(s => s.Type === 'Audio');
  return formatAudio(s);
}

// ── Quality from media source ─────────────────────────────────────────────────
function qualityFromSource(src) {
  const videoStream = (src.MediaStreams || []).find(s => s.Type === 'Video');
  const height = src.Height || videoStream?.Height || 0;
  const width  = src.Width  || videoStream?.Width  || 0;
  const is3D   = (src.Video3DFormat || '') !== '';
  const name   = (src.Name || src.Path || '').toLowerCase();
  const profile = (videoStream?.Profile || '').toLowerCase();
  const codec   = (videoStream?.Codec  || '').toLowerCase();
  const bitDepth = videoStream?.BitDepth || 8;

  // 4K signals: resolution, name hints, HDR/DV profiles
  const is4K =
    height >= 2160 || width >= 3840 ||
    name.includes('4k') || name.includes('2160') || name.includes('uhd') ||
    profile.includes('main 10') && (height >= 1800 || width >= 3000) ||
    name.includes('bluray.2160') || name.includes('blu-ray.2160');

  // 1080p signals
  const is1080 =
    (height >= 1080 && height < 2160) ||
    (width  >= 1920 && width  < 3840 && !is4K) ||
    (name.includes('1080') && !is4K);

  // 720p signals
  const is720 =
    (height >= 720 && height < 1080 && !is4K && !is1080) ||
    (name.includes('720') && !is4K && !is1080);

  let base = '';
  if (is4K)        base = '4K';
  else if (is1080) base = '1080p';
  else if (is720)  base = '720p';
  else if (height > 0 || width > 0) base = 'SD';

  if (!base) return [];

  // HDR / Dolby Vision badge
  const isHDR = bitDepth >= 10 ||
    name.includes('hdr') || name.includes('dv') || name.includes('dolby.vision') ||
    profile.includes('dolby') || codec === 'dvhe' || codec === 'dvh1';

  const suffix = is3D ? ' 3D' : isHDR && is4K ? ' HDR' : '';
  return [base + suffix];
}

// ── Map Jellyfin item to CyanFin MediaItem ────────────────────────────────────
function mapItem(i, token) {
  const sources = i.MediaSources || [];
  const qualitySet = new Set();

  sources.forEach(src => qualityFromSource(src).forEach(q => qualitySet.add(q)));
  if (qualitySet.size === 0 && i.MediaStreams) {
    qualityFromSource({ MediaStreams: i.MediaStreams, Height: i.Height }).forEach(q => qualitySet.add(q));
  }
  // Keep only the best quality (4K > 1080p > 720p > SD)
  const RANK = { '4K':4, '4K 3D':4, '1080p':3, '1080p 3D':3, '720p':2, '720p 3D':2, 'SD':1, 'SD 3D':1 };
  const best = [...qualitySet].sort((a,b) => (RANK[b]||0)-(RANK[a]||0))[0];
  if (best) { qualitySet.clear(); qualitySet.add(best); }

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
