'use strict';
/**
 * CyanFin Server Manager v0.19.2
 * ─────────────────────────────────────────────────────────────────────────────
 * Full high-availability multi-server manager:
 *   • N Jellyfin servers (JSON array in JELLYFIN_SERVERS config key)
 *   • N Plex servers    (JSON array in PLEX_SERVERS config key)
 *   • Continuous health monitoring (ping every 20s)
 *   • Per-server speed tests (bandwidth Mbps)
 *   • Load-balancing modes: fastest | round-robin | primary-first | manual
 *   • Automatic failover with Discord alerts
 *   • Per-session token management for all servers
 *   • Cross-server item matching via IMDB/TMDB IDs
 */

const http  = require('http');
const https = require('https');
const cfg   = require('./config');
const jf    = require('./jellyfin');

const CHECK_MS     = 20_000;  // health check interval
const PING_TIMEOUT = 5_000;   // per-server ping timeout ms
const SPEED_BYTES  = 1024 * 512; // 512KB speed test target

// ── State ─────────────────────────────────────────────────────────────────────
const HISTORY_LEN = 30;
let latencyHistory = {}; // { [serverId]: number[] }

let state = {
  jellyfin: [],     // { id, name, url, apiKey, priority, enabled, ok, latency, speedMbps, version, lastCheck, consecutiveFails }
  plex: [],         // { id, name, url, token, priority, enabled, ok, latency, speedMbps, lastCheck }
  activeJfId: null, // currently active Jellyfin server id
  mode: 'fastest',  // 'fastest' | 'round-robin' | 'primary-first' | 'manual'
  rrIndex: 0,       // round-robin cursor
  isOffline: false,
  lastFullCheck: 0,
};
let _interval = null;

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url, headers = {}, timeoutMs = PING_TIMEOUT) {
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const t = new URL(url);
      const lib = t.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: t.hostname,
        port:     t.port || (t.protocol === 'https:' ? 443 : 80),
        path:     t.pathname + t.search,
        method:   'GET',
        headers:  { Accept: 'application/json', ...headers },
        timeout:  timeoutMs,
      }, res => {
        const latency = Date.now() - start;
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ ok: res.statusCode < 400, latency, data: JSON.parse(d), bytes: Buffer.byteLength(d) }); }
          catch { resolve({ ok: res.statusCode < 400, latency, data: null, bytes: d.length }); }
        });
      });
      req.on('error', () => resolve({ ok: false, latency: null, data: null, bytes: 0 }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null, data: null, bytes: 0 }); });
      req.end();
    } catch { resolve({ ok: false, latency: null, data: null, bytes: 0 }); }
  });
}

// ── Discord alert ─────────────────────────────────────────────────────────────
function alertDiscord(message) {
  const url = cfg.get('DISCORD_WEBHOOK_URL');
  if (!url) return;
  try {
    const body = JSON.stringify({ content: `**CyanFin HA** ${message}`, username: 'CyanFin' });
    const p = new URL(url);
    const lib = p.protocol === 'https:' ? https : http;
    const req = lib.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 4000 }, () => {});
    req.on('error', () => {}); req.write(body); req.end();
  } catch {}
}

// ── Parse server lists from config ────────────────────────────────────────────
function getJellyfinServers() {
  try {
    const raw = cfg.get('JELLYFIN_SERVERS');
    if (raw) {
      const servers = JSON.parse(raw);
      return servers.map((s, i) => ({
        id: s.id || `jf-${i}`, name: s.name || `Jellyfin ${i+1}`,
        url: s.url, apiKey: s.apiKey || s.api_key || '',
        priority: s.priority ?? i, enabled: s.enabled !== false,
      }));
    }
  } catch {}
  // Fall back to legacy single/dual config
  const servers = [];
  const url = cfg.get('JELLYFIN_URL'), key = cfg.get('JELLYFIN_API_KEY');
  if (url) servers.push({ id: 'jf-primary', name: 'Primary', url, apiKey: key || '', priority: 0, enabled: true });
  const bUrl = cfg.get('JELLYFIN_BACKUP_URL');
  if (bUrl) servers.push({ id: 'jf-backup', name: 'Backup', url: bUrl, apiKey: cfg.get('JELLYFIN_BACKUP_API_KEY') || key || '', priority: 1, enabled: true });
  return servers;
}

