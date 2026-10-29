/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage, dialog, protocol, screen, powerSaveBlocker, Notification, safeStorage } from 'electron';
import type { MessageBoxOptions, ThumbarButton } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isPathSafe } from './pathUtils';
import { validateExternalUrl } from './urlValidator';
import { checkMinServerVersion, type ServerVersionCheck } from './versionCheck';
import {
  parseDeepLinkUrl,
  extractDeepLinkUrl,
  redactDeepLinkUrl,
  createDeepLinkDeduper
} from './deepLinkValidator';
import { getMainLocale, setMainLocale, t } from './i18n';
import { restoreWindow } from './windowRestore';
import { createSecretCustody } from './secretStore';
import type { SettingsSink } from './secretStore';
import log from 'electron-log';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';

// W4.12: GPU escape hatch — read before the app readiness callback so it takes effect.
// Check env var at module level (before store exists) and also check store preference after app is ready.
if (process.env.PHLIX_DISABLE_GPU === '1') {
  log.info('[gpu] Hardware acceleration disabled by PHLIX_DISABLE_GPU=1');
  app.disableHardwareAcceleration();
}

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

// The canonical deep-link grammar lives in src/main/deepLinkValidator.ts
// (W3 unification: this file used to re-implement it inline — that fork is
// gone). Re-exported here for the existing unit-test import surface.
export { parseDeepLinkUrl, extractDeepLinkUrl };

// W-low(a): once-guard window — the same URL arriving twice inside this
// window (double OS delivery, double notification click) is delivered once.
const DEEPLINK_DEDUPE_WINDOW_MS = 2000;
const deepLinkDeduper = createDeepLinkDeduper(DEEPLINK_DEDUPE_WINDOW_MS);

// M-WINDOWS-06: pending-deeplink queue + renderer-receiver handshake.
// History: cold-start delivery was a fixed `setTimeout(…, 1000)` armed on
// 'browser-window-created'. That was a race, not a contract: the renderer
// subscribes to 'deeplink:open' only inside boot(), AFTER three IPC
// round-trips and an HTTP server-version check (src/renderer/main.ts), so a
// slow boot pushed the subscription past the 1000ms mark and Electron
// silently dropped the message — the link was lost with no error and no
// retry. Delivery is now event-driven: EVERY deep-link surface enqueues here
// and the drain runs only when the renderer announces (via the
// 'deeplink:ready' handshake) that its listener is actually live.
const pendingDeepLinks: string[] = [];
let deepLinkReceiverReady = false;

/**
 * The single entry point for every deep link the app receives (cold start,
 * second-instance argv, macOS open-url, notification click). Enqueue, then
 * attempt the drain: a warm, subscribed renderer receives the link on the
 * same tick; anything earlier waits in the queue for the handshake.
 */
function handleDeepLinkUrl(url: string): void {
  pendingDeepLinks.push(url);
  drainPendingDeepLinks();
}

/**
 * M-WINDOWS-15 (windows__gameux M4): the user-visible surface for a deep link
 * the app RECEIVED but could not route. Before this, every parse rejection
 * (unknown host, malformed id/token, non-/app internal path, oversized link)
 * was a log-only drop — the clicking user saw nothing, which is the same
 * "silent no-op" failure shape the review condemns for the broken grammar.
 *
 * Redaction law (W3): the detail line carries ONLY the redacted form of the
 * link — a malformed accept-invite candidate may still contain a live secret.
 * Exported for tests (same seam idiom as showServerTooOldDialog).
 */
export function showDeepLinkRejectedDialog(url: string): void {
  const options: MessageBoxOptions = {
    type: 'warning',
    title: t('deeplink.failedTitle'),
    message: t('deeplink.failedMessage'),
    detail: redactDeepLinkUrl(url)
  };
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  if (parent) {
    dialog.showMessageBox(parent, options);
  } else {
    dialog.showMessageBox(options);
  }
}

/**
 * Deliver every queued link, FIFO, exactly once (drain-once semantics via
 * explicit state): each URL leaves the queue BEFORE its dispatch, so a
 * re-entrant or repeated handshake can never deliver it twice, and an
 * unparsable entry cannot poison the loop. Readiness is held only by the
 * renderer's 'deeplink:ready' handshake — load failures never announce it,
 * so the queue survives them and the next successful load's handshake
 * delivers (re-drain path per the did-start-loading re-arm in createWindow).
 */
