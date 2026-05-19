'use strict';
/**
 * CyanFin Server Manager v0.16.1
 * Multi-server failover: Jellyfin primary + backup + Plex
 * Exposes getActiveToken(session) for seamless failover without re-login
 */
const http  = require('http');
const https = require('https');
const cfg   = require('./config');
const jf    = require('./jellyfin');

const CHECK_MS     = 30_000;
const PRIMARY_BIAS = 75;
const PING_TIMEOUT = 6000;

let state = {
  active:    'primary',   // 'primary' | 'backup'
  source:    'jellyfin',  // 'jellyfin' | 'plex'
  primary:   { ok: false, latency: null, name: null, version: null, wasOk: undefined },
  backup:    { ok: false, latency: null, name: null, version: null, wasOk: undefined },
  plex:      { ok: false, latency: null },
  isOffline: false,
  lastCheck: 0,
};
let _interval = null;

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const t = new URL(url);
      const lib = t.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: t.hostname,
        port: t.port || (t.protocol === 'https:' ? 443 : 80),
        path: t.pathname + t.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        timeout: PING_TIMEOUT,
      }, res => {
        const latency = Date.now() - start;
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ ok: res.statusCode < 400, latency, data: JSON.parse(d) }); }
          catch { resolve({ ok: res.statusCode < 400, latency, data: null }); }
        });
      });
      req.on('error', () => resolve({ ok: false, latency: null }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null }); });
      req.end();
    } catch { resolve({ ok: false, latency: null }); }
  });
}

function pingJellyfin(url) {
  if (!url) return Promise.resolve({ ok: false, latency: null });
  return httpGet(url.replace(/\/$/, '') + '/System/Info/Public')
    .then(r => ({ ok: r.ok, latency: r.latency, name: r.data?.ServerName, version: r.data?.Version }));
}

function pingPlex(url, token) {
  if (!url || !token) return Promise.resolve({ ok: false, latency: null });
  return httpGet(url.replace(/\/$/, '') + '/identity', { 'X-Plex-Token': token })
    .then(r => ({ ok: r.ok, latency: r.latency }));
}

