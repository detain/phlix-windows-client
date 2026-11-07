/**
 * @vitest-environment node
 *
 * w10/L1 (windows__casualgamer 6): the crash-recovery dialog's Reload arm
 * blindly called webContents.reload(). A renderer that died while a FOREIGN
 * http(s) document was committed (top-level navigations to any http(s) origin
 * stay permitted by design — M-WINDOWS-18) was therefore "recovered" into the
 * very dead weight it needs to escape: the bridge-less foreign page, reloaded
 * at best, a blank error page at worst (its server may own the crash). The
 * recovery arm must route like the boot path: reload only when the committed
 * document is OUR app:// shell, otherwise loadURL(PROD_BOOT_URL).
 *
 * Harness follows ipcSenderAndPayloadHardening.test.ts (full boot under
 * mocked electron; the dialog response and the committed URL are per-test
 * state on the hoisted fake).
 */
import { describe, it, expect, vi } from 'vitest';

const { prefs, tracks, WIN, STATE } = vi.hoisted(() => {
  const prefs = {} as Record<string, unknown>;
  const tracks = {
    ipcOn: new Map<string, (event: unknown, payload?: unknown) => unknown>(),
    ipcHandle: new Map<string, (event: unknown, payload?: unknown) => unknown>(),
    wcOn: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
    winOn: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
    wcSend: [] as Array<[string, unknown]>,
    reloads: [] as number[],
    loads: [] as string[]
  };
  const STATE = { committedUrl: 'https://untrusted.example/page', dialogResponse: 0 };
  const WIN = {
    loadURL: (url: string) => { tracks.loads.push(url); return Promise.resolve(); },
    loadFile: () => undefined,
    show: () => undefined,
    hide: () => undefined,
    close: () => undefined,
    isDestroyed: () => false,
    setAlwaysOnTop: () => undefined,
    setFullScreen: () => undefined,
    isFullScreen: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    focus: () => undefined,
    restore: () => undefined,
    isFocused: () => true,
    maximize: () => undefined,
    isMaximized: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 870 }),
    setBounds: () => undefined,
    setProgressBar: () => undefined,
    setThumbarButtons: () => undefined,
    webContents: {
      send: (channel: string, payload?: unknown) => { tracks.wcSend.push([channel, payload]); },
      setWindowOpenHandler: () => undefined,
      on: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => { tracks.wcOn.set(channel, fn); },
      openDevTools: () => undefined,
      reload: () => { tracks.reloads.push(1); },
      getURL: () => STATE.committedUrl
    },
    on: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => { tracks.winOn.set(channel, fn); },
    once: () => undefined
  };
  return { prefs, tracks, WIN, STATE };
});

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), initialize: vi.fn() }
}));
vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null, autoDownload: false, allowPrerelease: false,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn(), quitAndInstall: vi.fn(),
    on: vi.fn().mockReturnThis(), once: vi.fn()
  }
}));
vi.mock('electron-store', () => ({
  default: class {
    get(key: string, fallback?: unknown) { return key in prefs ? prefs[key] : fallback; }
    set(key: string, value: unknown) { prefs[key] = value; }
  }
}));
vi.mock('electron', () => ({
  powerMonitor: { on: vi.fn() },
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: () => '/tmp/opencode/w10L1-crash',
    getAppPath: () => '/tmp/opencode/w10L1-crash',
    disableHardwareAcceleration: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: vi.fn(() => ({ then: (cb: () => void) => { cb(); } })),
    on: vi.fn(), quit: vi.fn(), getGPUFeatureStatus: vi.fn().mockReturnValue({})
  },
  BrowserWindow: vi.fn(function () { return WIN; }),
  Menu: { buildFromTemplate: vi.fn().mockReturnValue({ popup: vi.fn() }), setApplicationMenu: vi.fn() },
  Tray: vi.fn(function () {
    return { setToolTip: vi.fn(), setContextMenu: vi.fn(), on: vi.fn() };
  }),
  session: { defaultSession: { on: vi.fn(), setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => { throw new Error('mock safeStorage'); },
    decryptString: () => { throw new Error('mock safeStorage'); }
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, payload?: unknown) => unknown) => { tracks.ipcHandle.set(channel, fn); },
    on: (channel: string, fn: (event: unknown, payload?: unknown) => unknown) => { tracks.ipcOn.set(channel, fn); },
    send: vi.fn()
  },
  shell: { openExternal: vi.fn() },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({ isEmpty: () => false, resize: vi.fn() }),
    createEmpty: vi.fn().mockReturnValue({ isEmpty: () => true, resize: vi.fn() })
  },
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: STATE.dialogResponse })),
    showMessageBoxSync: vi.fn(() => 1)
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  screen: {
    getPrimaryDisplay: vi.fn().mockReturnValue({ scaleFactor: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
    getAllDisplays: vi.fn().mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }])
  },
  powerSaveBlocker: { start: vi.fn(() => 7), stop: vi.fn(), isStarted: vi.fn().mockReturnValue(false) },
  Notification: class {
    static isSupported = vi.fn().mockReturnValue(true);
    on!: (ev: string, fn: () => void) => void;
    show = vi.fn();
    close = vi.fn();
    constructor() { this.on = () => undefined; }
  }
}));

import '../../src/main/index';
import { PROD_BOOT_URL } from '../../src/main/index';

/** Drain the dialog .then microtask chain (the gone-handler must not await). */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('w10/L1: crash recovery reloads the shell, reboots from foreign documents', () => {
  it('reload after a death on the app:// shell — the session view recovers in place', async () => {
    STATE.committedUrl = 'app://-/app/library';
    STATE.dialogResponse = 0;
    tracks.reloads.length = 0;
    tracks.loads.length = 0;

    tracks.wcOn.get('render-process-gone')!({}, { reason: 'crashed' });
    await flush();

    expect(tracks.reloads).toHaveLength(1);
    expect(tracks.loads).toEqual([]);
  });

  it('a death while a FOREIGN http(s) document is committed reboots the boot URL instead of reloading the bridge-less page', async () => {
    STATE.committedUrl = 'https://untrusted.example/page';
    STATE.dialogResponse = 0;
    tracks.reloads.length = 0;
    tracks.loads.length = 0;

    tracks.wcOn.get('render-process-gone')!({}, { reason: 'crashed' });
    await flush();

    expect(tracks.loads, 'recovery must route like boot').toEqual([PROD_BOOT_URL]);
    expect(tracks.reloads, 'reload() would re-commit the foreign corpse page').toEqual([]);
  });

  it('did-fail-load on an app:// boot shares the same recovery (on-screen app doc reloads)', async () => {
    STATE.committedUrl = 'app://-/app/';
    STATE.dialogResponse = 0;
    tracks.reloads.length = 0;
    tracks.loads.length = 0;

    tracks.wcOn.get('did-fail-load')!({}, -101, 'CONNECTION_RESET', 'app://-/app/', true);
    await flush();

    expect(tracks.reloads).toHaveLength(1);
    expect(tracks.loads).toEqual([]);
  });

  it('dismiss answers with nothing — neither reload nor boot-load', async () => {
    STATE.committedUrl = 'https://untrusted.example/page';
    STATE.dialogResponse = 1;
    tracks.reloads.length = 0;
    tracks.loads.length = 0;

    tracks.wcOn.get('render-process-gone')!({}, { reason: 'crashed' });
    await flush();

    expect(tracks.reloads).toEqual([]);
    expect(tracks.loads).toEqual([]);
  });
});
