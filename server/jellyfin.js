const http = require('http');
const https = require('https');
const url = require('url');

let JELLYFIN_URL = '';
let DEFAULT_TOKEN = '';

function init(jellyfinUrl, apiKey) {
  JELLYFIN_URL = (jellyfinUrl || '').replace(/\/$/, '');
  DEFAULT_TOKEN = apiKey || '';
}

function request(endpoint, token, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const reqUrl = `${JELLYFIN_URL}${endpoint}`;
    const parsed = new url.URL(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const useToken = token || DEFAULT_TOKEN;
    const headers = {
      'Accept': 'application/json',
      'X-Emby-Authorization': `MediaBrowser Token="${useToken}"`,
    };
    if (body) headers['Content-Type'] = 'application/json';
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
      timeout: 10000,
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) return resolve({});
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error ${res.statusCode}: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function get(endpoint, token) { return request(endpoint, token, 'GET'); }
function post(endpoint, body, token) { return request(endpoint, token, 'POST', body); }

function imageUrl(itemId, type = 'Primary', opts = {}) {
  const token = opts.token || DEFAULT_TOKEN;
  const maxWidth = opts.maxWidth || 600;
  return `${JELLYFIN_URL}/Items/${itemId}/Images/${type}?maxWidth=${maxWidth}&api_key=${token}`;
}

function streamUrl(itemId, token) {
  return `${JELLYFIN_URL}/Videos/${itemId}/master.m3u8?api_key=${token || DEFAULT_TOKEN}&VideoCodec=h264&AudioCodec=aac&TranscodingProtocol=hls&MaxStreamingBitrate=20000000`;
}

function audioUrl(itemId, token) {
  return `${JELLYFIN_URL}/Audio/${itemId}/universal?api_key=${token || DEFAULT_TOKEN}&MaxStreamingBitrate=10000000&Container=opus,mp3,aac,flac,ogg&AudioCodec=aac`;
}

function directUrl(itemId, token) {
  return `${JELLYFIN_URL}/Videos/${itemId}/stream?api_key=${token || DEFAULT_TOKEN}&Static=true`;
}

async function authenticate(username, password) {
  const payload = { Username: username, Pw: password };
  const parsed = new url.URL(`${JELLYFIN_URL}/Users/AuthenticateByName`);
  const lib = parsed.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Emby-Authorization': 'MediaBrowser Client="CyanFin", Device="Browser", DeviceId="cyanfin", Version="0.9.0"',
    };
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers,
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { reject(new Error('Auth parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function proxyImage(imageUrl, res) {
  return new Promise((resolve) => {
    const parsed = new url.URL(imageUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      timeout: 8000,
    }, (imgRes) => {
      if (!res.headersSent) {
        res.writeHead(imgRes.statusCode, {
          'Content-Type': imgRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        });
      }
      imgRes.pipe(res);
      imgRes.on('end', resolve);
    });
    req.on('error', () => { if (!res.headersSent) { res.writeHead(404); res.end(); } resolve(); });
    req.on('timeout', () => { req.destroy(); if (!res.headersSent) { res.writeHead(504); res.end(); } resolve(); });
    req.end();
  });
}

module.exports = { init, get, post, authenticate, imageUrl, streamUrl, directUrl, audioUrl, proxyImage };
