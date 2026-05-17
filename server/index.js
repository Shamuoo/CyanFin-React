'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
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
const VERSION = '0.14.0';
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
      hasJellyfin: !!cfg.get('JELLYFIN_URL'),
      configured: !!cfg.get('JELLYFIN_URL'),
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

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = await jf.authenticate(body.username, body.password);
      const sessionId = auth.createSession({
        token: result.AccessToken,
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
    const isSetup = !cfg.get('JELLYFIN_URL');
    if (!isSetup) {
      const session = auth.getSessionFromRequest(req);
      if (!session) return json(res, { error: 'Not logged in' }, 401);
    }
    const body = await readBody(req);
    const result = cfg.saveConfig(body);
    if (result.success) {
      jf.init(cfg.get('JELLYFIN_URL'), cfg.get('JELLYFIN_API_KEY') || '');
      tmdb.init(cfg.get('TMDB_API_KEY'));
      sm.stop(); sm.start();
    }
    return json(res, result);
  }

  if (pathname === '/api/config') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, { version: VERSION, ...cfg.getPublic() });
  }

  // ── SERVER STATUS ─────────────────────────────────────────────────────────
  if (pathname === '/api/servers/status') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, sm.getStatus());
  }

  if (pathname === '/api/servers/switch' && req.method === 'POST') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const body = await readBody(req);
    sm.forceSwitch(body.server);
    return json(res, sm.getStatus());
  }

  if (pathname === '/api/servers/check') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    await sm.checkAll();
    return json(res, sm.getStatus());
  }

  // ── PROXY: images ─────────────────────────────────────────────────────────
  if (pathname === '/proxy/image') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const { id, type = 'Primary', w = '400' } = parsed.query;
    await jf.proxyImage(res, id, type, parseInt(w), session.token);
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
      if (pathname.startsWith('/api/stats/') || pathname === '/api/health') {
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

    // SPA fallback — serve index.html
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      fs.createReadStream(indexPath).pipe(res);
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
});

process.on('SIGTERM', () => { sm.stop(); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { sm.stop(); server.close(() => process.exit(0)); });
