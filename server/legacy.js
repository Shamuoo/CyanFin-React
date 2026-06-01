'use strict';
/**
 * CyanFin Legacy Mode — /legacy
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side rendered HTML4/HTML5 interface designed for:
 *   • PowerBook G4 / Aquafox (TenFourFox) — PPC Mac OS X 10.4/10.5
 *   • Any browser with no MSE, no ES6, no HLS support
 *   • IE8+, Firefox 3.5+, Safari 4+, old Chromium
 *
 * Uses: no React, no HLS.js, no ES modules — just direct HTML+CSS+<video>
 * Video: Jellyfin direct stream URLs (/Videos/{id}/stream?Static=true)
 * Audio: native browser <audio> with direct Jellyfin audio URLs
 */

const jf  = require('./jellyfin');
const cfg = require('./config');
const url = require('url');

// ── Inline CSS — no external files, no flexbox (PPC compat), table layout ────
const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0804; color: #e8dcc8; font: 14px/1.5 Georgia,serif; }
  a { color: #c9a84c; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { font: bold 24px/1 'Trebuchet MS',sans-serif; color: #c9a84c; padding: 12px 16px; border-bottom: 1px solid #333; background: #111; }
  h2 { font: bold 16px/1 'Trebuchet MS',sans-serif; color: #c9a84c; margin: 16px 0 8px; }
  .nav { background: #111; padding: 8px 16px; border-bottom: 1px solid #333; }
  .nav a { margin-right: 16px; font: bold 12px sans-serif; letter-spacing: 1px; text-transform: uppercase; }
  .nav a.active { color: #fff; }
  .content { padding: 16px; max-width: 1100px; margin: 0 auto; }
  .grid { width: 100%; }
  .grid td { padding: 8px; vertical-align: top; width: 150px; text-align: center; }
  .card img { width: 130px; height: 195px; object-fit: cover; border: 2px solid #333; display: block; margin: 0 auto 6px; }
  .card a { font-size: 11px; display: block; }
  .card .year { color: #888; font-size: 10px; }
  .card .rating { color: #c9a84c; font-size: 10px; }
  .card:hover img { border-color: #c9a84c; }
  form input, form select { background: #1a1510; border: 1px solid #444; color: #e8dcc8; padding: 6px 10px; font-size: 13px; }
  form input[type=submit], .btn { background: #c9a84c; border: none; color: #0a0804; padding: 8px 20px; font: bold 12px sans-serif; cursor: pointer; letter-spacing: 1px; }
  form input[type=submit]:hover, .btn:hover { background: #e0c070; }
  .detail-table { border-collapse: collapse; width: 100%; }
  .detail-table td { padding: 4px 8px; border-bottom: 1px solid #222; font-size: 13px; }
  .detail-table td:first-child { color: #888; width: 120px; }
  video, audio { display: block; width: 100%; max-width: 900px; background: #000; margin: 12px 0; }
  .alert { background: #1a0a08; border: 1px solid #c0392b; color: #e74c3c; padding: 10px 14px; margin: 12px 0; font-size: 13px; }
  .info  { background: #0a1a0a; border: 1px solid #2ecc71; color: #2ecc71; padding: 10px 14px; margin: 12px 0; font-size: 13px; }
  .search-bar { margin-bottom: 16px; }
  .search-bar input[type=text] { width: 260px; }
  .pagination { margin: 16px 0; }
  .pagination a { margin-right: 8px; padding: 4px 10px; border: 1px solid #444; font-size: 12px; }
  .pagination a.active { background: #c9a84c; color: #000; border-color: #c9a84c; }
  .episodes td { padding: 4px 8px; border-bottom: 1px solid #1a1a1a; font-size: 12px; }
  .episodes tr:hover td { background: #1a1510; }
  .played { color: #2ecc71; }
  .unwatched { color: #888; }
  .progress-bar { background: #333; height: 3px; margin-top: 4px; }
  .progress-fill { background: #c9a84c; height: 3px; }
  .nowplaying { background: #0d1117; border: 1px solid #c9a84c; padding: 16px; margin: 12px 0; }
  .nowplaying h3 { color: #c9a84c; margin-bottom: 8px; }
  .login-box { max-width: 360px; margin: 60px auto; background: #111; border: 1px solid #333; padding: 24px; }
  .login-box input { width: 100%; display: block; margin-bottom: 12px; }
  .login-box input[type=submit] { width: 100%; }
`;

// ── HTML wrapper ──────────────────────────────────────────────────────────────
function page(title, body, session, activeNav = '') {
  const navLinks = session
    ? ['movies','shows','music','search'].map(n =>
        `<a href="/legacy/${n}"${activeNav === n ? ' class="active"' : ''}>${n.charAt(0).toUpperCase()+n.slice(1)}</a>`
      ).join('') + `<a href="/legacy/logout" style="float:right;color:#888">Sign Out (${session.username})</a>`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} — CyanFin</title>
<style>${CSS}</style>
</head>
<body>
<h1>CyanFin <span style="font-size:13px;color:#666;font-weight:normal">legacy mode</span></h1>
${session ? `<div class="nav">${navLinks}</div>` : ''}
<div class="content">${body}</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function imgSrc(itemId, type = 'Primary', token, width = 260) {
  return `/proxy/image?id=${itemId}&type=${type}&w=${width}&t=${token || ''}`;
}

// ── Session store (simple in-memory) ─────────────────────────────────────────
const legacySessions = new Map(); // cookieId → session

function getLegacySession(req) {
  const cookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('cflm='));
  if (!cookie) return null;
  const id = cookie.trim().slice(5);
  return legacySessions.get(id) || null;
}

function setCookie(res, id, maxAge = 86400 * 30) {
  res.setHeader('Set-Cookie', `cflm=${id}; Path=/legacy; HttpOnly; Max-Age=${maxAge}`);
}

// ── Card grid ─────────────────────────────────────────────────────────────────
function cardsGrid(items, session) {
  if (!items.length) return '<p style="color:#666;margin:24px 0">Nothing found.</p>';
  const COLS = 6;
  const rows = [];
  for (let i = 0; i < items.length; i += COLS) {
    const row = items.slice(i, i + COLS).map(item => {
      const img = item.imageUrl || item.primaryImageUrl
        ? `<img src="${imgSrc(item.id,'Primary',session?.token)}" alt="" onerror="this.style.display='none'">`
        : `<div style="width:130px;height:195px;background:#1a1a1a;margin:0 auto 6px;border:2px solid #333"></div>`;
      const pct = item.userData?.playedPercentage;
      const bar = (pct && pct > 0 && pct < 100)
        ? `<div class="progress-bar"><div class="progress-fill" style="width:${Math.round(pct)}%"></div></div>` : '';
      return `<td class="card"><a href="/legacy/item/${item.id}">${img}<span>${escHtml(item.title||item.name||'')}</span></a><span class="year">${item.year||''}</span> <span class="rating">${item.communityRating ? '★ '+item.communityRating.toFixed(1) : ''}</span>${bar}</td>`;
    });
    rows.push(`<tr>${row.join('')}</tr>`);
  }
  return `<table class="grid"><tbody>${rows.join('')}</tbody></table>`;
}

// ── Search/filter bar ─────────────────────────────────────────────────────────
function searchBar(action, q, sort, genre) {
  return `<div class="search-bar"><form method="get" action="${action}">
  <input type="text" name="q" value="${escHtml(q||'')}" placeholder="Search…">
  <select name="sort"><option value="SortName"${sort==='SortName'?' selected':''}>A–Z</option><option value="PremiereDate,SortName"${sort==='PremiereDate,SortName'?' selected':''}>Release date</option><option value="CommunityRating,SortName"${sort==='CommunityRating,SortName'?' selected':''}>Rating</option><option value="DateCreated,SortName"${sort==='DateCreated,SortName'?' selected':''}>Recently added</option></select>
  <select name="genre"><option value="">All genres</option>${['Action','Comedy','Drama','Horror','Sci-Fi','Thriller','Documentary','Animation','Romance','Crime','Family'].map(g=>`<option value="${g}"${genre===g?' selected':''}>${g}</option>`).join('')}</select>
  <input type="submit" value="Go">
  </form></div>`;
}

// ── Main router ───────────────────────────────────────────────────────────────
async function handle(req, res) {
  const parsed = url.parse(req.url, true);
  const path   = parsed.pathname.replace(/^\/legacy/, '') || '/';
  const q      = parsed.query;
  const session = getLegacySession(req);

  // ── Login / logout ─────────────────────────────────────────────────────────
  if (path === '/logout') {
    if (session) legacySessions.delete([...legacySessions.entries()].find(([,v])=>v===session)?.[0]);
    res.setHeader('Set-Cookie', 'cflm=; Path=/legacy; Max-Age=0');
    res.writeHead(302, { Location: '/legacy/login' }); res.end(); return;
  }

  if (path === '/login') {
    if (req.method === 'POST') {
      let body = '';
      await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
      const params = new URLSearchParams(body);
      const username = params.get('username'), password = params.get('password');
      try {
        const result = await jf.authenticate(username, password);
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        legacySessions.set(id, { username, token: result.AccessToken, userId: result.User?.Id });
        setCookie(res, id);
        res.writeHead(302, { Location: '/legacy/movies' }); res.end(); return;
      } catch(e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Login', `<div class="login-box"><h2>Sign In to CyanFin</h2><div class="alert">Invalid credentials</div><form method="post"><input name="username" placeholder="Username"><input type="password" name="password" placeholder="Password"><input type="submit" value="Sign In"></form></div>`, null)); return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Login', `<div class="login-box"><h2>Sign In to CyanFin</h2><form method="post"><input name="username" placeholder="Username"><input type="password" name="password" placeholder="Password"><input type="submit" value="Sign In"></form></div>`, null)); return;
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (!session) { res.writeHead(302, { Location: '/legacy/login' }); res.end(); return; }
  const { token, userId } = session;

  // ── Movies ─────────────────────────────────────────────────────────────────
  if (path === '/' || path === '/movies') {
    const start = parseInt(q.start || '0'), limit = 36;
    const sort = q.sort || 'SortName', genre = q.genre || '';
    const search = q.q || '';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=${limit}&StartIndex=${start}` +
      `&SortBy=${sort}&SortOrder=Ascending` +
      (search ? `&SearchTerm=${encodeURIComponent(search)}` : '') +
      (genre  ? `&Genres=${encodeURIComponent(genre)}` : '') +
      `&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear,UserData,MediaStreams`, token
    );
    const items = (data.Items || []).map(i => ({ id: i.Id, title: i.Name, year: i.ProductionYear, communityRating: i.CommunityRating, userData: { playedPercentage: i.UserData?.PlayedPercentage } }));
    const total = data.TotalRecordCount || 0;
    const prevLink = start > 0 ? `<a href="/legacy/movies?start=${Math.max(0,start-limit)}&sort=${sort}&genre=${genre}&q=${escHtml(search)}">← Prev</a>` : '';
    const nextLink = start + limit < total ? `<a href="/legacy/movies?start=${start+limit}&sort=${sort}&genre=${genre}&q=${escHtml(search)}">Next →</a>` : '';
    const pagination = `<div class="pagination">${prevLink} <span style="color:#666;font-size:12px">${start+1}–${Math.min(start+limit,total)} of ${total}</span> ${nextLink}</div>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Movies', searchBar('/legacy/movies', search, sort, genre) + cardsGrid(items, session) + pagination, session, 'movies')); return;
  }

  // ── Shows ──────────────────────────────────────────────────────────────────
  if (path === '/shows') {
    const start = parseInt(q.start || '0'), limit = 36;
    const sort = q.sort || 'SortName', genre = q.genre || '', search = q.q || '';
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=Series&Recursive=true&Limit=${limit}&StartIndex=${start}` +
      `&SortBy=${sort}&SortOrder=Ascending` +
      (search ? `&SearchTerm=${encodeURIComponent(search)}` : '') +
      (genre  ? `&Genres=${encodeURIComponent(genre)}` : '') +
      `&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear,UserData`, token
    );
    const items = (data.Items || []).map(i => ({ id: i.Id, title: i.Name, year: i.ProductionYear, communityRating: i.CommunityRating }));
    const total = data.TotalRecordCount || 0;
    const prev = start > 0 ? `<a href="/legacy/shows?start=${Math.max(0,start-limit)}&sort=${sort}&q=${escHtml(search)}">← Prev</a>` : '';
    const next = start + limit < total ? `<a href="/legacy/shows?start=${start+limit}&sort=${sort}&q=${escHtml(search)}">Next →</a>` : '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Shows', searchBar('/legacy/shows', search, sort, genre) + cardsGrid(items, session) + `<div class="pagination">${prev} <span style="color:#666;font-size:12px">${start+1}–${Math.min(start+limit,total)} of ${total}</span> ${next}</div>`, session, 'shows')); return;
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  if (path === '/search') {
    const sq = q.q || '';
    let body = searchBar('/legacy/search', sq, 'SortName', '');
    if (sq) {
      const data = await jf.get(
        `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(sq)}&Recursive=true&Limit=36` +
        `&IncludeItemTypes=Movie,Series&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear,UserData`, token
      );
      const items = (data.Items || []).map(i => ({ id: i.Id, title: i.Name, year: i.ProductionYear, communityRating: i.CommunityRating }));
      body += `<h2>Results for "${escHtml(sq)}" (${data.TotalRecordCount||0})</h2>` + cardsGrid(items, session);
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Search', body, session, 'search')); return;
  }

  // ── Music ──────────────────────────────────────────────────────────────────
  if (path === '/music') {
    const data = await jf.get(
      `/Users/${userId}/Items?IncludeItemTypes=MusicAlbum&Recursive=true&Limit=36&SortBy=SortName&SortOrder=Ascending` +
      `&fields=PrimaryImageAspectRatio,ProductionYear,AlbumArtist`, token
    );
    const items = (data.Items || []).map(i => ({ id: i.Id, title: i.Name, year: i.ProductionYear }));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Music', cardsGrid(items, session), session, 'music')); return;
  }

  // ── Item detail ────────────────────────────────────────────────────────────
  const itemMatch = path.match(/^\/item\/([a-f0-9]+)$/i);
  if (itemMatch) {
    const itemId = itemMatch[1];
    const item = await jf.get(`/Users/${userId}/Items/${itemId}?fields=Overview,Genres,ProductionYear,OfficialRating,CommunityRating,MediaStreams,Studios,People,Chapters,ProviderIds`, token);
    const streamUrl = jf.streamUrl(itemId, token);
    const backdropUrl = item.BackdropImageTags?.length
      ? imgSrc(itemId, 'Backdrop/0', token, 1280) : null;

    const isShow = item.Type === 'Series';
    const isEp   = item.Type === 'Episode';
    const isMusic = item.Type === 'MusicAlbum' || item.Type === 'Audio';

    let mediaHtml = '';
    if (item.Type === 'Movie' || isEp) {
      mediaHtml = `
        <div class="nowplaying">
          <h3>▶ Play — ${escHtml(item.Name)}</h3>
          <p style="color:#888;font-size:11px;margin-bottom:8px">Direct stream. If video does not play, try <a href="${streamUrl}" target="_blank">open in new window</a> or download.</p>
          <video controls preload="metadata" src="${escHtml(streamUrl)}">
            Your browser does not support HTML5 video.
            <a href="${escHtml(streamUrl)}">Download video file</a>
          </video>
          <p style="margin-top:8px"><a href="${escHtml(streamUrl)}" class="btn">Download / Open externally</a></p>
        </div>`;
    } else if (isMusic) {
      const audioUrl = `${jf.getBaseUrl()}/Audio/${itemId}/stream?api_key=${token}&Static=true`;
      mediaHtml = `<div class="nowplaying"><h3>♪ Play</h3><audio controls src="${escHtml(audioUrl)}"></audio></div>`;
    }

    // Seasons for shows
    let seasonsHtml = '';
    if (isShow) {
      const seasons = await jf.get(`/Shows/${itemId}/Seasons?userId=${userId}&fields=ItemCounts`, token);
      seasonsHtml = `<h2>Seasons</h2><ul style="list-style:none">` +
        (seasons.Items || []).map(s =>
          `<li style="padding:4px 0;border-bottom:1px solid #222"><a href="/legacy/season/${s.Id}?showId=${itemId}">${escHtml(s.Name)}</a> <span style="color:#666;font-size:11px">${s.UserData?.UnplayedItemCount ? `${s.UserData.UnplayedItemCount} unwatched` : ''}</span></li>`
        ).join('') + `</ul>`;
    }

    const cast = (item.People || []).slice(0, 8).map(p => `<a href="/legacy/person/${p.Id}">${escHtml(p.Name)}</a>`).join(', ');
    const genres = (item.Genres || []).join(', ');
    const studios = (item.Studios || []).map(s => s.Name).join(', ');
    const runtime = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) + ' min' : '';

    const poster = `<img src="${imgSrc(itemId,'Primary',token,260)}" style="float:left;margin:0 16px 16px 0;width:180px;border:2px solid #444" alt="" onerror="this.style.display='none'">`;
    const meta = `<table class="detail-table">
      <tr><td>Year</td><td>${item.ProductionYear||''}</td></tr>
      <tr><td>Rating</td><td>${item.OfficialRating||''}</td></tr>
      <tr><td>Runtime</td><td>${runtime}</td></tr>
      <tr><td>Score</td><td>${item.CommunityRating ? '★ '+item.CommunityRating.toFixed(1) : ''}</td></tr>
      <tr><td>Genre</td><td>${escHtml(genres)}</td></tr>
      ${studios ? `<tr><td>Studio</td><td>${escHtml(studios)}</td></tr>` : ''}
      ${cast    ? `<tr><td>Cast</td><td>${cast}</td></tr>` : ''}
    </table>`;
    const overview = item.Overview ? `<p style="margin:12px 0;font-size:13px;color:#aaa;max-width:700px">${escHtml(item.Overview)}</p>` : '';
    const parentLink = (isEp && item.SeriesId) ? `<p><a href="/legacy/item/${item.SeriesId}">← ${escHtml(item.SeriesName||'Series')}</a></p>` : '';

    const body = `${parentLink}<h2>${escHtml(item.Name)} ${item.ProductionYear ? `<span style="color:#666;font-weight:normal">(${item.ProductionYear})</span>` : ''}</h2>
      ${poster}${meta}${overview}<div style="clear:both"></div>${mediaHtml}${seasonsHtml}`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(item.Name, body, session)); return;
  }

  // ── Season ─────────────────────────────────────────────────────────────────
  const seasonMatch = path.match(/^\/season\/([a-f0-9]+)$/i);
  if (seasonMatch) {
    const seasonId = seasonMatch[1];
    const showId = q.showId || '';
    const eps = await jf.get(
      `/Shows/${showId}/Episodes?seasonId=${seasonId}&userId=${userId}&fields=Overview,UserData,MediaStreams,RunTimeTicks`, token
    );
    const epRows = (eps.Items || []).map(ep => {
      const pct = ep.UserData?.PlayedPercentage;
      const watched = ep.UserData?.Played;
      const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) + ' min' : '';
      return `<tr>
        <td style="color:#666;width:50px">${ep.IndexNumber||''}</td>
        <td><a href="/legacy/item/${ep.Id}">${escHtml(ep.Name||'Episode '+ep.IndexNumber)}</a>
          ${pct && pct > 0 && pct < 100 ? `<div class="progress-bar"><div class="progress-fill" style="width:${Math.round(pct)}%"></div></div>` : ''}
        </td>
        <td style="color:#666;font-size:11px">${runtime}</td>
        <td><span class="${watched ? 'played' : 'unwatched'}">${watched ? '✓' : '○'}</span></td>
      </tr>`;
    });
    const body = `<h2>Episodes</h2><table class="episodes" style="width:100%;border-collapse:collapse"><tbody>${epRows.join('')}</tbody></table>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Season', body, session)); return;
  }

  // ── Person ─────────────────────────────────────────────────────────────────
  const personMatch = path.match(/^\/person\/([a-f0-9]+)$/i);
  if (personMatch) {
    const personId = personMatch[1];
    const person = await jf.get(`/Persons/${personId}`, token).catch(() => ({ Name: 'Unknown', Overview: '' }));
    const starring = await jf.get(
      `/Users/${userId}/Items?PersonIds=${personId}&Recursive=true&Limit=24&IncludeItemTypes=Movie,Series&fields=PrimaryImageAspectRatio,CommunityRating,ProductionYear`, token
    );
    const items = (starring.Items || []).map(i => ({ id: i.Id, title: i.Name, year: i.ProductionYear, communityRating: i.CommunityRating }));
    const body = `<h2>${escHtml(person.Name)}</h2>
      ${person.Overview ? `<p style="margin:8px 0 16px;color:#aaa;font-size:13px;max-width:700px">${escHtml(person.Overview.slice(0,400))}${person.Overview.length > 400 ? '…' : ''}</p>` : ''}
      <h2>Filmography</h2>${cardsGrid(items, session)}`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(person.Name, body, session)); return;
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  res.writeHead(302, { Location: '/legacy/movies' }); res.end();
}

module.exports = { handle };
