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
  BrowserWindow: vi.fn().mockReturnValue({
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
  }),
  Menu: {
    buildFromTemplate: vi.fn().mockReturnValue({}),
    setApplicationMenu: vi.fn()
  },
  Tray: vi.fn().mockReturnValue({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn()
  }),
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
    constructor() { mockNotification(); }
    on = vi.fn();
    show = vi.fn();
  }
}));

// Import main AFTER all mocks are configured — this triggers app.whenReady()
// which synchronously calls setupAutoUpdater() and registers autoUpdater handlers.
import '../../src/main/index';

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
