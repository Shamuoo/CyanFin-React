/**
 * Plex API client for CyanFin
 * Handles Plex Media Server requests alongside Jellyfin
 */
const http = require('http')
const https = require('https')
const cfg = require('./config')

function plexRequest(path, token, method = 'GET', body = null) {
  const baseUrl = cfg.get('PLEX_URL') || ''
  const plexToken = token || cfg.get('PLEX_TOKEN') || ''
  if (!baseUrl) return Promise.reject(new Error('No Plex URL configured'))

  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl.replace(/\/$/, '') + path)
    const lib = url.protocol === 'https:' ? https : http
    const headers = {
      'X-Plex-Token': plexToken,
      'X-Plex-Client-Identifier': 'cyanfin',
      'X-Plex-Product': 'CyanFin',
      'Accept': 'application/json',
    }
    if (body) headers['Content-Type'] = 'application/json'

    const bodyStr = body ? JSON.stringify(body) : null
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 10000,
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d)) }
        catch(e) { resolve({ raw: d, status: res.statusCode }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Plex timeout')) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// Map Plex media item to CyanFin format
function mapPlexItem(item, plexUrl, plexToken) {
  const type = item.type === 'movie' ? 'Movie' : item.type === 'show' ? 'Series' : item.type === 'episode' ? 'Episode' : item.type
  const thumb = item.thumb ? `${plexUrl}/photo/:/transcode?url=${encodeURIComponent(item.thumb)}&width=400&height=600&X-Plex-Token=${plexToken}` : null
  const art = item.art ? `${plexUrl}/photo/:/transcode?url=${encodeURIComponent(item.art)}&width=1920&height=1080&X-Plex-Token=${plexToken}` : null

  return {
    id: `plex_${item.ratingKey}`,
    plexKey: item.ratingKey,
    title: item.title,
    year: item.year,
    type,
    overview: item.summary,
    score: item.audienceRating || item.rating,
    rating: item.contentRating,
    runtime: item.duration ? item.duration * 10000 : null, // Plex uses ms, convert to ticks
    posterUrl: thumb,
    backdropUrl: art,
    genre: item.Genre?.[0]?.tag,
    audio: item.Media?.[0]?.audioProfile || null,
    qualities: item.Media?.map(m => {
      const res = m.videoResolution
      if (res === '4k' || res === '2160') return '4K'
      if (res === '1080') return '1080p'
      if (res === '720') return '720p'
      return res || 'SD'
    }) || [],
    _source: 'plex',
  }
}

async function getLibraries(token) {
  const data = await plexRequest('/library/sections', token)
  return (data.MediaContainer?.Directory || [])
}

async function getRecentlyAdded(token) {
  const data = await plexRequest('/library/recentlyAdded?limit=20', token)
  const plexUrl = cfg.get('PLEX_URL') || ''
  const plexToken = token || cfg.get('PLEX_TOKEN') || ''
  return (data.MediaContainer?.Metadata || []).map(i => mapPlexItem(i, plexUrl, plexToken))
}

async function search(query, token) {
  const data = await plexRequest(`/search?query=${encodeURIComponent(query)}&limit=10`, token)
  const plexUrl = cfg.get('PLEX_URL') || ''
  const plexToken = token || cfg.get('PLEX_TOKEN') || ''
  return (data.MediaContainer?.Metadata || []).map(i => mapPlexItem(i, plexUrl, plexToken))
}

async function getStreamUrl(plexKey, token) {
  const plexUrl = (cfg.get('PLEX_URL') || '').replace(/\/$/, '')
  const plexToken = token || cfg.get('PLEX_TOKEN') || ''
  // Direct play URL
  const streamUrl = `${plexUrl}/video/:/transcode/universal/start.m3u8?path=/library/metadata/${plexKey}&mediaIndex=0&partIndex=0&protocol=hls&fastSeek=1&directPlay=0&directStream=1&X-Plex-Token=${plexToken}`
  const directUrl = `${plexUrl}/library/metadata/${plexKey}/children?X-Plex-Token=${plexToken}`
  return { streamUrl, directUrl }
}

async function ping(plexUrl, plexToken) {
  try {
    const res = await new Promise((resolve, reject) => {
      const start = Date.now()
      const url = new URL((plexUrl || '').replace(/\/$/, '') + '/identity')
      const lib = url.protocol === 'https:' ? https : http
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        headers: { 'X-Plex-Token': plexToken || '', 'Accept': 'application/json' },
        timeout: 5000,
      }, res => {
        const latency = Date.now() - start
        res.resume()
        resolve({ ok: res.statusCode < 400, latency })
      })
      req.on('error', () => resolve({ ok: false, latency: null }))
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null }) })
      req.end()
    })
    return res
  } catch(e) { return { ok: false, latency: null } }
}

module.exports = { plexRequest, mapPlexItem, getLibraries, getRecentlyAdded, search, getStreamUrl, ping }
