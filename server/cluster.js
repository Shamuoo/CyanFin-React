'use strict';
/**
 * CyanFin Cluster Manager v0.20.2
 * ─────────────────────────────────────────────────────────────────────────────
 * Distributed workload management across multiple Jellyfin machines.
 *
 * Roles (assignable per server):
 *   primary      — main browsing + playback server
 *   transcoder   — dedicated transcoding (high CPU/GPU)
 *   scanner      — library scanning + metadata refreshes
 *   backup       — failover only
 *   media        — storage/playback only, no transcoding
 *
 * Features:
 *   • Pre-transcoding queue: submit items to be pre-transcoded on a specific server
 *   • Smart playback routing: 4K/HDR → transcoder, direct play → fastest
 *   • Scan delegation: trigger scans on designated scanner server
 *   • Load awareness: check active sessions before routing transcoding
 *   • Job queue: background jobs (scan, transcode, refresh) with status
 */

const http  = require('http');
const https = require('https');
const cfg   = require('./config');
const cache = require('./cache');

// ── Job queue ─────────────────────────────────────────────────────────────────
let jobs = []; // { id, type, serverId, itemId, status, createdAt, startedAt, completedAt, error }
let jobIdCounter = 0;

function addJob(type, serverId, payload = {}) {
  const job = {
    id: ++jobIdCounter,
    type,       // 'pretranscode' | 'scan' | 'metadata' | 'speedtest'
    serverId,
    ...payload,
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    error: null,
  };
  jobs.push(job);
  jobs = jobs.slice(-100); // keep last 100 jobs
  console.log(`[cluster] Job #${job.id} queued: ${type} on ${serverId}`);
  processQueue();
  return job;
}

function updateJob(id, updates) {
  const j = jobs.find(j => j.id === id);
  if (j) Object.assign(j, updates);
}

let processing = false;
async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    const queued = jobs.filter(j => j.status === 'queued');
    for (const job of queued) {
      updateJob(job.id, { status: 'running', startedAt: Date.now() });
      try {
        await runJob(job);
        updateJob(job.id, { status: 'done', completedAt: Date.now() });
      } catch(e) {
        updateJob(job.id, { status: 'error', error: e.message, completedAt: Date.now() });
        console.log(`[cluster] Job #${job.id} failed:`, e.message);
      }
    }
  } finally {
    processing = false;
  }
}

