# CyanFin

> **⚠️ AI-Generated Codebase**
> This project was built entirely using Claude (Anthropic) as the development environment. All code — frontend, backend, build scripts, and configuration — was written by Claude Sonnet via the claude.ai chat interface. No human code was written. The project is maintained by pushing AI-generated patches to this repository.
>
> This means: the code works, but it may not follow every conventional best practice. If you find bugs or want to contribute improvements, PRs are welcome.

A cinematic self-hosted media client for Jellyfin and Plex. Built with React 19, TypeScript, Vite, Tailwind v4, and a lightweight Node.js proxy server.

**v0.19.1**

---

## What is CyanFin?

CyanFin is a full-featured frontend for your Jellyfin server with optional Plex support. It runs as a Docker container on your NAS or home server and is accessible from any browser, plus native Android and Windows apps.

It is not a replacement for the official Jellyfin client — it is an opinionated, heavily customised alternative that prioritises a cinematic browsing experience, advanced customisation, and multi-server failover.

---

## Features

### Playback
- Full HLS and direct-play support via HLS.js
- Jellyfin playback session reporting (start / progress / stop) — appears in Jellyfin's activity feed like a native client
- Auto-marks items as played at 85% completion
- Trickplay scrubber thumbnails on hover (requires Jellyfin trickplay plugin)
- Skip Intro button (requires Jellyfin intro skipper plugin)
- Chapter navigation with name display
- Subtitle track selector with custom font/size/colour/background
- Audio track selector — switch language mid-stream
- Playback speed control (0.5×–2×)
- Picture-in-Picture
- Sleep timer
- Subtitle offset nudge (±500ms)
- Aspect ratio cycle (contain / cover / fill)
- Video bookmarks (localStorage per item)
- Up Next countdown toast — auto-advances to next episode after 12s
- Video quality selector — switch resolution mid-stream

### Home
- Fully customisable home section order (drag to reorder, toggle visibility)
- Sections: Continue Watching, New Episodes, Because You Watched, Recently Released, Recently Added, Trending This Week, Coming Soon, Top Rated, Best in 4K, Top TV Shows, Collections, Best in 3D (optional), 11 genre rows, Watch History, Random Pick
- Genre rows sorted by community rating (most acclaimed first)
- Hero cycles through recently added items with backdrop images
- Daily-shuffled genre row order — fresh layout each day
- 3 home hero styles: Cinematic, Minimal, Spotlight

### Browse
- Movies and Shows with genre filter pills, sort controls, and card size
- Lucky dip 🎲 — random unwatched movie
- People directory — portrait cards, search, pagination
- Studios page — logos, search, browse studio content
- Collections
- Music — Albums, Tracks, Playlists, Now Playing, Lyrics (synced .lrc), Audio Visualiser
- Watch History — grouped by date, paginated
- Advanced search filter (genre / year / rating / type / unwatched)
- Downloads — offline video files with progress rings

### Customisation
- 13 themes: Cinema, Midnight, Ember, Arctic, Neon, Rose, Forest, Slate, Mocha, Fluent, Sakura, Amoled, Sunset
- Custom accent colour
- OLED pure-black mode
- Custom background image
- Custom CSS injection
- Font style: Default (Inter), Rounded (Nunito), Mono (JetBrains Mono), Serif (Georgia)
- Card size: Small / Medium / Large
- Sidebar width slider (140–280px)
- Content age rating filter
- 3D content toggle
- Home section editor

### Playback settings
- Max streaming bitrate cap
- Preferred subtitle language (auto-selects on play)
- Skip length (5s / 10s / 30s)
- Autoplay next episode toggle
- Resume threshold
- Subtitle size / colour / background
- Show clock in nav

### Multi-server
- N Jellyfin servers — add, remove, test, speed test
- N Plex servers
- Automatic failover — picks the fastest server on login
- Latency + bandwidth display per server in Health page
- Offline mode — cached library with badge

### Admin (admin users only)
- Active transcoding panel — codec, framerate, hardware acceleration (NVENC/QSV/AMF)
- System stats — CPU, RAM, disk free, uptime
- Active sessions feed
- Library scan trigger
- Sync diff — compare primary vs backup server movie/show counts

### Integrations
- Jellyseerr — request movies and shows from detail view
- Radarr / Sonarr — direct add
- TMDB — external ratings, trailer links, trending
- Letterboxd — link to film page from detail
- Discord webhook — share now-playing
- Streamystats
- AI Navigator — natural language search (Claude / Gemini / Ollama)
- Wikipedia cast bios
- Open-Meteo weather (no API key required)

