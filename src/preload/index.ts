/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * M-WINDOWS-10 trust gate — which documents may hold the privileged bridge.
 *
 * A preload is tied to the window, not to the URL: this file runs again for
 * EVERY document the webContents commits. The main window deliberately keeps
 * an external-navigation posture — `will-navigate`
 * (src/main/index.ts) allows any https:/http: top-level navigation by design
 * (in-window OAuth-style flows), blocking only dangerous schemes
 * (src/main/urlValidator.ts). Before this gate, such a navigation handed the
 * attacker's page the FULL `electronAPI`: hubSetConfig()/setServerUrl() could
 * flip the PERSISTED auth endpoint to an attacker origin (next launch the
 * ApiClient auto-attaches the stored Authorization token to it),
 * getDeviceId() leaked the stable install identifier, getAppPath() the user
 * profile path, checkServerVersion() became a main-process SSRF probe, and
 * tray/GPU/power/always-on-top toggles gave silent window/device
 * manipulation (review windows__exploiter MAJOR-1).
 *
 * Law: the bridge is exposed only for this shell's own boot documents, and
 * only in the main frame:
 *   - prod : 'app://-/app/'  (PROD_BOOT_URL,       src/main/index.ts)
 *   - dev  : 'http://localhost:5173' (vite dev server, strictPort)
 * Same-origin child frames are NOT trusted either — the SPA never runs
 * framed, so no framed context has a legitimate need for the OS surface.
 * R-WINDOWS-08 (isPackaged-aware deny): in a PACKAGED shell the dev entry is
 * dead weight — a stray local listener on 5173 plus a top-level navigation
 * into it would otherwise hand the bridge to a non-bundled document. The
 * main process stamps `--phlix-packaged` into the window's
 * additionalArguments iff `app.isPackaged`, and the predicate rejects EVERY
 * http: document when that flag is present. (A sandboxed preload cannot read
 * `app` directly; process.argv is the sanctioned sync channel.) Absent the
 * flag the trust set is the full pair, exactly as before — the dev workflow
 * is untouched.
 * A file: origin is deliberately absent: nothing in this shell loads file://
 * (the only navigation sites are the two loadURL calls), and an unkeyed
 * file origin is no trust boundary anyway. If a future boot URL is added,
 * the wiring pins in tests/unit/preloadTrustGate.test.ts redden until it is
 * listed here (and only then) too.
 *
 * The test compares protocol+host on a parsed URL, never `.origin`: for
 * non-special schemes (app:) the WHATWG origin is engine-opaque — Node
 * serializes `new URL('app://-/app/').origin` as 'null'. Anything
 * unparseable or unreadable fails CLOSED (no bridge).
 */
export interface PreloadContext {
  /** The document URL the bridge would attach to (window.location.href). */
  href: string;
  /** True only for the webContents' main frame (process.isMainFrame). */
  isMainFrame: boolean;
  /**
   * True when this shell is a packaged build (main stamped
   * PHLIX_PACKAGED_ARGV_FLAG into process.argv). Absent/false = dev shell,
   * full trust set. R-WINDOWS-08.
   */
  isPackagedShell?: boolean;
}

/**
 * The sync main→sandboxed-preload packaged-ness channel: main adds it to the
 * window's additionalArguments iff app.isPackaged; the preload reads
 * process.argv (the only signal a sandboxed preload can see synchronously).
 */
export const PHLIX_PACKAGED_ARGV_FLAG = '--phlix-packaged';

/** Boot documents whose origin may hold the privileged bridge. */
export const TRUSTED_BOOT_TARGETS: ReadonlyArray<{ protocol: string; host: string }> = [
  { protocol: 'app:', host: '-' },              // prod  (PROD_BOOT_URL 'app://-/app/')
  { protocol: 'http:', host: 'localhost:5173' } // dev   (vite strictPort 5173)
];

/**
 * Pure trust decision: may a document with this context receive electronAPI?
 * Exported for unit pinning (tests/unit/preloadTrustGate.test.ts); the
 * module-level gate below is its only production call site.
 */