// ── Discord alerting ──────────────────────────────────────────────────────────
function alertDiscord(message) {
  const webhookUrl = cfg.get('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) return;
  try {
    const body = JSON.stringify({ content: `**CyanFin** ${message}`, username: 'CyanFin' });
    const parsed = new URL(webhookUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 5000,
    }, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch(e) {}
}

// ── Auth against backup server (called during login) ─────────────────────────
async function authenticateBackup(username, password) {
  const backupUrl = cfg.get('JELLYFIN_BACKUP_URL');
  if (!backupUrl) return null;
  try {
    // Temporarily swap jf base URL to backup
    const savedUrl = jf.getBaseUrl();
    jf.init(backupUrl, cfg.get('JELLYFIN_BACKUP_API_KEY') || '');
    const result = await jf.authenticate(username, password);
    jf.init(savedUrl, cfg.get('JELLYFIN_API_KEY') || ''); // restore
    return result?.AccessToken || null;
  } catch(e) {
    console.log('[servers] Backup auth failed (non-fatal):', e.message);
    return null;
  }
}

// ── Get the right token for the current active server ────────────────────────
function getActiveToken(session) {
  if (!session) return '';
  if (state.active === 'backup' && session.backupToken) return session.backupToken;
  return session.token || '';
}

// ── Check all servers ─────────────────────────────────────────────────────────
async function checkAll() {
  const primaryUrl = cfg.get('JELLYFIN_URL');
  const backupUrl  = cfg.get('JELLYFIN_BACKUP_URL');
  const plexUrl    = cfg.get('PLEX_URL');
  const plexToken  = cfg.get('PLEX_TOKEN');

  const [p, b, px] = await Promise.all([
    pingJellyfin(primaryUrl),
    pingJellyfin(backupUrl),
    pingPlex(plexUrl, plexToken),
  ]);

  // Discord alerts on state changes
  if (p.ok !== state.primary.wasOk && state.primary.wasOk !== undefined) {
    alertDiscord(p.ok
      ? '✅ **Jellyfin Primary** is back online'
      : '🔴 **Jellyfin Primary** is unreachable — switching to backup/Plex');
  }
  if (b.ok !== state.backup.wasOk && state.backup.wasOk !== undefined && backupUrl) {
    alertDiscord(b.ok ? '✅ **Jellyfin Backup** is back online' : '🟡 **Jellyfin Backup** is unreachable');
  }

  state.primary = { ...state.primary, ...p, wasOk: p.ok };
  state.backup  = { ...state.backup,  ...b, wasOk: b.ok };
  state.plex    = { ...state.plex,    ...px };
  state.lastCheck = Date.now();

  // Pick active Jellyfin server
  const mode = cfg.get('JELLYFIN_MODE') || 'fastest';
  const prev = state.active;
  const prevSource = state.source;

  if (mode === 'primary') {
    state.active = p.ok ? 'primary' : (b.ok ? 'backup' : 'primary');
  } else if (mode === 'backup') {
    state.active = b.ok ? 'backup' : (p.ok ? 'primary' : 'primary');
  } else {
    if (!p.ok && !b.ok) { /* keep */ }
    else if (!p.ok) state.active = 'backup';
    else if (!b.ok) state.active = 'primary';
    else state.active = ((b.latency||9999) < (p.latency||9999) + PRIMARY_BIAS) ? 'backup' : 'primary';
  }

  // Pick content source
  const jellyfinOk = (state.active === 'primary' && p.ok) || (state.active === 'backup' && b.ok);
  state.source   = jellyfinOk ? 'jellyfin' : (px.ok ? 'plex' : 'jellyfin');
  state.isOffline = !p.ok && !b.ok && !px.ok;

  // Re-init Jellyfin client
  const activeUrl = state.active === 'backup' && backupUrl ? backupUrl : primaryUrl;
  const activeKey = state.active === 'backup'
    ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '')
    : (cfg.get('JELLYFIN_API_KEY') || '');
  if (activeUrl) jf.init(activeUrl, activeKey);

  const pStr  = p.ok  ? `${p.latency}ms` : 'DOWN';
  const bStr  = backupUrl ? (b.ok ? `${b.latency}ms` : 'DOWN') : 'none';
  const pxStr = plexUrl   ? (px.ok ? `${px.latency}ms` : 'DOWN') : 'none';
  const changed = (prev !== state.active || prevSource !== state.source)
    ? ` ⚡ ${state.source.toUpperCase()}:${state.active}` : '';
  console.log(`[servers] jf-primary=${pStr} jf-backup=${bStr} plex=${pxStr}${changed}${state.isOffline ? ' ⚠ OFFLINE' : ''}`);
  return state;
}

// ── Start / Stop ──────────────────────────────────────────────────────────────
function start() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  const primaryUrl = cfg.get('JELLYFIN_URL');
  const plexUrl    = cfg.get('PLEX_URL');
  if (!primaryUrl && !plexUrl) { console.log('[servers] No servers configured'); return; }
  if (primaryUrl) jf.init(primaryUrl, cfg.get('JELLYFIN_API_KEY') || '');
  checkAll().then(() => {
    _interval = setInterval(checkAll, CHECK_MS);
    console.log(`[servers] Monitoring every ${CHECK_MS/1000}s`);
  });
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function getStatus() {
  return {
    active:    state.active,
    source:    state.source,
    isOffline: state.isOffline,
    mode:      cfg.get('JELLYFIN_MODE') || 'fastest',
    primary:   cfg.get('JELLYFIN_URL')        ? { url: cfg.get('JELLYFIN_URL'),        ...state.primary } : null,
    backup:    cfg.get('JELLYFIN_BACKUP_URL') ? { url: cfg.get('JELLYFIN_BACKUP_URL'), ...state.backup  } : null,
    plex:      cfg.get('PLEX_URL')            ? { url: cfg.get('PLEX_URL'),             ...state.plex   } : null,
    lastCheck: state.lastCheck,
  };
}

function forceSwitch(server) {
  if (server === 'plex') { state.source = 'plex'; console.log('[servers] → Plex'); return getStatus(); }
  if (server !== 'primary' && server !== 'backup') return getStatus();
  state.active = server; state.source = 'jellyfin';
  const url = server === 'backup' ? cfg.get('JELLYFIN_BACKUP_URL') : cfg.get('JELLYFIN_URL');
  const key = server === 'backup'
    ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '')
    : (cfg.get('JELLYFIN_API_KEY') || '');
  if (url) jf.init(url, key);
  console.log(`[servers] → ${server}`);
  return getStatus();
}

function isPlexFallback() { return state.source === 'plex'; }
function isOffline() { return state.isOffline; }

// Match item on another server by IMDB/TMDB ID
async function findMatchOnServer(targetUrl, targetKey, providerIds) {
  const imdbId = providerIds?.Imdb;
  const tmdbId = providerIds?.Tmdb;
  if (!targetUrl || (!imdbId && !tmdbId)) return null;
  try {
    const q = imdbId ? `imdb.${imdbId}` : `tmdb.${tmdbId}`;
    const r = await httpGet(`${targetUrl}/Items?AnyProviderIdEquals=${encodeURIComponent(q)}&Recursive=true&Limit=1&api_key=${targetKey}`);
    return r.data?.Items?.[0]?.Id || null;
  } catch { return null; }
}


