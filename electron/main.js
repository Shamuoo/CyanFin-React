const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const PORT = 3002
let mainWindow = null
let tray = null
let serverProcess = null

// ── Start embedded CyanFin server ─────────────────────────────────────────────
function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js')
  serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      CONFIG_PATH: path.join(app.getPath('userData'), 'config.json'),
    },
    stdio: 'pipe',
  })
  serverProcess.stdout.on('data', d => console.log('[server]', d.toString().trim()))
  serverProcess.stderr.on('data', d => console.error('[server]', d.toString().trim()))
  serverProcess.on('exit', code => console.log('[server] exited', code))
}

// ── Wait for server to be ready ───────────────────────────────────────────────
function waitForServer(attempts = 0) {
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(`http://localhost:${PORT}/api/public/info`, res => {
        res.resume()
        if (res.statusCode < 500) resolve()
        else if (attempts < 30) setTimeout(check, 500)
        else reject(new Error('Server failed to start'))
      }).on('error', () => {
        if (attempts < 30) setTimeout(() => waitForServer(attempts + 1).then(resolve).catch(reject), 500)
        else reject(new Error('Server not responding'))
      })
    }
    check()
  })
}

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#080604',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,    // allow loading from localhost
    },
    icon: path.join(__dirname, '..', 'public', 'favicon.svg'),
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (process.platform === 'darwin') app.dock.show()
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── Tray icon ─────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'public', 'favicon.svg'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  const menu = Menu.buildFromTemplate([
    { label: 'Open CyanFin', click: () => { if (mainWindow) mainWindow.focus(); else createWindow() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('CyanFin')
  tray.on('double-click', () => { if (mainWindow) mainWindow.focus(); else createWindow() })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startServer()
  try {
    await waitForServer()
    createWindow()
    createTray()
  } catch(e) {
    console.error('Server failed to start:', e)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray on macOS
    if (process.platform === 'darwin') app.dock.hide()
  }
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill()
})

// Auto-updater placeholder
ipcMain.handle('app-version', () => app.getVersion())
ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
