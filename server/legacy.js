'use strict';
/**
 * CyanFin Lite — /lite (also /legacy)
 * ─────────────────────────────────────────────────────────────────────────────
 * Zero-dependency server-rendered HTML interface. Works on:
 *   • PowerBook G4, Aquafox / TenFourFox (PPC Mac)
 *   • Old iPads (iOS 8–12, Safari 8–12)
 *   • Samsung Smart TV browser (Tizen 2+)
 *   • LG webOS browser
 *   • Amazon Fire Silk Browser
 *   • Any browser that can't run React / HLS.js / ES6 modules
 *   • Low-power devices, slow connections
 *
 * Design rules:
 *   - No JavaScript frameworks. Vanilla JS only, ES5-safe where possible.
 *   - No external assets. All CSS/JS inline.
 *   - HTML table layout for maximum compat, CSS where safe.
 *   - Video: direct file stream (Static=true) — no HLS, no MSE, no buffering.
 *   - Images: native lazy loading, small sizes, graceful fallback.
 *   - Forms for navigation (no pushState).
 */

const jf  = require('./jellyfin');
const url = require('url');

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function imgSrc(id, type, token, w) { return `/proxy/image?id=${id}&type=${type||'Primary'}&w=${w||200}`; }
function fmtRuntime(ticks) { if (!ticks) return ''; const m = Math.round(ticks/600_000_000); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; }

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map();
function getSession(req) {
  const c = (req.headers.cookie||'').split(';').find(s => s.trim().startsWith('cfl='));
  return c ? sessions.get(c.trim().slice(4)) : null;
}
function setSessionCookie(res, id) {
  res.setHeader('Set-Cookie', `cfl=${id}; Path=/; HttpOnly; Max-Age=${86400*30}`);
}

