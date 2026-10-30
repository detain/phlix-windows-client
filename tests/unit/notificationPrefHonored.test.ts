/**
 * M-WINDOWS-40 (review windows__gameux m6): the notificationsEnabled
 * preference must gate EVERY toast this process raises — including the three
 * autoUpdater arms, which historically fired raw `new Notification` guarded
 * only by isSupported(), silently overriding an explicit user opt-out.
 *
 * Harness shape mirrors autoUpdater.test.ts (vi.hoisted handler capture +
 * sync-thenable app.whenReady), with two additions: electron-store is mocked
 * so `notificationsEnabled` is a mutable pref, and the Notification mock
 * records instances (constructor options + registered click callback +
 * show()) so each gate and wiring leg is drivable.
 */
import { describe, it, expect, vi } from 'vitest';

interface RecordedNotification {
  options: { title: string; body: string };
  click?: () => void;
  wasShown: boolean;
}

const { mockAutoUpdater, mockAppWhenReady, handlers, prefs, recorded } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const recorded: unknown[] = [];

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
  autoUpdater.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    handlers[event] = cb;
    return autoUpdater;
  });

  const whenReady = vi.fn(() => ({
    then: (cb: () => void) => { cb(); }
  }));

  const prefs: Record<string, unknown> = {};

  return { mockAutoUpdater: autoUpdater, mockAppWhenReady: whenReady, handlers, prefs, recorded };
});

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), initialize: vi.fn() }
}));

vi.mock('electron-updater', () => ({ autoUpdater: mockAutoUpdater }));

// Deterministic prefs: get(key, fallback) consults the mutable hoisted bag.
vi.mock('electron-store', () => ({
  default: class {
    get(key: string, fallback?: unknown) {
      return key in prefs ? prefs[key] : fallback;
    }
    set(key: string, value: unknown) { prefs[key] = value; }
  }
}));

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
      webContents: { send: vi.fn(), setWindowOpenHandler: vi.fn(), on: vi.fn(), openDevTools: vi.fn() },
      on: vi.fn(),
      once: vi.fn()
    };
  }),
  Menu: { buildFromTemplate: vi.fn().mockReturnValue({}), setApplicationMenu: vi.fn() },
  Tray: vi.fn().mockImplementation(function () {
    return { setToolTip: vi.fn(), setContextMenu: vi.fn(), on: vi.fn() };
  }),
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => { throw new Error('mock safeStorage'); },
    decryptString: () => { throw new Error('mock safeStorage'); }
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), send: vi.fn() },
  shell: { openExternal: vi.fn() },
  nativeImage: { createFromPath: vi.fn().mockReturnValue({ isEmpty: () => false, resize: vi.fn() }) },
  dialog: { showMessageBox: vi.fn(), showMessageBoxSync: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  screen: { getAllDisplays: vi.fn().mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]) },
  powerSaveBlocker: { start: vi.fn(), stop: vi.fn(), isStarted: vi.fn().mockReturnValue(false) },
  Notification: class implements RecordedNotification {
    static isSupported = vi.fn().mockReturnValue(true);
    click?: () => void;
    wasShown = false;
    constructor(public options: { title: string; body: string }) {
      recorded.push(this);
    }
    on(ev: string, cb: () => void) {
      if (ev === 'click') this.click = cb;
    }
    show() { this.wasShown = true; }
  }
}));

import '../../src/main/index';
import { ipcMain } from 'electron';

function invokeHandler(channel: string): (...args: unknown[]) => unknown {
  const call = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`no ipcMain.handle registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

const toasts = () => recorded as RecordedNotification[];

describe('M-WINDOWS-40: notificationsEnabled gates every toast origin', () => {
  it('the update-available arm stays silent when the user opted out', () => {
    prefs.notificationsEnabled = false;
    recorded.length = 0;
    handlers['update-available']({ version: '9.9.9', releaseDate: '2026-01-01' });
    // THE bug this batch cures: the arm fired a raw Notification past the pref.
    expect(toasts()).toHaveLength(0);
  });

  it('the update-downloaded arm stays silent when the user opted out', () => {
    prefs.notificationsEnabled = false;
    recorded.length = 0;
    handlers['update-downloaded']({ version: '9.9.9', releaseDate: '2026-01-01' });
    expect(toasts()).toHaveLength(0);
  });

  it('the manual not-available reply stays silent when the user opted out', () => {
    prefs.notificationsEnabled = false;
    recorded.length = 0;
    // Arm the manual-check flag through the real IPC entry point first…
    // (the check-for-updates handler sets manualUpdateCheckPending)
    const check = invokeHandler('update:check-for-updates');
    mockAutoUpdater.checkForUpdates.mockClear();
    check({});
    handlers['update-not-available']({ version: '1.0.0' } as unknown as Record<string, unknown>);
    expect(toasts()).toHaveLength(0);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
  });

  it('with the pref on (default), the available arm toasts with the catalog copy', () => {
    delete prefs.notificationsEnabled;
    recorded.length = 0;
    handlers['update-available']({ version: '9.9.9', releaseDate: '2026-01-01' });
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].options.title).toBe('Update Available');
    expect(toasts()[0].options.body).toBe('Phlix 9.9.9 is available. Click to download.');
    expect(toasts()[0].wasShown).toBe(true);
  });

  it('a pref-enabled downloaded toast click installs the update (wiring survives the gate)', () => {
    delete prefs.notificationsEnabled;
    recorded.length = 0;
    handlers['update-downloaded']({ version: '9.9.9', releaseDate: '2026-01-01' });
    expect(toasts()).toHaveLength(1);
    mockAutoUpdater.quitAndInstall.mockClear();
    expect(typeof toasts()[0].click).toBe('function');
    toasts()[0].click!();
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(false, false);
  });

  it('the renderer IPC path honours the same pref', () => {
    prefs.notificationsEnabled = false;
    const show = invokeHandler('notification:show');
    expect(show({}, { title: 'x', body: 'y' })).toBe(false);
    delete prefs.notificationsEnabled;
    expect(show({}, { title: 'x', body: 'y' })).toBe(true);
  });
});
