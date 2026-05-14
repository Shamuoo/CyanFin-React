const crypto = require('crypto');

// In-memory session store
const sessions = new Map();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function createSession(userId, token, username, isAdmin) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, {
    userId, token, username, isAdmin,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  });
  return sessionId;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(sessionId);
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return getSession(cookies.cf_session);
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `cf_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'cf_session=; Path=/; HttpOnly; Max-Age=0');
}

function requireAuth(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized', redirect: '/login' }));
    return null;
  }
  return session;
}

module.exports = {
  createSession, getSession, deleteSession,
  getSessionFromRequest, setSessionCookie, clearSessionCookie,
  requireAuth, parseCookies,
};
