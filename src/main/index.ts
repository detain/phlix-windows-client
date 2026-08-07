/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage, dialog, protocol, screen, ThumbarButton } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isPathSafe } from './pathUtils';
import { validateExternalUrl } from './urlValidator';
import log from 'electron-log';
import Store from 'electron-store';

// Window bounds persistence schema
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 870;

// Re-export validateExternalUrl for backwards compatibility
export { validateExternalUrl };

const KNOWN_HOSTS = new Set(['media', 'play', 'accept-invite', 'server']);

const ID_PATTERN = /^[a-zA-Z0-9-]+$/;
const TOKEN_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Re-export for unit-testing
export { parseDeepLinkUrl, extractDeepLinkUrl };

function parseDeepLinkUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'phlix:') {
      log.warn(`[deeplink] Invalid protocol: ${parsed.protocol}`);
      return null;
    }

    const host = parsed.hostname;
    if (!host) {
      log.warn('[deeplink] Empty host');
      return null;
    }

    if (!KNOWN_HOSTS.has(host)) {
      log.warn(`[deeplink] Unknown host: ${host}`);
      return null;
    }

    const rawPath = parsed.pathname;
    if (!rawPath || rawPath === '/') {
      log.warn(`[deeplink] Empty path for host: ${host}`);
      return null;
    }

    // Remove leading slash to get the id/token
    const value = rawPath.slice(1);

    if (!value) {
      log.warn(`[deeplink] Empty value after host: ${host}`);
      return null;
    }

    // Check for path traversal attempts
    if (value.includes('..') || value.includes('/')) {
      log.warn(`[deeplink] Path traversal or extra slash attempt: ${value}`);
      return null;
    }

    // Null byte injection check
    if (value.includes('\x00')) {
      log.warn(`[deeplink] Null byte in value: ${value}`);
      return null;
    }

    // Validate based on host type
    if (host === 'accept-invite') {
      if (!TOKEN_PATTERN.test(value)) {
        log.warn(`[deeplink] Invalid token format: ${value}`);
        return null;
      }
    } else {
      if (!ID_PATTERN.test(value)) {
        log.warn(`[deeplink] Invalid id format: ${value}`);
        return null;
      }
    }

    // Build the internal path
    const routePath = `/${host}/${value}`;
    return routePath;
  } catch (err) {
    log.warn(`[deeplink] Failed to parse URL: ${url} — ${err}`);
    return null;
  }
}

function extractDeepLinkUrl(argv: string[]): string | null {
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.startsWith('phlix://')) {
      return arg;
    }
  }
  return null;
}

function handleDeepLinkUrl(url: string): void {
  const path = parseDeepLinkUrl(url);
  if (!path) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deeplink:open', path);
  } else {
    log.warn('[deeplink] mainWindow not available, cannot send deep link');
  }
}

function setAsDefaultProtocolClient(): void {
  if (process.platform === 'win32') {
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient('phlix', process.execPath, [`"${process.execPath}"`]);
    } else {
      app.setAsDefaultProtocolClient('phlix', process.execPath, [`"${process.execPath}"`]);
    }
  }
}

// Cold start: check if a deep link URL was passed via command line
const coldStartUrl = extractDeepLinkUrl(process.argv);
if (coldStartUrl) {
  // Store it for handling after app is ready
  log.info(`[deeplink] Cold start URL detected: ${coldStartUrl}`);
}

// Single-instance lock — ensures only one app window exists at a time.
// Deep links (W4.4) also arrive through the second-instance handler.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', (_event, argv, _workingDirectory) => {
  // Restore and focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
  // Handle deep link from second-instance (warm start on Windows)
  const url = extractDeepLinkUrl(argv);
  if (url) {
    handleDeepLinkUrl(url);
  }
});

const store = new Store<{ minimizeToTray: boolean; windowBounds?: WindowBounds }>();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isPlaying = false;

const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && !process.env.PHLIX_FORCE_PRODUCTION);

log.initialize();
log.info('Phlix Windows starting...');

/**
 * Validates that the given bounds overlap with at least one display's work area.
 */
function isBoundsOnScreen(bounds: WindowBounds): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const wa = display.workArea;
    return (
      bounds.x < wa.x + wa.width &&
      bounds.x + bounds.width > wa.x &&
      bounds.y < wa.y + wa.height &&
      bounds.y + bounds.height > wa.y
    );
  });
}

