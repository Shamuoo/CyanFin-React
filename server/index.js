const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const jf = require('./jellyfin');
const sm = require('./serverManager');
const cfg = require('./config');
const auth = require('./auth');
const tmdb = require('./tmdb');
const { handleApi } = require('./routes/api');
const { handleLibrary, handleLibraryPost } = require('./routes/library');
const { handleIntegrations } = require('./routes/integrations');
const { handleStats } = require('./routes/stats');
const { handleAI } = require('./routes/ai');

const PORT = parseInt(process.env.PORT || '3000');
cfg.loadConfig();
const JELLYFIN_URL = (cfg.get('JELLYFIN_URL') || '').replace(/\/$/, '');
const JELLYFIN_API_KEY = cfg.get('JELLYFIN_API_KEY') || '';
const TMDB_API_KEY = cfg.get('TMDB_API_KEY') || '';
const VERSION = '0.12.3';

if (!JELLYFIN_URL) console.warn('[warn] JELLYFIN_URL not set');

jf.init(JELLYFIN_URL, JELLYFIN_API_KEY);
tmdb.init(TMDB_API_KEY);

const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { resolve({}); } });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// AI autofix via Anthropic API
async function aiAutofix(itemId, token) {
  const item = await jf.get(`/Items/${itemId}?fields=Overview,Taglines,Genres,OfficialRating,ProductionYear,People`, token);
  const prompt = `You are a movie database assistant. Fix and improve this movie metadata. Respond ONLY with valid JSON, no markdown.

Movie: "${item.Name}" (${item.ProductionYear || 'year unknown'})
Current overview: ${item.Overview || 'MISSING'}
Current tagline: ${(item.Taglines||[])[0] || 'MISSING'}
Genres: ${(item.Genres||[]).join(', ') || 'MISSING'}
Rating: ${item.OfficialRating || 'MISSING'}

Return JSON: {"overview":"engaging 2-3 sentence overview","tagline":"short memorable tagline","issues":["issue1"],"confidence":0.9}`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 512, messages: [{ role: 'user', content: prompt }] });
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    if (!anthropicKey) return resolve({ success: false, error: 'ANTHROPIC_API_KEY not set in environment' });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type':'application/json', 'anthropic-version':'2023-06-01', 'x-api-key': anthropicKey, 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          const text = (r.content && r.content[0] && r.content[0].text) || '{}';
          resolve({ success: true, suggestion: JSON.parse(text.replace(/```json|```/g,'').trim()) });
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('AI timeout')); });
    req.write(body); req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── AUTH ──

  // Server status / failover
  if (pathname === '/api/servers/status') {
    return json(res, sm.getStatus());
  }
  if (pathname === '/api/servers/switch' && req.method === 'POST') {
    const body2 = await readBody(req);
    sm.forceServer(body2.server);
    // Re-init jellyfin with new active URL
    jf.init(sm.getActiveUrl(), '');
    return json(res, sm.getStatus());
  }
  if (pathname === '/api/servers/check') {
    const status = await sm.checkBoth();
    jf.init(sm.getActiveUrl(), '');
    return json(res, sm.getStatus());
  }

  // Quick Connect - generate a code for TV/remote login
  if (pathname === '/api/auth/quick-connect/initiate' && req.method === 'POST') {
    try {
      const result = await jf.get('/QuickConnect/Initiate', null);
      return json(res, { code: result.Code, secret: result.Secret });
    } catch(e) { return json(res, { error: e.message }, 500); }
  }

  // Quick Connect - check if authorized
  if (pathname === '/api/auth/quick-connect/check') {
    const secret = parsed.query.secret;
    if (!secret) return json(res, { authorized: false });
    try {
      const result = await jf.get(`/QuickConnect/Connect?Secret=${secret}`, null);
      if (result.Authenticated) {
        // Exchange for a full token
        const tokenResult = await jf.post('/Users/AuthenticateWithQuickConnect', { Secret: secret }, null);
        if (tokenResult && tokenResult.AccessToken) {
          const sessionData = {
            token: tokenResult.AccessToken,
            userId: tokenResult.User.Id,
            username: tokenResult.User.Name,
            isAdmin: tokenResult.User.Policy && tokenResult.User.Policy.IsAdministrator,
          };
          const sessionId = auth.createSession(sessionData);
          auth.setSessionCookie(res, sessionId);
          return json(res, { authorized: true, user: { id: tokenResult.User.Id, name: tokenResult.User.Name } });
        }
      }
      return json(res, { authorized: false });
    } catch(e) { return json(res, { authorized: false, error: e.message }); }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.username || !body.password) return json(res, { error: 'Username and password required' }, 400);
    try {
      const result = await jf.authenticate(body.username, body.password);
      if (result.status !== 200 || !result.data.AccessToken) return json(res, { error: 'Invalid credentials' }, 401);
      const user = result.data.User;
      const sessionId = auth.createSession(user.Id, result.data.AccessToken, user.Name, user.Policy && user.Policy.IsAdministrator);
      auth.setSessionCookie(res, sessionId);
      return json(res, { success: true, user: { id: user.Id, name: user.Name, isAdmin: user.Policy && user.Policy.IsAdministrator } });
    } catch(e) { return json(res, { error: e.message }, 500); }
  }

  if (pathname === '/api/auth/logout') {
    const session = auth.getSessionFromRequest(req);
    if (session) auth.deleteSession(auth.parseCookies(req.headers.cookie).cf_session);
    auth.clearSessionCookie(res);
    return json(res, { success: true });
  }

  if (pathname === '/api/auth/me') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Not logged in' }, 401);
    return json(res, { id: session.userId, name: session.username, isAdmin: session.isAdmin });
  }

  // ── PUBLIC ASSETS ──
  const publicPaths = ['/', '/login', '/player'];
  // Serve any static file that actually exists on disk
  const staticExts = ['.js','.css','.ico','.png','.jpg','.svg','.woff','.woff2','.ttf','.webp','.map']
  const isAsset = pathname.startsWith('/assets/') || pathname.startsWith('/css/') || pathname.startsWith('/js/') || staticExts.some(e => pathname.endsWith(e));

  if (isAsset) {
    const filePath = path.join(PUBLIC_DIR, pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
      res.end(data);
    });
    return;
  }


  // ── SUBTITLE PROXY ──
  if (pathname === '/proxy/subtitle') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const itemId = parsed.query.id;
    const index = parsed.query.index;
    const subUrl = `${require('./config').get('JELLYFIN_URL') || JELLYFIN_URL}/Videos/${itemId}/${itemId}/Subtitles/${index}/Stream.vtt?api_key=${session.token}`;
    try {
      const parsed2 = new (require('url').URL)(subUrl);
      const lib = parsed2.protocol === 'https:' ? require('https') : require('http');
      const proxyReq = lib.request(subUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': 'text/vtt',
          'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => { res.writeHead(500); res.end(); });
      proxyReq.end();
    } catch(e) { res.writeHead(500); res.end(); }
    return;
  }

  // ── IMAGE PROXY ──
  if (pathname === '/proxy/image') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const itemId = parsed.query.id;
    const type = parsed.query.type || 'Primary';
    const maxWidth = parsed.query.w || '600';
    const imgUrl = `${JELLYFIN_URL}/Items/${itemId}/Images/${type}?maxWidth=${maxWidth}&api_key=${session.token}`;
    await jf.proxyImage(imgUrl, res);
    return;
  }

  // ── DIRECT STREAM PROXY (fallback) ──
  if (pathname === '/proxy/direct') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const itemId = parsed.query.id;
    const directUrl = jf.directUrl(itemId, session.token);
    res.writeHead(302, { 'Location': directUrl });
    res.end();
    return;
  }

  // ── STREAM PROXY (HLS pass-through) ──
  if (pathname === '/proxy/stream') {
    const session = auth.getSessionFromRequest(req);
    if (!session) { res.writeHead(401); res.end(); return; }
    const itemId = parsed.query.id;
    const streamUrl = jf.streamUrl(itemId, session.token);
    res.writeHead(302, { 'Location': streamUrl });
    res.end();
    return;
  }

  // ── CONFIG SAVE ──
  if (pathname === '/api/config/save' && req.method === 'POST') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Not logged in' }, 401);
    const body = await readBody(req);
    const result = cfg.saveConfig(body);
    if (result.success) {
      // Re-init jellyfin and tmdb with new config
      const newJfUrl = (cfg.get('JELLYFIN_URL') || '').replace(/\/$/, '');
      jf.init(newJfUrl, cfg.get('JELLYFIN_API_KEY') || '');
      const newTmdb = cfg.get('TMDB_API_KEY') || '';
      tmdb.init(newTmdb);
      console.log('[config] Saved and reloaded:', result.saved.join(', '));
    }
    return json(res, result);
  }

  // ── CONFIG READ (public fields only) ──
  if (pathname === '/api/config/public') {
    return json(res, cfg.getPublicConfig());
  }

  // ── CLIENT CONFIG ──
  if (pathname === '/api/config') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, { jellyfinUrl: cfg.get('JELLYFIN_URL') || JELLYFIN_URL, version: VERSION, ...cfg.getPublicConfig() });
  }

  // ── STREAM URL (returns actual Jellyfin URL for HLS.js) ──
  if (pathname === '/api/stream-url') {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);
    const itemId = parsed.query.id;
    if (!itemId) return json(res, { error: 'No id' }, 400);
    return json(res, { url: jf.streamUrl(itemId, session.token), directUrl: jf.directUrl(itemId, session.token) });
  }

  // ── REQUIRE AUTH FOR API ──
  if (pathname.startsWith('/api/')) {
    const session = auth.getSessionFromRequest(req);
    if (!session) return json(res, { error: 'Unauthorized' }, 401);

    // AI autofix
    if (pathname === '/api/library/ai-autofix' && req.method === 'POST') {
      const body = await readBody(req);
      try { return json(res, await aiAutofix(body.itemId, session.token)); }
      catch(e) { return json(res, { error: e.message }, 500); }
    }

    // Library POST
    if (pathname.startsWith('/api/library/') && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const result = await handleLibraryPost(pathname, body, session);
        if (result) return json(res, result);
      } catch(e) { return json(res, { error: e.message }, 500); }
    }

    // Library GET
    if (pathname.startsWith('/api/library/')) {
      try {
        const result = await handleLibrary(pathname, parsed.query, session, req);
        if (result !== null) return json(res, result);
      } catch(e) { return json(res, { error: e.message }, 500); }
    }

    // AI Navigator
    if (pathname.startsWith('/api/ai/')) {
      const body = await readBody(req);
      try {
        const result = await handleAI(pathname, body, session);
        if (result !== null) return json(res, result);
      } catch(e) { return json(res, { error: e.message }, 500); }
    }

    // Integrations
    if (pathname.startsWith('/api/integrations/')) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      try {
        const result = await handleIntegrations(pathname, parsed.query, body, session);
        if (result !== null) return json(res, result);
      } catch(e) { return json(res, { error: e.message }, 500); }
    }

    // Stats
    if (pathname.startsWith('/api/stats/')) {
      try {
        const result = await handleStats(pathname, parsed.query, session);
        if (result !== null) return json(res, result);
      } catch(e) { return json(res, { error: e.message }, 500); }
    }

    // General API
    try {
      const result = await handleApi(pathname, parsed.query, session);
      if (result !== null && result !== undefined) return json(res, result);
      return json(res, null);
    } catch(e) {
      console.error(`[error] ${pathname}:`, e.message);
      return json(res, { error: e.message }, 500);
    }
  }

  // ── SPA SHELL (serve index.html for all non-asset routes) ──
  fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); res.end('Server error'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎬 CyanFin v${VERSION}`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Jellyfin: ${JELLYFIN_URL || '(not set)'}`);
  console.log(`   TMDB: ${TMDB_API_KEY ? 'enabled' : 'disabled'}\n`);
  sm.start();
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
