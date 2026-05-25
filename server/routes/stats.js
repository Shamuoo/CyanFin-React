const https = require('https');
const http = require('http');

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(url, { headers: opts.headers || {}, timeout: 5000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ json: () => { try { return Promise.resolve(JSON.parse(d)); } catch(e) { return Promise.reject(e); } }, ok: res.statusCode < 400 }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

const jf = require('../jellyfin');

async function handleStats(pathname, query, session) {
  const token = session.token;
  const userId = session.userId;


  // ── System Health ──────────────────────────────────────────────────────────
  if (pathname === '/api/system-stats') {
    const os2 = require('os');
    const cpus2 = os2.cpus();
    return {
      cpu:      Math.round((1 - os2.loadavg()[0] / cpus2.length) * 100),
      ramUsed:  Math.round((os2.totalmem() - os2.freemem()) / 1e9 * 10) / 10,
      ramTotal: Math.round(os2.totalmem() / 1e9 * 10) / 10,
      uptimeDays: Math.floor(os2.uptime() / 86400),
      freeGb:   Math.round(os2.freemem() / 1e9 * 10) / 10,
      totalGb:  Math.round(os2.totalmem() / 1e9 * 10) / 10,
      diskUsedPct: Math.round((1 - os2.freemem() / os2.totalmem()) * 100),
    };
  }

  if (pathname === '/api/health') {
    const cfg = require('../config');
    const sm = require('../serverManager');
    const pkg = (() => { try { return require('../../package.json'); } catch(e) { return { version: '0.14.0' }; } })();
    const os = require('os');

    const [info, sessions, libraries, plugins, gh] = await Promise.all([
      jf.get('/System/Info', token).catch(() => ({})),
      jf.get('/Sessions', token).catch(() => []),
      jf.get(`/Users/${userId}/Views`, token).catch(() => ({ Items: [] })),
      jf.get('/Plugins', token).catch(() => ({ Items: [] })),
      fetch('https://api.github.com/repos/Shamuoo/CyanFin-React/releases/latest', { headers: { 'User-Agent': 'CyanFin' } }).then(r => r.json()).catch(() => null),
    ]);

    const sessArr = Array.isArray(sessions) ? sessions : sessions?.Items || [];
    const active = sessArr.filter(s => s.NowPlayingItem);
    const transcoding = active.filter(s => s.TranscodingInfo?.IsVideoDirect === false).length;
    const latency = await (async () => {
      const start = Date.now();
      await jf.get('/System/Info/Public', '').catch(() => {});
      return Date.now() - start;
    })();

    const version = pkg.version || '0.14.0';
    const ghTag = gh?.tag_name;
    const isLatest = ghTag ? ghTag === `v${version}` : true;

    return {
      cyanFinVersion: version,
      github: gh ? { latestRelease: ghTag, isLatest } : null,
      serverName: info.ServerName,
      version: info.Version,
      os: info.OperatingSystemDisplayName || info.OperatingSystem,
      localAddress: info.LocalAddress,
      latency,
      activeSessions: active.length,
      totalSessions: sessArr.length,
      transcoding,
      nowPlaying: active.slice(0, 5).map(s => ({
        user: s.UserName,
        device: s.DeviceName,
        title: s.NowPlayingItem?.Name,
        progress: s.NowPlayingItem?.RunTimeTicks && s.PlayState?.PositionTicks
          ? Math.round((s.PlayState.PositionTicks / s.NowPlayingItem.RunTimeTicks) * 100) : 0,
      })),
      libraries: ((libraries.Items || [])).map(l => ({ name: l.Name, type: l.CollectionType })),
      plugins: ((plugins.Items || [])).map(p => ({ name: p.Name, version: p.Version })),
      disk: (() => {
        // Get disk stats via Jellyfin system info if available, fall back to os module for the server's disk
        const totalGb = typeof info.SystemUpdateLevel !== 'undefined'
          ? Math.round((os.totalmem() / 1e9) * 10) / 10
          : null;
        return {
          freeGb:  Math.round((os.freemem() / 1e9) * 10) / 10,
          totalGb: Math.round((os.totalmem() / 1e9) * 10) / 10,
          usedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
        };
      })(),
    };
  }


  // ── Backup library sync status ────────────────────────────────────────────────
  if (pathname === '/api/stats/sync-status') {
    const cfg = require('../config');
    const sm = require('../serverManager');
    const http = require('http');
    const https = require('https');
    const backupUrl = cfg.get('JELLYFIN_BACKUP_URL');
    const backupKey = cfg.get('JELLYFIN_BACKUP_API_KEY') || cfg.get('JELLYFIN_API_KEY') || '';
    const plexUrl   = cfg.get('PLEX_URL');
    const plexToken = cfg.get('PLEX_TOKEN');

    async function countItems(baseUrl, apiKey) {
      if (!baseUrl) return null;
      return new Promise(resolve => {
        const url = `${baseUrl}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=0&EnableTotalRecordCount=true&api_key=${apiKey}`;
        try {
          const parsed = new URL(url);
          const lib = parsed.protocol === 'https:' ? https : http;
          const req = lib.request(url, { timeout: 8000 }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d).TotalRecordCount || 0); } catch { resolve(0); } });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
          req.end();
        } catch { resolve(null); }
      });
    }

    async function countPlex(url, tok) {
      if (!url || !tok) return null;
      return new Promise(resolve => {
        const target = `${url}/library/all?X-Plex-Token=${tok}&X-Plex-Container-Size=0`;
        try {
          const parsed = new URL(target);
          const lib = parsed.protocol === 'https:' ? https : http;
          const req = lib.request(target, { headers: { Accept: 'application/json' }, timeout: 8000 }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d).MediaContainer?.totalSize || 0); } catch { resolve(0); } });
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
          req.end();
        } catch { resolve(null); }
      });
    }

    const primaryKey = cfg.get('JELLYFIN_API_KEY') || '';
    const [primaryCount, backupCount, plexCount] = await Promise.all([
      countItems(cfg.get('JELLYFIN_URL'), primaryKey),
      countItems(backupUrl, backupKey),
      countPlex(plexUrl, plexToken),
    ]);

    const drift = primaryCount != null && backupCount != null
      ? primaryCount - backupCount : null;

    return {
      primary: { count: primaryCount, url: cfg.get('JELLYFIN_URL') },
      backup:  backupUrl ? { count: backupCount, url: backupUrl, drift, inSync: drift === 0 } : null,
      plex:    plexUrl   ? { count: plexCount, url: plexUrl } : null,
      lastCheck: Date.now(),
    };
  }

  // Watch time by day (last 30 days)
  if (pathname === '/api/stats/watch-time') {
    try {
      const days = parseInt(query.days || '30');
      const data = await jf.get(
        `/Users/${userId}/Items?IncludeItemTypes=Movie,Episode&Filters=IsPlayed&SortBy=DatePlayed&SortOrder=Descending&Limit=500&fields=UserData,RunTimeTicks`, token
      );
      const byDay = {};
      const now = new Date();
      for (let i = 0; i < days; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        byDay[d.toISOString().split('T')[0]] = 0;
      }
      (data.Items || []).forEach(item => {
        if (!item.UserData || !item.UserData.LastPlayedDate) return;
        const day = item.UserData.LastPlayedDate.split('T')[0];
        if (byDay[day] !== undefined) {
          byDay[day] += Math.round((item.RunTimeTicks || 0) / 600000000); // minutes
        }
      });
      return Object.entries(byDay).map(([date, minutes]) => ({ date, minutes })).reverse();
    } catch(e) { return { error: e.message }; }
  }

  // Top genres
  if (pathname === '/api/stats/top-genres') {
    try {
      const data = await jf.get(
        `/Users/${userId}/Items?IncludeItemTypes=Movie,Episode&Filters=IsPlayed&Limit=500&fields=Genres,UserData`, token
      );
      const counts = {};
      (data.Items || []).forEach(item => {
        (item.Genres || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; });
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([genre, count]) => ({ genre, count }));
    } catch(e) { return { error: e.message }; }
  }

  // Top movies by play count
  if (pathname === '/api/stats/top-movies') {
    try {
      const data = await jf.get(
        `/Users/${userId}/Items?IncludeItemTypes=Movie&SortBy=PlayCount&SortOrder=Descending&Limit=10&fields=UserData,ImageTags&Recursive=true`, token
      );
      return (data.Items || []).map(i => ({
        id: i.Id, title: i.Name, year: i.ProductionYear,
        playCount: i.UserData ? i.UserData.PlayCount : 0,
        posterUrl: jf.imageUrl(i.Id, 'Primary', { token, maxWidth: 200 }),
      }));
    } catch(e) { return { error: e.message }; }
  }

  // Recent activity (all users if admin)
  if (pathname === '/api/stats/activity') {
    try {
      const limit = parseInt(query.limit || '20');
      const data = await jf.get(`/System/ActivityLog/Entries?Limit=${limit}&hasUserId=true`, token);
      return (data.Items || []).map(a => ({
        id: a.Id, name: a.Name, type: a.Type, date: a.Date,
        userId: a.UserId, userName: a.UserName, severity: a.Severity, overview: a.Overview,
      }));
    } catch(e) { return { error: e.message }; }
  }

  // User summary stats
  if (pathname === '/api/stats/summary') {
    try {
      const [movies, episodes, music] = await Promise.all([
        jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Filters=IsPlayed&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token),
        jf.get(`/Users/${userId}/Items?IncludeItemTypes=Episode&Filters=IsPlayed&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token),
        jf.get(`/Users/${userId}/Items?IncludeItemTypes=Audio&Filters=IsPlayed&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token).catch(() => ({ TotalRecordCount: 0 })),
      ]);
      // Estimate total watch time from played counts
      const moviesWatched = movies.TotalRecordCount || 0;
      const episodesWatched = episodes.TotalRecordCount || 0;
      const estimatedHours = Math.round((moviesWatched * 100 + episodesWatched * 45) / 60);
      return { moviesWatched, episodesWatched, songsPlayed: music.TotalRecordCount || 0, estimatedHours };
    } catch(e) { return { error: e.message }; }
  }

  // Player segments (skip intro/outro)
  if (pathname === '/api/stats/segments') {
    const itemId = query.itemId;
    if (!itemId) return { error: 'No itemId' };
    try {
      const data = await jf.get(`/MediaSegments/${itemId}`, token).catch(() => null);
      if (!data || !data.Items) return { segments: [] };
      return { segments: (data.Items || []).map(s => ({ type: s.Type, start: s.StartTicks, end: s.EndTicks })) };
    } catch(e) { return { segments: [] }; }
  }

  return null;
}

module.exports = { handleStats };
