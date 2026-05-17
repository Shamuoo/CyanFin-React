'use strict';
const http  = require('http');
const https = require('https');
const cfg   = require('./config');
const jf    = require('./jellyfin');

const CHECK_MS       = 30_000;
const PRIMARY_BIAS   = 75;   // ms advantage to primary
const PING_TIMEOUT   = 6000;

let state = {
  active:    'primary',   // 'primary' | 'backup' — which Jellyfin
  source:    'jellyfin',  // 'jellyfin' | 'plex'  — what content source
  primary:   { ok: false, latency: null, name: null, version: null },
  backup:    { ok: false, latency: null, name: null, version: null },
  plex:      { ok: false, latency: null },
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

async function pingJellyfin(url) {
  if (!url) return { ok: false, latency: null };
  const r = await httpGet(url.replace(/\/$/, '') + '/System/Info/Public');
  return { ok: r.ok, latency: r.latency, name: r.data?.ServerName, version: r.data?.Version };
}

async function pingPlex(url, token) {
  if (!url || !token) return { ok: false, latency: null };
  const r = await httpGet(url.replace(/\/$/, '') + '/identity', { 'X-Plex-Token': token });
  return { ok: r.ok, latency: r.latency };
}

// ── Check all servers and update state ────────────────────────────────────────
function alertDiscord(message) {
  const webhookUrl = cfg.get('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) return;
  try {
    const body = JSON.stringify({ content: `**CyanFin** ${message}`, username: 'CyanFin' });
    const parsed = new URL(webhookUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 5000 }, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
    console.log('[servers] Discord alert sent:', message);
  } catch(e) {}
}

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

  state.primary = { ...state.primary, ...p };
  state.backup  = { ...state.backup,  ...b };
  state.plex    = { ...state.plex,    ...px };
  state.lastCheck = Date.now();

  // ── Pick active Jellyfin server ────────────────────────────────────────────
  const mode = cfg.get('JELLYFIN_MODE') || 'fastest';
  if (mode === 'primary') {
    state.active = p.ok ? 'primary' : (b.ok ? 'backup' : 'primary');
  } else if (mode === 'backup') {
    state.active = b.ok ? 'backup' : (p.ok ? 'primary' : 'primary');
  } else {
    // fastest
    if (!p.ok && !b.ok)     { /* keep current */ }
    else if (!p.ok && b.ok) { state.active = 'backup'; }
    else if (p.ok && !b.ok) { state.active = 'primary'; }
    else {
      const pAdj = (p.latency || 9999) + PRIMARY_BIAS;
      state.active = (b.latency || 9999) < pAdj ? 'backup' : 'primary';
    }
  }

  // ── Pick content source (jellyfin or plex fallback) ────────────────────────
  const jellyfinOk = (state.active === 'primary' && p.ok) || (state.active === 'backup' && b.ok);
  const prevSource = state.source;
  state.source = jellyfinOk ? 'jellyfin' : (px.ok ? 'plex' : 'jellyfin');

  // Re-init Jellyfin client
  const activeUrl = state.active === 'backup' && backupUrl ? backupUrl : primaryUrl;
  const activeKey = state.active === 'backup'
    ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '')
    : (cfg.get('JELLYFIN_API_KEY') || '');
  if (activeUrl) jf.init(activeUrl, activeKey);

  const pStr  = p.ok  ? `${p.latency}ms` : 'DOWN';
  const bStr  = backupUrl ? (b.ok ? `${b.latency}ms` : 'DOWN') : 'none';
  const pxStr = plexUrl   ? (px.ok ? `${px.latency}ms` : 'DOWN') : 'none';
  const switched = prevSource !== state.source ? ` ⚡ SWITCHED TO ${state.source.toUpperCase()}` : '';

  // Discord webhook alerts on state changes
  const prevPrimaryOk = state.primary?.wasOk;
  if (p.ok !== prevPrimaryOk && prevPrimaryOk !== undefined) {
    alertDiscord(p.ok
      ? '✅ **Jellyfin Primary** is back online'
      : '🔴 **Jellyfin Primary** is unreachable — switching to backup/Plex'
    );
  }
  state.primary.wasOk = p.ok;
  console.log(`[servers] jf-primary=${pStr} jf-backup=${bStr} plex=${pxStr} active=${state.active} source=${state.source}${switched}`);

  return state;
}

// ── Start / Stop ──────────────────────────────────────────────────────────────
function start() {
  if (_interval) { clearInterval(_interval); _interval = null; }

  const primaryUrl = cfg.get('JELLYFIN_URL');
  const backupUrl  = cfg.get('JELLYFIN_BACKUP_URL');
  const plexUrl    = cfg.get('PLEX_URL');
  const plexToken  = cfg.get('PLEX_TOKEN');

  if (!primaryUrl && !plexUrl) {
    console.log('[servers] No servers configured');
    return;
  }

  // Always check all servers on start
  checkAll().then(() => {
    // Keep checking on interval — even single-server needs Plex failover monitoring
    _interval = setInterval(checkAll, CHECK_MS);
    const mode = backupUrl || plexUrl ? 'Multi-server' : 'Single-server';
    console.log(`[servers] ${mode} mode — checking every ${CHECK_MS / 1000}s`);
  });
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

// ── Public API ────────────────────────────────────────────────────────────────
function getStatus() {
  return {
    active:    state.active,
    source:    state.source,
    mode:      cfg.get('JELLYFIN_MODE') || 'fastest',
    primary:   cfg.get('JELLYFIN_URL')        ? { url: cfg.get('JELLYFIN_URL'),        ...state.primary } : null,
    backup:    cfg.get('JELLYFIN_BACKUP_URL') ? { url: cfg.get('JELLYFIN_BACKUP_URL'), ...state.backup  } : null,
    plex:      cfg.get('PLEX_URL')            ? { url: cfg.get('PLEX_URL'),             ...state.plex   } : null,
    lastCheck: state.lastCheck,
  };
}

function forceSwitch(server) {
  if (server === 'plex') {
    state.source = 'plex';
    console.log('[servers] Manually switched to Plex');
    return getStatus();
  }
  if (server !== 'primary' && server !== 'backup') return getStatus();
  state.active = server;
  state.source = 'jellyfin';
  const url = server === 'backup' ? cfg.get('JELLYFIN_BACKUP_URL') : cfg.get('JELLYFIN_URL');
  const key = server === 'backup'
    ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '')
    : (cfg.get('JELLYFIN_API_KEY') || '');
  if (url) jf.init(url, key);
  console.log(`[servers] Manually switched to ${server}`);
  return getStatus();
}

// Is Plex currently the active content source?
function isPlexFallback() {
  return state.source === 'plex';
}

// Find matching item on backup Jellyfin by provider ID
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

module.exports = {
  start, stop, checkAll, getStatus, forceSwitch,
  isPlexFallback, findMatchOnServer, pingJellyfin, pingPlex,
};