// ── Inline CSS ────────────────────────────────────────────────────────────────
const CSS = `
html,body{margin:0;padding:0;background:#0c0a08;color:#ddd3c0;font:14px/1.6 Arial,Helvetica,sans-serif}
a{color:#c9a84c}a:hover{color:#e8c96c}
h1{margin:0;padding:12px 16px;font-size:20px;background:#111;border-bottom:1px solid #222;color:#c9a84c}
.nav{background:#111;padding:6px 16px;border-bottom:1px solid #222}
.nav a{color:#aaa;margin-right:14px;font-size:12px;text-transform:uppercase;letter-spacing:1px;text-decoration:none}
.nav a:hover{color:#c9a84c}.nav a.on{color:#fff;font-weight:bold}
.wrap{padding:16px;max-width:1200px;margin:0 auto}
.grid{display:block}.cards{list-style:none;margin:0;padding:0;font-size:0}
.card{display:inline-block;vertical-align:top;width:140px;margin:0 10px 16px 0;font-size:12px;text-align:center}
.card a{color:#ddd3c0;text-decoration:none;display:block}
.card img{width:130px;height:195px;object-fit:cover;border:2px solid #333;display:block;margin:0 auto 5px}
.card:hover img{border-color:#c9a84c}
.card .meta{color:#888;font-size:10px}
.card .pct{height:3px;background:#222;margin-top:3px}
.card .fill{height:3px;background:#c9a84c}
.sf{margin-bottom:14px}
.sf input[type=text],.sf select{background:#1a1714;border:1px solid #3a3630;color:#ddd3c0;padding:6px 10px;font-size:13px;margin-right:6px}
.sf input[type=submit]{background:#c9a84c;border:none;color:#0c0a08;padding:6px 18px;font-size:12px;font-weight:bold;cursor:pointer}
.sf input[type=submit]:hover{background:#e0bf70}
.pages{margin:14px 0;font-size:12px}.pages a{border:1px solid #333;padding:3px 9px;margin-right:5px;color:#aaa}
.pages a.on{background:#c9a84c;color:#000;border-color:#c9a84c}
.badge{font-size:10px;background:#222;border:1px solid #333;padding:1px 5px;margin-right:3px;color:#999}

/* ── Detail page ── */
.dp{margin-bottom:20px}
.dp-poster{float:left;margin:0 18px 16px 0;width:160px}
.dp-poster img{width:160px;max-height:240px;object-fit:cover;border:2px solid #444}
.dp-info{overflow:hidden}
.dp-info h2{margin:0 0 8px;font-size:22px;color:#fff}
.dp-meta{font-size:12px;color:#888;margin-bottom:10px}
.dp-meta span{margin-right:10px}
.dp-overview{font-size:13px;color:#bbb;max-width:700px;line-height:1.7;margin-bottom:14px}
.dp-actions{margin-bottom:14px}
.dp-actions a{display:inline-block;padding:7px 18px;font-size:12px;font-weight:bold;text-decoration:none;border-radius:3px;margin-right:8px}
.btn-play{background:#c9a84c;color:#000!important}.btn-play:hover{background:#e0bf70}
.btn-dl{background:#222;color:#ccc!important;border:1px solid #444}.btn-dl:hover{background:#2a2a2a}
.dp-clear{clear:both}
.eps{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
.eps th{background:#1a1714;color:#888;padding:5px 8px;text-align:left;border-bottom:1px solid #2a2a2a}
.eps td{padding:5px 8px;border-bottom:1px solid #1a1a1a}
.eps tr:hover td{background:#161310}
.eps a{color:#ddd3c0;text-decoration:none}.eps a:hover{color:#c9a84c}
.wd{color:#2ecc71;font-size:11px}.uw{color:#555;font-size:11px}

/* ── Lite player ── */
.player-wrap{background:#000;margin:14px 0;position:relative}
.player-wrap video{display:block;width:100%;max-height:70vh;background:#000;outline:none}
.player-bar{background:#111;padding:8px 12px;font-size:12px;display:table;width:100%;box-sizing:border-box}
.player-bar-l{display:table-cell;vertical-align:middle;width:60%}
.player-bar-r{display:table-cell;vertical-align:middle;text-align:right;white-space:nowrap}
.player-bar input[type=range]{width:100%;margin:4px 0;cursor:pointer;accent-color:#c9a84c}
.player-bar select{background:#1a1714;border:1px solid #333;color:#ddd;padding:3px 6px;font-size:11px}
.player-bar button{background:#222;border:1px solid #333;color:#ccc;padding:3px 8px;font-size:11px;cursor:pointer;margin-left:4px}
.player-bar button:hover{background:#333;color:#c9a84c}
.player-time{font-size:11px;color:#888;font-family:monospace;min-width:90px;display:inline-block;text-align:right}
.player-sub{color:#fff;text-align:center;font-size:16px;text-shadow:0 1px 3px #000,0 0 8px #000;padding:6px 0 8px;background:rgba(0,0,0,0.5);display:none}
.kbd{font-size:10px;color:#555;margin-top:4px}
.login-box{max-width:340px;margin:60px auto;background:#111;border:1px solid #2a2a2a;padding:24px}
.login-box h2{margin:0 0 16px;color:#c9a84c;font-size:18px}
.login-box input{width:100%;display:block;margin-bottom:10px;background:#1a1714;border:1px solid #3a3630;color:#ddd;padding:7px 10px;box-sizing:border-box;font-size:13px}
.login-box input[type=submit]{background:#c9a84c;color:#000;font-weight:bold;cursor:pointer;border:none}
.err{background:#2a0a08;border:1px solid #c0392b;color:#e74c3c;padding:8px 12px;margin-bottom:12px;font-size:13px}
.info{font-size:11px;color:#555;margin:6px 0}
`;

