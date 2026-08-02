/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage, dialog, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isPathSafe } from './pathUtils';
import { validateExternalUrl } from './urlValidator';
import log from 'electron-log';
import Store from 'electron-store';

// Re-export validateExternalUrl for backwards compatibility
export { validateExternalUrl };

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// SyncPlay WebSocket state
let syncPlayWs: WebSocket | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

log.initialize();
log.info('Phlix Windows starting...');

function createWindow(): void {
  log.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 870,
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
  });

  // Load content
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: use app:// protocol for packaged renderer
    // This avoids webSecurity issues with module fetches from file:// origin
    mainWindow.loadURL('app://-/app');
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window ready');
  });

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray', true)) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

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

function createTray(): void {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../../build/icon.png')
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Phlix', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Play/Pause', click: () => mainWindow?.webContents.send('media-play-pause') },
    { label: 'Stop', click: () => mainWindow?.webContents.send('media-stop') },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      store.set('minimizeToTray', false);
      app.quit();
    }}
  ]);

  tray.setToolTip('Phlix Media Server');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open File...', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        { label: 'Play/Pause', accelerator: 'Space', click: () => mainWindow?.webContents.send('media-play-pause') },
        { label: 'Stop', click: () => mainWindow?.webContents.send('media-stop') },
        { type: 'separator' },
        { label: 'Rewind', accelerator: 'Left', click: () => mainWindow?.webContents.send('media-rewind') },
        { label: 'Fast Forward', accelerator: 'Right', click: () => mainWindow?.webContents.send('media-forward') },
        { type: 'separator' },
        { label: 'Fullscreen', accelerator: 'F11', click: () => toggleFullscreen() }
      ]
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

async function openFile(): Promise<void> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'] },
      { name: 'Audio Files', extensions: ['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('file-opened', result.filePaths[0]);
  }
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

/**
 * Parameters for establishing a SyncPlay collaborative viewing session.
 */
interface SyncPlayConnectParams {
  roomId: string;
  serverUrl: string;
  token: string;
}

ipcMain.handle('syncplay:connect', async (_, { roomId, serverUrl, token }: SyncPlayConnectParams) => {
  log.info(`SyncPlay connecting to room ${roomId} at ${serverUrl}`);

  // Disconnect existing connection if any
  if (syncPlayWs) {
    syncPlayWs.close();
    syncPlayWs = null;
  }

  const wsUrl = `${serverUrl.replace('http', 'ws')}/api/v1/syncplay/${roomId}?token=${encodeURIComponent(token)}`;

  try {
    syncPlayWs = new WebSocket(wsUrl);

    syncPlayWs.onopen = () => {
      log.info('SyncPlay WebSocket connected');
      mainWindow?.webContents.send('syncplay:connected', roomId);
    };

    syncPlayWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        mainWindow?.webContents.send('syncplay:message', message);
      } catch (err) {
        log.error('SyncPlay message parse error:', err);
      }
    };

    syncPlayWs.onerror = (error) => {
      log.error('SyncPlay WebSocket error:', error);
    };

    syncPlayWs.onclose = () => {
      log.info('SyncPlay WebSocket closed');
      syncPlayWs = null;
      mainWindow?.webContents.send('syncplay:disconnected');
    };
  } catch (err) {
    log.error('SyncPlay connection error:', err);
    throw err;
  }
});

ipcMain.handle('syncplay:disconnect', () => {
  log.info('SyncPlay disconnecting');
  if (syncPlayWs) {
    syncPlayWs.close();
    syncPlayWs = null;
  }
});

ipcMain.handle('syncplay:send', (_, message: unknown) => {
  if (syncPlayWs && syncPlayWs.readyState === WebSocket.OPEN) {
    syncPlayWs.send(JSON.stringify(message));
  } else {
    log.warn('SyncPlay WebSocket not connected, cannot send message');
  }
});

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
const RENDERER_DIST_DIR = path.join(__dirname, '../renderer');

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

    // Validate the hostname is '-' (the marker that identifies our app:// scheme)
    // For app://-/app/servers: hostname='-', pathname='/app/servers'
    if (parsedUrl.hostname !== '-') {
      log.warn(`[app protocol] Invalid path format: ${urlPath}`);
      return new Response('Forbidden', { status: 403 });
    }

    const routingPath = urlPath; // pathname IS the routing path (e.g., /app/servers)
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

// App lifecycle
app.whenReady().then(() => {
  log.info('App ready');
  setupAppProtocolHandler();
  createWindow();
  createMenu();
  createTray();
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
  store.set('minimizeToTray', false);
  // Close SyncPlay WebSocket on quit
  if (syncPlayWs) {
    syncPlayWs.close();
    syncPlayWs = null;
  }
});

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