function getPlexServers() {
  try {
    const raw = cfg.get('PLEX_SERVERS');
    if (raw) {
      const servers = JSON.parse(raw);
      return servers.map((s, i) => ({
        id: s.id || `plex-${i}`, name: s.name || `Plex ${i+1}`,
        url: s.url, token: s.token,
        priority: s.priority ?? i, enabled: s.enabled !== false,
      }));
    }
  } catch {}
  const url = cfg.get('PLEX_URL'), token = cfg.get('PLEX_TOKEN');
  if (url && token) return [{ id: 'plex-primary', name: 'Plex', url, token, priority: 0, enabled: true }];
  return [];
}

// ── Ping a single server ──────────────────────────────────────────────────────
async function pingServer(server) {
  const isJf = !!server.apiKey;
  const url  = isJf
    ? `${server.url.replace(/\/$/, '')}/System/Info/Public`
    : `${server.url.replace(/\/$/, '')}/identity`;
  const hdrs = isJf ? {} : { 'X-Plex-Token': server.token, Accept: 'application/json' };
  const r = await httpGet(url, hdrs);
  return {
    ...server, ok: r.ok, latency: r.latency,
    version: r.data?.Version || r.data?.version || null,
    serverName: r.data?.ServerName || r.data?.friendlyName || server.name,
    lastCheck: Date.now(), consecutiveFails: r.ok ? 0 : ((server.consecutiveFails || 0) + 1),
  };
}

// ── Speed test: fetch /Items (Jellyfin) or large endpoint (Plex) ──────────────
async function speedTestServer(server) {
  if (!server.ok) return { ...server, speedMbps: 0 };
  return new Promise(resolve => {
    try {
      const url = server.apiKey
        ? `${server.url.replace(/\/$/, '')}/Items?Limit=50&Recursive=true&api_key=${server.apiKey}`
        : `${server.url.replace(/\/$/, '')}/library/sections`;
      const hdrs = server.token ? { 'X-Plex-Token': server.token } : {};
      const t = new URL(url);
      const lib = t.protocol === 'https:' ? https : http;
      const start = Date.now(); let bytes = 0;
      const req = lib.request(url, { headers: hdrs, timeout: 8000 }, res => {
        res.on('data', c => { bytes += c.length; });
        res.on('end', () => {
          const ms = Date.now() - start;
          const speedMbps = ms > 0 ? parseFloat(((bytes * 8) / (ms / 1000) / 1_000_000).toFixed(2)) : 0;
          resolve({ ...server, speedMbps });
        });
      });
      req.on('error', () => resolve({ ...server, speedMbps: 0 }));
      req.on('timeout', () => { req.destroy(); resolve({ ...server, speedMbps: 0 }); });
      req.end();
    } catch { resolve({ ...server, speedMbps: 0 }); }
  });
}

// ── Select best Jellyfin server based on mode ─────────────────────────────────
function selectActive(jfServers) {
  const mode = cfg.get('JELLYFIN_MODE') || state.mode || 'fastest';
  const online = jfServers.filter(s => s.enabled && s.ok);
  if (!online.length) return jfServers[0]?.id || null;

  if (mode === 'primary-first') {
    const sorted = [...online].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    return sorted[0].id;
  }
  if (mode === 'round-robin') {
    state.rrIndex = (state.rrIndex + 1) % online.length;
    return online[state.rrIndex].id;
  }
  if (mode === 'manual') {
    return state.activeJfId && online.find(s => s.id === state.activeJfId)
      ? state.activeJfId : online[0].id;
  }
  // 'fastest': lowest latency wins, with 50ms bias toward currently active (stability)
  const STABILITY_BIAS_MS = 50;
  return online.sort((a, b) => {
    const aLat = (a.latency || 9999) + (a.id === state.activeJfId ? 0 : STABILITY_BIAS_MS);
    const bLat = (b.latency || 9999) + (b.id === state.activeJfId ? 0 : STABILITY_BIAS_MS);
    return aLat - bLat;
  })[0].id;
}