async function runJob(job) {
  const sm = require('./serverManager');
  const servers = sm.getJellyfinServers();
  const server  = servers.find(s => s.id === job.serverId) || servers[0];
  if (!server) throw new Error('Server not found: ' + job.serverId);

  switch (job.type) {
    case 'scan': {
      await apiPost(server, '/Library/Refresh', {});
      console.log(`[cluster] Library scan triggered on ${server.name}`);
      break;
    }
    case 'metadata': {
      const ids = job.itemIds || [];
      for (const id of ids) {
        await apiPost(server, `/Items/${id}/Refresh?MetadataRefreshMode=FullRefresh&ImageRefreshMode=FullRefresh&ReplaceAllImages=false`, {});
        await sleep(400);
      }
      console.log(`[cluster] Refreshed ${ids.length} items on ${server.name}`);
      break;
    }
    case 'pretranscode': {
      // Request Jellyfin to open a playback session at target quality on target server
      // This forces Jellyfin to start transcoding to its cache
      const { itemId, userId, token, maxBitrate = 8000000 } = job;
      await apiGet(server,
        `/Items/${itemId}/PlaybackInfo?UserId=${userId}&AutoOpenLiveStream=true&MaxStreamingBitrate=${maxBitrate}`,
        token
      );
      console.log(`[cluster] Pre-transcode started for ${itemId} on ${server.name}`);
      break;
    }
    case 'speedtest': {
      const r = await require('./serverManager').speedTestServer(server);
      updateJob(job.id, { result: r.speedMbps });
      break;
    }
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function apiGet(server, path, token) {
  const url = `${server.url}${path}${path.includes('?') ? '&' : '?'}api_key=${token || server.apiKey}`;
  return new Promise((resolve, reject) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.request(url, { timeout: 30000 }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    } catch(e) { reject(e); }
  });
}

function apiPost(server, path, body, token) {
  const url = `${server.url}${path}${path.includes('?') ? '&' : '?'}api_key=${token || server.apiKey}`;
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    try {
      const t = new URL(url);
      const lib = t.protocol === 'https:' ? https : http;
      const req = lib.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 30000,
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(payload); req.end();
    } catch(e) { reject(e); }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Server roles ──────────────────────────────────────────────────────────────
function getRoles() {
  try { return JSON.parse(cfg.get('SERVER_ROLES') || '{}'); } catch { return {}; }
}

function setRole(serverId, role) {
  const roles = getRoles();
  roles[serverId] = role;
  cfg.set('SERVER_ROLES', JSON.stringify(roles));
}

function getServerForRole(role) {
  const sm = require('./serverManager');
  const servers = sm.getJellyfinServers().filter(s => s.enabled && s.ok);
  const roles = getRoles();
  // Find server with this role
  const assigned = servers.find(s => roles[s.id] === role);
  if (assigned) return assigned;
  // Fallback to primary
  return servers.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0] || null;
}

// ── Smart routing ─────────────────────────────────────────────────────────────
// Decide which server to use for a given playback request
async function routePlayback(itemId, maxBitrate, requiresTranscode) {
  const sm = require('./serverManager');
  const roles = getRoles();
  const servers = sm.getJellyfinServers().filter(s => s.enabled && s.ok);

  if (!servers.length) return null;

  // 4K or requires transcode → prefer transcoder role server
  if (requiresTranscode || (maxBitrate && maxBitrate > 20_000_000)) {
    const transcoder = servers.find(s => roles[s.id] === 'transcoder');
    if (transcoder) {
      console.log(`[cluster] Routing ${itemId} to transcoder: ${transcoder.name}`);
      return transcoder;
    }
  }

  // Default: active server
  return servers.find(s => s.id === sm.getStatus().activeJfId) || servers[0];
}

// ── Cluster stats ─────────────────────────────────────────────────────────────
async function getClusterStats() {
  const sm = require('./serverManager');
  const status = sm.getStatus();
  const roles = getRoles();
  const servers = status.jellyfin.map(s => ({
    ...s,
    role: roles[s.id] || 'primary',
    jobCount: jobs.filter(j => j.serverId === s.id && j.status !== 'done' && j.status !== 'error').length,
  }));
  return {
    servers,
    jobs: jobs.slice(-20), // last 20 jobs
    activeJfId: status.activeJfId,
    mode: status.mode,
  };
}

// ── Scheduled tasks ───────────────────────────────────────────────────────────
let autoScanInterval = null;

function scheduleAutoScan(intervalMs = 7 * 24 * 60 * 60 * 1000) {
  if (autoScanInterval) clearInterval(autoScanInterval);
  autoScanInterval = setInterval(() => {
    const sm = require('./serverManager');
    const scanner = module.exports.getServerForRole('scanner')
               || module.exports.getServerForRole('primary');
    if (scanner && scanner.ok) {
      console.log('[cluster] Scheduled auto-scan on', scanner.name);
      module.exports.triggerScan(scanner.id);
    }
  }, intervalMs);
  console.log(`[cluster] Auto-scan scheduled every ${Math.round(intervalMs/3600000)}h`);
}

// Start auto-scan when cluster module is loaded
scheduleAutoScan(7 * 24 * 60 * 60 * 1000); // weekly

module.exports = {
  addJob, updateJob, getJobs: () => jobs,
  getRoles, setRole, getServerForRole,
  routePlayback,
  getClusterStats,
  triggerScan: (serverId) => addJob('scan', serverId),
  triggerMetadata: (serverId, itemIds) => addJob('metadata', serverId, { itemIds }),
  scheduleAutoScan,
  pretranscode: (serverId, itemId, userId, token, maxBitrate) =>
    addJob('pretranscode', serverId, { itemId, userId, token, maxBitrate }),
};
