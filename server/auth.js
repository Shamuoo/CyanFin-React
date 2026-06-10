'use strict';
const crypto = require('crypto');

const sessions = new Map(); // token -> session object
const SESSION_FILE = (() => {
  const path = require('path');
  return process.env.CONFIG_PATH
    ? path.join(path.dirname(process.env.CONFIG_PATH), 'sessions.json')
    : path.join(__dirname, '../data/sessions.json');
})();

// ── Persist sessions to disk ──────────────────────────────────────────────────
function saveSessions() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(SESSION_FILE);
    if (!require('fs').existsSync(dir)) require('fs').mkdirSync(dir, { recursive: true });
    const obj = {};
    for (const [k, v] of sessions.entries()) obj[k] = v;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(obj, null, 2));
  } catch(e) { console.warn('[auth] Could not save sessions:', e.message); }
}

function loadSessions() {
  try {
    const fs = require('fs');
    if (!fs.existsSync(SESSION_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    for (const [k, v] of Object.entries(obj)) sessions.set(k, v);
    console.log(`[auth] Loaded ${sessions.size} sessions`);
  } catch(e) { console.warn('[auth] Could not load sessions:', e.message); }
}

loadSessions();

// ── Session operations ────────────────────────────────────────────────────────
function createSession(data) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...data, createdAt: Date.now() });
  saveSessions();
  return token;
}

function getSession(token) {
  return sessions.get(token) || null;
}

function deleteSession(token) {
  sessions.delete(token);
  saveSessions();
}

function getAllSessions() {
  return [...sessions.values()];
}

function getSessionFromRequest(req) {
  // Check Authorization header
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const session = sessions.get(token);
    if (session) return session;
  }
  // Check cookie
  const cookie = (req.headers.cookie || '').split(';')
    .find(c => c.trim().startsWith('cfsid='));
  if (cookie) {
    const token = cookie.trim().slice(6);
    return sessions.get(token) || null;
  }
  return null;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `cfsid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 30}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'cfsid=; Path=/; HttpOnly; Max-Age=0');
}

// Re-auth all sessions against a new server on failover
async function reAuthAll(targetServerId) {
  const cfg = require('./config');
  const jfMod = require('./jellyfin');
  const sm = require('./serverManager');
  const servers = sm.getJellyfinServers();
  const target = servers.find(s => s.id === targetServerId);
  if (!target) return 0;
  let count = 0;
  for (const session of sessions.values()) {
    if (!session.username || !session._password) continue;
    if (session.tokens && session.tokens[targetServerId]) continue;
    try {
      const savedUrl = jfMod.getBaseUrl();
      jfMod.init(target.url, target.apiKey || '');
      const result = await jfMod.authenticate(session.username, session._password);
      jfMod.init(savedUrl, cfg.get('JELLYFIN_API_KEY') || '');
      if (result && result.AccessToken) {
        if (!session.tokens) session.tokens = {};
        session.tokens[targetServerId] = result.AccessToken;
        count++;
      }
    } catch {}
  }
  if (count) saveSessions();
  return count;
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  getAllSessions,
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  reAuthAll,
};