function drainPendingDeepLinks(): void {
  if (!deepLinkReceiverReady) return; // the handshake will drain later
  if (!mainWindow || mainWindow.isDestroyed()) {
    // Stale announcement (window replaced or destroyed since): keep the
    // queue, wait for a live window's handshake instead of dropping.
    deepLinkReceiverReady = false;
    return;
  }
  const rejectedUrls: string[] = [];
  while (pendingDeepLinks.length > 0) {
    const url = pendingDeepLinks.shift()!;
    if (deepLinkDeduper.suppresses(url)) {
      log.info(`[deeplink] Duplicate delivery suppressed within ${DEEPLINK_DEDUPE_WINDOW_MS}ms: ${redactDeepLinkUrl(url)}`);
      continue;
    }
    const path = parseDeepLinkUrl(url);
    if (!path) {
      // M-WINDOWS-15: the parser already logged the rejection (redacted); the
      // USER also gets told. One dialog per drain — a burst of bad links is a
      // single honest surface, not a modal pile-up (each rejection keeps its
      // redacted log line for diagnosis).
      rejectedUrls.push(url);
      continue;
    }
    mainWindow.webContents.send('deeplink:open', path);
  }
  if (rejectedUrls.length > 0) {
    showDeepLinkRejectedDialog(rejectedUrls[0]!);
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
  // W3: never log a raw cold-start URL — it may carry a one-time invite token.
  log.info(`[deeplink] Cold start URL detected: ${redactDeepLinkUrl(coldStartUrl)}`);
  // This is the ONLY cold-start dispatch (W-low(a) law stands: the whenReady
  // callback must never add a second one). M-WINDOWS-06 replaced the former
  // 'browser-window-created' + setTimeout(1000) arm — a fixed delay racing
  // the renderer's late IPC subscription — with the pendingDeepLinks queue:
  // the link waits here until the renderer's 'deeplink:ready' handshake
  // drains it. Nothing time-driven remains on this path.
  handleDeepLinkUrl(coldStartUrl);
}

// Single-instance lock — ensures only one app window exists at a time.
// Deep links (W4.4) also arrive through the second-instance handler.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', (_event, argv, _workingDirectory) => {
  // M-WINDOWS-03: the lock keeps this the only live process, so clicking the
  // app icon while hidden-to-tray lands HERE. The previous body called
  // focus() on a hidden window — focus() does not un-hide (BrowserWindow
  // docs: show() is what "shows and gives focus"), which is exactly why the
  // icon click did nothing. restoreWindow() covers minimized/hidden/destroyed.
  restoreWindow(mainWindow);
  // Handle deep link from second-instance (warm start on Windows).
  // M-WINDOWS-06: same queue + drain helper as every other surface — no
  // second bespoke timer. On a warm, subscribed app the drain delivers on
  // this very call; in the rare early window (renderer still booting) the
  // link waits for the handshake instead of being dropped.
  const url = extractDeepLinkUrl(argv);
  if (url) {
    handleDeepLinkUrl(url);
  }
});

// M-WINDOWS-06: the renderer's readiness handshake for deep-link delivery.
// boot() sends 'deeplink:ready' only AFTER api.onDeeplink(...) has actually
// subscribed to 'deeplink:open' (src/renderer/main.ts) — the one signal that
// matches when the receiver is live. did-finish-load/dom-ready were rejected
// as the drain trigger on purpose: they fire long before that subscription
// (boot awaits three IPC round-trips plus an HTTP version check), so draining
// on them would re-create the drop-the-message race with a new name.
// The sender must be the current main window's webContents: a stale signal
// from a replaced or destroyed webContents may not drain the queue anywhere.
ipcMain.on('deeplink:ready', (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    log.warn('[deeplink] Ignored deeplink:ready from a non-current webContents');
    return;
  }
  deepLinkReceiverReady = true;
  drainPendingDeepLinks();
});

// W-low(d): every key touched via store.get/set is declared here — previously
// hubUrl/activeServerId/connectionMode/serverUrl/deviceId/notificationsEnabled
// were used untyped (Store<> generic omitted them).
const store = new Store<{
  minimizeToTray: boolean;
  windowBounds?: WindowBounds;
  disableHardwareAcceleration: boolean;
  hubUrl?: string | null;
  activeServerId?: string | null;
  connectionMode?: string;
  serverUrl?: string | null;
  deviceId?: string;
  notificationsEnabled?: boolean;
}>();

