'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const watchParty = require('./watchParty');
const cluster   = require('./cluster');
const path = require('path');
const url = require('url');

const cfg = require('./config');
const auth = require('./auth');
const jf = require('./jellyfin');
const sm = require('./serverManager');
const tmdb = require('./tmdb');

const { handleBrowse } = require('./routes/browse');
const { handleItems } = require('./routes/items');
const { handleStats } = require('./routes/stats');
const { handleLibrary, handleLibraryPost } = require('./routes/library');
const { handleIntegrations } = require('./routes/integrations');
const { handleAI } = require('./routes/ai');

// ── Init ─────────────────────────────────────────────────────────────────────
cfg.loadConfig();
tmdb.init(cfg.get('TMDB_API_KEY'));

const PORT = parseInt(process.env.PORT || '3000');
const VERSION = '0.20.2';
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.json':  'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico':   'image/x-icon',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.svg':   'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
  '.mp4':   'video/mp4',
  '.webp':  'image/webp',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : {});
      } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────
async function handler(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Config export (backup) ─────────────────────────────────────────────────
  if (pathname === '/api/config/export' && req.method === 'GET') {
    const session = auth.getSessionFromRequest(req);
    if (!session || !session.isAdmin) { res.writeHead(403); res.end(); return; }
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    if (!fs.existsSync(configPath)) { res.writeHead(404); res.end(); return; }
    const data = fs.readFileSync(configPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cyanfin-config-backup-${new Date().toISOString().slice(0,10)}.json"`,
    });
    res.end(data);
    return;
  }

  // ── Config import (restore) ──────────────────────────────────────────────────
  if (pathname === '/api/config/import' && req.method === 'POST') {
    const session = auth.getSessionFromRequest(req);
    if (!session || !session.isAdmin) { res.writeHead(403); res.end(); return; }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const data = Buffer.concat(chunks);
        const parsed = JSON.parse(data.toString());
        if (!parsed || typeof parsed !== 'object') { json(res, { error: 'Invalid config' }, 400); return; }
        const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
        fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2));
        cfg.loadConfig();
        json(res, { ok: true });
      } catch(e) { json(res, { error: e.message }, 400); }
    });
    return;
  }

  // ── Background image upload ────────────────────────────────────────────────
  if (pathname === '/api/config/background' && req.method === 'POST') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const bgPath = path.join(path.dirname(configPath), 'bg.jpg');
    // Read raw body as buffer
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length > 20 * 1024 * 1024) { json(res, { error: 'File too large (max 20MB)' }, 400); return; }
      fs.writeFileSync(bgPath, buf);
      json(res, { ok: true, url: '/api/config/background' });
    });
    return;
  }

  // ── Background image delete ─────────────────────────────────────────────────
  if (pathname === '/api/config/background' && req.method === 'DELETE') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const bgPath = path.join(path.dirname(configPath), 'bg.jpg');
    try { fs.unlinkSync(bgPath); } catch {}
    return json(res, { ok: true });
  }

  // ── Background image serve ──────────────────────────────────────────────────
  if (pathname === '/api/config/background' && req.method === 'GET') {
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const bgPath = path.join(path.dirname(configPath), 'bg.jpg');
    if (!fs.existsSync(bgPath)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
    fs.createReadStream(bgPath).pipe(res);
    return;
  }

  // ── PUBLIC: manifest ──────────────────────────────────────────────────────
  if (pathname === '/manifest.json' || pathname === '/manifest.webmanifest') {
    const p = path.join(PUBLIC_DIR, 'manifest.json');
    if (fs.existsSync(p)) {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json' });
      fs.createReadStream(p).pipe(res);
    } else { res.writeHead(404); res.end(); }
    return;
  }

  // ── PUBLIC: server info (no auth needed) ─────────────────────────────────
  if (pathname === '/api/public/info') {
    return json(res, {
      version: VERSION,
      hasJellyfin: !!(cfg.get('JELLYFIN_URL') || cfg.get('JELLYFIN_SERVERS')),
      configured:  !!(cfg.get('JELLYFIN_URL') || cfg.get('JELLYFIN_SERVERS')),
      hasPlex: !!(cfg.get('PLEX_URL') && cfg.get('PLEX_TOKEN')),
      ...cfg.getPublic(),
    });
  }

  // ── PUBLIC: Jellyfin connection test ─────────────────────────────────────
  if (pathname === '/api/test/jellyfin') {
    const testUrl = parsed.query.url;
    if (!testUrl) return json(res, { ok: false, error: 'No URL provided' });
    try {
      const parsedTest = new URL(testUrl.replace(/\/$/, '') + '/System/Info/Public');
      const lib = parsedTest.protocol === 'https:' ? https : http;
      const result = await new Promise((resolve) => {
        const r = lib.request({ hostname: parsedTest.hostname, port: parsedTest.port, path: parsedTest.pathname, method: 'GET', timeout: 8000 },
          resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => { try { resolve({ ok: resp.statusCode < 400, data: JSON.parse(d) }); } catch { resolve({ ok: resp.statusCode < 400 }); } }); });
        r.on('error', e => resolve({ ok: false, error: e.message }));
        r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        r.end();
      });
      return json(res, { ok: result.ok, serverName: result.data?.ServerName, version: result.data?.Version, error: result.error });
    } catch(e) { return json(res, { ok: false, error: e.message }); }
  }

  // ── PUBLIC: Plex test ────────────────────────────────────────────────────
  if (pathname === '/api/test/plex') {
    const { url: plexUrl, token: plexToken } = parsed.query;
    if (!plexUrl || !plexToken) return json(res, { ok: false, error: 'URL and token required' });
    try {
      const parsedPlex = new URL(plexUrl.replace(/\/$/, '') + '/identity');
      const lib = parsedPlex.protocol === 'https:' ? https : http;
      const result = await new Promise(resolve => {
        const r = lib.request({ hostname: parsedPlex.hostname, port: parsedPlex.port, path: parsedPlex.pathname, method: 'GET', headers: { 'X-Plex-Token': plexToken, 'Accept': 'application/json' }, timeout: 8000 },
          resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve({ ok: resp.statusCode < 400 })); });
        r.on('error', e => resolve({ ok: false, error: e.message }));
        r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        r.end();
      });
      return json(res, result);
    } catch(e) { return json(res, { ok: false, error: e.message }); }
  }

  // ── Download management ────────────────────────────────────────────────────
  // Start a download — fetches the stream and saves to /data/downloads/
  if (pathname === '/api/downloads/start' && req.method === 'POST') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const body = await readBody(req);
    const { itemId, title } = body;
    if (!itemId) return json(res, { error: 'No itemId' }, 400);

    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const dlDir = path.join(path.dirname(configPath), 'downloads');
    if (!fs.existsSync(dlDir)) fs.mkdirSync(dlDir, { recursive: true });

    // Get playback info to find stream URL
    try {
      const info = await jf.post(`/Items/${itemId}/PlaybackInfo?userId=${session.userId}`, {
        DeviceProfile: { DirectPlayProfiles: [{ Type: 'Video', Container: 'mp4,mkv,avi,mov' }], TranscodingProfiles: [], SubtitleProfiles: [], ResponseProfiles: [], CodecProfiles: [], ContainerProfiles: [] }
      }, session.token);

      const source = info.MediaSources?.[0];
      if (!source) return json(res, { error: 'No media source found' }, 404);

      const streamUrl = `${jf.getBaseUrl()}/Videos/${itemId}/stream?api_key=${session.token}&Static=true&mediaSourceId=${source.Id}`;
      const safeName = (title || itemId).replace(/[^a-zA-Z0-9 ._-]/g, '_').trim();
      const ext = source.Container || 'mkv';
      const filename = `${safeName}.${ext}`;
      const filePath = path.join(dlDir, filename);

      // Track download state in memory
      const dlId = require('crypto').randomBytes(8).toString('hex');
      global._downloads = global._downloads || {};
      global._downloads[dlId] = { id: dlId, itemId, title: title || itemId, filename, status: 'downloading', progress: 0, size: 0, error: null };

      // Stream to disk in background
      const downloadFile = () => {
        const parsed = new URL(streamUrl);
        const lib = parsed.protocol === 'https:' ? https : http;
        const fileStream = fs.createWriteStream(filePath);
        const req2 = lib.request(streamUrl, { timeout: 0 }, res2 => {
          const total = parseInt(res2.headers['content-length'] || '0');
          let received = 0;
          res2.on('data', chunk => {
            received += chunk.length;
            if (total > 0) global._downloads[dlId].progress = Math.round((received / total) * 100);
            global._downloads[dlId].size = received;
          });
          res2.pipe(fileStream);
          fileStream.on('finish', () => { global._downloads[dlId].status = 'complete'; console.log(`[download] Complete: ${filename}`); });
        });
        req2.on('error', e => { global._downloads[dlId].status = 'error'; global._downloads[dlId].error = e.message; fs.unlinkSync(filePath); });
        req2.end();
      };
      setImmediate(downloadFile);

      return json(res, { id: dlId, filename, status: 'downloading' });
    } catch(e) { return json(res, { error: e.message }, 500); }
  }

  // ── List downloads ─────────────────────────────────────────────────────────
  if (pathname === '/api/downloads') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const dlDir = path.join(path.dirname(configPath), 'downloads');
    const active = Object.values(global._downloads || {});

    // List completed files
    let files = [];
    if (fs.existsSync(dlDir)) {
      files = fs.readdirSync(dlDir).map(f => {
        const fp = path.join(dlDir, f);
        const stat = fs.statSync(fp);
        return { filename: f, size: stat.size, modified: stat.mtimeMs };
      });
    }
    return json(res, { active, files });
  }

  // ── Delete download ────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/downloads/') && req.method === 'DELETE') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const filename = decodeURIComponent(pathname.replace('/api/downloads/', ''));
    if (filename.includes('..') || filename.includes('/')) return json(res, { error: 'Invalid filename' }, 400);
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const filePath = path.join(path.dirname(configPath), 'downloads', filename);
    try { fs.unlinkSync(filePath); } catch {}
    return json(res, { ok: true });
  }

  // ── Serve downloaded file ──────────────────────────────────────────────────
  if (pathname === '/proxy/download') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const filename = decodeURIComponent(parsed.query.file || '');
    if (!filename || filename.includes('..') || filename.includes('/')) { res.writeHead(400); res.end(); return; }
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
    const dlDir = path.join(path.dirname(configPath), 'downloads');
    const filePath = path.join(dlDir, filename);
    // Security: ensure file is inside downloads dir
    if (!filePath.startsWith(dlDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(filePath)) {
      console.log('[download] File not found:', filePath);
      res.writeHead(404); res.end('Not found'); return;
    }
    const stat = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = { '.mkv':'video/x-matroska', '.mp4':'video/mp4', '.avi':'video/x-msvideo', '.mov':'video/quicktime', '.webm':'video/webm', '.m4v':'video/mp4' };
    const mime = mimeMap[ext] || 'video/x-matroska';

    // Range request support (required for HTML5 video scrubbing)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${filename}"`,
      });
      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  // ── User profiles ─────────────────────────────────────────────────────────
  if (pathname === '/api/profiles') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    try {
      const users = await jf.get('/Users', session.token);
      return json(res, (Array.isArray(users) ? users : []).map(u => ({
        id: u.Id,
        name: u.Name,
        isAdmin: u.Policy?.IsAdministrator,
        avatarUrl: u.PrimaryImageTag ? `/proxy/image?id=${u.Id}&type=Primary&w=120` : null,
        hasPassword: u.HasPassword,
      })));
    } catch(e) { return json(res, []); }
  }

  // ── Switch profile (re-auth as different user) ─────────────────────────────
  if (pathname === '/api/profiles/switch' && req.method === 'POST') {
    const body = await readBody(req);
    const { username, password } = body;
    try {
      const currentUrl = cfg.get('JELLYFIN_URL') || (() => { try { return JSON.parse(cfg.get('JELLYFIN_SERVERS') || '[]')[0]?.url } catch { return null } })();
      if (!currentUrl) return json(res, { error: 'Not configured' }, 503);
      const result = await jf.authenticate(username, password);
      const [backupToken] = await Promise.all([
        sm.authenticateBackup(username, password),
      ]);
      const sessionId = auth.createSession({
        token: result.AccessToken,
        backupToken: backupToken || null,
        userId: result.User.Id,
        username: result.User.Name,
        isAdmin: result.User.Policy?.IsAdministrator,
      });
      auth.setSessionCookie(res, sessionId);
      return json(res, { user: { id: result.User.Id, name: result.User.Name, isAdmin: result.User.Policy?.IsAdministrator } });
    } catch(e) { return json(res, { error: e.message }, 401); }
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const currentUrl = cfg.get('JELLYFIN_URL') || (() => { try { return JSON.parse(cfg.get('JELLYFIN_SERVERS') || '[]')[0]?.url } catch { return null } })();
      if (!currentUrl) return json(res, { error: 'Jellyfin server not configured. Please complete setup first.' }, 503);
      if (currentUrl && !jf.getBaseUrl()) jf.init(currentUrl, cfg.get('JELLYFIN_API_KEY') || '');

      // Authenticate against primary server
      const result = await jf.authenticate(body.username, body.password);

      // Attempt auth against backup server in background (don't fail if unavailable)
      let backupToken = null;
      const backupUrl = cfg.get('JELLYFIN_BACKUP_URL');
      if (backupUrl) {
        try {
          const backupJf = require('./jellyfin');
          // Temporarily use backup URL
          const origUrl = backupJf.getBaseUrl();
          backupJf.init(backupUrl, cfg.get('JELLYFIN_BACKUP_API_KEY') || '');
          const backupResult = await backupJf.authenticate(body.username, body.password);
          backupToken = backupResult.AccessToken;
          backupJf.init(origUrl, cfg.get('JELLYFIN_API_KEY') || ''); // restore
          console.log('[auth] Pre-authenticated against backup server');
        } catch(e) {
          console.log('[auth] Backup server auth skipped:', e.message);
        }
      }

      const sessionId = auth.createSession({
        token: result.AccessToken,
        backupToken,
        userId: result.User.Id,
        username: result.User.Name,
        isAdmin: result.User.Policy?.IsAdministrator,
      });
      auth.setSessionCookie(res, sessionId);
      return json(res, { user: { id: result.User.Id, name: result.User.Name, isAdmin: result.User.Policy?.IsAdministrator } });
    } catch(e) { return json(res, { error: e.message }, 401); }
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const session = auth.getSessionFromRequest(req);
    if (session) {
      const cookie = req.headers.cookie || '';
      const match = cookie.match(/cf_session=([a-f0-9]{64})/);
      if (match) auth.deleteSession(match[1]);
    }
    auth.clearSessionCookie(res);
    return json(res, { ok: true });
  }

  if (pathname === '/api/auth/me') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Not logged in' }, 401);
    return json(res, { id: session.userId, name: session.username, isAdmin: session.isAdmin });
  }

  // Quick Connect
  if (pathname === '/api/auth/quick-connect/initiate' && req.method === 'POST') {
    try {
      const result = await jf.get('/QuickConnect/Initiate', '');
      return json(res, { code: result.Code, secret: result.Secret });
    } catch(e) { return json(res, { error: e.message }, 500); }
  }

  if (pathname === '/api/auth/quick-connect/check') {
    const secret = parsed.query.secret;
    if (!secret) return json(res, { authorized: false });
    try {
      const result = await jf.get(`/QuickConnect/Connect?Secret=${secret}`, '');
      if (result.Authenticated) {
        const tokenResult = await jf.post('/Users/AuthenticateWithQuickConnect', { Secret: secret }, '');
        if (tokenResult?.AccessToken) {
          const sessionId = auth.createSession({ token: tokenResult.AccessToken, userId: tokenResult.User.Id, username: tokenResult.User.Name });
          auth.setSessionCookie(res, sessionId);
          return json(res, { authorized: true, user: { id: tokenResult.User.Id, name: tokenResult.User.Name } });
        }
      }
      return json(res, { authorized: false });
    } catch(e) { return json(res, { authorized: false }); }
  }

  // ── CONFIG ────────────────────────────────────────────────────────────────
  if (pathname === '/api/config/save' && req.method === 'POST') {
    // Allow unauthenticated only during initial setup (no Jellyfin URL set)
    const isSetup = !cfg.get('JELLYFIN_URL') && !cfg.get('JELLYFIN_SERVERS');
    if (!isSetup) {
      const session = auth.getSessionFromRequest(req);
      if (!session) return json(res, { error: 'Not logged in' }, 401);
    }
    const body = await readBody(req);
    const result = cfg.saveConfig(body);
    if (result.success) {
      // Reinitialise Jellyfin client + HA manager with new config
      const newUrl = cfg.get('JELLYFIN_URL') || (() => { try { return JSON.parse(cfg.get('JELLYFIN_SERVERS') || '[]')[0]?.url } catch { return null } })()
      const newKey = cfg.get('JELLYFIN_API_KEY') || ''
      if (newUrl) { jf.init(newUrl, newKey); sm.stop(); sm.start(); }
      jf.init(cfg.get('JELLYFIN_URL'), cfg.get('JELLYFIN_API_KEY') || '');
      tmdb.init(cfg.get('TMDB_API_KEY'));
      sm.stop(); sm.start();
    }
    return json(res, result);
  }

  if (pathname === '/api/config') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    // Admins get full config (URLs visible), non-admins get masked version
    const data = session.isAdmin ? cfg.getAll() : cfg.getPublic();
    // Always mask actual secret values for safety, but keep URLs
    const safe = { ...data, version: VERSION };
    for (const [key, schema] of Object.entries(cfg.SCHEMA || {})) {
      if (schema.secret && safe[key] && safe[key] !== '') {
        safe[key] = '***';
      }
    }
    return json(res, safe);
  }

  // ── SERVER STATUS ─────────────────────────────────────────────────────────
  if (pathname === '/api/servers/status') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, sm.getStatus());
  }

  // servers switch/check handled below after body read

  // ── PROXY: images ─────────────────────────────────────────────────────────
  // Subtitle proxy — converts Jellyfin subtitles to WebVTT for <track> elements
  if (pathname === '/proxy/subtitles') {
    const itemId = parsed.query.id;
    const index  = parseInt(parsed.query.index||'0');
    const tok    = parsed.query.token || (session?.token) || '';
    if (!itemId || !tok) { res.writeHead(400); res.end(); return; }
    const cfg = require('./config');
    const jfUrl = cfg.get('JELLYFIN_URL');
    const subUrl = `${jfUrl}/Videos/${itemId}/${itemId}/Subtitles/${index}/Stream.vtt?api_key=${tok}`;
    const http2 = require('http'), https2 = require('https');
    const lib = subUrl.startsWith('https') ? https2 : http2;
    lib.get(subUrl, upstream => {
      res.writeHead(upstream.statusCode, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      upstream.pipe(res);
    }).on('error', () => { res.writeHead(500); res.end(); });
    return;
  }

  if (pathname === '/proxy/image') {
    const session = auth.getSessionFromRequest(req);
    const { id, type = 'Primary', w = '400' } = parsed.query;
    if (!id) { res.writeHead(400); res.end(); return; }
    // Use session token or fall back to API key - images should always load
    const token = session?.token || cfg.get('JELLYFIN_API_KEY') || '';
    if (!token) { res.writeHead(401); res.end(); return; }
    // Decode URL-encoded type (e.g. Backdrop%2F0 -> Backdrop/0)
    const decodedType = decodeURIComponent(type);
    await jf.proxyImage(res, id, decodedType, parseInt(w), token);
    return;
  }

  // ── PROXY: subtitles ──────────────────────────────────────────────────────
  if (pathname === '/proxy/subtitle') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const { id, index } = parsed.query;
    const subUrl = `${jf.getBaseUrl()}/Videos/${id}/${id}/Subtitles/${index}/Stream.vtt?api_key=${session.token}`;
    try {
      const parsedSub = new URL(subUrl);
      const lib = parsedSub.protocol === 'https:' ? https : http;
      lib.request(subUrl, proxyRes => {
        res.writeHead(proxyRes.statusCode || 200, { 'Content-Type': 'text/vtt', 'Access-Control-Allow-Origin': '*' });
        proxyRes.pipe(res);
      }).on('error', () => { res.writeHead(500); res.end(); }).end();
    } catch(e) { res.writeHead(500); res.end(); }
    return;
  }

  // ── PROXY: trickplay BIF (Jellyfin trickplay sprite) ────────────────────────
  if (pathname === '/proxy/trickplay') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const { id, width = '320', index = '0' } = parsed.query;
    if (!id) { res.writeHead(400); res.end(); return; }
    const bifUrl = `${jf.getBaseUrl()}/Videos/${id}/Trickplay/${width}/${index}.jpg?api_key=${session.token}`;
    try {
      const parsedBif = new URL(bifUrl);
      const lib = parsedBif.protocol === 'https:' ? https : http;
      lib.request(bifUrl, proxyRes => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        });
        proxyRes.pipe(res);
      }).on('error', () => { res.writeHead(404); res.end(); }).end();
    } catch { res.writeHead(500); res.end(); }
    return;
  }

  // ── PROXY: plex images ──────────────────────────────────────────────────────
  if (pathname === '/proxy/plex-image') {
    // Plex images are public via token - no session check needed for images
    const { path: plexPath, w = '400', h = '600' } = parsed.query;
    const plexClient = require('./plexClient');
    await plexClient.proxyImage(res, plexPath, parseInt(w), parseInt(h));
    return;
  }

  // ── PROXY: plex stream (adds token, proxies stream) ──────────────────────
  if (pathname === '/proxy/plex-stream') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const plexBase = cfg.get('PLEX_URL') || '';
    const plexTok  = cfg.get('PLEX_TOKEN') || '';
    const streamPath = parsed.query.path || '';
    if (!plexBase || !streamPath) { res.writeHead(400); res.end(); return; }
    const fullUrl = `${plexBase}${streamPath}?X-Plex-Token=${plexTok}`;
    try {
      const parsedUrl = new URL(fullUrl);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      lib.request(fullUrl, { headers: { 'X-Plex-Token': plexTok } }, proxyRes => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res);
      }).on('error', () => { res.writeHead(502); res.end(); }).end();
    } catch(e) { res.writeHead(500); res.end(); }
    return;
  }

  // ── AUTHENTICATED API ROUTES ──────────────────────────────────────────────
  const session = auth.getSessionFromRequest(req);
  if (!session) {
    if (pathname.startsWith('/api/')) return json(res, { error: 'Not logged in' }, 401);
  } else {
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      body = await readBody(req);
    }
    req._body = body;

    try {
      // Browse (library listing)
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/library/') && !pathname.startsWith('/api/stats/') && !pathname.startsWith('/api/integrations/') && !pathname.startsWith('/api/ai/') && !pathname.startsWith('/api/items/') && !pathname.startsWith('/api/playback') && !pathname.startsWith('/api/user/') && !pathname.startsWith('/api/servers/')) {
        const browseResult = await handleBrowse(pathname, parsed.query, session);
        if (browseResult !== null) return json(res, browseResult);
      }

      // Items (detail, playback, user actions)
      const itemsResult = await handleItems(pathname, parsed.query, session, req);
      if (itemsResult !== null) return json(res, itemsResult);

      // Stats
      if (pathname.startsWith('/api/stats/') || pathname === '/api/health' || pathname === '/api/system-stats' || pathname === '/api/weather' || pathname.startsWith('/api/servers/') || pathname.startsWith('/api/cluster/') || pathname === '/api/active-sessions' || pathname === '/api/changelog' || pathname.startsWith('/api/admin/') || pathname.startsWith('/api/cache/') || pathname.startsWith('/api/push/') || pathname.startsWith('/api/party/') || pathname.startsWith('/api/trakt/') || pathname.startsWith('/api/scheduled-tasks') || pathname === '/api/tasks' || pathname.match(/^\/api\/tasks\//)) {
        const statsResult = await handleStats(pathname, parsed.query, session);
        if (statsResult !== null) return json(res, statsResult);
      }

      // Library tools
      if (pathname.startsWith('/api/library/')) {
        if (req.method === 'POST') {
          const libResult = await handleLibraryPost(pathname, body, session);
          if (libResult !== null) return json(res, libResult);
        } else {
          const libResult = await handleLibrary(pathname, parsed.query, session, req);
          if (libResult !== null) return json(res, libResult);
        }
      }

      // AI Navigator
      if (pathname.startsWith('/api/ai/')) {
        const aiResult = await handleAI(pathname, body, session);
        if (aiResult !== null) return json(res, aiResult);
      }

      // Match item on another server (for failover resume)
      if (pathname === '/api/servers/match') {
        const { itemId, targetServer } = body;
        if (!itemId) return json(res, { matchId: null });
        const matchId = await sm.getMatchingItemId(itemId, targetServer || 'backup');
        return json(res, { matchId });
      }

      // Servers switch / check
      // ── Jellyfin webhook receiver ─────────────────────────────────────────────────
  // Configure in Jellyfin → Dashboard → Plugins → Webhook → Add → URL = http://your-ip:3002/webhook
  if (pathname === '/webhook' && req.method === 'POST') {
    try {
      const event = req._body || {};
      const type = event.NotificationType || event.Event || '';
      console.log('[webhook]', type, event.ItemName || '');
      const cache = require('./cache');

      // React to different event types
      if (type.includes('ItemAdded') || type.includes('library')) {
        // Bust home caches so new items appear
        cache.bustPattern(/^(recent|pop|best|trending)/);
        console.log('[webhook] Cache busted for new library item');
      }
      if (type.includes('PlaybackStart')) {
        cache.bustPattern(/^active/);
      }
      if (type.includes('RefreshComplete') || type.includes('ScanComplete')) {
        cache.bustPattern(/.*/); // full cache bust after scan
        console.log('[webhook] Full cache bust after scan complete');
      }
      // Future: push notification trigger would go here
      return { ok: true, received: type };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Cluster API ───────────────────────────────────────────────────────────────
      if (pathname === '/api/cluster/stats') {
        return cluster.getClusterStats();
      }

      if (pathname === '/api/cluster/roles' && req.method === 'POST') {
        const { serverId, role } = req._body || {};
        if (!serverId || !role) return { error: 'serverId and role required' };
        cluster.setRole(serverId, role);
        return { ok: true, serverId, role };
      }

      if (pathname === '/api/cluster/scan' && req.method === 'POST') {
        const { serverId } = req._body || {};
        const server = sm.getJellyfinServers().find(s => s.id === serverId) || sm.getJellyfinServers()[0];
        if (!server) return { error: 'No server available' };
        const job = cluster.triggerScan(server.id);
        return { ok: true, jobId: job.id };
      }

      if (pathname === '/api/cluster/pretranscode' && req.method === 'POST') {
        const { serverId, itemId, maxBitrate } = req._body || {};
        const job = cluster.pretranscode(serverId, itemId, userId, token, maxBitrate);
        return { ok: true, jobId: job.id };
      }

      if (pathname === '/api/cluster/metadata' && req.method === 'POST') {
        const { serverId, itemIds } = req._body || {};
        const job = cluster.triggerMetadata(serverId, itemIds);
        return { ok: true, jobId: job.id };
      }

      if (pathname === '/api/cluster/route' && req.method === 'POST') {
        // Choose best server for a given playback request
        const { itemId, maxBitrate, requiresTranscode } = req._body || {};
        const server = await cluster.routePlayback(itemId, maxBitrate, requiresTranscode);
        if (!server) return { serverId: null, url: null };
        return { serverId: server.id, name: server.name, url: server.url };
      }

      if (pathname === '/api/cluster/jobs') {
        return { jobs: cluster.getJobs().slice(-50) };
      }

      // ── Cross-server item matching ─────────────────────────────────────────────
      if (pathname === '/api/servers/match-item' && req.method === 'POST') {
        const { itemId } = req._body || {};
        if (!itemId) return { error: 'No itemId' };
        const results = await sm.matchItemAllServers(itemId);
        return { matches: results };
      }

      // ── HA Server Management API ─────────────────────────────────────────────────
      if (pathname === '/api/servers/status') {
        return sm.getStatus();
      }

      if (pathname === '/api/servers/check') {
        return sm.checkAll();
      }

      if (pathname === '/api/servers/speedtest') {
        return sm.runSpeedTests();
      }

      if (pathname === '/api/servers/ping' && req.method === 'POST') {
        const { url, apiKey, token } = req._body || {};
        if (!url) return { error: 'No URL' };
        const s = { id: 'test', name: 'Test', url, apiKey: apiKey || '', token, priority: 0, enabled: true };
        const pinged = await sm.pingServer(s);
        const speeded = pinged.ok ? await sm.speedTestServer(pinged) : pinged;
        return speeded;
      }

      if (pathname === '/api/servers/save' && req.method === 'POST') {
        const { jellyfin, plex } = req._body || {};
        sm.saveServers(jellyfin, plex);
        await sm.checkAll();
        return sm.getStatus();
      }

      if (pathname === '/api/servers/mode' && req.method === 'POST') {
        const { mode } = req._body || {};
        return sm.setMode(mode);
      }

      if (pathname === '/api/servers/force' && req.method === 'POST') {
        const { serverId } = req._body || {};
        return sm.forceActive(serverId);
      }

      if (pathname === '/api/servers/switch' && req.method === 'POST') {
        sm.forceSwitch(body.server);
        return json(res, sm.getStatus());
      }
      if (pathname === '/api/servers/check') {
        await sm.checkAll();
        return json(res, sm.getStatus());
      }

      // Integrations
      if (pathname.startsWith('/api/integrations/')) {
        const intResult = await handleIntegrations(pathname, parsed.query, body, session);
        if (intResult !== null) return json(res, intResult);
      }
    } catch(e) {
      console.error(`[error] ${pathname}:`, e.message);
      return json(res, { error: e.message }, e.status || 500);
    }
  }

  // ── STATIC FILES ──────────────────────────────────────────────────────────
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/proxy/')) {
    // Try to serve static file
    const safePath = path.normalize(pathname).replace(/^(\.\.\/)+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA fallback — serve index.html with injected config
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      let html = fs.readFileSync(indexPath, 'utf8');
      const backupUrl = cfg.get('CYANFIN_BACKUP_URL');
      if (backupUrl) html = html.replace('</head>', `<meta name="cf-backup" content="${backupUrl}"></head>`);
      res.end(html);
    } else {
      res.writeHead(500); res.end('Server not built. Run npm run build.');
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
}

// ── Start ─────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handler(req, res).catch(e => {
    console.error('[fatal]', e);
    if (!res.headersSent) { res.writeHead(500); res.end('Internal server error'); }
  });
});

server.listen(PORT, () => {
  console.log(`\n🎬 CyanFin v${VERSION}`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Jellyfin: ${cfg.get('JELLYFIN_URL') || '(not configured)'}`);
  console.log(`   TMDB: ${cfg.get('TMDB_API_KEY') ? 'enabled' : 'disabled'}\n`);
  sm.start();
  watchParty.start(server);
});

process.on('SIGTERM', () => { sm.stop(); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { sm.stop(); server.close(() => process.exit(0)); });