// ── Full health check ─────────────────────────────────────────────────────────
async function checkAll() {
  const cfgJf   = getJellyfinServers().filter(s => s.enabled);
  const cfgPlex = getPlexServers().filter(s => s.enabled);

  // Merge with existing state to preserve speedMbps etc.
  const mergeState = (cfgList, stateList) => cfgList.map(s => ({
    ...(stateList.find(e => e.id === s.id) || {}), ...s,
  }));

  const [jfResults, plexResults] = await Promise.all([
    Promise.all(mergeState(cfgJf, state.jellyfin).map(pingServer)),
    Promise.all(mergeState(cfgPlex, state.plex).map(pingServer)),
  ]);

  // Discord alerts for new failures/recoveries
  [...jfResults, ...plexResults].forEach(s => {
    const prev = [...state.jellyfin, ...state.plex].find(e => e.id === s.id);
    if (prev?.ok === true  && !s.ok) alertDiscord(`🔴 **${s.name}** went offline`);
    if (prev?.ok === false && s.ok)  alertDiscord(`✅ **${s.name}** is back online`);
  });

  // Record latency history
  [...jfResults, ...plexResults].forEach(s => {
    if (!latencyHistory[s.id]) latencyHistory[s.id] = [];
    latencyHistory[s.id].push(s.latency || 0);
    if (latencyHistory[s.id].length > HISTORY_LEN) latencyHistory[s.id].shift();
  });

  state.jellyfin = jfResults;
  state.plex     = plexResults;

  const prevActive = state.activeJfId;
  state.activeJfId = selectActive(jfResults);
  state.isOffline  = jfResults.every(s => !s.ok) && plexResults.every(s => !s.ok);
  state.lastFullCheck = Date.now();

  // Update Jellyfin client to active server
  const activeJf = jfResults.find(s => s.id === state.activeJfId);
  if (activeJf) jf.init(activeJf.url, activeJf.apiKey || '');

  if (prevActive !== state.activeJfId) {
    console.log(`[HA] Switched Jellyfin → ${state.activeJfId} (${activeJf?.name})`);
    // Re-authenticate all sessions against new server
    try { require('./auth').reAuthAll(state.activeJfId).catch(() => {}); } catch {}
    // Emit event so auth layer can re-authenticate sessions against new server
    process.emit('cyanfin:server-switch', { from: prevActive, to: state.activeJfId, server: activeJf });
    alertDiscord(`⚡ Load-balanced to **${activeJf?.name}** (${activeJf?.latency}ms)`);
  }

  const summary = jfResults.map(s => `${s.name}:${s.ok ? s.latency+'ms' : 'DOWN'}`).join(' | ');
  console.log(`[HA] ${summary}${state.isOffline ? ' ⚠ ALL OFFLINE' : ''}`);
  return getStatus();
}

// ── Run speed tests on all servers ───────────────────────────────────────────
async function runSpeedTests() {
  const [jfSpeeds, plexSpeeds] = await Promise.all([
    Promise.all(state.jellyfin.map(speedTestServer)),
    Promise.all(state.plex.map(speedTestServer)),
  ]);
  state.jellyfin = state.jellyfin.map(s => ({ ...s, speedMbps: jfSpeeds.find(r => r.id === s.id)?.speedMbps ?? s.speedMbps }));
  state.plex     = state.plex.map(s => ({ ...s, speedMbps: plexSpeeds.find(r => r.id === s.id)?.speedMbps ?? s.speedMbps }));
  return getStatus();
}

// ── Public API ────────────────────────────────────────────────────────────────
function getStatus() {
  const mode = cfg.get('JELLYFIN_MODE') || state.mode || 'fastest';
  return {
    jellyfin:    state.jellyfin.map(s => ({ ...s, apiKey: undefined, isActive: s.id === state.activeJfId, latencyHistory: latencyHistory[s.id] || [] })),
    plex:        state.plex.map(s => ({ ...s, token: undefined, latencyHistory: latencyHistory[s.id] || [] })),
    activeJfId:  state.activeJfId,
    mode,
    isOffline:   state.isOffline,
    lastCheck:   state.lastFullCheck,
    uptime:      process.uptime(),
  };
}

function setMode(mode) {
  state.mode = mode;
  cfg.set('JELLYFIN_MODE', mode);
  console.log(`[HA] Mode → ${mode}`);
  return getStatus();
}