// M-WINDOWS-11: safeStorage (DPAPI) custody for the persisted quasi-secrets.
// `deviceId` is the stable installation identifier echoed on the wire as
// X-Phlix-Device-ID; `serverUrl`/`hubUrl` are the auth endpoints the @phlix/ui
// ApiClient auto-attaches bearer tokens to. Before this fix all three lived
// PLAINTEXT in config.json (review windows__exploiter MAJOR-11). They now go
// through src/main/secretStore.ts: envelope values on disk, legacy plaintext
// rows migrated on first read (verify-after-write, never-orphan), and a
// DISCLOSED plaintext fallback only where OS encryption is unavailable.
// Non-secret preferences (minimizeToTray, windowBounds, GPU/power/notification
// toggles, connectionMode, activeServerId) deliberately stay plaintext.
// The custody key argument is confined by this compile-time whitelist — the
// casts in the sink adapter below do not widen it.
type ConfigSecretKey = 'deviceId' | 'serverUrl' | 'hubUrl';

const configCustody = createSecretCustody({
  safeStorage,
  settings: {
    get: (key: string) => store.get(key as ConfigSecretKey),
    set: (key: string, value: unknown) => store.set(key as ConfigSecretKey, value as string | null),
    delete: (key: string) => store.delete(key as ConfigSecretKey)
  } satisfies SettingsSink
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isPlaying = false;
let powerBlockerId: number | null = null;

// W4.9: Auto-updater state
interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
}

const updateState: UpdateState = { status: 'idle' };
let _updateCheckTimer: NodeJS.Timeout | null = null;

// M-WINDOWS-12 [review windows__gameux M1]: a user-initiated check (menu
// "Check for updates" / the update:check-for-updates IPC) must ANSWER, even
// when the answer is "nothing new". The boot and 6-hour periodic checks never
// set this flag, so their success stays silent (W4.9 no-user-facing-noise
// doctrine for automatic paths). Any terminal updater event —
// update-available, update-not-available, or error — consumes it exactly once.
let manualUpdateCheckPending = false;

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
  // M-WINDOWS-06: any navigation swaps the document, and the previous
  // document's 'deeplink:open' subscription dies with it — drop readiness
  // immediately so links arriving across the navigation wait in the queue
  // instead of being sent into a listener-less renderer. A failed load never
  // announces readiness, so this same re-arm is what keeps the queue alive
  // across did-fail-load retries until the next successful document's
  // 'deeplink:ready' handshake drains it.
  mainWindow.webContents.on('did-start-loading', () => {
    deepLinkReceiverReady = false;
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(PROD_BOOT_URL);
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

    // W4.6: release power blocker on window close
    ensurePowerBlocker(false);

    if (!isQuitting && store.get('minimizeToTray', true)) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // M-WINDOWS-06: a dead window is not a receiver. Reset readiness; the
    // pending queue survives for a future window's 'deeplink:ready' drain
    // (createWindow on activate).
    deepLinkReceiverReady = false;
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

  // W4.6: release power blocker if renderer process crashes
  mainWindow.webContents.on('render-process-gone', () => {
    ensurePowerBlocker(false);
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
      tooltip: t('thumbar.previous'),
      icon: prevIcon,
      click: () => mainWindow?.webContents.send('media-rewind')
    },
    {
      tooltip: isPlaying ? t('thumbar.pause') : t('thumbar.play'),
      icon: playPauseIcon,
      click: () => mainWindow?.webContents.send('media-play-pause')
    },
    {
      tooltip: t('thumbar.next'),
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

function ensurePowerBlocker(start: boolean): void {
  if (start) {
    if (powerBlockerId === null || !powerSaveBlocker.isStarted(powerBlockerId)) {
      powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      log.info(`[power] Display sleep blocked (id: ${powerBlockerId})`);
    }
  } else {
    if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
      powerSaveBlocker.stop(powerBlockerId);
      log.info(`[power] Display sleep unblocked (id: ${powerBlockerId})`);
    }
    powerBlockerId = null;
  }
}

// W4.9: Auto-updater — user-controlled update with notification on ready
function setupAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    updateState.status = 'checking';
    updateState.error = undefined;
    log.info('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    updateState.status = 'available';
    updateState.version = info.version;
    // M-WINDOWS-12: this arm's own "Update Available" toast IS the answer to
    // a manual request — consume the pending flag so the following
    // download-progress/update-downloaded cycle (or a later automatic
    // not-available) cannot fire a second "you're up to date" reply.
    manualUpdateCheckPending = false;
    log.info(`[updater] Update available: ${info.version}`);

    // Notify renderer so it can show UI if needed
    mainWindow?.webContents.send('update:available', { version: info.version });

    // Offer to download via notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: t('updater.availableTitle'),
        body: t('updater.availableBody', { version: info.version })
      });
      notification.on('click', () => {
        autoUpdater.downloadUpdate();
        updateState.status = 'downloading';
      });
      notification.show();
    }
  });

  // M-WINDOWS-12 [review windows__gameux M1]: the previously-missing arm.
  // "No updates" is the steady state of EVERY check, and without this handler
  // the status set by 'checking-for-update' never left 'checking' for the life
  // of the process: the menu guard and the 6-hour periodic check (both keyed
  // on idle/error) early-returned forever, making "Check for updates" a
  // permanent silent no-op after the first launch. Resetting to idle here
  // un-jams both paths; a user-requested check additionally gets the visible
  // reply below, delivered through the same main-process Notification surface
  // the update-available/update-downloaded arms already use (no renderer
  // channel, no new UI surface). The version shown is the one running — the
  // emitted UpdateInfo describes the latest feed release, which on a
  // downgrade-refusal may be older than current.
  autoUpdater.on('update-not-available', () => {
    updateState.status = 'idle';
    updateState.version = undefined;
    updateState.progress = undefined;
    updateState.error = undefined;
    log.info('[updater] No update available — already on the latest version');

    if (manualUpdateCheckPending) {
      manualUpdateCheckPending = false;
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: t('updater.notAvailableTitle'),
          body: t('updater.notAvailableBody', { version: app.getVersion() })
        });
        notification.show();
      }
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    updateState.status = 'downloading';
    updateState.progress = progress.percent;
    mainWindow?.webContents.send('update:progress', { percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState.status = 'downloaded';
    updateState.version = info.version;
    log.info(`[updater] Update downloaded: ${info.version}`);

    // W4.9: Notify renderer — do NOT auto-restart silently
    mainWindow?.webContents.send('update:downloaded', { version: info.version });

    // W4.7: Wire to notification system — user chooses when to restart
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: t('updater.readyTitle'),
        body: t('updater.readyBody', { version: info.version })
      });
      notification.on('click', () => {
        isQuitting = true;
        autoUpdater.quitAndInstall(false, false);
      });
      notification.show();
    }
  });

  autoUpdater.on('error', (err) => {
    // M-WINDOWS-12: an error terminates the in-flight check; consume any
    // pending manual request so it cannot leak into a later automatic
    // not-available and fabricate a "you're up to date" toast.
    manualUpdateCheckPending = false;
    // W4.9: Handle offline and rate-limited cases quietly — no user-facing noise
    const message = err.message ?? String(err);
    if (
      message.includes('net::ERR_') ||
      message.includes('rate limit') ||
      message.includes('404') ||
      message.includes('ENOTFOUND') ||
      message.includes('ECONNREFUSED')
    ) {
      log.warn(`[updater] Update check failed (likely offline): ${message}`);
      updateState.status = 'idle';
      updateState.error = undefined;
    } else {
      log.error(`[updater] Error: ${message}`);
      updateState.status = 'error';
      updateState.error = message;
    }
  });

  // W4.9: Check after a short delay — do not block first paint
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn(`[updater] Initial check error: ${err.message}`);
    });
  }, 5000);

  // W4.9: Periodic check every 6 hours
  _updateCheckTimer = setInterval(() => {
    if (updateState.status === 'idle' || updateState.status === 'error') {
      autoUpdater.checkForUpdates().catch((err) => {
        log.warn(`[updater] Periodic check error: ${err.message}`);
      });
    }
  }, 6 * 60 * 60 * 1000);
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
    { label: t('tray.show'), click: () => restoreWindow(mainWindow) },
    { type: 'separator' },
    { label: t('tray.playPause'), click: () => mainWindow?.webContents.send('media-play-pause') },
    { label: t('tray.stop'), click: () => mainWindow?.webContents.send('media-stop') },
    { type: 'separator' },
    { label: t('tray.minimizeToTray'), type: 'checkbox', checked: store.get('minimizeToTray', true),
      click: (menuItem) => store.set('minimizeToTray', menuItem.checked) },
    { type: 'separator' },
    { label: t('tray.quit'), click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip(t('tray.tooltip'));
  tray.setContextMenu(contextMenu);

  // M-WINDOWS-03: while the window is hidden there is NO taskbar button to
  // click — Windows emits no restore event of its own (the macOS 'activate'
  // equivalent does not exist here), so the tray icon is the primary re-entry
  // surface and it must work. Double-click is the Windows tray idiom
  // (docs/api/tray.md: 'double-click' *macOS* *Windows*); single-click
  // restores too because most users try it first. A real double-click fires
  // click+click+double-click in burst; restoreWindow() is idempotent for a
  // live window (visible+focused → focus() only), so the burst is safe.
  tray.on('click', () => {
    restoreWindow(mainWindow);
  });
  tray.on('double-click', () => {
    restoreWindow(mainWindow);
  });
}

