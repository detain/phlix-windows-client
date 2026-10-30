/**
 * @vitest-environment node
 *
 * M-WINDOWS-02 (review windows__casualgamer): a server below MIN_SERVER_VERSION
 * used to end in a permanently dark window — the renderer aborted boot with
 * nothing but an electron-log line. The cure raises an EXPLICIT main-process
 * error dialog from the `app:check-server-version` handler, naming the version
 * found and the version required. This file proves both halves:
 *
 *   1. showServerTooOldDialog() actually invokes dialog.showMessageBox with a
 *      type-'error' payload carrying both version strings (behavioral — kills
 *      "log-only" reverts at the function level);
 *   2. the handler WIRING: `if (!result.compatible) showServerTooOldDialog(...)`
 *      is present in src/main/index.ts (static pin — kills removing the call
 *      or flipping the condition, which the function's unit test alone cannot
 *      see because the handler is the only production caller).
 *
 * Mock header mirrors tests/unit/protocolHandler.test.ts (same import chain of
 * src/main/index.ts under a mocked electron/electron-log/electron-store), plus
 * isDestroyed on the window stub — showServerTooOldDialog probes it before
 * parenting the dialog.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import { readFileSync } from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

vi.mock('electron-log', () => ({
  default: {
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('electron-store', () => ({
  // vitest@5: constructor mocks must be function/class (arrow impls are no longer
  // newable). Same behavior: fresh {get,set} stub per `new Store()`.
  default: vi.fn(function () {
    return {
      get: vi.fn(() => null),
      set: vi.fn()
    };
  })
}));

const { protocolHandlers } = vi.hoisted(() => {
  const handlers = new Map<string, (request: { url: string }) => Response>();
  return { protocolHandlers: handlers };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(PROJECT_ROOT, 'dist')),
    getVersion: vi.fn(() => '1.0.0'),
    isPackaged: true,
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(),
    on: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true)
  },
  // vitest@5: `new BrowserWindow()` requires a function impl (arrow impls are not newable).
  BrowserWindow: vi.fn(function () {
    return {
      loadURL: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      isFullScreen: vi.fn(() => false),
      setFullScreen: vi.fn(),
      // M-WINDOWS-02 addition over the protocolHandler harness: the dialog
      // helper checks liveness before parenting.
      isDestroyed: vi.fn(() => false),
      on: vi.fn(),
      once: vi.fn(),
      webContents: {
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(() => ({ action: 'deny' })),
        on: vi.fn()
      }
    };
  }),
  // M-WINDOWS-11: safeStorage stub (see autoUpdater.test.ts note) — the SUT
  // destructures it at module-eval; unavailable ⇒ disclosed plaintext fallback.
  // M-WINDOWS-29: src/main/index.ts installs the permission guard on
  // defaultSession inside app.whenReady — the mock must expose it.
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
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
    on: vi.fn()
  },
  protocol: {
    handle: vi.fn((scheme: string, handler: (request: { url: string }) => Response) => {
      protocolHandlers.set(scheme, handler);
    }),
    registerSchemesAsPrivileged: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      resize: vi.fn(() => ({ width: 16, height: 16 }))
    }))
  },
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn()
  },
  // vitest@5: `new Tray()` requires a function impl (arrow impls are not newable).
  Tray: vi.fn(function () {
    return {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
      click: vi.fn()
    };
  }),
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
  }
}));

import { dialog } from 'electron';
import { showServerTooOldDialog } from '../../src/main/index';
import type { ServerVersionCheck } from '../../src/main/versionCheck';

/** Last positional arg of the showMessageBox call = the options bag (the first
 *  arg is the parent window only when one exists — the call site has both
 *  overloads, so assert on the options regardless of arity). */
function lastShowMessageBoxOptions(): { type?: string; title?: string; message?: string; detail?: string } {
  const showMessageBox = vi.mocked(dialog.showMessageBox);
  expect(showMessageBox).toHaveBeenCalledTimes(1);
  const args = showMessageBox.mock.calls[0];
  return args[args.length - 1] as { type?: string; title?: string; message?: string; detail?: string };
}

describe('showServerTooOldDialog (main-process too-old-server surface)', () => {
  beforeEach(() => {
    vi.mocked(dialog.showMessageBox).mockClear();
  });

  it('raises an error dialog naming the version found and the version required', () => {
    const verdict: ServerVersionCheck = { compatible: false, serverVersion: '1.0.7', minimumVersion: '1.1.0' };

    showServerTooOldDialog(verdict);

    const options = lastShowMessageBoxOptions();
    expect(options.type).toBe('error');
    expect(options.message).toMatch(/too old/i);
    // The whole point of M-WINDOWS-02: the user learns WHICH versions made the
    // call, not just that something failed. Interpolation runs through the
    // main-process i18n catalog (en in the harness).
    expect(options.detail).toContain('1.0.7');
    expect(options.detail).toContain('1.1.0');
  });

  it('degrades to an explicit "unknown" marker instead of leaving a hole when no version was read', () => {
    const verdict: ServerVersionCheck = { compatible: false, serverVersion: null, minimumVersion: '1.1.0' };

    showServerTooOldDialog(verdict);

    const options = lastShowMessageBoxOptions();
    expect(options.detail).toContain('unknown');
    expect(options.detail).toContain('1.1.0');
  });

  it('the version handler wires the blocking verdict to the dialog (static pin)', () => {
    // The dialog's only production caller is the `app:check-server-version`
    // handler; a bare boolean contract could not decide. Pin the wiring so
    // removing the call, flipping the condition, or re-narrowing to a boolean
    // reddens here even though the function itself still tests green.
    const source = readFileSync(path.join(PROJECT_ROOT, 'src', 'main', 'index.ts'), 'utf8');
    const handler = source.match(/ipcMain\.handle\('app:check-server-version'[\s\S]*?\n\}\);/);
    expect(handler, 'app:check-server-version handler block').not.toBeNull();
    expect(handler![0]).toMatch(/const result = await checkMinServerVersion\(apiBase\);/);
    expect(handler![0]).toMatch(/if \(!result\.compatible\) \{\s*showServerTooOldDialog\(result\);\s*\}/);
    expect(handler![0]).toMatch(/return result;/);
  });
});