// ── Inline JS for the player (ES5 compatible) ─────────────────────────────────
// This is the only JS on the page. Progressively enhances the plain <video> tag.
const PLAYER_JS = `
(function() {
  var vid = document.getElementById('cf-vid');
  var seekBar = document.getElementById('cf-seek');
  var volBar  = document.getElementById('cf-vol');
  var timeEl  = document.getElementById('cf-time');
  var subSel  = document.getElementById('cf-subtitles');
  var audSel  = document.getElementById('cf-audio');
  var subText = document.getElementById('cf-subtext');
  var ITEM_ID = document.getElementById('cf-itemid') ? document.getElementById('cf-itemid').value : '';

  if (!vid) return;

  // Restore position from localStorage
  var savedKey = 'cf_pos_' + ITEM_ID;
  var savedPos = localStorage ? parseFloat(localStorage.getItem(savedKey) || '0') : 0;
  if (savedPos > 10) { vid.currentTime = savedPos; }

  function fmt(s) {
    s = Math.floor(s||0);
    var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h > 0) return h+':'+(m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;
    return m+':'+(sec<10?'0':'')+sec;
  }

  vid.addEventListener('timeupdate', function() {
    var cur = vid.currentTime, dur = vid.duration || 0;
    if (seekBar && dur) seekBar.value = Math.floor(cur/dur*1000);
    if (timeEl) timeEl.textContent = fmt(cur) + ' / ' + fmt(dur);
    if (localStorage && ITEM_ID && dur && cur > 5) localStorage.setItem(savedKey, cur);
  });

  vid.addEventListener('ended', function() {
    if (localStorage && ITEM_ID) localStorage.removeItem(savedKey);
    var nextLink = document.getElementById('cf-next');
    if (nextLink) { setTimeout(function(){ window.location = nextLink.href; }, 2000); }
  });

  if (seekBar) {
    seekBar.addEventListener('input', function() {
      if (vid.duration) vid.currentTime = (seekBar.value/1000)*vid.duration;
    });
  }
  if (volBar) {
    volBar.value = Math.round((vid.volume||1)*100);
    volBar.addEventListener('input', function() { vid.volume = volBar.value/100; });
  }

  // Subtitle track switching
  if (subSel) {
    subSel.addEventListener('change', function() {
      var idx = parseInt(subSel.value);
      for (var i = 0; i < vid.textTracks.length; i++) {
        vid.textTracks[i].mode = (i === idx) ? 'showing' : 'disabled';
      }
    });
  }

  // Audio track switching (only works for direct MP4 with multiple audio tracks in some browsers)
  if (audSel) {
    audSel.addEventListener('change', function() {
      var newSrc = audSel.value;
      if (newSrc) {
        var t = vid.currentTime;
        vid.src = newSrc;
        vid.currentTime = t;
        vid.play();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    switch(e.keyCode) {
      case 32: case 75: e.preventDefault(); vid.paused ? vid.play() : vid.pause(); break; // Space/K
      case 37: e.preventDefault(); vid.currentTime = Math.max(0, vid.currentTime-10); break; // ←
      case 39: e.preventDefault(); vid.currentTime = Math.min(vid.duration||0, vid.currentTime+10); break; // →
      case 38: e.preventDefault(); vid.volume = Math.min(1, vid.volume+0.1); break; // ↑
      case 40: e.preventDefault(); vid.volume = Math.max(0, vid.volume-0.1); break; // ↓
      case 70: case 102: // F
        if (vid.requestFullscreen) vid.requestFullscreen();
        else if (vid.webkitRequestFullscreen) vid.webkitRequestFullscreen();
        else if (vid.mozRequestFullScreen) vid.mozRequestFullScreen();
        break;
      case 77: case 109: vid.muted = !vid.muted; break; // M
    }
  });

  // Auto-hide controls on fullscreen
  var ctrlBar = document.getElementById('cf-ctrlbar');
  var hideTimer;
  document.addEventListener('fullscreenchange', function() {
    if (document.fullscreenElement === vid) {
      if (ctrlBar) ctrlBar.style.display = 'none';
      vid.addEventListener('mousemove', function showCtrl() {
        if (ctrlBar) { ctrlBar.style.display = ''; clearTimeout(hideTimer); hideTimer = setTimeout(function(){ ctrlBar.style.display='none'; }, 3000); }
      });
    } else {
      if (ctrlBar) ctrlBar.style.display = '';
    }
  });
})();
`;

// ── HTML wrapper ──────────────────────────────────────────────────────────────
function page(title, body, session, activeNav) {
  const nav = session
    ? ['movies','shows','music','search'].map(n =>
        `<a href="/lite/${n}"${activeNav===n?' class="on"':''}>${n[0].toUpperCase()+n.slice(1)}</a>`
      ).join('') + `<a href="/lite/logout" style="float:right;color:#666;font-size:11px">Sign out (${esc(session.username)})</a>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — CyanFin Lite</title>
<style>${CSS}</style></head>
<body>
<h1>CyanFin <span style="color:#555;font-size:12px;font-weight:normal">Lite</span></h1>
${session?`<div class="nav">${nav}</div>`:''}
<div class="wrap">${body}</div>
<script>${PLAYER_JS}</script>
</body></html>`;
}

