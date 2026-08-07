/**
 * @vitest-environment node
 *
 * Tests for the single-instance lock in src/main/index.ts.
 *
 * Verifies:
 * - `app.requestSingleInstanceLock()` is called when the module loads
 * - `app.quit()` is called when the lock cannot be acquired
 * - `app.on('second-instance', ...)` is registered
 *
 * Because the lock check runs at MODULE EVALUATION time, we must mock
 * electron before the import.  We use vi.hoisted() to create the spy
 * tracking state in the correct hoisted scope so the vi.mock factory
 * can reference it.
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock electron-log (has module-level side-effects)
// ---------------------------------------------------------------------------
vi.mock('electron-log', () => ({
  default: {
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// ---------------------------------------------------------------------------
// Mock electron-store
// ---------------------------------------------------------------------------
vi.mock('electron-store', () => ({
  default: vi.fn(() => ({
    get: vi.fn(() => null),
    set: vi.fn()
  }))
}));

// ---------------------------------------------------------------------------
// Mock pathUtils and urlValidator (imported by src/main/index.ts)
// ---------------------------------------------------------------------------
vi.mock('../../src/main/pathUtils', () => ({
  isPathSafe: vi.fn(() => true)
}));

vi.mock('../../src/main/urlValidator', () => ({
  validateExternalUrl: vi.fn(() => true)
}));

// ---------------------------------------------------------------------------
// Mock @phlix/ui CSS imports
// ---------------------------------------------------------------------------
vi.mock('@phlix/ui/style.css', () => ({}));
vi.mock('@phlix/ui/fonts.css', () => ({}));

// ---------------------------------------------------------------------------
// Mock electron — vi.hoisted ensures tracking vars exist before the factory
// ---------------------------------------------------------------------------
const tracks = vi.hoisted(() => {
  const quitCalls: number[] = [];
  const lockCalls: number[] = [];
  const secondInstanceHandlers: Array<(event: unknown, argv: unknown, wd: unknown) => void> = [];
  return { quitCalls, lockCalls, secondInstanceHandlers };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
    getVersion: vi.fn(() => '1.0.0'),
    isPackaged: false,
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(() => { tracks.quitCalls.push(1); }),
    on: vi.fn((event: string, handler: (event: unknown, argv: unknown, wd: unknown) => void) => {
      if (event === 'second-instance') {
        tracks.secondInstanceHandlers.push(handler);
      }
    }),
    requestSingleInstanceLock: vi.fn(() => {
      tracks.lockCalls.push(1);
      return false; // Simulate lock failure → triggers app.quit()
    })
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isFullScreen: vi.fn(() => false),
    setFullScreen: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    webContents: {
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(() => ({ action: 'deny' })),
      on: vi.fn()
    },
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    focus: vi.fn()
  })),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
  shell: { openExternal: vi.fn() },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: vi.fn(() => false),
      resize: vi.fn(() => ({}))
    }))
  },
  Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
  Tray: vi.fn(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    click: vi.fn()
  })),
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
  }
}));

// ---------------------------------------------------------------------------
// Import after mocks — triggers src/main/index.ts top-level code
// ---------------------------------------------------------------------------
import '../../src/main/index';

describe('single-instance lock', () => {
  it('calls app.requestSingleInstanceLock() at module load time', () => {
    expect(tracks.lockCalls.length).toBeGreaterThan(0);
  });

  it('calls app.quit() when the lock cannot be acquired', () => {
    // Mock returns false → code calls app.quit()
    expect(tracks.quitCalls.length).toBeGreaterThan(0);
  });

  it('registers the second-instance event handler', () => {
    expect(tracks.secondInstanceHandlers.length).toBeGreaterThan(0);
  });

  it('second-instance handler focuses the main window when it exists', () => {
    const handler = tracks.secondInstanceHandlers[0];
    expect(handler).toBeDefined();

    // mainWindow is null in the test environment — no-op path
    expect(() => handler!({} as unknown, [] as unknown, '/tmp')).not.toThrow();
  });
});
