/**
 * @vitest-environment node
 *
 * Batch 6 (review asphp MAJ-3 / casualgamer #4 / gameux #5 / crossfe #2):
 * network-failure attribution and framing refusal —
 *   M10  certificate-error + did-fail-load: default-deny KEPT, but the
 *        diagnosis now reaches electron-log (scheme+host law) and a
 *        redacted toast;
 *   m7b  an app:// boot failure rides crashRecoveryDialog's Reload shape;
 *   M11  a subframe navigation aimed at app:// is refused outright.
 * Harness cloned from ipcSenderAndPayloadHardening.test.ts; deltas: session
 * and protocol listeners are RECORDED (not bare vi.fn), showMessageBox is a
 * spy resolving a per-test answer, and webContents exposes reload().
 */
import { describe, it, expect, vi } from 'vitest';

const { prefs, tracks, WIN } = vi.hoisted(() => {
  const prefs = {} as Record<string, unknown>;
  const tracks = {
    ipcOn: new Map<string, (event: unknown, payload?: unknown) => unknown>(),
    ipcHandle: new Map<string, (event: unknown, payload?: unknown) => unknown>(),
    wcOn: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
    winOn: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
    sessionOn: new Map<string, (...args: unknown[]) => unknown>(),
    dialogBoxes: [] as Array<Record<string, unknown>>,
    reloads: [] as true[],
    notifications: [] as Array<{ title?: string; body?: string; onClick?: () => void }>
  };
  const WIN = {
    loadURL: () => undefined, loadFile: () => undefined, show: () => undefined, hide: () => undefined,
    close: () => undefined, isDestroyed: () => false, setAlwaysOnTop: () => undefined,
    setFullScreen: () => undefined, isFullScreen: () => false, isMinimized: () => false,
    isVisible: () => true, focus: () => undefined, restore: () => undefined, isFocused: () => true,
    maximize: () => undefined, isMaximized: () => false,
    setProgressBar: () => undefined, setThumbarButtons: () => undefined,
    webContents: {
      send: () => undefined,
      setWindowOpenHandler: () => undefined,
      on: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => { tracks.wcOn.set(channel, fn); },
      openDevTools: () => undefined,
      reload: () => { tracks.reloads.push(true); }
    },
    on: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => { tracks.winOn.set(channel, fn); },
    once: () => undefined
  };
  return { prefs, tracks, WIN };
});

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), verbose: vi.fn(), transport: { file: { level: false } }, initialize: vi.fn() }
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
  // M8 batch 10: index.ts imports powerMonitor — partial electron mocks
  // make the named import throw at boot (exit-7 class, see batch 6).
  powerMonitor: { on: vi.fn() },
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: () => '/tmp/opencode/windows-fix-c2',
    getAppPath: () => '/tmp/opencode/windows-fix-c2',
    disableHardwareAcceleration: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: vi.fn(() => ({ then: (cb: () => void) => { cb(); } })),
    on: vi.fn(), quit: vi.fn(), getGPUFeatureStatus: vi.fn().mockReturnValue({})
  },
  BrowserWindow: vi.fn(function () { return WIN; }),
  Menu: { buildFromTemplate: vi.fn().mockReturnValue({ popup: vi.fn() }), setApplicationMenu: vi.fn() },
  Tray: vi.fn(function () {
    return { setToolTip: () => undefined, setContextMenu: vi.fn(), on: vi.fn() };
  }),
  session: {
    defaultSession: {
      on: (channel: string, fn: (...args: unknown[]) => unknown) => { tracks.sessionOn.set(channel, fn); },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn()
    }
  },
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
  shell: { openExternal: () => undefined },
  nativeImage: { createFromPath: vi.fn().mockReturnValue({ isEmpty: () => false, resize: vi.fn() }) },
  dialog: {
    showMessageBox: vi.fn((_win: unknown, opts: Record<string, unknown>) => {
      tracks.dialogBoxes.push(opts);
      return Promise.resolve({ response: 0 });
    }),
    showMessageBoxSync: () => 1
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  screen: {
    getPrimaryDisplay: vi.fn().mockReturnValue({ scaleFactor: 1 }),
    getAllDisplays: vi.fn().mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }])
  },
  powerSaveBlocker: { start: () => 7, stop: vi.fn(), isStarted: vi.fn().mockReturnValue(false) },
  Notification: class {
    static isSupported = vi.fn().mockReturnValue(true);
    constructor(options: { title?: string; body?: string }) {
      const self = { ...options } as { title?: string; body?: string; onClick?: () => void };
      tracks.notifications.push(self);
      return {
        on: (ev: string, fn: () => void) => { if (ev === 'click') { self.onClick = fn; } },
        show: vi.fn(),
        close: vi.fn()
      };
    }
  }
}));

import '../../src/main/index';
import log from 'electron-log';

type CertListener = (
  event: { preventDefault: () => void },
  webContents: unknown,
  url: string,
  error: string,
  certificate: unknown,
  callback: (isTrusted: boolean) => void
) => void;
type FailLoadListener = (
  event: unknown,
  errorCode: number,
  errorDescription: string,
  validatedURL: string,
  isMainFrame: boolean
) => void;
type FrameNavEvent = {
  isMainFrame: boolean;
  url: string;
  prevented: boolean;
  preventDefault: () => void;
};