// ── Search + filter bar ───────────────────────────────────────────────────────
function filterBar(action, q, sort, genre) {
  return `<div class="sf"><form method="get" action="${esc(action)}">
    <input type="text" name="q" value="${esc(q||'')}" placeholder="Search…" style="width:180px">
    <select name="sort">
      <option value="SortName"${sort==='SortName'?' selected':''}>A–Z</option>
      <option value="PremiereDate,SortName"${sort==='PremiereDate,SortName'?' selected':''}>Release date</option>
      <option value="CommunityRating,SortName"${sort==='CommunityRating,SortName'?' selected':''}>Rating</option>
      <option value="DateCreated,SortName"${sort==='DateCreated,SortName'?' selected':''}>Recently added</option>
    </select>
    <select name="genre">
      <option value="">All genres</option>
      ${['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Sci-Fi','Thriller','War','Western'].map(g=>`<option value="${esc(g)}"${genre===g?' selected':''}>${g}</option>`).join('')}
    </select>
    <input type="submit" value="Go">
  </form></div>`;
}

// ── Card grid ─────────────────────────────────────────────────────────────────
function cards(items) {
  if (!items.length) return '<p style="color:#555;padding:20px 0">Nothing found.</p>';
  return `<ul class="cards">${items.map(i => {
    const pct = i.userData?.playedPercentage || 0;
    const prog = (pct > 0 && pct < 100) ? `<div class="pct"><div class="fill" style="width:${Math.round(pct)}%"></div></div>` : '';
    const watched = i.userData?.played ? ' <span style="color:#2ecc71;font-size:9px">✓</span>' : '';
    return `<li class="card"><a href="/lite/item/${esc(i.id)}">
      <img src="${imgSrc(i.id,'Primary','',200)}" alt="" loading="lazy" onerror="this.style.background='#222';this.removeAttribute('src')">
      <span>${esc(i.title||i.name||'')}${watched}</span>
      <span class="meta">${i.year||''} ${i.rating ? `· ★${i.rating.toFixed(1)}` : ''}</span>
      ${prog}
    </a></li>`;
  }).join('')}</ul>`;
}

// ── Pagination ────────────────────────────────────────────────────────────────
function pagination(base, start, limit, total) {
  const cur = Math.floor(start/limit);
  const pages = Math.ceil(total/limit);
  let out = `<div class="pages">`;
  if (cur > 0) out += `<a href="${base}&start=${(cur-1)*limit}">← Prev</a>`;
  const lo = Math.max(0,cur-2), hi = Math.min(pages-1,cur+2);
  for (let p = lo; p <= hi; p++) {
    out += `<a href="${base}&start=${p*limit}"${p===cur?' class="on"':''}>${p+1}</a>`;
  }
  if (cur < pages-1) out += `<a href="${base}&start=${(cur+1)*limit}">Next →</a>`;
  out += ` <span style="color:#555">${start+1}–${Math.min(start+limit,total)} of ${total}</span></div>`;
  return out;
}