let saveBoundsTimer: NodeJS.Timeout | null = null;

/**
 * Schedules a debounced save of current window bounds to the store (250ms).
 */
function scheduleSaveBounds(): void {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', {
        x: mainWindow.getBounds().x,
        y: mainWindow.getBounds().y,
        width: mainWindow.getBounds().width,
        height: mainWindow.getBounds().height,
        isMaximized: mainWindow.isMaximized()
      });
    }
  }, 250);
}

function createWindow(): void {
  log.info('Creating main window');

  // Read saved bounds and validate against current displays
  const savedBounds = store.get('windowBounds') as WindowBounds | undefined;
  let useBounds = savedBounds;

  if (savedBounds && !isBoundsOnScreen(savedBounds)) {
    log.warn('Saved window bounds are off-screen, falling back to defaults');
    useBounds = undefined;
  }

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: useBounds?.width ?? DEFAULT_WIDTH,
    height: useBounds?.height ?? DEFAULT_HEIGHT,
    x: useBounds?.x,
    y: useBounds?.y,
    minWidth: 960,
    minHeight: 690,
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };

  mainWindow = new BrowserWindow(windowOptions);

  // Restore maximized state if it was maximized
  if (savedBounds?.isMaximized) {
    mainWindow.maximize();
  }

  // Load content
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://-/app');
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window ready');
    // W4.5: set up taskbar thumbnail toolbar buttons
    setupThumbarButtons();
  });

  // Handle close to tray
  mainWindow.on('close', (event) => {
    // Save window bounds before anything else
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', {
        x: mainWindow.getBounds().x,
        y: mainWindow.getBounds().y,
        width: mainWindow.getBounds().width,
        height: mainWindow.getBounds().height,
        isMaximized: mainWindow.isMaximized()
      });
    }

    if (!isQuitting && store.get('minimizeToTray', true)) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Debounced resize/move handlers for live bounds persistence
  mainWindow.on('resize', scheduleSaveBounds);
  mainWindow.on('move', scheduleSaveBounds);

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (validateExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  /**
   * Guards against renderer-initiated navigation to untrusted URL schemes.
   *
   * Blocks navigation to anything except http: and https:. Dangerous schemes such as
   * file:, javascript:, and data: are prevented from triggering renderer navigation,
   * which stops a malicious page from e.g. exfiltrating local files or launching
   * internal Electron handlers.
   */
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!validateExternalUrl(url)) {
      event.preventDefault();
    }
  });
}

/**
 * Creates the taskbar thumbnail toolbar buttons (previous track, play/pause, next track).
 * Called once after createWindow() and updated via thumbar:update IPC events.
 */
export function setupThumbarButtons(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const iconPath = path.join(__dirname, '../../build/icon.png');
  const baseIcon = nativeImage.createFromPath(iconPath);

  // Fallback: if icon is missing/empty use an empty 1x1 placeholder so buttons
  // still get set (Windows will just show nothing on the buttons, not crash).
  const fallbackIcon = nativeImage.createEmpty();
  const icon = baseIcon.isEmpty() ? fallbackIcon : baseIcon;

  // Build the three buttons: rewind | play-pause | forward (10s seek)
  const prevIcon = icon.resize({ width: 16, height: 16 });
  const playPauseIcon = icon.resize({ width: 16, height: 16 });
  const nextIcon = icon.resize({ width: 16, height: 16 });

  const buttons: ThumbarButton[] = [
    {
      tooltip: 'Previous / Rewind 10s',
      icon: prevIcon,
      click: () => mainWindow?.webContents.send('media-rewind')
    },
    {
      tooltip: isPlaying ? 'Pause' : 'Play',
      icon: playPauseIcon,
      click: () => mainWindow?.webContents.send('media-play-pause')
    },
    {
      tooltip: 'Next / Forward 10s',
      icon: nextIcon,
      click: () => mainWindow?.webContents.send('media-forward')
    }
  ];

  mainWindow.setThumbarButtons(buttons);
}

/**
 * Updates the play/pause button tooltip in the thumbar without rebuilding the
 * full button array. Called by the thumbar:update IPC handler.
 */
function updateThumbarPlayState(playing: boolean): void {
  isPlaying = playing;
  setupThumbarButtons();
}

