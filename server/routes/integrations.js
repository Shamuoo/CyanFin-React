const cfg = require('../config');
const https = require('https');
const http = require('http');
const url = require('url');

function integrationGet(baseUrl, apiKey, path) {
  return new Promise((resolve, reject) => {
    if (!baseUrl) return reject(new Error('Integration URL not configured'));
    const fullUrl = baseUrl.replace(/\/$/, '') + path;
    const parsed = new url.URL(fullUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 8000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function integrationPost(baseUrl, apiKey, path, body) {
  return new Promise((resolve, reject) => {
    if (!baseUrl) return reject(new Error('Integration URL not configured'));
    const fullUrl = baseUrl.replace(/\/$/, '') + path;
    const parsed = new url.URL(fullUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: 10000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: {} }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(bodyStr); req.end();
  });
}

function discordPost(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    if (!webhookUrl) return reject(new Error('Discord webhook not configured'));
    const parsed = new url.URL(webhookUrl);
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000,
    }, res => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body); req.end();
  });
}

async function handleIntegrations(pathname, query, body, session) {
  const JELLYSEERR_URL = cfg.get('JELLYSEERR_URL');
  const JELLYSEERR_KEY = cfg.get('JELLYSEERR_API_KEY');
  const RADARR_URL = cfg.get('RADARR_URL');
  const RADARR_KEY = cfg.get('RADARR_API_KEY');
  const SONARR_URL = cfg.get('SONARR_URL');
  const SONARR_KEY = cfg.get('SONARR_API_KEY');
  const DISCORD_WEBHOOK = cfg.get('DISCORD_WEBHOOK_URL');

  // ── Jellyseerr ──
  if (pathname === '/api/integrations/jellyseerr-status') {
    if (!JELLYSEERR_URL) return { configured: false };
    try {
      const data = await integrationGet(JELLYSEERR_URL, JELLYSEERR_KEY, '/api/v1/status');
      return { configured: true, version: data.version };
    } catch(e) { return { configured: true, error: e.message }; }
  }

  if (pathname === '/api/integrations/request') {
    const { mediaType, mediaId, tmdbId } = body;
    if (!JELLYSEERR_URL || !JELLYSEERR_KEY) return { error: 'Jellyseerr not configured' };
    try {
      const result = await integrationPost(JELLYSEERR_URL, JELLYSEERR_KEY, '/api/v1/request', {
        mediaType: mediaType || 'movie',
        mediaId: parseInt(mediaId || tmdbId),
      });
      return { success: result.status === 201 || result.status === 200, status: result.status, data: result.data };
    } catch(e) { return { error: e.message }; }
  }

  if (pathname === '/api/integrations/search-jellyseerr') {
    const q = query.q || '';
    if (!JELLYSEERR_URL || !q) return [];
    try {
      const data = await integrationGet(JELLYSEERR_URL, JELLYSEERR_KEY, `/api/v1/search?query=${encodeURIComponent(q)}&page=1`);
      return (data.results || []).slice(0, 10).map(r => ({
        id: r.id, tmdbId: r.id, title: r.title || r.name,
        type: r.mediaType, year: r.releaseDate ? r.releaseDate.split('-')[0] : (r.firstAirDate ? r.firstAirDate.split('-')[0] : null),
        overview: r.overview,
        posterUrl: r.posterPath ? `https://image.tmdb.org/t/p/w300${r.posterPath}` : null,
        status: r.mediaInfo ? r.mediaInfo.status : 0,
      }));
    } catch(e) { return { error: e.message }; }
  }

  // ── Radarr ──
  if (pathname === '/api/integrations/radarr-status') {
    if (!RADARR_URL) return { configured: false };
    try {
      const [queue, movies] = await Promise.all([
        integrationGet(RADARR_URL, RADARR_KEY, '/api/v3/queue?pageSize=50'),
        integrationGet(RADARR_URL, RADARR_KEY, '/api/v3/movie?monitored=true').catch(() => []),
      ]);
      const downloading = (queue.records || []).map(r => ({
        title: r.title, status: r.status, progress: r.sizeleft && r.size ? Math.round((1 - r.sizeleft / r.size) * 100) : 0,
        eta: r.estimatedCompletionTime, quality: r.quality && r.quality.quality ? r.quality.quality.name : null,
      }));
      const missing = (Array.isArray(movies) ? movies : []).filter(m => !m.hasFile && m.monitored).length;
      return { configured: true, downloading, missing, totalMovies: Array.isArray(movies) ? movies.length : 0 };
    } catch(e) { return { configured: true, error: e.message }; }
  }

  if (pathname === '/api/integrations/radarr-movie') {
    const tmdbId = query.tmdbId;
    if (!RADARR_URL || !tmdbId) return { configured: !!RADARR_URL };
    try {
      const movies = await integrationGet(RADARR_URL, RADARR_KEY, `/api/v3/movie?tmdbId=${tmdbId}`);
      const movie = Array.isArray(movies) ? movies[0] : null;
      return { configured: true, found: !!movie, hasFile: movie ? movie.hasFile : false, monitored: movie ? movie.monitored : false, status: movie ? movie.status : null, quality: movie && movie.movieFile ? movie.movieFile.quality.quality.name : null };
    } catch(e) { return { configured: true, error: e.message }; }
  }

  // ── Sonarr ──
  if (pathname === '/api/integrations/sonarr-status') {
    if (!SONARR_URL) return { configured: false };
    try {
      const queue = await integrationGet(SONARR_URL, SONARR_KEY, '/api/v3/queue?pageSize=50');
      const downloading = (queue.records || []).map(r => ({
        title: r.title, status: r.status, progress: r.sizeleft && r.size ? Math.round((1 - r.sizeleft / r.size) * 100) : 0, eta: r.estimatedCompletionTime,
      }));
      return { configured: true, downloading };
    } catch(e) { return { configured: true, error: e.message }; }
  }

  // ── Discord ──
  if (pathname === '/api/integrations/discord-notify') {
    const { title, overview, posterUrl, type, year } = body;
    if (!DISCORD_WEBHOOK) return { error: 'Discord webhook not configured' };
    try {
      const embed = {
        title: `🎬 New ${type || 'Movie'} Added`,
        description: `**${title}** ${year ? `(${year})` : ''}\n${(overview || '').slice(0, 200)}${overview && overview.length > 200 ? '…' : ''}`,
        color: 0xc9a84c,
        thumbnail: posterUrl ? { url: posterUrl } : undefined,
        footer: { text: 'CyanFin' },
        timestamp: new Date().toISOString(),
      };
      await discordPost(DISCORD_WEBHOOK, { embeds: [embed] });
      return { success: true };
    } catch(e) { return { error: e.message }; }
  }

  // ── Integration config status ──
  if (pathname === '/api/integrations/config') {
    return {
      jellyseerr: !!(cfg.get('JELLYSEERR_URL') && cfg.get('JELLYSEERR_API_KEY')),
      radarr: !!(cfg.get('RADARR_URL') && cfg.get('RADARR_API_KEY')),
      sonarr: !!(cfg.get('SONARR_URL') && cfg.get('SONARR_API_KEY')),
      discord: !!cfg.get('DISCORD_WEBHOOK_URL'),
      anthropic: !!cfg.get('ANTHROPIC_API_KEY'),
      tmdb: !!cfg.get('TMDB_API_KEY'),
    };
  }

  // ── Test connections ──
  if (pathname === '/api/integrations/test') {
    const service = query.service;
    try {
      if (service === 'jellyseerr') {
        if (!cfg.get('JELLYSEERR_URL') || !cfg.get('JELLYSEERR_API_KEY')) return { ok: false, error: 'Not configured' };
        const d = await integrationGet(cfg.get('JELLYSEERR_URL'), cfg.get('JELLYSEERR_API_KEY'), '/api/v1/status');
        return { ok: true, message: 'Jellyseerr v' + (d.version || '?') };
      }
      if (service === 'radarr') {
        if (!cfg.get('RADARR_URL') || !cfg.get('RADARR_API_KEY')) return { ok: false, error: 'Not configured' };
        const d = await integrationGet(cfg.get('RADARR_URL'), cfg.get('RADARR_API_KEY'), '/api/v3/system/status');
        return { ok: true, message: 'Radarr v' + (d.version || '?') };
      }
      if (service === 'sonarr') {
        if (!cfg.get('SONARR_URL') || !cfg.get('SONARR_API_KEY')) return { ok: false, error: 'Not configured' };
        const d = await integrationGet(cfg.get('SONARR_URL'), cfg.get('SONARR_API_KEY'), '/api/v3/system/status');
        return { ok: true, message: 'Sonarr v' + (d.version || '?') };
      }
      if (service === 'tmdb') {
        if (!cfg.get('TMDB_API_KEY')) return { ok: false, error: 'Not configured' };
        const https = require('https');
        const d = await new Promise((resolve, reject) => {
          const req = https.request({ hostname: 'api.themoviedb.org', path: '/3/configuration?api_key=' + cfg.get('TMDB_API_KEY'), method: 'GET', headers: { Accept: 'application/json' }, timeout: 6000 }, res => {
            let data = ''; res.on('data', c => data += c); res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode }); } });
          }); req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); }); req.end();
        });
        return d.status === 200 ? { ok: true, message: 'TMDB connected' } : { ok: false, error: 'Invalid API key' };
      }
      if (service === 'anthropic') {
        if (!cfg.get('ANTHROPIC_API_KEY')) return { ok: false, error: 'Not configured' };
        const https = require('https');
        const body = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] });
        const d = await new Promise((resolve, reject) => {
          const req = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': cfg.get('ANTHROPIC_API_KEY'), 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 }, res => {
            let data = ''; res.on('data', c => data += c); res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode }); } });
          }); req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); }); req.write(body); req.end();
        });
        return d.status === 200 ? { ok: true, message: 'Claude connected' } : { ok: false, error: d.data && d.data.error ? d.data.error.message : 'Auth failed' };
      }
      if (service === 'discord') {
        if (!cfg.get('DISCORD_WEBHOOK_URL')) return { ok: false, error: 'Not configured' };
        const r = await discordPost(cfg.get('DISCORD_WEBHOOK_URL'), { content: '✅ CyanFin connection test' });
        return r.status === 204 || r.status === 200 ? { ok: true, message: 'Discord webhook active' } : { ok: false, error: 'Webhook error ' + r.status };
      }
      return { ok: false, error: 'Unknown service: ' + service };
    } catch(e) { return { ok: false, error: e.message }; }
  }

  return null;
}

module.exports = { handleIntegrations };
