'use strict';
const http = require('http');
const https = require('https');
const cfg = require('./config');
const jf = require('./jellyfin');

const CHECK_MS = 30_000;
const PRIMARY_BIAS_MS = 75; // prefer primary if within 75ms

let state = {
  active: 'primary',
  primary: { ok: true, latency: null },
  backup: { ok: false, latency: null },
  plex: { ok: false, latency: null },
  lastCheck: 0,
};
let _interval = null;

async function pingUrl(url) {
  if (!url) return { ok: false, latency: null };
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const parsed = new URL(url.replace(/\/$/, '') + '/health');
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'GET',
        timeout: 5000,
      }, res => {
        const latency = Date.now() - start;
        res.resume();
        resolve({ ok: res.statusCode < 500, latency });
      });
      req.on('error', () => resolve({ ok: false, latency: null }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null }); });
      req.end();
    } catch(e) { resolve({ ok: false, latency: null }); }
  });
}

async function pingPlex(url, token) {
  if (!url || !token) return { ok: false, latency: null };
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const parsed = new URL(url.replace(/\/$/, '') + '/identity');
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'GET',
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' },
        timeout: 5000,
      }, res => {
        const latency = Date.now() - start;
        res.resume();
        resolve({ ok: res.statusCode < 400, latency });
      });
      req.on('error', () => resolve({ ok: false, latency: null }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null }); });
      req.end();
    } catch(e) { resolve({ ok: false, latency: null }); }
  });
}

async function checkAll() {
  const primaryUrl = cfg.get('JELLYFIN_URL');
  const backupUrl = cfg.get('JELLYFIN_BACKUP_URL');
  const plexUrl = cfg.get('PLEX_URL');
  const plexToken = cfg.get('PLEX_TOKEN');

  const [p, b, px] = await Promise.all([
    pingUrl(primaryUrl),
    pingUrl(backupUrl),
    pingPlex(plexUrl, plexToken),
  ]);

  state.primary = p;
  state.backup = b;
  state.plex = px;
  state.lastCheck = Date.now();

  const mode = cfg.get('JELLYFIN_MODE') || 'fastest';

  if (mode === 'primary') {
    state.active = p.ok ? 'primary' : (b.ok ? 'backup' : 'primary');
  } else if (mode === 'backup') {
    state.active = b.ok ? 'backup' : (p.ok ? 'primary' : 'primary');
  } else {
    // fastest — pick lowest latency with bias toward primary
    if (!p.ok && !b.ok) { /* keep current */ }
    else if (!p.ok) state.active = 'backup';
    else if (!b.ok) state.active = 'primary';
    else {
      const pAdj = (p.latency || 9999) + PRIMARY_BIAS_MS;
      state.active = (b.latency || 9999) < pAdj ? 'backup' : 'primary';
    }
  }

  // Re-init Jellyfin with active URL
  const activeUrl = state.active === 'backup' && backupUrl ? backupUrl : primaryUrl;
  const activeKey = state.active === 'backup' ? (cfg.get('JELLYFIN_BACKUP_API_KEY') || '') : '';
  jf.init(activeUrl, activeKey);

  const pStr = p.ok ? `${p.latency}ms` : 'DOWN';
  const bStr = backupUrl ? (b.ok ? `${b.latency}ms` : 'DOWN') : 'none';
  console.log(`[servers] primary=${pStr} backup=${bStr} active=${state.active}`);

  return state;
}

function start() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  const backupUrl = cfg.get('JELLYFIN_BACKUP_URL');
  const primaryUrl = cfg.get('JELLYFIN_URL');

  if (!primaryUrl) {
    console.log('[servers] No Jellyfin URL configured');
    return;
  }

  if (backupUrl || cfg.get('PLEX_URL')) {
    checkAll();
    _interval = setInterval(checkAll, CHECK_MS);
    console.log('[servers] Multi-server mode — checking every 30s');
  } else {
    jf.init(primaryUrl, cfg.get('JELLYFIN_API_KEY') || '');
    state.primary.ok = true;
    state.active = 'primary';
    console.log('[servers] Single server mode');
  }
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function getStatus() {
  return {
    active: state.active,
    mode: cfg.get('JELLYFIN_MODE') || 'fastest',
    primary: { url: cfg.get('JELLYFIN_URL'), ...state.primary },
    backup: cfg.get('JELLYFIN_BACKUP_URL') ? { url: cfg.get('JELLYFIN_BACKUP_URL'), ...state.backup } : null,
    plex: cfg.get('PLEX_URL') ? { url: cfg.get('PLEX_URL'), ...state.plex } : null,
    lastCheck: state.lastCheck,
  };
}

function forceSwitch(server) {
  if (server !== 'primary' && server !== 'backup') return;
  state.active = server;
  const url = server === 'backup' ? cfg.get('JELLYFIN_BACKUP_URL') : cfg.get('JELLYFIN_URL');
  const key = server === 'backup' ? cfg.get('JELLYFIN_BACKUP_API_KEY') : cfg.get('JELLYFIN_API_KEY');
  if (url) jf.init(url, key || '');
  console.log('[servers] Manually switched to', server);
}

module.exports = { start, stop, checkAll, getStatus, forceSwitch };
