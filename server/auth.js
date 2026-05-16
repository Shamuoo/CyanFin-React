const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const sessions = new Map();
const SESSION_FILE = path.join(process.env.CONFIG_PATH ? path.dirname(process.env.CONFIG_PATH) : '/tmp', 'sessions.json');

// Load persisted sessions on startup
function loadSessions() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    const now = Date.now();
    let loaded = 0;
    for (const [id, session] of Object.entries(data)) {
      if (now - session.createdAt < SESSION_TTL) {
        sessions.set(id, session);
        loaded++;
      }
    }
    console.log(`[auth] Loaded ${loaded} sessions`);
  } catch(e) { /* ignore */ }
}

function saveSessions() {
  try {
    const obj = {};
    for (const [id, session] of sessions.entries()) obj[id] = session;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(obj));
  } catch(e) { /* ignore */ }
}

loadSessions();

function createSession(data) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, { ...data, createdAt: Date.now(), lastSeen: Date.now() });
  saveSessions();
  return sessionId;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(sessionId);
    saveSessions();
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
  saveSessions();
}

function getSessionFromRequest(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/cf_session=([a-f0-9]{64})/);
  if (!match) return null;
  return getSession(match[1]);
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `cf_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`);
}

module.exports = { createSession, getSession, deleteSession, getSessionFromRequest, setSessionCookie };
