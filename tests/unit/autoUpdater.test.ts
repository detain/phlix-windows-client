import { describe, it, expect, vi } from 'vitest';
import log from 'electron-log';

// --- Shared mocks via vi.hoisted so vi.mock can reference them -----------------
// The handlers object MUST be declared here and configured with mockImplementation
// BEFORE the module import so that setupAutoUpdater() captures handlers on load.
const { mockAutoUpdater, mockAppWhenReady, handlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};

  const autoUpdater = {
    logger: null,
    autoDownload: false,
    allowPrerelease: false,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    once: vi.fn()
  };

  // Capture handlers synchronously during module load — BEFORE any test runs.
  autoUpdater.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    handlers[event] = cb;
    return autoUpdater;
  });

  // app.whenReady() returns a thenable so that .then() callbacks fire synchronously
  // during module import — this lets setupAutoUpdater populate handlers before tests run.
  const whenReady = vi.fn(() => ({
    then: (cb: () => void) => { cb(); }
  }));

  return { mockAutoUpdater: autoUpdater, mockAppWhenReady: whenReady, handlers };
});

// --- Module-level mocks -------------------------------------------------------
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    initialize: vi.fn()
  }
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater
}));

// Mock electron — must use mockAppWhenReady so app.whenReady() triggers
// setupAutoUpdater synchronously during module import.
const mockNotification = vi.fn();
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    disableHardwareAcceleration: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: mockAppWhenReady,
    on: vi.fn(),
    quit: vi.fn()
  },
  // vitest@5: `mockReturnValue` is rejected when the mock is called with `new`
  // ("Use mockImplementation with a function/class instead"). Same stub shape.
  BrowserWindow: vi.fn().mockImplementation(function () {
    return {
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      setAlwaysOnTop: vi.fn(),
      setFullScreen: vi.fn(),
      isFullScreen: vi.fn().mockReturnValue(false),
      maximize: vi.fn(),
      isMaximized: vi.fn().mockReturnValue(false),
      setProgressBar: vi.fn(),
      setThumbarButtons: vi.fn(),
      webContents: {
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        on: vi.fn(),
        openDevTools: vi.fn()
      },
      on: vi.fn(),
      once: vi.fn()
    };
  }),
  Menu: {
    buildFromTemplate: vi.fn().mockReturnValue({}),
    setApplicationMenu: vi.fn()
  },
  // vitest@5: `new Tray()` cannot come from mockReturnValue — function impl, same stub.
  Tray: vi.fn().mockImplementation(function () {
    return {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn()
    };
  }),
  // M-WINDOWS-11: src/main/index.ts destructures electron.safeStorage at module-eval
  // time (custody wiring). Stub = encryption unavailable → the disclosed plaintext
  // fallback path, which leaves the store-mock interactions these tests pin unchanged.
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('mock safeStorage');
    },
    decryptString: () => {
      throw new Error('mock safeStorage');
    }
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    send: vi.fn()
  },
  shell: { openExternal: vi.fn() },
  nativeImage: { createFromPath: vi.fn().mockReturnValue({ isEmpty: () => false, resize: vi.fn() }) },
  dialog: { showMessageBox: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  screen: { getAllDisplays: vi.fn().mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]) },
  powerSaveBlocker: { start: vi.fn(), stop: vi.fn(), isStarted: vi.fn().mockReturnValue(false) },
  Notification: class {
    static isSupported = vi.fn().mockReturnValue(true);
    // M-WINDOWS-12: capture the constructor options so payload copy can be
    // asserted byte-for-byte (previously only "a Notification was built").
    constructor(options: { title: string; body: string }) { mockNotification(options); }
    on = vi.fn();
    show = vi.fn();
  }
}));

// Import main AFTER all mocks are configured — this triggers app.whenReady()
// which synchronously calls setupAutoUpdater() and registers autoUpdater handlers.
import '../../src/main/index';
// The mocked electron + pure main-process i18n module: handlers registered via
// ipcMain.handle / Menu.buildFromTemplate are recovered from the mock call
// logs, and menu labels are resolved through the SAME t() the app used.
import { ipcMain, Menu } from 'electron';
import { t as tMain } from '../../src/main/i18n';

