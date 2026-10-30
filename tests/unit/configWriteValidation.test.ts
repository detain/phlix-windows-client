/**
 * M-WINDOWS-34 (review windows__exploiter 6): the config-write IPC handlers
 * persisted renderer-supplied values verbatim — any scheme (file:, data:),
 * embedded credentials, non-string junk, or made-up connection modes sailed
 * into the store/custody and later became boot-time fetch/seed inputs.
 * The handlers are the boundary; they validate now (empty string stays a
 * LEGAL CLEAR — main.ts's onConnectionChange(url ?? '') relies on it).
 *
 * Harness mirrors notificationPrefHonored.test.ts (mutable hoisted prefs via
 * mocked electron-store; custody falls back to plaintext when safeStorage
 * mock throws, so prefs shows every persisted write).
 */
import { describe, it, expect, vi } from 'vitest';

const { mockAppWhenReady, prefs } = vi.hoisted(() => {
  const whenReady = vi.fn(() => ({
    then: (cb: () => void) => { cb(); }
  }));
  const prefs: Record<string, unknown> = {};
  return { mockAppWhenReady: whenReady, prefs };
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
    getPath: () => '/tmp/opencode/fix-win-min',
    getAppPath: () => '/tmp/opencode/fix-win-min',
    disableHardwareAcceleration: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: mockAppWhenReady,
    on: vi.fn(),
    quit: vi.fn()
  },
  BrowserWindow: vi.fn().mockImplementation(function () {
    return {
      loadURL: vi.fn(), loadFile: vi.fn(), show: vi.fn(), hide: vi.fn(), close: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false), setAlwaysOnTop: vi.fn(),
      setFullScreen: vi.fn(), isFullScreen: vi.fn().mockReturnValue(false),
      maximize: vi.fn(), isMaximized: vi.fn().mockReturnValue(false),
      setProgressBar: vi.fn(), setThumbarButtons: vi.fn(),
      webContents: { send: vi.fn(), setWindowOpenHandler: vi.fn(), on: vi.fn(), openDevTools: vi.fn() },
      on: vi.fn(), once: vi.fn()
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
  dialog: { showMessageBox: vi.fn().mockReturnValue(Promise.resolve({ response: 1 })), showMessageBoxSync: vi.fn().mockReturnValue(1) },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  screen: { getPrimaryDisplay: vi.fn().mockReturnValue({ scaleFactor: 1 }), getAllDisplays: vi.fn().mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]) },
  powerSaveBlocker: { start: vi.fn(), stop: vi.fn(), isStarted: vi.fn().mockReturnValue(false) },
  Notification: class {
    static isSupported = vi.fn().mockReturnValue(true);
    on() {}
    show() {}
  }
}));

import '../../src/main/index';
import { ipcMain } from 'electron';

function invokeHandler(channel: string): (...args: unknown[]) => unknown {
  const call = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`no ipcMain.handle registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

const setServerUrl = invokeHandler('app:set-server-url');
const setHubConfig = invokeHandler('hub:set-config');

describe('M-WINDOWS-34: server URL writes are validated at the boundary', () => {
  it('refuses a non-http(s) scheme and stores nothing', () => {
    delete prefs.serverUrl;
    expect(setServerUrl({}, 'file:///C:/secrets/saml.config')).toBe(false);
    expect('serverUrl' in prefs).toBe(false);
  });

  it('refuses embedded credentials (the old code stored them raw)', () => {
    delete prefs.serverUrl;
    expect(setServerUrl({}, 'http://admin:hunter2@internal.corp:8096')).toBe(false);
    expect('serverUrl' in prefs).toBe(false);
  });

  it('refuses non-string input', () => {
    delete prefs.serverUrl;
    expect(setServerUrl({}, 42)).toBe(false);
    expect(setServerUrl({}, { url: 'https://ok' })).toBe(false);
    expect('serverUrl' in prefs).toBe(false);
  });

  it('accepts a plain https origin AND loopback http (self-hosted product)', () => {
    expect(setServerUrl({}, 'https://media.example.com')).toBe(true);
    expect(prefs.serverUrl).toBe('https://media.example.com');
    expect(setServerUrl({}, 'http://192.168.1.10:8096')).toBe(true);
    expect(prefs.serverUrl).toBe('http://192.168.1.10:8096');
  });

  it("the empty string stays the legal CLEAR signal (main.ts onConnectionChange(''))", () => {
    prefs.serverUrl = 'https://old.example';
    expect(setServerUrl({}, '')).toBe(true);
    expect(prefs.serverUrl).toBe('');
  });
});

describe('M-WINDOWS-34: hub config writes are validated field by field', () => {
  it('a malformed hubUrl is refused while other legal fields still land', () => {
    setHubConfig({}, { hubUrl: 'javascript:alert(1)', connectionMode: 'hub', activeServerId: 'srv-7' });
    expect(prefs.hubUrl).toBeUndefined();
    expect(prefs.connectionMode).toBe('hub');
    expect(prefs.activeServerId).toBe('srv-7');
  });

  it('connectionMode only accepts the real vocabulary', () => {
    delete prefs.connectionMode;
    setHubConfig({}, { connectionMode: 'tunnel-to-attacker' });
    expect('connectionMode' in prefs).toBe(false);
    setHubConfig({}, { connectionMode: 'direct' });
    expect(prefs.connectionMode).toBe('direct');
    setHubConfig({}, { connectionMode: 'hub' });
    expect(prefs.connectionMode).toBe('hub');
  });

  it('activeServerId must be a bounded non-empty string', () => {
    prefs.activeServerId = 'good-id';
    setHubConfig({}, { activeServerId: '   ' });
    expect(prefs.activeServerId).toBe('good-id');
    setHubConfig({}, { activeServerId: {} });
    expect(prefs.activeServerId).toBe('good-id');
    setHubConfig({}, { activeServerId: 'x'.repeat(600) });
    expect(prefs.activeServerId).toBe('good-id');
    setHubConfig({}, { activeServerId: 'fresh-id' });
    expect(prefs.activeServerId).toBe('fresh-id');
  });

  it('hubUrl empty string clears (disconnect law, resolveConfig truthiness guard)', () => {
    prefs.hubUrl = 'https://hub.example';
    setHubConfig({}, { hubUrl: '' });
    expect(prefs.hubUrl).toBe('');
  });
});