// Find equivalent item on target server using IMDB/TMDB IDs
async function getMatchingItemId(itemId, targetServer) {
  const jf = require('./jellyfin');
  const currentKey = state.active === 'primary'
    ? cfg.get('JELLYFIN_API_KEY') : (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY'));

  try {
    // Get provider IDs from current item
    const data = await new Promise((resolve, reject) => {
      const url = `${jf.getBaseUrl()}/Items/${itemId}?fields=ProviderIds&api_key=${currentKey}`;
      httpGet(url).then(r => resolve(r.data)).catch(reject);
    });
    if (!data?.ProviderIds) return null;

    const targetUrl = targetServer === 'backup' ? cfg.get('JELLYFIN_BACKUP_URL') : cfg.get('JELLYFIN_URL');
    const targetKey = targetServer === 'backup'
      ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY'))
      : cfg.get('JELLYFIN_API_KEY');

    return await findMatchOnServer(targetUrl, targetKey, data.ProviderIds);
  } catch { return null; }
}

// ── Multi-server management ────────────────────────────────────────────────────
// Reads JELLYFIN_SERVERS / PLEX_SERVERS as JSON arrays
// Each entry: { id, name, url, apiKey, priority, enabled }

function getJellyfinServers() {
  try {
    const raw = cfg.get('JELLYFIN_SERVERS');
    if (raw) return JSON.parse(raw);
  } catch {}
  // Fall back to legacy single-server config
  const servers = [];
  const url = cfg.get('JELLYFIN_URL');
  const key = cfg.get('JELLYFIN_API_KEY');
  if (url) servers.push({ id: 'primary', name: 'Primary', url, apiKey: key || '', priority: 1, enabled: true });
  const bUrl = cfg.get('JELLYFIN_BACKUP_URL');
  const bKey = cfg.get('JELLYFIN_BACKUP_API_KEY') || key || '';
  if (bUrl) servers.push({ id: 'backup', name: 'Backup', url: bUrl, apiKey: bKey, priority: 2, enabled: true });
  return servers;
}

function getPlexServers() {
  try {
    const raw = cfg.get('PLEX_SERVERS');
    if (raw) return JSON.parse(raw);
  } catch {}
  const url = cfg.get('PLEX_URL');
  const token = cfg.get('PLEX_TOKEN');
  if (!url || !token) return [];
  return [{ id: 'plex-primary', name: 'Plex', url, token, priority: 1, enabled: true }];
}

// Ping a server and return latency
async function pingServer(server) {
  const start = Date.now();
  try {
    const isJf = !!server.apiKey;
    const testUrl = isJf
      ? `${server.url}/System/Info/Public`
      : `${server.url}/identity`;
    const headers = isJf ? {} : { 'X-Plex-Token': server.token, Accept: 'application/json' };
    const result = await httpGet(testUrl, headers);
    return { ...server, ok: result.ok, latency: Date.now() - start, data: result.data };
  } catch {
    return { ...server, ok: false, latency: null };
  }
}

// Speed test: fetch a small chunk of content from server
async function speedTestServer(server) {
  if (!server.ok || !server.url) return { ...server, speedMbps: null };
  return new Promise(resolve => {
    try {
      const testUrl = server.apiKey
        ? `${server.url}/System/Info/Public`
        : `${server.url}/identity`;
      const start = Date.now();
      let bytes = 0;
      const t = new URL(testUrl);
      const lib = t.protocol === 'https:' ? require('https') : require('http');
      const req = lib.request(testUrl, { headers: server.token ? { 'X-Plex-Token': server.token } : {}, timeout: 5000 }, res => {
        res.on('data', chunk => { bytes += chunk.length; });
        res.on('end', () => {
          const ms = Date.now() - start;
          const speedMbps = ms > 0 ? parseFloat(((bytes * 8) / (ms / 1000) / 1_000_000).toFixed(2)) : null;
          resolve({ ...server, speedMbps });
        });
      });
      req.on('error', () => resolve({ ...server, speedMbps: null }));
      req.on('timeout', () => { req.destroy(); resolve({ ...server, speedMbps: null }); });
      req.end();
    } catch { resolve({ ...server, speedMbps: null }); }
  });
}

// Check all servers and rank by latency
async function checkAllServers() {
  const jfServers = getJellyfinServers().filter(s => s.enabled);
  const plexServers = getPlexServers().filter(s => s.enabled);

  const [jfResults, plexResults] = await Promise.all([
    Promise.all(jfServers.map(pingServer)),
    Promise.all(plexServers.map(pingServer)),
  ]);

  // Sort by latency (fastest first, offline last)
  const sortBySpeed = arr => [...arr].sort((a, b) => {
    if (!a.ok && !b.ok) return 0;
    if (!a.ok) return 1;
    if (!b.ok) return -1;
    return (a.latency || 9999) - (b.latency || 9999);
  });

  const rankedJf = sortBySpeed(jfResults);
  const rankedPlex = sortBySpeed(plexResults);

  // Set active Jellyfin to fastest online server
  const bestJf = rankedJf.find(s => s.ok);
  if (bestJf) {
    jf.init(bestJf.url, bestJf.apiKey || '');
    state.active = bestJf.id;
  }
  state.isOffline = !bestJf && rankedPlex.every(s => !s.ok);

  return { jellyfin: jfResults, plex: plexResults, bestJellyfin: bestJf?.id, timestamp: Date.now() };
}

module.exports.getJellyfinServers = getJellyfinServers;
module.exports.getPlexServers = getPlexServers;
module.exports.pingServer = pingServer;
module.exports.speedTestServer = speedTestServer;
module.exports.checkAllServers = checkAllServers;

module.exports = {
  start, stop, checkAll, getStatus, forceSwitch,
  getActiveToken, authenticateBackup,
  isPlexFallback, isOffline, findMatchOnServer, getMatchingItemId,
  pingJellyfin, pingPlex,
};
