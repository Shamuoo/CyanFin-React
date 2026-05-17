# CyanFin

> ⚠️ **AI-Generated Project** — Built entirely through conversation with [Claude](https://anthropic.com) by Anthropic.

**CyanFin is a self-hosted, cinema-quality frontend for [Jellyfin](https://jellyfin.org)** — fast, modern, and built for home theater use. Runs as a single Docker container alongside your existing Jellyfin instance. Optionally connects to Plex as a secondary server.

---

## Quick Start

**First time — no env vars needed. Setup wizard handles everything.**

```bash
mkdir /mnt/user/appdata/cyanfin
cd /mnt/user/appdata/cyanfin
git clone https://github.com/Shamuoo/CyanFin-React.git .
npm install && npm run build
docker build -t cyanfin .
docker run -d --name cyanfin --restart unless-stopped \
  -p 3002:3000 \
  -v /mnt/user/appdata/cyanfin/data:/app/data \
  -v /mnt/user/appdata/cyanfin/server/public:/app/server/public \
  cyanfin
```

Open `http://your-server-ip:3002` → setup wizard → done.

## Update

```bash
cd /mnt/user/appdata/cyanfin && git pull && npm run build && docker restart cyanfin
```

## Full Wipe & Reinstall

```bash
docker stop cyanfin && docker rm cyanfin && docker rmi cyanfin
rm -rf /mnt/user/appdata/cyanfin
mkdir /mnt/user/appdata/cyanfin && cd /mnt/user/appdata/cyanfin
git clone https://github.com/Shamuoo/CyanFin-React.git .
npm install && npm run build
docker build --no-cache -t cyanfin .
docker run -d --name cyanfin --restart unless-stopped \
  -p 3002:3000 \
  -v /mnt/user/appdata/cyanfin/data:/app/data \
  -v /mnt/user/appdata/cyanfin/server/public:/app/server/public \
  cyanfin
```

---

## Features

### 🎬 Playback
- Smart stream selection — direct play first, HLS transcode fallback
- Version picker — choose between multiple files (4K MKV, 1080p HEVC, etc.)
- Audio track picker — switch language/codec before playing
- Subtitle switching — in-player track selector, external VTT via proxy
- Skip Intro / Skip Credits — Jellyfin segment API + Intro Skipper plugin
- Chapter markers on scrub bar — click to jump
- Next episode auto-play — card 2 min before end, auto-advances after 8s
- Picture-in-Picture, fullscreen
- Playback reporting to Jellyfin — progress saves, Continue Watching works

### 🏠 Home
- Cinematic hero with backdrop, logo, Play + Info
- Auto-rotating hero every 7 seconds
- Configurable rows — drag to reorder, eye to hide/show
- Rows: Continue Watching, Recently Added, Popular, History, TV Shows, Top Rated, Collections, Best in 3D

### 🎥 Movies & TV
- Grid with sort, genre filter, infinite scroll
- TV Shows → Seasons → Episodes with play buttons and progress bars
- Quality badges: 4K (gold), 1080p (blue), 3D (green)
- Audio badges: `Atmos 🇬🇧`, `DD+ 5.1 🇫🇷`, `TrueHD 7.1 🇬🇧`

### 🤖 AI Navigator
- Press `⌘I` to open
- Natural language: "Play Barbie", "Show sci-fi movies", "What's on my continue watching?"
- Tool-calling agent — searches your library and executes actions
- Providers: Claude (Anthropic), Gemini (Google), Ollama (local)

### 🎵 Music
- Album grid → track list → persistent audio bar
- Shuffle, repeat, scrubber, volume

### 📺 Server Management
- Settings → Servers tab
- Add Jellyfin (primary + backup) and Plex servers
- Live latency display, Test Connection button
- Failover modes: Fastest (auto), Primary-first, Backup-first
- Nav bar shows active server and latency

### 🎉 Watch Party
- Create a session code, share with friends
- Host controls playback, others sync automatically
- Requires CyanFin Plugin on Jellyfin

### ⭐ Ratings & Metadata
- External ratings: IMDb, TMDB, Rotten Tomatoes 🍅, Metacritic
- Letterboxd link on every movie
- Personal star ratings (1-10) via CyanFin Plugin
- Requires free OMDB API key for RT/Metacritic scores

### 📊 Stats
- Watch time bar chart (last 30 days)
- Top genres, most-watched movies
- Summary: movies, episodes, hours

### 🔧 Library Tools
- Quality report: SD files, upgrade candidates
- Missing content: no poster, no backdrop, no overview
- Scan, refresh metadata, refresh images

### 📡 Health
- Server latency, version, OS info
- CPU, RAM, disk with colour-coded bars
- Active sessions and transcoding count
- Integration status for all connected services

### ⚙️ Settings
- **Appearance tab** — 5 themes (Cinema, Midnight, Ember, Arctic, Neon), layout, AI provider
- **Servers tab** — add/remove/test Jellyfin and Plex servers, failover mode
- **Integrations tab** — all API keys with Test buttons, all saved to `/app/data/config.json`

### 📺 Android TV / Smart TV
- PWA installable from Chrome — no app store
- `display: fullscreen` — launches like a native app
- D-pad navigation in TV layout mode
- Focus rings for remote control

---

## Configuration

All settings can be entered in the **Setup Wizard** (first run) or **Settings → Integrations** (any time). Saved to `/app/data/config.json` and survive container restarts.

| Setting | Where to get it |
|---|---|
| Jellyfin URL | Your Jellyfin server IP + port |
| Plex URL | Your Plex server IP + port (32400) |
| Plex Token | Sign into Plex web → open any media → view XML → copy `X-Plex-Token` from URL |
| TMDB API Key | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) — free |
| OMDB API Key | [omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx) — free tier (1000/day) |
| Anthropic API Key | [console.anthropic.com](https://console.anthropic.com) |
| Gemini API Key | [aistudio.google.com](https://aistudio.google.com) — free tier |
| Ollama URL | `http://your-unraid-ip:11434` if running Ollama locally |
| Jellyseerr | URL + API key from Jellyseerr settings |
| Radarr | URL + API key from Radarr → Settings → General |
| Sonarr | URL + API key from Sonarr → Settings → General |
| Discord | Webhook URL from Discord server settings → Integrations |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10s |
| `↑` / `↓` | Volume |
| `F` | Fullscreen |
| `M` | Mute |
| `C` | Subtitles panel |
| `Escape` | Exit player / close modal |
| `⌘K` | Search |
| `⌘I` | AI Navigator |
| `?` | Keyboard shortcut help |

---

## Android TV Install

1. Open `http://your-server-ip:3002` in Chrome on your Android TV
2. Menu → "Add to Home screen" → Install
3. Settings → Appearance → Layout → **TV**
4. D-pad and remote navigation now active

---

## CyanFin Plugin (Jellyfin)

Optional plugin that unlocks extra features:

- **Trickplay** — scrubber preview thumbnails
- **Watch Party** — server-side sync for watching together  
- **Personal Ratings** — star ratings stored per-user
- **Push Notifications** — Jellyfin pushes events to CyanFin in real-time

**Install:**
1. In Jellyfin: Dashboard → Plugins → Repositories → Add
2. URL: `https://shamuoo.github.io/CyanFin-Plugin/manifest.json`
3. Install CyanFin from the catalogue
4. Restart Jellyfin
5. Dashboard → Plugins → CyanFin → enter your CyanFin URL

---

## Architecture

```
CyanFin-React/
├── server/                   # Node.js backend (no framework)
│   ├── index.js              # Main HTTP server, routing, auth, proxies
│   ├── config.js             # Config schema, validation, persistence
│   ├── auth.js               # Session management (persisted to disk)
│   ├── jellyfin.js           # Jellyfin API client with retry logic
│   ├── serverManager.js      # Multi-server failover (Jellyfin + Plex)
│   ├── plexClient.js         # Plex API client
│   ├── tmdb.js               # TMDB API
│   └── routes/
│       ├── browse.js         # Library browsing (movies, shows, music, search)
│       ├── items.js          # Item detail, playback info, user actions
│       ├── media.js          # Shared mapping utilities
│       ├── stats.js          # Watch stats
│       ├── library.js        # Library tools (quality, missing, scan)
│       ├── integrations.js   # Third-party integrations + test endpoints
│       └── ai.js             # AI navigator (Claude, Gemini, Ollama)
├── src/                      # React 19 + TypeScript frontend
│   ├── App.tsx               # Router, auth guard, error boundaries
│   ├── lib/api.ts            # Typed API client
│   ├── lib/store.ts          # Zustand state (persisted)
│   ├── types/index.ts        # All TypeScript types
│   ├── pages/                # One file per page
│   ├── components/
│   │   ├── layout/           # Nav, Layout, ThemeProvider
│   │   ├── detail/           # Movie/show detail modal
│   │   ├── ui/               # Reusable components
│   │   └── player/           # Audio player bar
│   └── hooks/                # useDpadNavigation
├── Dockerfile                # Multi-stage build
└── data/                     # Persisted config + sessions (volume mounted)
    ├── config.json
    └── sessions.json
```

**Stack:** React 19, TypeScript, Vite, Tailwind v4, Framer Motion, TanStack Query, Zustand, HLS.js, Node.js

---

## License

GPL-3.0 — same as Jellyfin.

> *Every line of CyanFin was written through conversation with Claude by Anthropic. It is an experiment in what AI-assisted development looks like for a real, self-hosted home theater use case.*
