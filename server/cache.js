'use strict';
/**
 * CyanFin Cache v0.20
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-tier: in-memory (fast, 0ms) + disk (persistent across restarts)
 * TTL-aware: items expire automatically, no stale serving by default
 * 
 * Usage:
 *   const cache = require('./cache')
 *   const data = await cache.get(key, ttlMs, fetchFn)
 *   cache.bust(key)           // invalidate one key
 *   cache.bustUser(userId)    // invalidate all keys for a user
 */

const fs   = require('fs');
const path = require('path');
const cfg  = require('./config');

const mem = new Map(); // key → { data, expiresAt }

function cacheDir() {
  return cfg.getCachePath('cache');
}

function diskPath(key) {
  const safe = String(key).replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  return path.join(cacheDir(), `${safe}.json`);
}

function memGet(key) {
  const entry = mem.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { mem.delete(key); return null; }
  return entry.data;
}

function memSet(key, data, ttlMs) {
  mem.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function diskGet(key) {
  try {
    const entry = JSON.parse(fs.readFileSync(diskPath(key), 'utf8'));
    if (Date.now() > entry.expiresAt) { fs.unlinkSync(diskPath(key)); return null; }
    return entry.data;
  } catch { return null; }
}

function diskSet(key, data, ttlMs) {
  try {
    const dir = cacheDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diskPath(key), JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
  } catch {}
}

/**
 * Get cached data or fetch fresh.
 * @param {string}   key    Cache key
 * @param {number}   ttlMs  Time-to-live in ms. 0 = no cache.
 * @param {Function} fetch  Async function that returns fresh data
 * @param {object}   opts   { disk: bool, fallback: bool }
 *   disk:     persist to disk (survives server restart). Default true.
 *   fallback: serve stale disk cache on fetch error. Default true.
 */
async function get(key, ttlMs, fetchFn, opts = {}) {
  const { disk = true, fallback = true } = opts;
  if (ttlMs <= 0) return fetchFn();

  // 1. Memory hit (fastest)
  const memHit = memGet(key);
  if (memHit !== null) return memHit;

  // 2. Disk hit
  if (disk) {
    const diskHit = diskGet(key);
    if (diskHit !== null) {
      memSet(key, diskHit, ttlMs); // warm memory
      return diskHit;
    }
  }

  // 3. Fetch fresh
  try {
    const data = await fetchFn();
    memSet(key, data, ttlMs);
    if (disk) diskSet(key, data, ttlMs);
    return data;
  } catch (e) {
    // 4. Fallback to stale disk on error
    if (fallback && disk) {
      try {
        const entry = JSON.parse(fs.readFileSync(diskPath(key), 'utf8'));
        console.log(`[cache] Serving stale fallback for ${key}`);
        return entry.data;
      } catch {}
    }
    throw e;
  }
}

function bust(key) {
  mem.delete(key);
  try { fs.unlinkSync(diskPath(key)); } catch {}
}

function bustPattern(pattern) {
  const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  for (const k of mem.keys()) { if (re.test(k)) mem.delete(k); }
  try {
    const dir = cacheDir();
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (re.test(f)) fs.unlinkSync(path.join(dir, f));
    }
  } catch {}
}

function bustUser(userId) {
  bustPattern(new RegExp(String(userId).slice(0, 8)));
}

function stats() {
  let diskCount = 0, diskBytes = 0;
  try {
    const dir = cacheDir();
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        try { const s = fs.statSync(path.join(dir, f)); diskCount++; diskBytes += s.size; } catch {}
      }
    }
  } catch {}
  return { memEntries: mem.size, diskFiles: diskCount, diskMb: (diskBytes / 1e6).toFixed(1) };
}

// TTL presets (ms)
const TTL = {
  SHORT:   2 * 60_000,    // 2 min  — active sessions, now-playing
  MED:     10 * 60_000,   // 10 min — home rows, library counts
  LONG:    60 * 60_000,   // 1 hr   — metadata, person bios
  DAY:     24 * 60 * 60_000,  // 24 hr  — images, static data
  WEEK:    7  * 24 * 60 * 60_000,  // 7 days — Wikipedia, TMDB details
};

module.exports = { get, bust, bustPattern, bustUser, stats, TTL };