function loggedText(): string {
  const calls = [...(log.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls, ...(log.error as unknown as { mock: { calls: unknown[][] } }).mock.calls];
  return calls.map((args) => args.map((a) => String(a)).join(' ')).join('\n');
}

describe('M10: certificate-error is default-deny WITH a diagnosis', () => {
  it('a listener is registered on the default session', () => {
    expect(tracks.sessionOn.has('certificate-error')).toBe(true);
  });

  it('a rejection denies (callback(false)) and logs only scheme+host', () => {
    const listener = tracks.sessionOn.get('certificate-error') as CertListener;
    let prevented = false;
    let trusted: boolean | null = null;
    listener(
      { preventDefault: () => { prevented = true; } },
      {},
      'https://phlix.example.com:8097/private/path?token=S3CR3T',
      'ERR_CERT_AUTHORITY_INVALID',
      {},
      (isTrusted) => { trusted = isTrusted; }
    );
    expect(trusted).toBe(false); // default-deny KEPT
    expect(prevented).toBe(true); // the handler owns the verdict now
    const text = loggedText();
    expect(text).toContain('https://phlix.example.com:8097');
    expect(text).not.toContain('S3CR3T');
    expect(text).not.toContain('private/path');
  });

  it('the user gets a redacted toast, not silence', () => {
    const before = tracks.notifications.length;
    const listener = tracks.sessionOn.get('certificate-error') as CertListener;
    listener({ preventDefault: () => undefined }, {}, 'wss://home.example.net/socket?k=hidden', 'ERR_CERT_DATE_INVALID', {}, () => undefined);
    expect(tracks.notifications.length).toBeGreaterThan(before);
    const latest = tracks.notifications[tracks.notifications.length - 1];
    expect(latest.title).toBe('Connection not trusted');
    expect(latest.body).toContain('wss://home.example.net');
    expect(latest.body).not.toContain('hidden');
  });
});

describe('M10/m7b: did-fail-load wires the boot-retry surface', () => {
  const listener = () => tracks.wcOn.get('did-fail-load') as FailLoadListener;

  it('ERR_ABORTED stays silent (superseded navigations are normal traffic)', async () => {
    const dialogsBefore = tracks.dialogBoxes.length;
    const notesBefore = tracks.notifications.length;
    listener()({}, -3, 'ERR_ABORTED', 'app://-/app/', true);
    await Promise.resolve();
    expect(tracks.dialogBoxes.length).toBe(dialogsBefore);
    expect(tracks.notifications.length).toBe(notesBefore);
  });

  it('subframe failures stay silent (main-frame law)', async () => {
    const notesBefore = tracks.notifications.length;
    listener()({}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://img.example.com/a.png', false);
    await Promise.resolve();
    expect(tracks.notifications.length).toBe(notesBefore);
  });

  it('an app:// boot failure opens the Reload dialog and reloads on answer', async () => {
    const dialogsBefore = tracks.dialogBoxes.length;
    listener()({}, -322, 'ERR_FILE_NOT_FOUND', 'app://-/app/', true);
    await Promise.resolve();
    await Promise.resolve();
    expect(tracks.dialogBoxes.length).toBe(dialogsBefore + 1);
    const opts = tracks.dialogBoxes[tracks.dialogBoxes.length - 1];
    expect((opts.buttons as string[]).length).toBe(2); // crashRecoveryDialog shape: Reload + Dismiss
    expect(tracks.reloads.length).toBeGreaterThan(0);
  });

  it('an external main-frame failure toasts with the scheme+host summary only', async () => {
    const notesBefore = tracks.notifications.length;
    listener()({}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://off.example.com/deep/path?q=secret', true);
    await Promise.resolve();
    expect(tracks.notifications.length).toBeGreaterThan(notesBefore);
    const latest = tracks.notifications[tracks.notifications.length - 1];
    expect(latest.title).toBe('Page failed to load');
    expect(latest.body).toContain('https://off.example.com');
    expect(latest.body).not.toContain('secret');
    expect(loggedText()).not.toContain('deep/path?q=secret');
  });
});

describe('M11 belt: will-frame-navigate refuses app:// documents in subframes', () => {
  const fire = (url: string, isMainFrame: boolean): FrameNavEvent => {
    const e: FrameNavEvent = { url, isMainFrame, prevented: false, preventDefault: () => { e.prevented = true; } };
    (tracks.wcOn.get('will-frame-navigate') as (ev: FrameNavEvent) => void)(e);
    return e;
  };

  it('a hidden iframe aimed at the authenticated SPA is refused', () => {
    expect(fire('app://-/app/', false).prevented).toBe(true);
  });

  it('even an app://-initiated subframe frame is refused (the SPA has no framed surfaces)', () => {
    expect(fire('app://-/app/library', false).prevented).toBe(true);
  });

  it('main-frame navigations (boot, reload, SPA) pass through to the existing will-navigate law', () => {
    expect(fire('app://-/app/', true).prevented).toBe(false);
  });

  it('non-app subframes are not this listener’s business', () => {
    expect(fire('https://evil.example/frame', false).prevented).toBe(false);
  });
});
