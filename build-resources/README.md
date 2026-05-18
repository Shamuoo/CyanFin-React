# Build Resources

Place these files here before packaging:

- `icon.ico`  — Windows icon (256x256, multi-size .ico)
- `icon.icns` — macOS icon (.icns format)
- `icon.png`  — Linux icon (512x512 .png)

You can convert the favicon SVG using:
  - https://convertio.co/svg-ico/
  - https://cloudconvert.com/svg-to-icns
  - `magick favicon.svg -resize 256x256 icon.ico`

Without these files, electron-builder will use the default Electron icon.
