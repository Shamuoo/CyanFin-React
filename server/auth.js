'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const sessions = new Map();

function getSessionFile() {
  const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');
  return path.join(path.dirname(configPath), 'sessions.json');
}

function persist() {
  try {
    const obj = {};
    for (const [id, s] of sessions) obj[id] = s;
    fs.writeFileSync(getSessionFile(), JSON.stringify(obj));
  } catch(e) { /* ignore */ }
}

function load() {
  try {
    const f = getSessionFile();
    if (!fs.existsSync(f)) return;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    const now = Date.now();
    let loaded = 0;
    for (const [id, s] of Object.entries(data)) {
      if (now - s.createdAt < SESSION_TTL) {
        sessions.set(id, s);
        loaded++;
      }
    }
    if (loaded) console.log(`[auth] Restored ${loaded} session(s)`);
  } catch(e) { /* ignore */ }
}

function cleanup() {
  const now = Date.now();
  let removed = 0;
  for (const [id, s] of sessions) {
    if (now - s.createdAt >= SESSION_TTL) {
      sessions.delete(id);
      removed++;
    }
  }
  if (removed) { console.log(`[auth] Expired ${removed} session(s)`); persist(); }
}

// Initialize
load();
setInterval(cleanup, CLEANUP_INTERVAL);

function createSession(data) {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, { ...data, createdAt: Date.now(), lastSeen: Date.now() });
  persist();
  return id;
}

function getSession(id) {
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.createdAt >= SESSION_TTL) {
    sessions.delete(id);
    persist();
    return null;
  }
  s.lastSeen = Date.now();
  return s;
}

function deleteSession(id) {
  sessions.delete(id);
  persist();
}

function getSessionFromRequest(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/cf_session=([a-f0-9]{64})/);
  return match ? getSession(match[1]) : null;
}

function setSessionCookie(res, id) {
  const maxAge = Math.floor(SESSION_TTL / 1000);
  res.setHeader('Set-Cookie', `cf_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'cf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

// Re-authenticate all active sessions against a newly-active server
async function reAuthAll(targetServerId) {
  const cfg  = require('./config');
  const jfMod = require('./jellyfin');
  const sm   = require('./serverManager');
  const servers = sm.getJellyfinServers();
  const target  = servers.find(s => s.id === targetServerId);
  if (!target) return;

  let count = 0;
  for (const session of Object.values(sessions)) {
    if (!session.username || !session._password) continue;
    if (session.tokens && session.tokens[targetServerId]) continue; // already have token
    try {
      const savedUrl = jfMod.getBaseUrl();
      jfMod.init(target.url, target.apiKey || '');
      const result = await jfMod.authenticate(session.username, session._password);
      jfMod.init(savedUrl, cfg.get('JELLYFIN_API_KEY') || '');
      if (result?.AccessToken) {
        if (!session.tokens) session.tokens = {};
        session.tokens[targetServerId] = result.AccessToken;
        count++;
        console.log('[auth] Re-authed ' + session.username + ' → ' + target.name);
      }
    } catch (e) {
      console.log('[auth] Re-auth failed for ' + session.username + ':', e.message);
    }
  }
  if (count) saveSessions();
  return count;
}

module.exports = { createSession, getSession, deleteSession, getSessionFromRequest, setSessionCookie, clearSessionCookie };

// ── Re-authenticate sessions on server failover ────────────────────────────
process.on('cyanfin:server-switch', async ({ to, server }) => {
  if (!server?.url) return;
  const sessions = getAllSessions();
  const jf = require('./jellyfin');
  console.log(`[auth] Re-authing ${sessions.length} sessions against ${server.name}`);
  for (const session of sessions) {
    if (!session.username || !session._password) continue; // can't re-auth without stored creds
    try {
      const savedUrl = jf.getBaseUrl();
      jf.init(server.url, server.apiKey || '');
      const result = await jf.authenticate(session.username, session._password);
      jf.init(savedUrl, ''); // restore (checkAll will set it properly)
      if (result?.AccessToken) {
        if (!session.tokens) session.tokens = {};
        session.tokens[to] = result.AccessToken;
        console.log(`[auth] Re-authed ${session.username} → ${server.name}`);
      }
    } catch (e) {
      console.log(`[auth] Re-auth failed for ${session.username}:`, e.message);
    }
  }
  saveSessions();
});
