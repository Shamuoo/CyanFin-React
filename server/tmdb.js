const https = require('https');

let TMDB_KEY = '';
function init(key) { TMDB_KEY = key || ''; }

function tmdbGet(path) {
  return new Promise((resolve, reject) => {
    if (!TMDB_KEY) return reject(new Error('No TMDB key'));
    const req = https.request({
      hostname: 'api.themoviedb.org',
      path: `/3${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}`,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TMDB timeout')); });
    req.end();
  });
}

async function getTrailer(title, year, type = 'movie') {
  try {
    const search = await tmdbGet(`/search/${type}?query=${encodeURIComponent(title)}&year=${year||''}`);
    const id = search.results && search.results[0] ? search.results[0].id : null;
    if (!id) return null;
    const detail = await tmdbGet(`/${type}/${id}?append_to_response=videos,credits`);
    const trailer = (detail.videos && detail.videos.results || [])
      .find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const cast = (detail.credits && detail.credits.cast || []).slice(0, 8).map(c => ({
      name: c.name, character: c.character, photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));
    return { trailerKey: trailer ? trailer.key : null, cast };
  } catch(e) { return null; }
}

async function getUpcoming() {
  try {
    const data = await tmdbGet('/movie/upcoming?language=en-US&page=1');
    return (data.results || []).slice(0, 20).map(m => ({
      id: m.id, title: m.title,
      year: m.release_date ? m.release_date.split('-')[0] : null,
      releaseDate: m.release_date,
      overview: m.overview,
      score: m.vote_average,
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
    }));
  } catch(e) { return []; }
}

async function getOnThisDay() {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const results = [];
    for (let y = now.getFullYear() - 40; y < now.getFullYear(); y += 5) {
      try {
        const date = `${y}-${month}-${day}`;
        const data = await tmdbGet(`/discover/movie?primary_release_date.gte=${date}&primary_release_date.lte=${date}&sort_by=vote_count.desc&vote_count.gte=100`);
        if (data.results && data.results.length) {
          results.push(...data.results.slice(0, 2).map(m => ({
            id: m.id, title: m.title,
            year: m.release_date ? m.release_date.split('-')[0] : null,
            overview: m.overview, score: m.vote_average,
            posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
            backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
          })));
        }
      } catch(e) {}
    }
    return results.slice(0, 12);
  } catch(e) { return []; }
}

module.exports = { init, getTrailer, getUpcoming, getOnThisDay };
