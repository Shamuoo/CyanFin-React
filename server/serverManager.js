/**
 * CyanFin Server Manager
 * Manages primary and backup Jellyfin servers
 * Supports fastest-wins, primary-first, and manual modes
 */
const http = require('http')
const https = require('https')
const cfg = require('./config')
const plex = require('./plexClient')

let _state = {
  active: 'primary',
  plexOk: false,
  plexLatency: null,        // which server is currently active
  primaryOk: true,
  backupOk: false,
  primaryLatency: null,
  backupLatency: null,
  lastCheck: 0,
  checkInterval: null,
}

const CHECK_INTERVAL = 30_000 // 30s

function getServers() {
  const primary = (cfg.get('JELLYFIN_URL') || '').replace(/\/$/, '')
  const backup = (cfg.get('JELLYFIN_BACKUP_URL') || '').replace(/\/$/, '')
  return { primary, backup, hasBackup: !!backup }
}

async function pingServer(url) {
  if (!url) return { ok: false, latency: null }
  return new Promise(resolve => {
    const start = Date.now()
    const parsed = new URL(url + '/health')
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'GET',
      timeout: 5000,
    }, res => {
      const latency = Date.now() - start
      res.resume()
      resolve({ ok: res.statusCode < 500, latency })
    })
    req.on('error', () => resolve({ ok: false, latency: null }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null }) })
    req.end()
  })
}

async function checkBoth() {
  const { primary, backup, hasBackup } = getServers()
  const mode = cfg.get('JELLYFIN_MODE') || 'fastest'

  const plexUrl = cfg.get('PLEX_URL')
  const plexToken = cfg.get('PLEX_TOKEN')
  const [primaryResult, backupResult, plexResult] = await Promise.all([
    pingServer(primary),
    hasBackup ? pingServer(backup) : Promise.resolve({ ok: false, latency: null }),
    plexUrl ? plex.ping(plexUrl, plexToken) : Promise.resolve({ ok: false, latency: null }),
  ])

  _state.primaryOk = primaryResult.ok
  _state.backupOk = backupResult.ok
  _state.primaryLatency = primaryResult.latency
  _state.backupLatency = backupResult.latency
  _state.plexOk = plexResult.ok
  _state.plexLatency = plexResult.latency
  _state.lastCheck = Date.now()

  // Determine active server
  if (mode === 'primary') {
    _state.active = primaryResult.ok ? 'primary' : (backupResult.ok ? 'backup' : 'primary')
  } else if (mode === 'backup') {
    _state.active = backupResult.ok ? 'backup' : (primaryResult.ok ? 'primary' : 'primary')
  } else {
    // 'fastest' mode - pick whichever is faster and online
    if (!primaryResult.ok && !backupResult.ok) {
      // Both down - keep last active
    } else if (!primaryResult.ok) {
      _state.active = 'backup'
    } else if (!backupResult.ok) {
      _state.active = 'primary'
    } else {
      // Both ok - pick fastest (with 50ms bias towards primary for stability)
      const primaryAdj = (primaryResult.latency || 9999) + 50
      const backupAdj = backupResult.latency || 9999
      _state.active = backupAdj < primaryAdj ? 'backup' : 'primary'
    }
  }

  console.log(`[servers] primary=${primary} ${primaryResult.ok ? primaryResult.latency+'ms' : 'DOWN'} | backup=${hasBackup ? (backupResult.ok ? backupResult.latency+'ms' : 'DOWN') : 'none'} | active=${_state.active}`)
  return _state
}

function getActiveUrl() {
  const { primary, backup } = getServers()
  return _state.active === 'backup' && backup ? backup : primary
}

function getActiveToken(requestToken) {
  // If backup is active and has its own API key, prefer that
  // Otherwise use the request token (user's auth token works on both servers if synced)
  if (_state.active === 'backup') {
    const backupKey = cfg.get('JELLYFIN_BACKUP_API_KEY')
    if (backupKey) return backupKey
  }
  return requestToken
}

function getStatus() {
  const { primary, backup, hasBackup } = getServers()
  return {
    active: _state.active,
    mode: cfg.get('JELLYFIN_MODE') || 'fastest',
    primary: {
      url: primary,
      ok: _state.primaryOk,
      latency: _state.primaryLatency,
    },
    backup: hasBackup ? {
      url: backup,
      ok: _state.backupOk,
      latency: _state.backupLatency,
    } : null,
    plex: plexUrl ? { url: plexUrl, ok: _state.plexOk, latency: _state.plexLatency } : null,
    lastCheck: _state.lastCheck,
  }
}

function start() {
  const { hasBackup } = getServers()
  if (hasBackup) {
    checkBoth()
    _state.checkInterval = setInterval(checkBoth, CHECK_INTERVAL)
    console.log('[servers] Multi-server mode active, checking every 30s')
  } else {
    _state.active = 'primary'
    _state.primaryOk = true
    console.log('[servers] Single server mode')
  }
}

function stop() {
  if (_state.checkInterval) clearInterval(_state.checkInterval)
}

// Force switch
function forceServer(server) {
  if (server === 'primary' || server === 'backup') {
    _state.active = server
    console.log('[servers] Manually switched to', server)
  }
}

module.exports = { start, stop, getActiveUrl, getActiveToken, getStatus, checkBoth, forceServer }
