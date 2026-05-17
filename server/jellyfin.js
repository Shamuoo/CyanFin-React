'use strict';
const http = require('http');
const https = require('https');

let BASE_URL = '';
let DEFAULT_TOKEN = '';

class JellyfinError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'JellyfinError';
    this.status = status;
  }
}

function init(url, token) {
  BASE_URL = (url || '').replace(/\/$/, '');
  DEFAULT_TOKEN = token || '';
}

function getBaseUrl() { return BASE_URL; }

function request(path, token, method = 'GET', body = null, retries = 2) {
  if (!BASE_URL) return Promise.reject(new JellyfinError('Jellyfin URL not configured', 503));
  const tok = token || DEFAULT_TOKEN;
  const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${tok}`;

  return new Promise((resolve, reject) => {
    const attempt = (retriesLeft) => {
      try {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const bodyStr = body ? JSON.stringify(body) : null;
        const headers = { 'Accept': 'application/json', 'X-MediaBrowser-Token': tok };
        if (bodyStr) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(bodyStr); }

        const req = lib.request({
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method, headers, timeout: 15000,
        }, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            if (res.statusCode === 401) return reject(new JellyfinError('Unauthorized', 401));
            if (res.statusCode === 403) return reject(new JellyfinError('Forbidden', 403));
            if (res.statusCode === 404) return reject(new JellyfinError('Not found', 404));
            if (res.statusCode >= 500 && retriesLeft > 0) {
              return setTimeout(() => attempt(retriesLeft - 1), 1000);
            }
            try { resolve(JSON.parse(data)); }
            catch { resolve(data || {}); }
          });
        });

        req.on('error', e => {
          if (retriesLeft > 0) return setTimeout(() => attempt(retriesLeft - 1), 1000);
          reject(new JellyfinError(e.message, 503));
        });
        req.on('timeout', () => {
          req.destroy();
          if (retriesLeft > 0) return setTimeout(() => attempt(retriesLeft - 1), 1000);
          reject(new JellyfinError('Request timeout', 504));
        });

        if (bodyStr) req.write(bodyStr);
        req.end();
      } catch(e) { reject(new JellyfinError(e.message, 500)); }
    };
    attempt(retries);
  });
}

const get = (path, token) => request(path, token, 'GET');
const post = (path, body, token) => request(path, token, 'POST', body);
const del = (path, token) => request(path, token, 'DELETE');

// Image URLs
function imageUrl(itemId, type = 'Primary', opts = {}) {
  const { token, maxWidth = 600, maxHeight } = opts;
  const tok = token || DEFAULT_TOKEN;
  let url = `${BASE_URL}/Items/${itemId}/Images/${type}?api_key=${tok}&maxWidth=${maxWidth}`;
  if (maxHeight) url += `&maxHeight=${maxHeight}`;
  return url;
}

function backdropUrl(itemId, idx = 0, token) {
  return imageUrl(itemId, `Backdrop/${idx}`, { token, maxWidth: 1920 });
}

function streamUrl(itemId, token) {
  const tok = token || DEFAULT_TOKEN;
  return `${BASE_URL}/Videos/${itemId}/stream?api_key=${tok}&Static=true`;
}

function hlsUrl(itemId, token) {
  const tok = token || DEFAULT_TOKEN;
  return `${BASE_URL}/Videos/${itemId}/master.m3u8?api_key=${tok}&VideoCodec=h264&AudioCodec=aac&TranscodingProtocol=hls&MaxStreamingBitrate=20000000`;
}

function audioUrl(itemId, token) {
  const tok = token || DEFAULT_TOKEN;
  return `${BASE_URL}/Audio/${itemId}/universal?api_key=${tok}&MaxStreamingBitrate=10000000&Container=opus,mp3,aac,flac,ogg`;
}

function directUrl(itemId, token) {
  const tok = token || DEFAULT_TOKEN;
  return `${BASE_URL}/Videos/${itemId}/stream?api_key=${tok}&Static=true`;
}

// Proxy image through our server
async function proxyImage(res, itemId, type, maxWidth, token) {
  const url = imageUrl(itemId, type, { token, maxWidth });
  try {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(url, proxyRes => {
      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      });
      proxyRes.pipe(res);
    });
    req.on('error', () => { res.writeHead(404); res.end(); });
    req.end();
  } catch(e) { res.writeHead(404); res.end(); }
}

// Quick ping
async function ping() {
  try {
    const data = await request('/System/Info/Public', '', 'GET', null, 0);
    return { ok: true, serverName: data.ServerName, version: data.Version };
  } catch(e) { return { ok: false, error: e.message }; }
}

// Authenticate user
async function authenticate(username, password) {
  const authHeader = `MediaBrowser Client="CyanFin", Device="Browser", DeviceId="cyanfin", Version="0.14.0"`;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ Username: username, Pw: password });
    const parsed = new URL(`${BASE_URL}/Users/AuthenticateByName`);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Emby-Authorization': authHeader,
        'Authorization': authHeader,
      },
      timeout: 15000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 401) return reject(new JellyfinError('Invalid username or password', 401));
        if (res.statusCode >= 400) return reject(new JellyfinError(`Auth failed: ${res.statusCode}`, res.statusCode));
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new JellyfinError('Invalid response', 500)); }
      });
    });
    req.on('error', e => reject(new JellyfinError(e.message, 503)));
    req.on('timeout', () => { req.destroy(); reject(new JellyfinError('Timeout', 504)); });
    req.write(body);
    req.end();
  });
}

module.exports = {
  init, get, post, del, getBaseUrl,
  imageUrl, backdropUrl, streamUrl, hlsUrl, audioUrl, directUrl,
  proxyImage, ping, authenticate,
  JellyfinError,
};