export function createTray(): void {
  const iconPath = path.join(__dirname, '../../build/icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    log.error(`[tray] Icon not found at ${iconPath}, skipping tray creation`);
    return;
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Phlix', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Play/Pause', click: () => mainWindow?.webContents.send('media-play-pause') },
    { label: 'Stop', click: () => mainWindow?.webContents.send('media-stop') },
    { type: 'separator' },
    { label: 'Minimize to Tray', type: 'checkbox', checked: store.get('minimizeToTray', true),
      click: (menuItem) => store.set('minimizeToTray', menuItem.checked) },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('Phlix Media Server');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

/**
 * Exported for unit-testing of menu accelerator configuration.
 * Single-character keys (Space, Left, Right) use registerAccelerator: false so
 * they do not intercept text input in URL fields or other text controls.
 */
export const playbackMenuTemplate: Electron.MenuItemConstructorOptions[] = [
  { label: 'Play/Pause', accelerator: 'Space', registerAccelerator: false, click: () => mainWindow?.webContents.send('media-play-pause') },
  { label: 'Stop', click: () => mainWindow?.webContents.send('media-stop') },
  { type: 'separator' },
  { label: 'Rewind', accelerator: 'Left', registerAccelerator: false, click: () => mainWindow?.webContents.send('media-rewind') },
  { label: 'Fast Forward', accelerator: 'Right', registerAccelerator: false, click: () => mainWindow?.webContents.send('media-forward') },
  { type: 'separator' },
  { label: 'Fullscreen', accelerator: 'F11', click: () => toggleFullscreen() }
];

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Playback',
      submenu: playbackMenuTemplate
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Phlix', click: () => showAbout() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function openSettings(): void {
  mainWindow?.webContents.send('open-settings');
}

function toggleFullscreen(): void {
  if (!mainWindow) return;

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  } else {
    mainWindow.setFullScreen(true);
  }
}

function showAbout(): void {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About Phlix',
    message: 'Phlix Media Server',
    detail: `Version ${app.getVersion()}\n\nA free media server for your home.`
  });
}

// IPC Handlers
ipcMain.handle('get-app-path', () => app.getPath('userData'));

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.on('set-always-on-top', (_, value: boolean) => {
  mainWindow?.setAlwaysOnTop(value);
});

ipcMain.on('minimize-to-tray', () => {
  mainWindow?.hide();
});

ipcMain.handle('tray:get-minimize-to-tray', () => store.get('minimizeToTray', true));

ipcMain.on('tray:set-minimize-to-tray', (_, val: boolean) => store.set('minimizeToTray', val));

// Hub configuration handlers
ipcMain.handle('hub:get-config', () => {
  return {
    hubUrl: store.get('hubUrl', null),
    activeServerId: store.get('activeServerId', null),
    connectionMode: store.get('connectionMode', 'direct')
  };
});

ipcMain.handle('hub:set-config', (_, config: { hubUrl?: string; activeServerId?: string; connectionMode?: string }) => {
  if (config.hubUrl !== undefined) store.set('hubUrl', config.hubUrl);
  if (config.activeServerId !== undefined) store.set('activeServerId', config.activeServerId);
  if (config.connectionMode !== undefined) store.set('connectionMode', config.connectionMode);
});

// Direct server URL handlers
ipcMain.handle('app:get-server-url', () => {
  return store.get('serverUrl', null);
});

ipcMain.handle('app:set-server-url', (_, url: string) => {
  store.set('serverUrl', url);
});

/**
 * Returns a stable, per-installation device identifier.
 *
 * On first call a UUID-based ID is generated and persisted to electron-store.
 * Subsequent calls return the same ID for the lifetime of the installation.
 * The ID is sent to the server as `X-Phlix-Device-ID` via `buildPhlixHeaders`.
 */
ipcMain.handle('app:get-device-id', () => {
  let deviceId = store.get('deviceId') as string | undefined;
  if (!deviceId) {
    deviceId = `windows-${randomUUID()}`;
    store.set('deviceId', deviceId);
  }
  return deviceId;
});

// W4.5: thumbar buttons — renderer sends updated play state to refresh play/pause icon
ipcMain.on('thumbar:update', (_, state: { playing: boolean }) => {
  updateThumbarPlayState(state.playing);
});