/**
 * Built lazily (at createMenu time, after app-ready) so the labels resolve
 * through the i18n locale captured on ready. Exported for unit-testing of menu
 * accelerator configuration.
 * Single-character keys (Space, Left, Right) use registerAccelerator: false so
 * they do not intercept text input in URL fields or other text controls.
 */
export function buildPlaybackMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  return [
    { label: t('menu.playPause'), accelerator: 'Space', registerAccelerator: false, click: () => mainWindow?.webContents.send('media-play-pause') },
    { label: t('menu.stop'), click: () => mainWindow?.webContents.send('media-stop') },
    { type: 'separator' },
    { label: t('menu.rewind'), accelerator: 'Left', registerAccelerator: false, click: () => mainWindow?.webContents.send('media-rewind') },
    { label: t('menu.fastForward'), accelerator: 'Right', registerAccelerator: false, click: () => mainWindow?.webContents.send('media-forward') },
    { type: 'separator' },
    { label: t('menu.fullscreen'), accelerator: 'F11', click: () => toggleFullscreen() }
  ];
}

function createMenu(): void {
  // Role items below (quit/reload/forceReload/toggleDevTools/zoom/fullscreen)
  // intentionally keep no explicit label — Electron renders roles with native,
  // already-localized strings, which beats anything this catalog could ship.
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.settings'), accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: t('menu.playback'),
      submenu: buildPlaybackMenuTemplate()
    },
    {
      label: t('menu.view'),
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
      label: t('menu.help'),
      submenu: [
        { label: t('menu.about'), click: () => showAbout() },
        { type: 'separator' },
        { label: t('menu.checkForUpdates'), click: () => {
          if (updateState.status === 'downloading' || updateState.status === 'checking') return;
          // M-WINDOWS-12: remember the user asked — the check's terminal
          // updater event answers (not-available → "latest version" toast).
          manualUpdateCheckPending = true;
          updateState.status = 'checking';
          autoUpdater.checkForUpdates().catch((err) => {
            log.warn(`[updater] Menu check error: ${err.message}`);
            manualUpdateCheckPending = false;
            updateState.status = 'idle';
          });
        }}
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
    title: t('about.title'),
    message: t('about.message'),
    detail: t('about.detail', { version: app.getVersion() })
  });
}