### Profiles
- Multiple profiles with 4-digit PIN lock
- Pinned profiles on login screen
- Per-profile watch history

---

## Platform support

| Platform | Status |
|---|---|
| Web (any browser) | ✅ Full support |
| Windows .exe (installer + portable) | ✅ Electron |
| Android phone | 📱 APK via Capacitor — see `build-resources/ANDROID.md` |
| Android TV | 📺 APK via Capacitor — D-pad + TV layout ready |
| iOS | 🔜 Needs Mac + Xcode |

---

## Docker (recommended)

```bash
docker run -d \
  --name cyanfin-react \
  --restart unless-stopped \
  -p 3002:3000 \
  -v /path/to/data:/app/data \
  cyanfin-react
```

### Full rebuild from source

```bash
cd /path/to/cyanfin-react
git clone https://github.com/Shamuoo/CyanFin-React.git .
npm install
npm run build
docker build --no-cache -t cyanfin-react .
docker rm -f cyanfin-react
docker run -d --name cyanfin-react --restart unless-stopped \
  -p 3002:3000 \
  -v /path/to/data:/app/data \
  cyanfin-react
```

### Quick update (git pull)

```bash
cd /path/to/cyanfin-react
git pull
npm run build
docker build --no-cache -t cyanfin-react .
docker rm -f cyanfin-react && docker run -d --name cyanfin-react --restart unless-stopped \
  -p 3002:3000 -v /path/to/data:/app/data cyanfin-react
```

---

## Data directory

```
/app/data/
├── config.json       # All settings
├── sessions.json     # Persisted sessions
├── bg.jpg            # Custom background image
├── cache/            # Library cache, Wikipedia cache (7-day TTL)
└── downloads/        # Offline downloaded video files
```

---

## Windows app

```bash
npm run electron:portable   # → CyanFin-x.x.x-portable.exe
npm run electron:win        # → NSIS installer
```

Portable stores data next to the .exe in `cyanfin-data/`. Supports tray icon, media keys, and single-instance mode.

---

## Android / Android TV

See `build-resources/ANDROID.md` for full instructions.

```bash
# Prerequisites: Android Studio, ANDROID_HOME set
npm install @capacitor/android @capacitor/splash-screen @capacitor/keyboard
npx cap add android

# Build phone APK
npm run android:phone

# Build TV APK (adds Leanback launcher + TV manifest)
npm run android:tv
```

Edit `capacitor.config.ts` to point to your CyanFin server URL before building.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10s |
| `↑` / `↓` | Volume ±10% |
| `F` | Toggle fullscreen |
| `M` | Mute |
| `C` | Subtitles panel |
| `⌘K` | Search |
| `⌘I` | AI Navigator |
| `?` | Keyboard shortcuts overlay |
| `H` | Go to Home |
| `S` | Go to Shows |
| `Esc` | Close / exit player |

---

## Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Framer Motion, TanStack Query, Zustand, HLS.js
- **Server**: Node.js (no framework), serves built assets + proxies all Jellyfin/Plex API calls
- **Desktop**: Electron
- **Mobile**: Capacitor (Android / iOS)

---

## Config reference

Settings are stored in `/app/data/config.json` and can also be set via environment variables.

| Key | Description |
|---|---|
| `JELLYFIN_URL` | Primary Jellyfin server URL |
| `JELLYFIN_API_KEY` | Jellyfin API key |
| `JELLYFIN_SERVERS` | JSON array of N servers (multi-server mode) |
| `PLEX_URL` | Plex server URL |
| `PLEX_TOKEN` | Plex token |
| `PLEX_SERVERS` | JSON array of N Plex servers |
| `TMDB_API_KEY` | TMDB API key (trending, trailers, ratings) |
| `JELLYSEERR_URL` / `JELLYSEERR_API_KEY` | Request integration |
| `RADARR_URL` / `RADARR_API_KEY` | Radarr integration |
| `SONARR_URL` / `SONARR_API_KEY` | Sonarr integration |
| `ANTHROPIC_API_KEY` | Claude AI Navigator |
| `GEMINI_API_KEY` | Gemini AI Navigator |
| `DISCORD_WEBHOOK_URL` | Discord share notifications |

---

## Roadmap highlights

- Chromecast / AirPlay
- Live TV + EPG
- Watch Party (WebSocket rooms)
- iOS app
- Trakt.tv scrobbling
- Smart playlists
- Push notifications

---

## Credits

Built by Shamuoo. Powered by Jellyfin, Plex, TMDB, and open-meteo.