// W4.5: taskbar progress bar — renderer sends current/total position
ipcMain.on('playback:progress', (_, progress: { current: number; total: number }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { current, total } = progress;
  if (total > 0 && current < total) {
    mainWindow.setProgressBar(current / total);
  } else {
    // total === 0 or current >= total: clear the progress bar
    mainWindow.setProgressBar(-1);
  }
});

// App lifecycle

// Register custom privileged scheme BEFORE app.whenReady()
// This must be called synchronously before any ready event
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

// Renderer dist base directory (absolute path)
export const RENDERER_DIST_DIR = path.join(__dirname, '../renderer');

/**
 * Handles app:// protocol requests in production.
 *
 * Maps URLs like app://-/app/servers -> dist/renderer/servers (or index.html if not found).
 * Provides path traversal protection by resolving the requested path against
 * RENDERER_DIST_DIR and verifying the result is within that directory.
 * Falls back to index.html for SPA routing (HTML5 history fallback).
 */
export function setupAppProtocolHandler(): void {
  protocol.handle('app', (request) => {
    const urlStr = request.url;
    // urlStr is like app://-/app/servers or app://-/app/assets/main.js
    const parsedUrl = new URL(urlStr);
    const urlPath = parsedUrl.pathname;

    // Validate hostname is '-' (security requirement for app:// protocol)
    if (parsedUrl.hostname !== '-') {
      return new Response('Forbidden', { status: 403 });
    }

    // Validate pathname starts with /app/ (the SPA routing prefix)
    if (!urlPath.startsWith('/app/')) {
      log.warn(`[app protocol] Invalid path format: ${urlPath}`);
      return new Response('Forbidden', { status: 403 });
    }

    const routingPath = urlPath;
    let relativePath = routingPath;

    // If path doesn't look like a file request (no extension), treat as SPA route
    // Serve index.html for any path that doesn't have a file extension
    const isFileRequest = /\.\w+$/.test(routingPath);

    if (!isFileRequest) {
      // SPA route - serve index.html
      const indexPath = path.join(RENDERER_DIST_DIR, 'index.html');
      try {
        const indexContent = fs.readFileSync(indexPath);
        return new Response(indexContent, {
          headers: { 'Content-Type': 'text/html' }
        });
      } catch (err) {
        log.error(`[app protocol] Failed to serve index.html: ${err}`);
        return new Response('Not Found', { status: 404 });
      }
    }

    // File request - map to dist/renderer/assets/...
    // routingPath is like /app/assets/main.js
    // We want assets/main.js
    relativePath = routingPath.replace(/^\/app\//, '');

    // Path traversal protection: ensure resolved path is within RENDERER_DIST_DIR
    if (!isPathSafe(RENDERER_DIST_DIR, relativePath)) {
      log.warn(`[app protocol] Path traversal attempt blocked: ${relativePath}`);
      return new Response('Forbidden', { status: 403 });
    }

    const absoluteFilePath = path.resolve(RENDERER_DIST_DIR, relativePath);

    // Check if file exists
    if (!fs.existsSync(absoluteFilePath)) {
      log.warn(`[app protocol] File not found: ${absoluteFilePath}, serving index.html`);
      // SPA fallback for missing files (e.g., missing asset that was namespaced)
      try {
        const indexContent = fs.readFileSync(path.join(RENDERER_DIST_DIR, 'index.html'));
        return new Response(indexContent, {
          headers: { 'Content-Type': 'text/html' }
        });
      } catch (err) {
        log.error(`[app protocol] Failed to serve index.html: ${err}`);
        return new Response('Not Found', { status: 404 });
      }
    }

    // Serve the file
    try {
      const fileContent = fs.readFileSync(absoluteFilePath);
      const ext = path.extname(absoluteFilePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.ico': 'image/x-icon'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      return new Response(fileContent, {
        headers: { 'Content-Type': contentType }
      });
    } catch (err) {
      log.error(`[app protocol] Failed to read file ${absoluteFilePath}: ${err}`);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
  log.info('[app protocol] Handler registered');
}

app.whenReady().then(() => {
  log.info('App ready');
  setupAppProtocolHandler();
  setAsDefaultProtocolClient();
  createWindow();
  createMenu();
  createTray();

  // Handle cold start deep link
  if (coldStartUrl) {
    handleDeepLinkUrl(coldStartUrl);
  }
});

// Handle open-url event on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  log.info(`[deeplink] open-url event: ${url}`);
  handleDeepLinkUrl(url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