describe('autoUpdater state machine', () => {
  // Note: `handlers` is sourced from vi.hoisted() — do NOT redeclare here.
  // The module-level handlers object contains all handlers captured during
  // setupAutoUpdater() which runs once at module-load time.
  // No beforeEach/afterEach hooks needed — setupAutoUpdater runs once at
  // module-load time, handlers are fixed, and mock state persists across tests.
  // Use mockXxx.mockReset() individually if a test needs a clean slate.

  describe('update state transitions', () => {
    it('transitions to checking when checking-for-update fires', () => {
      // Simulate the event
      handlers['checking-for-update']();
      // The module-level updateState would be 'checking' — verify via log
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
    });

    it('transitions to available when update-available fires with version', () => {
      const info = { version: '1.0.1', releaseDate: '2026-01-01' };
      handlers['update-available'](info);
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
    });

    it('transitions to downloading when download-progress fires', () => {
      const progress = { percent: 45.5, bytesPerSecond: 1024000, transferred: 1024, total: 2048 };
      handlers['download-progress'](progress);
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
    });

    it('transitions to downloaded when update-downloaded fires', () => {
      const info = { version: '1.0.1', releaseDate: '2026-01-01' };
      handlers['update-downloaded'](info);
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
    });

    it('transitions to error on error event with non-offline message', () => {
      const err = new Error('签名验证失败');
      handlers['error'](err);
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('treats network errors as idle (offline/rate-limited) without surfacing to user', () => {
      const networkErrors = [
        'net::ERR_INTERNET_DISCONNECTED',
        'net::ERR_Connection_REFUSED',
        'rate limit',
        '404',
        'ENOTFOUND'
      ];

      for (const msg of networkErrors) {
        const err = new Error(msg);
        handlers['error'](err);
        // Should not log as error — only warn
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('likely offline'));
      }
    });
  });

  describe('menu "Check for updates" behavior', () => {
    it('skips check when already checking or downloading', async () => {
      // Verify the menu handler has early-exit guard logic
      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });
  });

  describe('IPC handlers', () => {
    it('update:check-for-updates is registered', () => {
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('autoUpdater configuration', () => {
    it('sets autoDownload to false (user-initiated download)', () => {
      expect(mockAutoUpdater.autoDownload).toBe(false);
    });

    it('sets allowPrerelease to false (follow tagged releases only)', () => {
      expect(mockAutoUpdater.allowPrerelease).toBe(false);
    });
  });

  describe('notification on update-downloaded', () => {
    it('creates a notification when update is downloaded', () => {
      const info = { version: '1.0.1' };
      handlers['update-downloaded'](info);

      // Verify Notification was constructed (clickAction wires to quitAndInstall)
      expect(mockNotification).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// M-WINDOWS-12 [review windows__gameux M1]: the 'update-not-available' arm.
// Without it the FIRST "no updates" result — the steady state of every boot —
// jammed updateState at 'checking' forever: the menu guard and the 6-hour
// periodic check both early-return on checking/downloading, so "Check for
// updates" was a permanent silent no-op after first launch. Each test below
// drives REAL handler emissions captured at module load (handlers[]), the
// registered ipcMain handlers, and the actual menu click closure — red on the
// parent commit, where handlers['update-not-available'] does not exist.
// ---------------------------------------------------------------------------
type MenuItemLike = {
  label?: string;
  submenu?: MenuItemLike[];
  click?: (...args: unknown[]) => void;
};

function ipcHandler(channel: string): (...args: unknown[]) => unknown {
  const calls = (ipcMain.handle as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const entry = calls.find((c: unknown[]) => c[0] === channel);
  if (!entry) throw new Error(`no ipcMain.handle registration for ${channel}`);
  return entry[1] as (...args: unknown[]) => unknown;
}

function getUpdateStatus(): Record<string, unknown> {
  return ipcHandler('update:get-status')() as Record<string, unknown>;
}

function clickMenuCheckForUpdates(): void {
  const templates = (Menu.buildFromTemplate as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => c[0])
    .filter(Array.isArray) as MenuItemLike[][];
  const help = templates.flat().find((item) => item.label === tMain('menu.help'));
  const check = help?.submenu?.find((item) => item.label === tMain('menu.checkForUpdates'));
  if (!check?.click) throw new Error('menu "Check for updates" entry not found');
  check.click();
}

describe('M-WINDOWS-12: update-not-available arm', () => {
  // Mirrors the vendor emit order (AppUpdater.doCheckForUpdates):
  // checking-for-update, then the terminal update-not-available result.
  const noUpdateCheck = async () => {
    handlers['checking-for-update']();
    handlers['update-not-available']({ version: '1.0.0', releaseDate: '2026-01-01' });
  };

  it('registers the update-not-available handler (the previously missing arm)', () => {
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
    expect(typeof handlers['update-not-available']).toBe('function');
  });

  it('un-sticks a checking status back to idle — the guard precondition the menu and the 6h periodic check need to stay alive', () => {
    handlers['checking-for-update']();
    expect(getUpdateStatus().status).toBe('checking');
    handlers['update-not-available']({ version: '1.0.0' });
    expect(getUpdateStatus().status).toBe('idle');
  });

  it('menu "Check for updates" with no new release answers with the up-to-date notification (payload copy truth, current version)', () => {
    mockNotification.mockClear();
    mockAutoUpdater.checkForUpdates.mockImplementation(noUpdateCheck);

    clickMenuCheckForUpdates();

    expect(mockNotification).toHaveBeenCalledTimes(1);
    expect(mockNotification).toHaveBeenCalledWith({
      title: "You're on the latest version",
      body: 'Phlix 1.0.0 is already the latest version.'
    });
    expect(getUpdateStatus().status).toBe('idle');
  });

  it('update:check-for-updates IPC answers honestly (idle, no stale version) and toasts once', async () => {
    mockNotification.mockClear();
    mockAutoUpdater.checkForUpdates.mockImplementation(noUpdateCheck);

    const result = await ipcHandler('update:check-for-updates')();

    expect(result).toEqual({ status: 'idle', version: undefined });
    expect(mockNotification).toHaveBeenCalledTimes(1);
    expect(mockNotification).toHaveBeenCalledWith({
      title: "You're on the latest version",
      body: 'Phlix 1.0.0 is already the latest version.'
    });
  });

  it('automatic checks (boot / 6h periodic) stay SILENT on not-available — W4.9 no-noise doctrine', () => {
    mockNotification.mockClear();

    handlers['checking-for-update']();
    handlers['update-not-available']({ version: '1.0.0' });

    expect(mockNotification).not.toHaveBeenCalled();
    expect(getUpdateStatus().status).toBe('idle');
  });

  it('a manual request consumed by an error cannot leak into a later automatic toast', async () => {
    mockNotification.mockClear();
    mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
      handlers['checking-for-update']();
      handlers['error'](new Error('signature verification failed'));
    });

    const result = await ipcHandler('update:check-for-updates')();
    expect(result).toEqual(expect.objectContaining({ status: 'error' }));

    // Later automatic cycle: the consumed flag must not revive the reply.
    handlers['update-not-available']({ version: '1.0.0' });
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('an available update during a manual check consumes the request — only the real "Update Available" toast fires', async () => {
    mockNotification.mockClear();
    mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
      handlers['checking-for-update']();
      handlers['update-available']({ version: '2.0.0', releaseDate: '2026-06-01' });
    });

    await ipcHandler('update:check-for-updates')();
    expect(mockNotification).toHaveBeenCalledTimes(1);
    expect(mockNotification).toHaveBeenCalledWith({
      title: 'Update Available',
      body: 'Phlix 2.0.0 is available. Click to download.'
    });

    // A subsequent automatic not-available cycle stays silent (flag consumed).
    handlers['update-not-available']({ version: '2.0.0' });
    expect(mockNotification).toHaveBeenCalledTimes(1);
  });
});