// ── Main router ───────────────────────────────────────────────────────────────
async function handle(req, res) {
  const parsed = url.parse(req.url, true);
  // Handle both /lite/* and /legacy/* (legacy alias)
  let path = parsed.pathname.replace(/^\/(lite|legacy)/, '') || '/';
  const q = parsed.query;
  const session = getSession(req);

  function send(html) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
  function redirect(to) { res.writeHead(302, { Location: to }); res.end(); }

  // ── Logout ─────────────────────────────────────────────────────────────────
  if (path === '/logout') {
    const c = (req.headers.cookie||'').split(';').find(s=>s.trim().startsWith('cfl='));
    if (c) sessions.delete(c.trim().slice(4));
    res.setHeader('Set-Cookie','cfl=; Path=/; Max-Age=0');
    redirect('/lite/login'); return;
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  if (path === '/login') {
    if (req.method === 'POST') {
      let body = '';
      await new Promise(r => { req.on('data',c=>body+=c); req.on('end',r); });
      const p = new URLSearchParams(body);
      const username = p.get('username'), password = p.get('password');
      try {
        const result = await jf.authenticate(username, password);
        const id = Math.random().toString(36).slice(2)+Date.now().toString(36);
        sessions.set(id, { username, token: result.AccessToken, userId: result.User?.Id });
        setSessionCookie(res, id);
        redirect('/lite/movies'); return;
      } catch(e) {
        send(page('Login', `<div class="login-box"><h2>Sign In</h2><div class="err">Incorrect username or password</div><form method="post"><input name="username" placeholder="Username" autocomplete="username"><input type="password" name="password" placeholder="Password" autocomplete="current-password"><input type="submit" value="Sign In"></form></div>`, null)); return;
      }
    }
    send(page('Login', `<div class="login-box"><h2>Sign In to CyanFin</h2><form method="post"><input name="username" placeholder="Username" autocomplete="username"><input type="password" name="password" placeholder="Password" autocomplete="current-password"><input type="submit" value="Sign In"></form><p class="info">CyanFin Lite — works on any browser, any device.</p></div>`, null)); return;
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (!session) { redirect('/lite/login'); return; }
  const { token, userId } = session;

  // ── Movies ─────────────────────────────────────────────────────────────────
  if (path === '/' || path === '/movies') {
    const start = parseInt(q.start||'0'), limit = 40;
    const sort = q.sort||'SortName', genre = q.genre||'', sq = q.q||'';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=${limit}&StartIndex=${start}` +
      `&SortBy=${sort}&SortOrder=Ascending` +
      (sq ? `&SearchTerm=${encodeURIComponent(sq)}` : '') +
      (genre ? `&Genres=${encodeURIComponent(genre)}` : '') +
      `&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear,UserData`, token
    );
    const items = (data.Items||[]).map(i => ({ id:i.Id, title:i.Name, year:i.ProductionYear, rating:i.CommunityRating, userData:{ playedPercentage:i.UserData?.PlayedPercentage, played:i.UserData?.Played } }));
    const total = data.TotalRecordCount||0;
    const base = `/lite/movies?sort=${encodeURIComponent(sort)}&genre=${encodeURIComponent(genre)}&q=${encodeURIComponent(sq)}`;
    send(page('Movies', filterBar('/lite/movies', sq, sort, genre) + cards(items) + pagination(base, start, limit, total), session, 'movies')); return;
  }

  // ── Shows ──────────────────────────────────────────────────────────────────
  if (path === '/shows') {
    const start = parseInt(q.start||'0'), limit = 40;
    const sort = q.sort||'SortName', genre = q.genre||'', sq = q.q||'';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true&Limit=${limit}&StartIndex=${start}` +
      `&SortBy=${sort}&SortOrder=Ascending` +
      (sq ? `&SearchTerm=${encodeURIComponent(sq)}` : '') +
      (genre ? `&Genres=${encodeURIComponent(genre)}` : '') +
      `&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear,UserData`, token
    );
    const items = (data.Items||[]).map(i => ({ id:i.Id, title:i.Name, year:i.ProductionYear, rating:i.CommunityRating }));
    const total = data.TotalRecordCount||0;
    const base = `/lite/shows?sort=${encodeURIComponent(sort)}&genre=${encodeURIComponent(genre)}&q=${encodeURIComponent(sq)}`;
    send(page('Shows', filterBar('/lite/shows', sq, sort, genre) + cards(items) + pagination(base, start, limit, total), session, 'shows')); return;
  }

  // ── Music ──────────────────────────────────────────────────────────────────
  if (path === '/music') {
    const start = parseInt(q.start||'0'), limit = 40, sq = q.q||'';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=MusicAlbum&Recursive=true&Limit=${limit}&StartIndex=${start}&SortBy=SortName&SortOrder=Ascending` +
      (sq ? `&SearchTerm=${encodeURIComponent(sq)}` : '') +
      `&fields=PrimaryImageAspectRatio,ProductionYear,AlbumArtist`, token
    );
    const items = (data.Items||[]).map(i => ({ id:i.Id, title:i.Name, year:i.ProductionYear }));
    send(page('Music', filterBar('/lite/music', sq, 'SortName', '') + cards(items) + pagination(`/lite/music?q=${encodeURIComponent(sq)}`, start, limit, data.TotalRecordCount||0), session, 'music')); return;
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  if (path === '/search') {
    const sq = q.q||'';
    let body = filterBar('/lite/search', sq, 'SortName', '');
    if (sq) {
      const data = await jf.get(
        `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(sq)}&Recursive=true&Limit=40` +
        `&IncludeItemTypes=Movie,Series,MusicAlbum&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear,UserData`, token
      );
      const items = (data.Items||[]).map(i => ({ id:i.Id, title:i.Name, year:i.ProductionYear, rating:i.CommunityRating }));
      body += `<h2 style="font-size:15px;margin-bottom:10px;color:#aaa">Results for <em>${esc(sq)}</em> (${data.TotalRecordCount||0})</h2>` + cards(items);
    }
    send(page('Search', body, session, 'search')); return;
  }

  // ── Season episodes ────────────────────────────────────────────────────────
  const seasonMatch = path.match(/^\/season\/([a-f0-9]+)$/i);
  if (seasonMatch) {
    const seasonId = seasonMatch[1], showId = q.show||'';
    const eps = await jf.get(`/Shows/${showId}/Episodes?seasonId=${seasonId}&userId=${userId}&fields=Overview,UserData,RunTimeTicks`, token);
    const rows = (eps.Items||[]).map(ep => {
      const pct = ep.UserData?.PlayedPercentage, watched = ep.UserData?.Played;
      return `<tr><td style="color:#666;width:40px">${ep.IndexNumber||''}</td>
        <td><a href="/lite/item/${ep.Id}">${esc(ep.Name||'Episode '+ep.IndexNumber)}</a>${pct&&pct>0&&pct<100?`<div class="pct" style="width:120px;display:inline-block;margin-left:8px"><div class="fill" style="width:${Math.round(pct)}%"></div></div>`:''}</td>
        <td style="color:#666">${fmtRuntime(ep.RunTimeTicks)}</td>
        <td><span class="${watched?'wd':'uw'}">${watched?'✓':'○'}</span></td></tr>`;
    });
    const showLink = showId ? `<p style="margin-bottom:12px"><a href="/lite/item/${showId}">← Back to series</a></p>` : '';
    send(page('Season', showLink + `<table class="eps"><thead><tr><th>#</th><th>Title</th><th>Runtime</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`, session)); return;
  }

  // ── Item detail + player ───────────────────────────────────────────────────
  const itemMatch = path.match(/^\/item\/([a-f0-9]+)$/i);
  if (itemMatch) {
    const itemId = itemMatch[1];
    const [item, mediaSources] = await Promise.all([
      jf.get(`/Users/${userId}/Items/${itemId}?fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,Studios,People,Chapters,ProviderIds,RunTimeTicks`, token),
      jf.get(`/Items/${itemId}/PlaybackInfo?UserId=${userId}&AutoOpenLiveStream=true`, token).catch(()=>({MediaSources:[]})),
    ]);
    const ms = mediaSources?.MediaSources?.[0];
    const streamUrl = jf.streamUrl(itemId, token) + (ms?.Id ? `&MediaSourceId=${ms.Id}` : '');
    const isMovie = item.Type === 'Movie';
    const isEp    = item.Type === 'Episode';
    const isSeries= item.Type === 'Series';
    const isAudio = item.Type === 'Audio' || item.Type === 'MusicAlbum';

    // Subtitle tracks for <track> elements (WebVTT via Jellyfin)
    const subStreams = (ms?.MediaStreams || item.MediaStreams || []).filter(s => s.Type === 'Subtitle' && !s.IsExternal);
    const subTracks  = subStreams.map((s,i) => 
      `<track kind="subtitles" src="/proxy/subtitles?id=${itemId}&index=${s.Index}&token=${token}" srclang="${s.Language||'und'}" label="${esc(s.DisplayTitle||s.Language||'Sub '+(i+1))}" ${i===0&&s.IsDefault?'default':''}>`
    ).join('');

    // Audio streams info
    const audioStreams = (ms?.MediaStreams || []).filter(s => s.Type === 'Audio');

    // Video info
    const videoStream = (ms?.MediaStreams || []).find(s => s.Type === 'Video');
    const videoInfo = videoStream ? `${videoStream.Width||'?'}×${videoStream.Height||'?'} ${videoStream.Codec?.toUpperCase()||''} ${videoStream.DisplayTitle||''}`.trim() : '';

    // Build player
    let mediaHtml = '';
    if (isMovie || isEp) {
      const subOptions = subStreams.length > 0
        ? `<select id="cf-subtitles" title="Subtitles"><option value="-1">Off</option>${subStreams.map((s,i)=>`<option value="${i}">${esc(s.DisplayTitle||s.Language||'Sub '+(i+1))}</option>`)}</select>`
        : '';
      const audioOptions = audioStreams.length > 1
        ? `<select id="cf-audio" title="Audio track">${audioStreams.map((s,i)=>`<option value="">${esc(s.DisplayTitle||s.Language||'Track '+(i+1))}</option>`)}</select>`
        : '';
      mediaHtml = `
<div class="player-wrap">
  <video id="cf-vid" controls preload="metadata" playsinline
    poster="${imgSrc(itemId,'Backdrop/0',token,1280)}"
    style="width:100%;max-height:70vh">
    <source src="${esc(streamUrl)}" type="video/mp4">
    <source src="${esc(streamUrl)}">
    ${subTracks}
    Your browser does not support HTML5 video.
    <a href="${esc(streamUrl)}">Download file</a>
  </video>
  <input type="hidden" id="cf-itemid" value="${esc(itemId)}">
</div>
<div class="player-bar" id="cf-ctrlbar">
  <div class="player-bar-l">
    <input type="range" id="cf-seek" min="0" max="1000" value="0" step="1" style="width:100%" title="Seek">
    <div style="display:table;width:100%;margin-top:3px">
      <div style="display:table-cell"><span id="cf-time" class="player-time">0:00 / 0:00</span></div>
      <div style="display:table-cell;text-align:right;font-size:11px;color:#555">${esc(videoInfo)}</div>
    </div>
  </div>
  <div class="player-bar-r">
    Vol: <input type="range" id="cf-vol" min="0" max="100" value="100" style="width:60px" title="Volume">
    ${subOptions}${audioOptions}
    <button onclick="var v=document.getElementById('cf-vid');if(v.requestFullscreen)v.requestFullscreen();else if(v.webkitRequestFullscreen)v.webkitRequestFullscreen();" title="Fullscreen">⛶</button>
    <a href="${esc(streamUrl)}" download style="margin-left:4px"><button title="Download">⬇</button></a>
  </div>
</div>
<p class="kbd">Keyboard: Space/K=play · ←/→=±10s · ↑/↓=volume · F=fullscreen · M=mute</p>`;
    } else if (isAudio || item.Type === 'Audio') {
      const audioUrl = `${jf.getBaseUrl()}/Audio/${itemId}/stream?api_key=${token}&Static=true`;
      mediaHtml = `<div class="player-wrap" style="padding:16px"><audio id="cf-vid" controls preload="metadata" src="${esc(audioUrl)}" style="width:100%;max-width:600px"></audio></div>`;
    }

    // Seasons for series
    let seasonsHtml = '';
    if (isSeries) {
      const seasons = await jf.get(`/Shows/${itemId}/Seasons?userId=${userId}&fields=ItemCounts,UserData`, token).catch(()=>({Items:[]}));
      const rows = (seasons.Items||[]).map(s =>
        `<tr><td><a href="/lite/season/${s.Id}?show=${itemId}">${esc(s.Name)}</a></td><td style="color:#666;font-size:11px">${s.UserData?.UnplayedItemCount ? s.UserData.UnplayedItemCount+' unwatched' : ''}</td></tr>`
      );
      if (rows.length) seasonsHtml = `<h3 style="margin:16px 0 8px;font-size:15px;color:#aaa">Seasons</h3><table class="eps"><tbody>${rows.join('')}</tbody></table>`;
    }

    // Next episode for shows
    let nextEpHtml = '';
    if (isEp && item.SeriesId) {
      const nextEps = await jf.get(
        `/Shows/${item.SeriesId}/Episodes?UserId=${userId}&Filters=IsUnplayed&StartIndex=${item.IndexNumber||0}&Limit=1&fields=MediaStreams`,
        token
      ).catch(()=>({Items:[]}));
      const ne = nextEps.Items?.find(e => e.Id !== itemId && (e.ParentIndexNumber||0) >= (item.ParentIndexNumber||0));
      if (ne) nextEpHtml = `<p style="margin:8px 0"><a id="cf-next" href="/lite/item/${ne.Id}" style="color:#c9a84c;font-size:13px">▶ Next: ${esc(ne.Name)} (S${ne.ParentIndexNumber}E${ne.IndexNumber})</a></p>`;
    }

    // Metadata
    const genres = (item.Genres||[]).slice(0,4).join(', ');
    const cast = (item.People||[]).filter(p=>p.Type==='Actor').slice(0,8).map(p=>`<a href="/lite/person/${p.Id}">${esc(p.Name)}</a>`).join(', ');
    const parentLink = isEp && item.SeriesId ? `<p style="margin-bottom:10px"><a href="/lite/item/${item.SeriesId}">← ${esc(item.SeriesName||'Series')}</a></p>` : '';

    const detail = `
${parentLink}
<div class="dp">
  <div class="dp-poster"><img src="${imgSrc(itemId,'Primary',token,320)}" alt="" loading="lazy" onerror="this.style.display='none'"></div>
  <div class="dp-info">
    <h2>${esc(item.Name)} ${item.ProductionYear?`<span style="color:#666;font-weight:normal;font-size:16px">(${item.ProductionYear})</span>`:''}</h2>
    <div class="dp-meta">
      ${item.OfficialRating?`<span class="badge">${esc(item.OfficialRating)}</span>`:''}
      ${item.CommunityRating?`<span>★ ${item.CommunityRating.toFixed(1)}</span>`:''}
      ${item.RunTimeTicks?`<span>${fmtRuntime(item.RunTimeTicks)}</span>`:''}
      ${genres?`<span>${esc(genres)}</span>`:''}
    </div>
    ${item.Overview?`<div class="dp-overview">${esc(item.Overview.slice(0,500))}${item.Overview.length>500?'…':''}</div>`:''}
    ${(isMovie||isEp)?`<div class="dp-actions"><a class="dp-actions btn-play" href="#cf-vid" onclick="document.getElementById('cf-vid')&&document.getElementById('cf-vid').play()">▶ Play</a><a class="dp-actions btn-dl" href="${esc(streamUrl)}" download>⬇ Download</a></div>`:''}
    ${cast?`<p style="font-size:12px;color:#888">Cast: ${cast}</p>`:''}
  </div>
  <div class="dp-clear"></div>
</div>
${mediaHtml}${nextEpHtml}${seasonsHtml}`;

    send(page(item.Name, detail, session)); return;
  }

  // ── Person ─────────────────────────────────────────────────────────────────
  const personMatch = path.match(/^\/person\/([a-f0-9]+)$/i);
  if (personMatch) {
    const personId = personMatch[1];
    const [person, starring] = await Promise.all([
      jf.get(`/Persons/${personId}`, token).catch(()=>({Name:'Unknown'})),
      jf.get(`/Users/${userId}/Items?PersonIds=${personId}&Recursive=true&Limit=40&IncludeItemTypes=Movie,Series&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear`, token).catch(()=>({Items:[]})),
    ]);
    const items = (starring.Items||[]).map(i=>({id:i.Id,title:i.Name,year:i.ProductionYear,rating:i.CommunityRating}));
    send(page(person.Name, `<h2 style="margin-bottom:10px">${esc(person.Name)}</h2>${person.Overview?`<p style="color:#aaa;font-size:13px;max-width:700px;margin-bottom:16px">${esc(person.Overview.slice(0,500))}</p>`:''}<h3 style="color:#888;font-size:13px;margin-bottom:10px">Filmography</h3>${cards(items)}`, session)); return;
  }

  redirect('/lite/movies');
}

module.exports = { handle };
