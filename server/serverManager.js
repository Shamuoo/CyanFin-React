'use strict';
const http = require('http');
const https = require('https');
const cfg = require('./config');
const jf = require('./jellyfin');

const CHECK_MS = 30_000;
const PRIMARY_BIAS_MS = 75;
const PING_TIMEOUT = 6000;

let state = {
  active: 'primary',
  primary: { ok: false, latency: null, name: null, version: null },
  backup:  { ok: false, latency: null, name: null, version: null },
  plex:    { ok: false, latency: null, name: null },
  lastCheck: 0,
};
let _interval = null;

function httpGet(url, headers = {}) {
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const target = new URL(url);
      const lib = target.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        timeout: PING_TIMEOUT,
      }, res => {
        const latency = Date.now() - start;
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ ok: res.statusCode < 400, latency, data: JSON.parse(data) }); }
          catch { resolve({ ok: res.statusCode < 400, latency, data: null }); }
        });
      });
      req.on('error', e => resolve({ ok: false, latency: null, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null, error: 'timeout' }); });
      req.end();
    } catch(e) { resolve({ ok: false, latency: null, error: e.message }); }
  });
}

async function pingJellyfin(url) {
  if (!url) return { ok: false, latency: null };
  // Use /System/Info/Public - works without auth, correct Jellyfin endpoint
  const r = await httpGet(url.replace(/\/$/, '') + '/System/Info/Public');
  return { ok: r.ok, latency: r.latency, name: r.data?.ServerName, version: r.data?.Version };
}

async function pingPlex(url, token) {
  if (!url || !token) return { ok: false, latency: null };
  const r = await httpGet(url.replace(/\/$/, '') + '/identity', { 'X-Plex-Token': token });
  return { ok: r.ok, latency: r.latency };
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

  const mode = cfg.get('JELLYFIN_MODE') || 'fastest';
  const prev = state.active;

  if (mode === 'primary') {
    state.active = p.ok ? 'primary' : (b.ok ? 'backup' : 'primary');
  } else if (mode === 'backup') {
    state.active = b.ok ? 'backup' : (p.ok ? 'primary' : 'primary');
  } else {
    if (!p.ok && !b.ok) { /* keep current */ }
    else if (!p.ok) state.active = 'backup';
    else if (!b.ok) state.active = 'primary';
    else state.active = ((b.latency||9999) < (p.latency||9999) + PRIMARY_BIAS_MS) ? 'backup' : 'primary';
  }

  // Re-init Jellyfin with active URL
  const activeUrl = (state.active === 'backup' && backupUrl) ? backupUrl : primaryUrl;
  const activeKey = state.active === 'backup'
    ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '')
    : (cfg.get('JELLYFIN_API_KEY') || '');
  if (activeUrl) jf.init(activeUrl, activeKey);

  const changed = prev !== state.active ? ' ← SWITCHED' : '';
  console.log(`[servers] primary=${p.ok ? p.latency+'ms' : 'DOWN'} backup=${backupUrl ? (b.ok ? b.latency+'ms' : 'DOWN') : 'none'} plex=${plexUrl ? (px.ok ? px.latency+'ms' : 'DOWN') : 'none'} active=${state.active}${changed}`);
  return state;
}

function start() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  const primaryUrl = cfg.get('JELLYFIN_URL');
  const backupUrl  = cfg.get('JELLYFIN_BACKUP_URL');
  const plexUrl    = cfg.get('PLEX_URL');

  if (!primaryUrl) { console.log('[servers] No Jellyfin URL configured'); return; }

  jf.init(primaryUrl, cfg.get('JELLYFIN_API_KEY') || '');

  if (backupUrl || plexUrl) {
    checkAll();
    _interval = setInterval(checkAll, CHECK_MS);
    console.log(`[servers] Multi-server mode — checking every ${CHECK_MS/1000}s`);
  } else {
    state.active = 'primary';
    pingJellyfin(primaryUrl).then(r => {
      Object.assign(state.primary, r);
      state.lastCheck = Date.now();
      console.log(`[servers] ${r.ok ? `Connected to ${r.name} v${r.version}` : 'Jellyfin unreachable'}`);
    });
  }
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function getStatus() {
  return {
    active: state.active,
    mode: cfg.get('JELLYFIN_MODE') || 'fastest',
    primary: cfg.get('JELLYFIN_URL')        ? { url: cfg.get('JELLYFIN_URL'),        ...state.primary } : null,
    backup:  cfg.get('JELLYFIN_BACKUP_URL') ? { url: cfg.get('JELLYFIN_BACKUP_URL'), ...state.backup  } : null,
    plex:    cfg.get('PLEX_URL')            ? { url: cfg.get('PLEX_URL'),             ...state.plex   } : null,
    lastCheck: state.lastCheck,
  };
}

function forceSwitch(server) {
  if (server !== 'primary' && server !== 'backup') return getStatus();
  state.active = server;
  const url = server === 'backup' ? cfg.get('JELLYFIN_BACKUP_URL') : cfg.get('JELLYFIN_URL');
  const key = server === 'backup'
    ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '')
    : (cfg.get('JELLYFIN_API_KEY') || '');
  if (url) jf.init(url, key);
  console.log(`[servers] Manually switched to ${server}`);
  return getStatus();
}

// Find matching item on another Jellyfin server by IMDB/TMDB ID
async function findMatchOnServer(targetUrl, targetKey, providerIds) {
  const imdbId = providerIds?.Imdb;
  const tmdbId = providerIds?.Tmdb;
  if (!targetUrl || (!imdbId && !tmdbId)) return null;
  try {
    const q = imdbId ? `imdb.${imdbId}` : `tmdb.${tmdbId}`;
    const r = await httpGet(`${targetUrl}/Items?AnyProviderIdEquals=${q}&Recursive=true&Limit=1&api_key=${targetKey}`);
    return r.data?.Items?.[0]?.Id || null;
  } catch { return null; }
}

module.exports = { start, stop, checkAll, getStatus, forceSwitch, findMatchOnServer, pingJellyfin, pingPlex };
