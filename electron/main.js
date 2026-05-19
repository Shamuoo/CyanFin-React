'use strict';
/**
 * CyanFin Windows / Mac Desktop App
 * Electron main process — embeds the CyanFin Node server and opens a native window.
 *
 * BUILD (Windows .exe installer):
 *   npm install --save-dev electron electron-builder
 *   npm run build          (builds the React frontend first)
 *   npm run electron:build (packages with electron-builder)
 *   → dist-electron/CyanFin Setup x.x.x.exe
 *
 * DEV:
 *   npm run build && npm run electron
 */

const {
  app, BrowserWindow, Menu, Tray, nativeImage,
  shell, ipcMain, globalShortcut, dialog,
} = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs   = require('fs');

const PORT        = 3002;
// Portable mode: store data next to the .exe instead of AppData
const IS_PORTABLE = !!process.env.PORTABLE_EXECUTABLE_DIR
const DATA_DIR    = IS_PORTABLE
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'cyanfin-data')
  : path.join(app.getPath('userData'), 'cyanfin-data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const IS_WIN      = process.platform === 'win32';
const IS_MAC      = process.platform === 'darwin';
const IS_DEV      = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow    = null;
let tray          = null;
let serverProcess = null;
let isQuitting    = false;

// ── Ensure data directory exists ──────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Single instance lock ──────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

// ── Start the embedded CyanFin server ─────────────────────────────────────────
function startServer() {
  // In packaged app, node is bundled; in dev use system node
  const nodeBin = IS_DEV ? 'node' : path.join(process.resourcesPath, 'node', IS_WIN ? 'node.exe' : 'node');
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'index.js')
    : path.join(__dirname, '..', 'server', 'index.js');

  console.log('[electron] Starting server:', serverEntry);

  serverProcess = spawn(IS_DEV ? 'node' : nodeBin, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(PORT),
      CONFIG_PATH,
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Detach on Windows to prevent zombie processes
    ...(IS_WIN ? { detached: false } : {}),
  });

  serverProcess.stdout?.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.log('[server]', msg);
  });
  serverProcess.stderr?.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.error('[server]', msg);
  });
  serverProcess.on('exit', (code, signal) => {
    console.log(`[server] exited code=${code} signal=${signal}`);
    if (!isQuitting && code !== 0) {
      // Restart on crash
      setTimeout(startServer, 2000);
    }
  });
}

// ── Wait for server to respond ────────────────────────────────────────────────
function waitForServer(maxAttempts = 40, attempt = 0) {
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(`http://localhost:${PORT}/api/public/info`, res => {
        res.resume();
        if (res.statusCode < 500) return resolve();
        if (attempt < maxAttempts) setTimeout(() => waitForServer(maxAttempts, attempt + 1).then(resolve).catch(reject), 500);
        else reject(new Error('Server failed to start'));
      }).on('error', () => {
        if (attempt < maxAttempts) setTimeout(() => waitForServer(maxAttempts, attempt + 1).then(resolve).catch(reject), 500);
        else reject(new Error('Server not responding after 20 seconds'));
      });
    };
    check();
  });
}

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  // Persist window bounds
  const defaultBounds = { width: 1400, height: 880 };
  let savedBounds = defaultBounds;
  try {
    const boundsFile = path.join(DATA_DIR, 'window.json');
    if (fs.existsSync(boundsFile)) savedBounds = { ...defaultBounds, ...JSON.parse(fs.readFileSync(boundsFile, 'utf8')) };
  } catch {}

  mainWindow = new BrowserWindow({
    ...savedBounds,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#080604',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    frame: !IS_WIN,              // frameless on Windows — we draw our own chrome
    ...(IS_WIN ? { titleBarOverlay: { color: '#080604', symbolColor: '#c9a84c', height: 40 } } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: IS_WIN
      ? path.join(__dirname, '..', 'public', 'icon.ico')
      : path.join(__dirname, '..', 'public', 'favicon.png'),
    show: false,
  });

  // Save window size on close
  mainWindow.on('close', () => {
    try {
      const b = mainWindow.getBounds();
      fs.writeFileSync(path.join(DATA_DIR, 'window.json'), JSON.stringify(b));
    } catch {}
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (savedBounds.maximized) mainWindow.maximize();
    if (IS_MAC) app.dock.show();
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Windows: hide to tray on close instead of quitting
  if (IS_WIN) {
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });
  }
}

// ── System tray ───────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = IS_WIN
    ? path.join(__dirname, '..', 'public', 'icon.ico')
    : path.join(__dirname, '..', 'public', 'favicon.png');

  let trayIcon;
  try { trayIcon = nativeImage.createFromPath(iconPath); }
  catch { trayIcon = nativeImage.createEmpty(); }
  if (!trayIcon.isEmpty() && IS_WIN) trayIcon = trayIcon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('CyanFin');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: 'Open CyanFin', click: () => { mainWindow ? mainWindow.show() : createWindow(); mainWindow?.focus(); } },
    { label: 'Reload',       click: () => mainWindow?.webContents.reload() },
    { type: 'separator' },
    { label: `v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: IS_WIN ? 'Quit CyanFin' : 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => { mainWindow ? mainWindow.show() : createWindow(); mainWindow?.focus(); });
}

// ── App menu ──────────────────────────────────────────────────────────────────
function buildAppMenu() {
  const template = [
    ...(IS_MAC ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' },
    ]}] : []),
    { label: 'View', submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
      { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      ...(IS_DEV ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' },
      ...(IS_MAC ? [{ role: 'zoom' }] : [{ role: 'minimize' }]),
      { type: 'separator' },
      { role: 'close' },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template as any));
}

// ── Global media key shortcuts ────────────────────────────────────────────────
function registerMediaKeys() {
  try {
    globalShortcut.register('MediaPlayPause', () => mainWindow?.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}))"));
    globalShortcut.register('MediaNextTrack',  () => mainWindow?.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',bubbles:true}))"));
    globalShortcut.register('MediaPreviousTrack', () => mainWindow?.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',code:'KeyP',bubbles:true}))"));
  } catch(e) { console.warn('[electron] Media keys unavailable:', e.message); }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('app-version',    () => app.getVersion());
ipcMain.handle('open-external',  (_, url) => shell.openExternal(url));
ipcMain.handle('data-dir',       () => DATA_DIR);
ipcMain.handle('minimize',       () => mainWindow?.minimize());
ipcMain.handle('maximize',       () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle('close',          () => { if (IS_WIN) mainWindow?.hide(); else mainWindow?.close(); });

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  buildAppMenu();
  createTray();
  startServer();

  try {
    await waitForServer();
    createWindow();
    registerMediaKeys();
  } catch(e) {
    console.error('[electron] Failed to start:', e);
    dialog.showErrorBox('CyanFin', `Failed to start server: ${e.message}\n\nCheck that port ${PORT} is not in use.`);
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

app.on('window-all-closed', () => {
  if (!IS_MAC && !tray) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    // Force kill after 2s on Windows
    if (IS_WIN) setTimeout(() => { try { serverProcess?.kill('SIGKILL'); } catch {} }, 2000);
  }
});
