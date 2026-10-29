/**
 * @vitest-environment node
 *
 * Wiring tests for M-WINDOWS-03: every user re-entry surface (second-
 * instance handoff, tray click, tray double-click, tray menu "Show",
 * notification click) must drive the canonical restoreWindow() sequence on
 * the module-scoped main window.
 *
 * The electron mock lets the real boot run (whenReady resolves), so
 * `mainWindow` is a live fake by the time handlers fire — the assertions
 * observe the exact BrowserWindow method calls a real restore would make.
 * windowRestore is deliberately NOT mocked: these tests compose the real
 * helper with the real handler wiring, which is what regressed before
 * (tray click called show() without focus; second-instance called focus()
 * without ever un-hiding).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted recording state
// ---------------------------------------------------------------------------
const tracks = vi.hoisted(() => {
  interface RecordedWindow {
    calls: string[];
    state: { destroyed: boolean; minimized: boolean; visible: boolean };
    [key: string]: unknown;
  }
  return {
    windows: [] as RecordedWindow[],
    appHandlers: new Map<string, Array<(event: unknown, ...args: unknown[]) => void>>(),
    trayRegistrations: [] as Array<{ instance: number; event: string; handler: () => void }>,
    menuTemplates: [] as Array<Array<Record<string, unknown>>>,
    ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
    notificationClickHandlers: [] as Array<() => void>,
    deepLinkSends: [] as unknown[][]
  };
});

// Fresh hidden-window fake per BrowserWindow construction.
function makeFakeWindow(index: number): (typeof tracks.windows)[number] {
  const state = { destroyed: false, minimized: false, visible: false };
  const calls: string[] = [];
  return {
    calls,
    state,
    isDestroyed: () => state.destroyed,
    isMinimized: () => state.minimized,
    isVisible: () => state.visible,
    restore: () => void calls.push('restore'),
    show: () => void calls.push('show'),
    focus: () => void calls.push('focus'),
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 870 }),
    isMaximized: () => false,
    maximize: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isFullScreen: () => false,
    setFullScreen: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    webContents: {
      send: vi.fn((...args: unknown[]) => {
        tracks.deepLinkSends.push(args);
      }),
      setWindowOpenHandler: vi.fn(() => ({ action: 'deny' })),
      openDevTools: vi.fn(),
      on: vi.fn()
    },
    _index: index
  };
}

// ---------------------------------------------------------------------------
// Mocks required before importing src/main/index
// ---------------------------------------------------------------------------
vi.mock('electron-log', () => ({
  default: { initialize: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('electron-store', () => ({
  default: vi.fn(function () {
    return {
      get: vi.fn((key: string, fallback: unknown) => {
        // notificationsEnabled must be true for the notification wiring test;
        // every other key follows the caller's fallback (boot defaults).
        if (key === 'notificationsEnabled') return true;
        return fallback ?? null;
      }),
      set: vi.fn()
    };
  })
}));

vi.mock('../../src/main/pathUtils', () => ({ isPathSafe: vi.fn(() => true) }));
vi.mock('../../src/main/urlValidator', () => ({ validateExternalUrl: vi.fn(() => true) }));

// electron-updater: setupAutoUpdater only registers listeners; the mock keeps
// the real module's platform-specific singleton out of the test venue.
vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: false
  }
}));

vi.mock('electron', () => {
  let trayInstanceCount = 0;
  return {
    app: {
      getPath: vi.fn(() => '/tmp'),
      getVersion: vi.fn(() => '1.0.0'),
      getLocale: vi.fn(() => 'en'),
      isPackaged: false,
      whenReady: vi.fn(() => Promise.resolve()),
      quit: vi.fn(),
      setAsDefaultProtocolClient: vi.fn(),
      disableHardwareAcceleration: vi.fn(),
      on: vi.fn((event: string, handler: (event: unknown, ...args: unknown[]) => void) => {
        const list = tracks.appHandlers.get(event) ?? [];
        list.push(handler);
        tracks.appHandlers.set(event, list);
      }),
      once: vi.fn(),
      requestSingleInstanceLock: vi.fn(() => true)
    },
    // vitest@5: constructor mocks must be function/class (arrow impls are not newable).
    BrowserWindow: vi.fn(function () {
      const index = tracks.windows.length;
      const win = makeFakeWindow(index);
      tracks.windows.push(win);
      return win;
    }),
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        tracks.ipcHandlers.set(channel, handler);
      }),
      on: vi.fn()
    },
    protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
    shell: { openExternal: vi.fn() },
    nativeImage: {
      createFromPath: vi.fn(() => ({ isEmpty: vi.fn(() => false), resize: vi.fn(() => ({})) }))
    },
    Menu: {
      buildFromTemplate: vi.fn((template: Array<Record<string, unknown>>) => {
        tracks.menuTemplates.push(template);
        return {};
      }),
      setApplicationMenu: vi.fn()
    },
    // vitest@5: `new Tray()` requires a function impl.
    Tray: vi.fn(function () {
      const instance = trayInstanceCount++;
      return {
        setToolTip: vi.fn(),
        setContextMenu: vi.fn(),
        isDestroyed: vi.fn(() => false),
        on: vi.fn((event: string, handler: () => void) => {
          tracks.trayRegistrations.push({ instance, event, handler });
        })
      };
    }),
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
    },
    screen: {
      getAllDisplays: vi.fn(() => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }])
    },
    powerSaveBlocker: { isStarted: vi.fn(() => false), start: vi.fn(() => 1), stop: vi.fn() },
    // vitest@5: `new Notification()` requires a function impl; isSupported
    // is a static on the real class, so it rides the constructor mock itself.
    Notification: Object.assign(vi.fn(function () {
      return {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'click') tracks.notificationClickHandlers.push(handler);
        }),
        show: vi.fn()
      };
    }), { isSupported: vi.fn(() => true) })
  };
});

vi.mock('@phlix/ui/style.css', () => ({}));
vi.mock('@phlix/ui/fonts.css', () => ({}));

// ---------------------------------------------------------------------------
// Import after mocks — registers handlers; whenReady boot creates mainWindow.
// ---------------------------------------------------------------------------
import '../../src/main/index';
import { createTray } from '../../src/main/index';
import { t } from '../../src/main/i18n';

function mainWin(): (typeof tracks.windows)[number] {
  const win = tracks.windows[0];
  if (!win) {
    throw new Error('boot did not construct the main window fake — wiring is untestable');
  }
  return win;
}

function resetWindow(
  win: (typeof tracks.windows)[number],
  state?: Partial<{ destroyed: boolean; minimized: boolean; visible: boolean }>
): void {
  win.calls.length = 0;
  Object.assign(win.state, { destroyed: false, minimized: false, visible: false }, state);
}

function trayHandler(event: 'click' | 'double-click'): () => void {
  const record = [...tracks.trayRegistrations].reverse().find((r) => r.event === event);
  const found = record?.handler;
  if (!found) {
    throw new Error(`no tray '${event}' handler was registered`);
  }
  return found;
}

beforeAll(async () => {
  // Drain the whenReady().then(...) boot microtasks, then guarantee the tray
  // handlers exist even if an unrelated boot step after createWindow throws:
  // createTray() is exported and idempotent-per-instance by construction.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!tracks.trayRegistrations.some((r) => r.event === 'click')) {
    createTray();
  }
});

describe('tray/second-instance restore wiring (M-WINDOWS-03)', () => {
  it('second-instance raises the hidden window with show()+focus() (the bug was focus-only)', () => {
    const win = mainWin();
    resetWindow(win);
    const handler = tracks.appHandlers.get('second-instance')?.[0];
    expect(handler).toBeDefined();

    handler!({} as unknown, [] as unknown, '/tmp');

    // Old body called focus() alone on a hidden window → nothing visible.
    expect(win.calls).toEqual(['show', 'focus']);
  });

  it('second-instance raises a minimized window restore-before-show, then focus', () => {
    const win = mainWin();
    resetWindow(win, { minimized: true });
    const handler = tracks.appHandlers.get('second-instance')?.[0];

    handler!({} as unknown, [] as unknown, '/tmp');

    expect(win.calls).toEqual(['restore', 'show', 'focus']);
  });

  it('tray single-click on the hidden window calls show() then focus()', () => {
    const win = mainWin();
    resetWindow(win);

    trayHandler('click')();

    // Old body was show() alone (no focus → foreground trap) and had no
    // destroyed guard; exact-sequence pin keeps both honest.
    expect(win.calls).toEqual(['show', 'focus']);
  });

  it('tray double-click is registered and raises the hidden window', () => {
    const win = mainWin();
    resetWindow(win);

    trayHandler('double-click')();

    expect(win.calls).toEqual(['show', 'focus']);
  });

  it('tray context-menu "Show" entry drives the full restore sequence', () => {
    const win = mainWin();
    resetWindow(win);
    const showLabel = t('tray.show');
    const item = tracks.menuTemplates
      .flat()
      .find((candidate) => candidate.label === showLabel);
    expect(item).toBeDefined();
    const click = item!['click'] as () => void;

    click();

    expect(win.calls).toEqual(['show', 'focus']);
  });

  it('destroyed window: tray click is a no-op, not a crash', () => {
    const win = mainWin();
    resetWindow(win);
    win.state.destroyed = true;

    expect(() => trayHandler('click')()).not.toThrow();
    expect(win.calls).toEqual([]);
  });

  it('notification click restores the window and still delivers the clickAction route', async () => {
    const win = mainWin();
    resetWindow(win);
    tracks.deepLinkSends.length = 0;
    const handler = tracks.ipcHandlers.get('notification:show');
    expect(handler).toBeDefined();

    const shown = await handler!(
      {} as unknown,
      { title: 't', body: 'b', clickAction: '/library' } as unknown
    );
    expect(shown).toBe(true);
    const clickHandler = tracks.notificationClickHandlers.at(-1);
    expect(clickHandler).toBeDefined();

    clickHandler!();

    expect(win.calls).toEqual(['show', 'focus']);
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/library']]);
  });

  it('notification click on a MINIMIZED window restores before show (old show+focus body has no restore arm)', async () => {
    const win = mainWin();
    resetWindow(win, { minimized: true });
    tracks.deepLinkSends.length = 0;
    const handler = tracks.ipcHandlers.get('notification:show');

    await handler!({} as unknown, { title: 't', body: 'b' } as unknown);
    tracks.notificationClickHandlers.at(-1)!();

    expect(win.calls).toEqual(['restore', 'show', 'focus']);
  });

  it('notification click on a DESTROYED window is a no-op, not an "Object has been destroyed" throw', async () => {
    const win = mainWin();
    resetWindow(win);
    win.state.destroyed = true;
    tracks.deepLinkSends.length = 0;
    const handler = tracks.ipcHandlers.get('notification:show');

    await handler!({} as unknown, { title: 't', body: 'b', clickAction: '/library' } as unknown);
    const clickHandler = tracks.notificationClickHandlers.at(-1);

    // The old body ran mainWindow?.show() straight — on a destroyed window
    // that throws (BrowserWindow docs: touching a destroyed window throws
    // "Object has been destroyed"); handleDeepLinkUrl's own guard kept the
    // send path safe, the restore part did not.
    expect(() => clickHandler!()).not.toThrow();
    expect(win.calls).toEqual([]);
  });

  it('second-instance still delivers its deep link after raising the window', () => {
    const win = mainWin();
    resetWindow(win);
    tracks.deepLinkSends.length = 0;
    const handler = tracks.appHandlers.get('second-instance')?.[0];

    handler!({} as unknown, ['phlix://internal/settings'], '/tmp');

    expect(win.calls).toEqual(['show', 'focus']);
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/settings']]);
  });
});