function forceActive(serverId) {
  const server = state.jellyfin.find(s => s.id === serverId);
  if (server) {
    state.activeJfId = serverId;
    state.mode = 'manual';
    cfg.set('JELLYFIN_MODE', 'manual');
    jf.init(server.url, server.apiKey || '');
    console.log(`[HA] Manual override → ${server.name}`);
    alertDiscord(`🔧 Manual override: active server → **${server.name}**`);
  }
  return getStatus();
}

function saveServers(jfServers, plexServers) {
  if (jfServers) cfg.set('JELLYFIN_SERVERS', JSON.stringify(jfServers));
  if (plexServers) cfg.set('PLEX_SERVERS', JSON.stringify(plexServers));
}

// Legacy compat: get active token for a session
function getActiveToken(session) {
  if (!session) return '';
  // Find token for active server
  const active = state.jellyfin.find(s => s.id === state.activeJfId);
  if (!active) return session.token || '';
  // Multi-server sessions store tokens keyed by server id
  if (session.tokens && session.tokens[active.id]) return session.tokens[active.id];
  // Legacy: backup token
  if (active.id === 'jf-backup' && session.backupToken) return session.backupToken;
  return session.token || '';
}

async function authenticateBackup(username, password) {
  const servers = getJellyfinServers().filter(s => s.enabled);
  const primaryId = servers[0]?.id;
  const backups = servers.slice(1);
  if (!backups.length) return {};
  const tokens = {};
  for (const srv of backups) {
    try {
      const savedUrl = jf.getBaseUrl();
      jf.init(srv.url, srv.apiKey || '');
      const result = await jf.authenticate(username, password);
      jf.init(savedUrl, cfg.get('JELLYFIN_API_KEY') || '');
      if (result?.AccessToken) tokens[srv.id] = result.AccessToken;
    } catch {}
  }
  return tokens;
}

function isPlexFallback() {
  return state.jellyfin.every(s => !s.ok) && state.plex.some(s => s.ok);
}

function isOffline() { return state.isOffline; }

function start() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  const jfServers = getJellyfinServers();
  if (!jfServers.length && !getPlexServers().length) {
    console.log('[HA] No servers configured');
    return;
  }
  // Init jellyfin client with first server
  const first = jfServers[0];
  if (first) jf.init(first.url, first.apiKey || '');

  checkAll().then(s => {
    _interval = setInterval(checkAll, CHECK_MS);
    console.log(`[HA] Monitoring ${jfServers.length} Jellyfin + ${getPlexServers().length} Plex servers every ${CHECK_MS/1000}s`);
    console.log(`[HA] Active: ${s.activeJfId} | Mode: ${s.mode}`);
  });
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

// Cross-server item match
async function getMatchingItemId(itemId, targetServerId) {
  try {
    const sourceKey = state.jellyfin.find(s => s.id === state.activeJfId)?.apiKey || cfg.get('JELLYFIN_API_KEY');
    const data = await httpGet(`${jf.getBaseUrl()}/Items/${itemId}?fields=ProviderIds&api_key=${sourceKey}`);
    const ids = data.data?.ProviderIds;
    if (!ids) return null;
    const target = state.jellyfin.find(s => s.id === targetServerId);
    if (!target) return null;
    const q = ids.Imdb ? `imdb.${ids.Imdb}` : ids.Tmdb ? `tmdb.${ids.Tmdb}` : null;
    if (!q) return null;
    const r = await httpGet(`${target.url}/Items?AnyProviderIdEquals=${encodeURIComponent(q)}&Recursive=true&Limit=1&api_key=${target.apiKey}`);
    return r.data?.Items?.[0]?.Id || null;
  } catch { return null; }
}

// ── Single export object ──────────────────────────────────────────────────────
module.exports = {
  start, stop, checkAll, runSpeedTests,
  getStatus, setMode, forceActive, saveServers,
  getJellyfinServers, getPlexServers,
  pingServer, speedTestServer,
  getActiveToken, authenticateBackup,
  isPlexFallback, isOffline,
  getMatchingItemId,
  // Legacy compat
  forceSwitch: (s) => forceActive(s),
  pingJellyfin: (url) => httpGet(url + '/System/Info/Public').then(r => ({ ok: r.ok, latency: r.latency, name: r.data?.ServerName, version: r.data?.Version })),
  pingPlex: (url, token) => httpGet(url + '/identity', { 'X-Plex-Token': token }).then(r => ({ ok: r.ok, latency: r.latency })),
  checkAllServers: checkAll,
};
