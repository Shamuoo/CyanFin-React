#!/bin/bash
# Build CyanFin Windows .exe installer
# Run from repo root: bash scripts/build-windows.sh
set -e
npm run build
npm install --save-dev electron electron-builder 2>/dev/null
npm run electron:win
echo "Done — installer in dist-electron/"
