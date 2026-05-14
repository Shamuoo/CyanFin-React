# CyanFin React

> ⚠️ AI-Generated Project — built entirely with Claude by Anthropic.

CyanFin v0.11 — React frontend rewrite. Same Node.js server, new React + TypeScript + Tailwind frontend.

## Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Framer Motion, Tanstack Query
- **Backend**: Node.js (same server as v0.10)
- **Player**: HLS.js with automatic fallback to direct stream

## Dev
```bash
npm install
npm run dev   # frontend on :5173 (proxies /api to :3000)
```

## Build
```bash
npm run build  # outputs to server/public
```

## Docker
```bash
docker build -t cyanfin-react .
docker run -d --name cyanfin -p 3000:3000 \
  -v /your/appdata/cyanfin/data:/app/data \
  -e JELLYFIN_URL="http://192.168.1.x:8096" \
  cyanfin-react
```
