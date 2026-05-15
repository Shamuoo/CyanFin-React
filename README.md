# CyanFin React

> ⚠️ **AI-Generated Project** — Built entirely through conversation with [Claude](https://anthropic.com) by Anthropic. All code, architecture and documentation is AI-assisted.

**CyanFin is a self-hosted, cinema-quality frontend for [Jellyfin](https://jellyfin.org)** — fast, modern, and built for home theater use. Runs as a single Docker container alongside your Jellyfin instance.

---

## Features

### 🎬 Playback
- Smart stream negotiation — direct play first, HLS transcode fallback
- Version picker — choose between multiple media sources (1080p MKV, 4K HEVC, etc.)
- Audio track picker — switch between language/codec options before playing
- Skip Intro / Skip Credits — detects Jellyfin segments automatically
- Picture-in-Picture, fullscreen, keyboard shortcuts
- HLS.js for transcoded streams, native browser for direct play

### 🏠 Home
- Cinematic hero section with backdrop, logo, Play + Info buttons
- Animated hero crossfade between recently added items
- Rows: Continue Watching, Recently Added, Popular, History, Best in 3D, On This Day, Coming Soon

### 🎥 Movies & TV
- Grid with sort, genre filter, infinite scroll
- TV Shows → Seasons → Episodes with play buttons and progress bars
- Quality badges: 4K (gold), 1080p (blue), 720p (grey), 3D (green)
- Audio badges: Atmos, DTS:X, TrueHD, DTS-HD MA, etc.

### 🤖 AI Navigator
- Press `⌘I` to open — powered by Claude or Gemini
- Natural language: "Play Barbie", "Show sci-fi movies", "What's on my continue watching?"
- Tool-calling agent that searches your library and executes actions
- Multi-provider: Claude (Anthropic) or Gemini (Google)

### 🎵 Music
- Album grid → track list → play queue
- Persistent audio bar with play/pause/skip/shuffle/repeat
- Volume control, progress scrubber

### 📊 Stats
- Watch time bar chart (last 30 days)
- Top genres with progress bars
- Most watched movies
- Summary cards: movies watched, episodes, hours

### 🔧 Library Tools
- Quality report: SD files, upgrade candidates, poor audio
- Missing content: no poster, no backdrop, no overview
- Quick actions: scan, refresh metadata, refresh images
- AI metadata fix (requires Anthropic key)

### 📡 Health
- Server latency, version, OS
- CPU, RAM, disk usage with colour-coded bars
- Active sessions and transcoding count
- Integration status: Jellyseerr, Radarr, Sonarr, Discord, Anthropic, Gemini

### ⚙️ Settings
- 5 themes: Cinema (gold), Midnight (blue), Ember (orange), Arctic (light), Neon (cyan)
- Layouts: Desktop, TV, Mobile
- Integrations: Radarr, Sonarr, Jellyseerr, TMDB, Anthropic, Gemini, Discord — all configurable in UI, saved to server
- Test connection buttons for each integration

### 📺 Android TV / Smart TV
- PWA installable from browser (no app store required)
- `display: fullscreen` manifest — installs as a native-feeling app
- D-pad navigation when layout is set to TV mode
- Focus rings visible for remote control navigation

---

## Quick Start

```bash
docker run -d --name cyanfin --restart unless-stopped \
  -p 3000:3000 \
  -v /your/appdata/cyanfin/data:/app/data \
  -e JELLYFIN_URL="http://192.168.1.x:8096" \
  ghcr.io/shamuoo/cyanfin-react:latest
```

Open `http://your-server-ip:3000` and sign in with your Jellyfin credentials.

## Full Setup

```bash
docker run -d --name cyanfin --restart unless-stopped \
  -p 3000:3000 \
  -v /your/appdata/cyanfin/data:/app/data \
  -e JELLYFIN_URL="http://192.168.1.x:8096" \
  -e TMDB_API_KEY="your_tmdb_key" \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e GEMINI_API_KEY="AIza..." \
  -e JELLYSEERR_URL="http://192.168.1.x:5055" \
  -e JELLYSEERR_API_KEY="your_key" \
  -e RADARR_URL="http://192.168.1.x:7878" \
  -e RADARR_API_KEY="your_key" \
  -e SONARR_URL="http://192.168.1.x:8989" \
  -e SONARR_API_KEY="your_key" \
  -e DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  ghcr.io/shamuoo/cyanfin-react:latest
```

> All integration keys can also be set in **Settings → Integrations** after login — no rebuild required.

## Unraid / Self-Build

```bash
mkdir /mnt/user/appdata/cyanfin-react
cd /mnt/user/appdata/cyanfin-react
git clone https://github.com/Shamuoo/CyanFin-React.git .
docker build -t cyanfin-react .
docker run -d --name cyanfin-react --restart unless-stopped \
  -p 3002:3000 \
  -v /mnt/user/appdata/cyanfin-react/data:/app/data \
  -e JELLYFIN_URL="http://192.168.1.125:8096" \
  cyanfin-react
```

## Update

```bash
cd /mnt/user/appdata/cyanfin-react && git stash && git pull && npm run build && docker restart cyanfin-react
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JELLYFIN_URL` | ✅ | Jellyfin server URL e.g. `http://192.168.1.100:8096` |
| `TMDB_API_KEY` | No | Enables trailers, Coming Soon, On This Day |
| `ANTHROPIC_API_KEY` | No | Claude AI Navigator + metadata fix |
| `GEMINI_API_KEY` | No | Gemini AI Navigator alternative |
| `JELLYSEERR_URL` + `_API_KEY` | No | Media requests from detail pages |
| `RADARR_URL` + `_API_KEY` | No | Download queue in stats |
| `SONARR_URL` + `_API_KEY` | No | Download queue in stats |
| `DISCORD_WEBHOOK_URL` | No | Share button on detail pages |
| `CONFIG_PATH` | No | Config file path (default: `/app/data/config.json`) |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10s |
| `↑` / `↓` | Volume |
| `F` | Fullscreen |
| `M` | Mute |
| `Escape` | Exit player / close modal |
| `⌘K` | Search |
| `⌘I` | AI Navigator |

## Android TV

1. Open `http://your-server-ip:3000` in Chrome on your Android TV
2. Menu → "Add to Home screen" → Install
3. In Settings → Layout → select **TV**
4. D-pad navigation is now active

## Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Framer Motion, Tanstack Query, Zustand
- **Backend**: Node.js (no framework, zero runtime npm deps)
- **Player**: HLS.js + native browser fallback
- **AI**: Claude (Anthropic) or Gemini (Google) with tool-calling

## License

GPL-3.0 — same as Jellyfin.

> *Every line of code in CyanFin was written through conversation with Claude by Anthropic. It is an experiment in what AI-assisted development looks like for a real, self-hosted home theater use case.*