/**
 * M-WINDOWS-02: the explicit, user-facing surface for the version gate's ONE
 * blocking verdict (server reports a version below the minimum). Before this,
 * a too-old server produced only an electron-log line and a renderer boot
 * abort — permanently dark empty window, zero explanation.
 *
 * Enforcement policy is UNCHANGED (fail-open everywhere except the explicit
 * too-low report); this adds the missing explanation, nothing more. The
 * renderer complements the dialog with a persistent on-screen version
 * (src/renderer/main.ts renderIncompatibleServerScreen).
 *
 * Exported for tests (same seam idiom as setupAppProtocolHandler).
 */
export function showServerTooOldDialog(result: ServerVersionCheck): void {
  const options: MessageBoxOptions = {
    type: 'error',
    title: t('boot.tooOldTitle'),
    message: t('boot.tooOldMessage'),
    detail: t('boot.tooOldDetail', {
      serverVersion: result.serverVersion ?? 'unknown',
      minimumVersion: result.minimumVersion
    })
  };
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  if (parent) {
    dialog.showMessageBox(parent, options);
  } else {
    dialog.showMessageBox(options);
  }
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
// M-WINDOWS-11: hubUrl travels through encrypted custody (auth endpoint);
// activeServerId (opaque selection pointer) and connectionMode (enum) are
// not credential-bearing and stay plain store reads.
ipcMain.handle('hub:get-config', () => {
  return {
    hubUrl: configCustody.read('hubUrl'),
    activeServerId: store.get('activeServerId', null),
    connectionMode: store.get('connectionMode', 'direct')
  };
});

ipcMain.handle('hub:set-config', (_, config: { hubUrl?: string; activeServerId?: string; connectionMode?: string }) => {
  if (config.hubUrl !== undefined) configCustody.write('hubUrl', config.hubUrl);
  if (config.activeServerId !== undefined) store.set('activeServerId', config.activeServerId);
  if (config.connectionMode !== undefined) store.set('connectionMode', config.connectionMode);
});

// Direct server URL handlers — M-WINDOWS-11: custody-sealed (see hubUrl above).
ipcMain.handle('app:get-server-url', () => {
  return configCustody.read('serverUrl');
});

ipcMain.handle('app:set-server-url', (_, url: string) => {
  configCustody.write('serverUrl', url);
});

// W7.6: runtime server version enforcement — verify server meets minimum version before boot completes
// M-WINDOWS-02: the gate now carries its own explanation — the handler returns the
// structured verdict (versions included) and raises an explicit error dialog on the
// sole blocking outcome, instead of the user seeing a permanently dark window.
ipcMain.handle('app:check-server-version', async (_, { apiBase }: { apiBase: string }): Promise<ServerVersionCheck> => {
  const result = await checkMinServerVersion(apiBase);
  if (!result.compatible) {
    showServerTooOldDialog(result);
  }
  return result;
});

/**
 * Returns a stable, per-installation device identifier.
 *
 * On first call a UUID-based ID is generated and persisted through the
 * M-WINDOWS-11 encrypted custody (safeStorage/DPAPI-sealed envelope in
 * config.json; legacy plaintext rows migrate transparently on read).
 * Subsequent calls return the same ID for the lifetime of the installation.
 * The ID is sent to the server as `X-Phlix-Device-ID` via `buildPhlixHeaders`.
 */
ipcMain.handle('app:get-device-id', () => {
  let deviceId = configCustody.read('deviceId');
  if (!deviceId) {
    deviceId = `windows-${randomUUID()}`;
    configCustody.write('deviceId', deviceId);
  }
  return deviceId;
});

// ---------------------------------------------------------------------------
// M-WINDOWS-11 — renderer token vault (secrets.json, DPAPI-sealed).
//
// The auth tokens themselves are minted and READ BY THE RENDERER via the
// vendored @phlix/ui, which today still uses localStorage custody — the
// upstream half (a tokenStore seam in createPhlixApp) is the v0.99.12-wave
// rider recorded in the M-WINDOWS-11 fixlog. This vault is the windows-side
// endpoint that rider plugs into: src/renderer/safeStorageTokenStore.ts
// implements @phlix/ui's TokenStore over exactly these four channels, so
// when the seam lands the tokens move from renderer localStorage to
// main-process safeStorage custody with a one-line boot() change.
//
// Protocol law:
//   - sendSync, not invoke: the ui TokenStore contract is synchronous, and
//     the main side of every handler here is pure in-memory crypto — no I/O
//     stall beyond electron-store's own (already synchronous) writes.
//   - a sender check mirrors the 'deeplink:ready' precedent: only the
//     CURRENT main window's webContents may open the vault (defense in
//     depth behind the M-WINDOWS-10 preload trust gate).
//   - keys/values are guarded by src/main/secretStore.ts; a rejected shape
//     answers null/false and never echoes the offending input to the log.
//   - separate file from config.json: renderer-minted rows never interleave
//     with main-owned settings, and a corrupt vault cannot take the shell's
//     own preferences down with it.
// ---------------------------------------------------------------------------
const secretsStore = new Store<Record<string, string>>({ name: 'secrets' });

const vaultCustody = createSecretCustody({
  safeStorage,
  settings: {
    get: (key: string) => secretsStore.get(key),
    set: (key: string, value: unknown) => secretsStore.set(key, value as string),
    delete: (key: string) => secretsStore.delete(key)
  } satisfies SettingsSink
});

function vaultSenderTrusted(event: Electron.IpcMainEvent): boolean {
  return mainWindow !== null && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}

ipcMain.on('vault:get', (event, payload: { key?: unknown }) => {
  if (!vaultSenderTrusted(event)) {
    log.warn('[vault] get refused — sender is not the current main window');
    event.returnValue = null;
    return;
  }
  try {
    event.returnValue = typeof payload?.key === 'string' ? vaultCustody.read(payload.key) : null;
  } catch {
    log.warn('[vault] get rejected by the key guard');
    event.returnValue = null;
  }
});

ipcMain.on('vault:set', (event, payload: { key?: unknown; value?: unknown }) => {
  if (!vaultSenderTrusted(event)) {
    log.warn('[vault] set refused — sender is not the current main window');
    event.returnValue = false;
    return;
  }
  if (typeof payload?.key !== 'string' || typeof payload?.value !== 'string') {
    event.returnValue = false; // invalid shapes fail closed — never coerced, never persisted
    return;
  }
  try {
    vaultCustody.write(payload.key, payload.value);
    event.returnValue = true;
  } catch {
    log.warn('[vault] set rejected by the key/value guards');
    event.returnValue = false;
  }
});

ipcMain.on('vault:delete', (event, payload: { key?: unknown }) => {
  if (!vaultSenderTrusted(event)) {
    log.warn('[vault] delete refused — sender is not the current main window');
    event.returnValue = false;
    return;
  }
  try {
    if (typeof payload?.key !== 'string') {
      event.returnValue = false;
      return;
    }
    vaultCustody.remove(payload.key);
    event.returnValue = true;
  } catch {
    log.warn('[vault] delete rejected by the key guard');
    event.returnValue = false;
  }
});

ipcMain.on('vault:is-available', (event) => {
  if (!vaultSenderTrusted(event)) {
    log.warn('[vault] is-available refused — sender is not the current main window');
    event.returnValue = false;
    return;
  }
  event.returnValue = vaultCustody.isEncryptionAvailable();
});

// W4.5: thumbar buttons — renderer sends updated play state to refresh play/pause icon
ipcMain.on('thumbar:update', (_, state: { playing: boolean }) => {
  updateThumbarPlayState(state.playing);
});

// W4.5: taskbar progress bar — renderer sends current/total position
ipcMain.on('playback:progress', (_, progress: { current: number; total: number }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { current, total } = progress;
  if (current === 0 && total > 0) {
    // Playback just started at position 0 — show indeterminate progress (Windows mode 2)
    mainWindow.setProgressBar(2);
  } else if (total > 0 && current < total) {
    mainWindow.setProgressBar(current / total);
  } else {
    // total === 0 or current >= total: clear the progress bar
    mainWindow.setProgressBar(-1);
  }
});

// W4.6: power save blocker — renderer sends playing state to block/unblock display sleep
ipcMain.on('power:update', (_event, { playing }: { playing: boolean }) => {
  ensurePowerBlocker(playing);
});

// W4.7: native notifications — renderer requests native system notification
// M-WINDOWS-15 law for producers: `clickAction` MUST be an /app-rooted router
// path (e.g. '/app/settings'); anything else fails parseDeepLinkUrl's internal
// /app gate and surfaces as a rejection dialog instead of a silent no-op.
ipcMain.handle('notification:show', (_event, { title, body, clickAction }: { title: string; body: string; clickAction?: string }) => {
  if (!Notification.isSupported()) {
    log.warn('[notification] Notifications not supported on this platform');
    return false;
  }
  if (!store.get('notificationsEnabled', true)) {
    log.info('[notification] Notifications disabled by user preference');
    return false;
  }
  const notification = new Notification({ title, body });
  notification.on('click', () => {
    // M-WINDOWS-03: a notification click is a re-entry surface too — the
    // window may be hidden-to-tray or minimized, not merely unfocused.
    restoreWindow(mainWindow);
    if (clickAction) {
      handleDeepLinkUrl(`phlix://internal${clickAction}`);
    }
  });
  notification.show();
  return true;
});

// W4.12: GPU escape hatch — get/set disableHardwareAcceleration preference
ipcMain.handle('gpu:get-disable-hardware-acceleration', () => {
  return store.get('disableHardwareAcceleration', false);
});

ipcMain.handle('gpu:set-disable-hardware-acceleration', (_, value: boolean) => {
  store.set('disableHardwareAcceleration', value);
});

// W4.12: GPU feature status for diagnostics
ipcMain.handle('gpu:get-feature-status', () => {
  return app.getGPUFeatureStatus();
});

// W4.5: SMTC action handlers from navigator.mediaSession
// These dispatch back to the renderer which owns the player state
ipcMain.handle('media:play', () => {
  mainWindow?.webContents.send('media-play-pause');
});

ipcMain.handle('media:pause', () => {
  mainWindow?.webContents.send('media-play-pause');
});

ipcMain.handle('media:previous', () => {
  mainWindow?.webContents.send('media-previous');
});

ipcMain.handle('media:next', () => {
  mainWindow?.webContents.send('media-next');
});

ipcMain.handle('media:seek-backward', () => {
  mainWindow?.webContents.send('media-rewind');
});

ipcMain.handle('media:seek-forward', () => {
  mainWindow?.webContents.send('media-forward');
});

ipcMain.handle('media:seek-to', (_, time: number) => {
  mainWindow?.webContents.send('media-seek-to', time);
});

// W4.9: Manual update check — triggered by "Check for updates" menu or renderer
ipcMain.handle('update:check-for-updates', async () => {
  if (updateState.status === 'downloading' || updateState.status === 'checking') {
    return { status: updateState.status, version: updateState.version };
  }
  try {
    // M-WINDOWS-12: renderer-initiated checks are user-initiated too — the
    // not-available arm answers with the visible "latest version" toast.
    manualUpdateCheckPending = true;
    updateState.status = 'checking';
    await autoUpdater.checkForUpdates();
    return { status: updateState.status, version: updateState.version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`[updater] Manual check error: ${message}`);
    manualUpdateCheckPending = false;
    updateState.status = 'idle';
    return { status: 'idle', error: undefined };
  }
});

// W4.9: Renderer queries current update state
ipcMain.handle('update:get-status', () => {
  return { ...updateState };
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
 * Production boot URL. Must always be a path setupAppProtocolHandler() serves
 * with 200 — it is pinned against the live handler in
 * tests/unit/protocolHandler.test.ts. Keep the trailing slash explicit: the
 * bare '/app' form happens to be accepted as well, but the canonical form the
 * handler's prefix gate was written for is '/app/'.
 */
export const PROD_BOOT_URL = 'app://-/app/';

/**
 * Handles app:// protocol requests in production.
 *
 * Maps URLs like app://-/app/servers -> dist/renderer/servers (or index.html if not found).
 * The bare prefix '/app' (no trailing slash) is served index.html, exactly like a
 * real web server redirects/routes '/app' to the SPA root.
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

    // Validate pathname is the SPA prefix ('/app', which routes to index.html
    // like any real web server would) or lives under it ('/app/...').
    const isSpaPrefixOrChild = urlPath === '/app' || urlPath.startsWith('/app/');
    if (!isSpaPrefixOrChild) {
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

  // i18n: pin the main-process UI locale now that the app is ready —
  // app.getLocale() is only guaranteed to work after the ready event. Every
  // user-facing string below (window chrome, menu, tray, updater notifications)
  // resolves through src/main/i18n against this locale. The typeof guard keeps
  // the module importable under trimmed-down electron test mocks that predate
  // the API; real Electron always has it.
  const mainLocale = typeof app.getLocale === 'function' ? app.getLocale() : 'en';
  setMainLocale(mainLocale);
  log.info(`[i18n] Main-process UI locale: ${mainLocale} (active: ${getMainLocale()})`);

  // W4.12: GPU escape hatch — also check store preference (env var already checked at module level)
  if (store.get('disableHardwareAcceleration', false)) {
    log.info('[gpu] Hardware acceleration disabled by preference');
    app.disableHardwareAcceleration();
  }

  setupAppProtocolHandler();
  setAsDefaultProtocolClient();
  createWindow();
  createMenu();
  createTray();
  setupAutoUpdater();

  // W-low(a): cold start deep links are dispatched exactly once, through the
  // pendingDeepLinks queue (M-WINDOWS-06) — do not add a second dispatch here.
});

// Handle open-url event on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  // W3: redact — the URL may carry a one-time invite token.
  log.info(`[deeplink] open-url event: ${redactDeepLinkUrl(url)}`);
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
  // W4.6: release power blocker on before-quit
  ensurePowerBlocker(false);
  // W-low(e): cancel a pending debounced bounds save so it cannot fire while
  // the window is tearing down.
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = null;
  // W4.9: stop the periodic update check so the process can exit cleanly
  if (_updateCheckTimer) {
    clearInterval(_updateCheckTimer);
    _updateCheckTimer = null;
  }
});

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