export function isTrustedPreloadContext(context: PreloadContext): boolean {
  if (!context.isMainFrame) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(context.href);
  } catch {
    return false; // fail closed: garbage/unreadable location ⇒ no bridge
  }
  if (context.isPackagedShell && parsed.protocol === 'http:') {
    return false; // R-WINDOWS-08: packaged shells deny the dev-server entry
  }
  return TRUSTED_BOOT_TARGETS.some(
    (target) => target.protocol === parsed.protocol && target.host === parsed.host
  );
}

/**
 * Read the live context this preload script is evaluating into. In a
 * sandboxed preload, `globalThis.window` is the isolated-world window whose
 * `location` reflects the committed document, and `process.isMainFrame` is
 * Electron's frame discriminator. Missing pieces are represented as
 * untrusted (fail closed) rather than throwing during module evaluation.
 */
function readPreloadContext(): PreloadContext {
  const hostWindow = (globalThis as unknown as { window?: { location?: { href?: string } } }).window;
  const href = typeof hostWindow?.location?.href === 'string' ? hostWindow.location.href : '';
  return {
    href,
    isMainFrame: process.isMainFrame === true,
    isPackagedShell: process.argv.includes(PHLIX_PACKAGED_ARGV_FLAG),
  };
}

// Expose protected methods to renderer — surface unchanged, but gated below.
const electronApiSurface = {
  // App info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Window controls
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('set-always-on-top', value),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  getMinimizeToTray: () => ipcRenderer.invoke('tray:get-minimize-to-tray'),
  setMinimizeToTray: (val: boolean) => ipcRenderer.send('tray:set-minimize-to-tray', val),

  // Media controls from main process
  onMediaPlayPause: (callback: () => void) => {
    ipcRenderer.on('media-play-pause', callback);
    return () => ipcRenderer.removeListener('media-play-pause', callback);
  },
  onMediaStop: (callback: () => void) => {
    ipcRenderer.on('media-stop', callback);
    return () => ipcRenderer.removeListener('media-stop', callback);
  },
  onMediaRewind: (callback: () => void) => {
    ipcRenderer.on('media-rewind', callback);
    return () => ipcRenderer.removeListener('media-rewind', callback);
  },
  onMediaForward: (callback: () => void) => {
    ipcRenderer.on('media-forward', callback);
    return () => ipcRenderer.removeListener('media-forward', callback);
  },
  onMediaSeekTo: (callback: (time: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, time: number) => callback(time);
    ipcRenderer.on('media-seek-to', listener);
    return () => ipcRenderer.removeListener('media-seek-to', listener);
  },
  onMediaPrevious: (callback: () => void) => {
    ipcRenderer.on('media-previous', callback);
    return () => ipcRenderer.removeListener('media-previous', callback);
  },
  onMediaNext: (callback: () => void) => {
    ipcRenderer.on('media-next', callback);
    return () => ipcRenderer.removeListener('media-next', callback);
  },

  // W4.5: SMTC action handlers (navigator.mediaSession)
  mediaPlay: () => ipcRenderer.invoke('media:play'),
  mediaPause: () => ipcRenderer.invoke('media:pause'),
  mediaPrevious: () => ipcRenderer.invoke('media:previous'),
  mediaNext: () => ipcRenderer.invoke('media:next'),
  mediaSeekBackward: () => ipcRenderer.invoke('media:seek-backward'),
  mediaSeekForward: () => ipcRenderer.invoke('media:seek-forward'),
  mediaSeekTo: (time: number) => ipcRenderer.invoke('media:seek-to', time),

  // Settings
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback);
    return () => ipcRenderer.removeListener('open-settings', callback);
  },

  // Hub configuration handlers
  hubGetConfig: () => ipcRenderer.invoke('hub:get-config'),
  hubSetConfig: (config: { hubUrl?: string; activeServerId?: string; connectionMode?: string }) =>
    ipcRenderer.invoke('hub:set-config', config),

  // Direct server URL
  getServerUrl: () => ipcRenderer.invoke('app:get-server-url'),
  setServerUrl: (url: string) => ipcRenderer.invoke('app:set-server-url', url),

  // W7.6: runtime server version enforcement (1.1.0 minimum). M-WINDOWS-02: resolves to the
  // structured ServerVersionCheck verdict (src/renderer/types/electron.d.ts), not a bare boolean.
  checkServerVersion: (apiBase: string) => ipcRenderer.invoke('app:check-server-version', { apiBase }),

  // Stable device id
  /** Returns a persistent, per-install device identifier. See main process handler for details. */
  getDeviceId: () => ipcRenderer.invoke('app:get-device-id'),

  // M-WINDOWS-11: DPAPI token vault (secrets.json, main-side safeStorage custody).
  // SYNCHRONOUS by design — @phlix/ui's TokenStore contract is sync; the async
  // alternative (invoke) would force an upstream interface change. Senders other
  // than the current main window are refused in main (defense in depth behind
  // the M-WINDOWS-10 trust gate); every method here is therefore inert-but-safe
  // on documents the gate already excludes. See src/renderer/safeStorageTokenStore.ts.
  vaultGet: (key: string): string | null => ipcRenderer.sendSync('vault:get', { key }) as string | null,
  vaultSet: (key: string, value: string): boolean => ipcRenderer.sendSync('vault:set', { key, value }) as boolean,
  vaultDelete: (key: string): boolean => ipcRenderer.sendSync('vault:delete', { key }) as boolean,
  vaultIsAvailable: (): boolean => ipcRenderer.sendSync('vault:is-available') as boolean,

  // Deep links (W4.4)
  onDeeplink: (callback: (path: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('deeplink:open', listener);
    return () => ipcRenderer.removeListener('deeplink:open', listener);
  },
  // M-WINDOWS-06: announce that the listener above is live, so the main
  // process drains its pending-deeplink queue to THIS renderer. Call only
  // after onDeeplink() has subscribed; a subscription-less announce would
  // deliver into a dropped message.
  notifyDeeplinkReady: () => ipcRenderer.send('deeplink:ready'),

  // W4.5: taskbar thumbnail button state (play/pause icon refresh)
  updateThumbar: (state: { playing: boolean }) => ipcRenderer.send('thumbar:update', state),

  // W4.5: taskbar progress bar
  setPlaybackProgress: (current: number, total: number) => ipcRenderer.send('playback:progress', { current, total }),

  // W4.6: power save blocker — prevent display sleep during playback
  updatePowerBlocker: (playing: boolean) => ipcRenderer.send('power:update', { playing }),

  // W4.7: native notifications
  showNotification: (title: string, body: string, clickAction?: string) =>
    ipcRenderer.invoke('notification:show', { title, body, clickAction }),

  // W4.12: GPU escape hatch — get/set disableHardwareAcceleration preference
  getDisableHardwareAcceleration: () => ipcRenderer.invoke('gpu:get-disable-hardware-acceleration'),
  setDisableHardwareAcceleration: (value: boolean) => ipcRenderer.invoke('gpu:set-disable-hardware-acceleration', value),

  // W4.12: GPU feature status for diagnostics
  getGpuFeatureStatus: () => ipcRenderer.invoke('gpu:get-feature-status'),

  // W4.9: Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('update:check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  onUpdateAvailable: (callback: (data: { version: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { version: string }) => callback(data);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
  onUpdateProgress: (callback: (data: { percent: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { percent: number }) => callback(data);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { version: string }) => callback(data);
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
};

// THE gate (M-WINDOWS-10): a document this preload runs in receives the
// bridge only if it is this shell's own boot page in the main frame. An
// in-window navigation to any other origin — including every http(s) site
// the will-navigate posture deliberately permits — gets NO electronAPI.
if (isTrustedPreloadContext(readPreloadContext())) {
  contextBridge.exposeInMainWorld('electronAPI', electronApiSurface);
}
