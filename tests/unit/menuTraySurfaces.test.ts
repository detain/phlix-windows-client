/**
 * @vitest-environment node
 *
 * Batch-4 law pins (review gameux #1/#3/#4 + casualgamer M6):
 *  - M5: the Edit menu role exists; a context-menu handler is registered on
 *    the main window and pops an edit/selection-aware template (roles only).
 *  - m10: the playback rows no longer DISPLAY accelerators the menu never
 *    registered (Space/Left/Right live in the renderer-side relay, not in the
 *    menu); F11 — a genuinely registered accelerator — stays displayed.
 *  - M6/m11: the preference checkboxes (minimize-to-tray, notifications) exist
 *    on BOTH surfaces (View submenu + tray menu), WRITER on click, and both
 *    menus rebuild in lockstep so they can never disagree.
 *
 * Harness: the real src/main/index.ts boots under a recording electron mock
 * (pattern proven by trayRestoreWiring.test.ts), with a Map-backed store so
 * toggles round-trip for real.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

const tracks = vi.hoisted(() => {
  return {
    storeData: new Map<string, unknown>(),
    menuTemplates: [] as Array<Array<Record<string, unknown>>>,
    applicationMenus: [] as Array<Record<string, unknown>>,
    poppedMenus: [] as Array<{ template: Array<Record<string, unknown>>; options: unknown }>,
    webContentsHandlers: new Map<string, Array<(event: unknown, params: unknown) => void>>(),
    appMenusRebuilt: { count: 0 }
  };
});

const POPUP = Symbol('popupMenu');

function makeFakeWindow() {
  const state = { destroyed: false, minimized: false, visible: false };
  return {
    state,
    isDestroyed: () => state.destroyed,
    isMinimized: () => state.minimized,
    isVisible: () => state.visible,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 870 }),
    isMaximized: () => false,
    maximize: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isFullScreen: () => false,
    setFullScreen: vi.fn(),
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    setMenuBarVisibility: vi.fn(),
    removeMenu: vi.fn(),
    webContents: {
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(() => ({ action: 'deny' })),
      openDevTools: vi.fn(),
      on: vi.fn((event: string, handler: (event: unknown, params: unknown) => void) => {
        const list = tracks.webContentsHandlers.get(event) ?? [];
        list.push(handler);
        tracks.webContentsHandlers.set(event, list);
      })
    },
    [POPUP]: true
  };
}

vi.mock('electron-log', () => ({
  default: { initialize: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: undefined }
}));

vi.mock('electron-store', () => ({
  default: vi.fn(function () {
    return {
      get: vi.fn((key: string, fallback?: unknown) =>
        tracks.storeData.has(key) ? tracks.storeData.get(key) : fallback),
      set: vi.fn((key: string, value: unknown) => void tracks.storeData.set(key, value))
    };
  })
}));

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
  return {
    // M8 batch 10: index.ts imports powerMonitor — partial electron mocks
    // make the named import throw at boot (exit-7 class, see batch 6).
    powerMonitor: { on: vi.fn() },
    app: {
      getPath: vi.fn(() => '/tmp'),
      getVersion: vi.fn(() => '1.0.0'),
      getLocale: vi.fn(() => 'en'),
      isPackaged: false,
      whenReady: vi.fn(() => Promise.resolve()),
      quit: vi.fn(),
      setAsDefaultProtocolClient: vi.fn(),
      setLoginItemSettings: vi.fn(),
      disableHardwareAcceleration: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      requestSingleInstanceLock: vi.fn(() => true)
    },
    BrowserWindow: vi.fn(function () {
      return makeFakeWindow();
    }),
    session: {
      defaultSession: {
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        on: vi.fn(),
        webRequest: { onBeforeRequest: vi.fn() },
        protocol: { registerSchemesAsPrivileged: vi.fn() }
      }
    },
    safeStorage: {
      isEncryptionAvailable: () => false,
      encryptString: () => {
        throw new Error('mock safeStorage');
      },
      decryptString: () => {
        throw new Error('mock safeStorage');
      }
    },
    ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
    protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
    shell: { openExternal: vi.fn() },
    nativeImage: {
      createFromPath: vi.fn(() => ({ isEmpty: vi.fn(() => true), resize: vi.fn(() => ({ isEmpty: vi.fn(() => true) })) }))
    },
    Menu: {
      buildFromTemplate: vi.fn((template: Array<Record<string, unknown>>) => {
        tracks.menuTemplates.push(template);
        return {
          template,
          popup: vi.fn((options: unknown) => {
            tracks.poppedMenus.push({ template, options });
          })
        };
      }),
      setApplicationMenu: vi.fn((menu: Record<string, unknown>) => {
        tracks.applicationMenus.push(menu);
        tracks.appMenusRebuilt.count += 1;
      })
    },
    Tray: vi.fn(function () {
      return {
        setToolTip: vi.fn(),
        setContextMenu: vi.fn(),
        isDestroyed: vi.fn(() => false),
        on: vi.fn()
      };
    }),
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
    },
    screen: {
      getAllDisplays: vi.fn(() => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]),
      getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }))
    },
    powerSaveBlocker: { isStarted: vi.fn(() => false), start: vi.fn(() => 1), stop: vi.fn() },
    Notification: Object.assign(
      vi.fn(function () {
        return { on: vi.fn(), show: vi.fn() };
      }),
      { isSupported: vi.fn(() => true) }
    )
  };
});

let menu: typeof import('../../src/main/index');

beforeAll(async () => {
  menu = await import('../../src/main/index');
});

function rolesOf(template: ReadonlyArray<object>): string[] {
  return template.map((raw) => {
    const item = raw as { role?: unknown; label?: unknown; type?: unknown };
    return String(item.role ?? item.label ?? item.type);
  });
}

describe('M5 — Edit menu role + registered context-menu handler', () => {
  it('the application menu carries a top-level editMenu role (Undo/Redo/Clipboard rows)', () => {
    const template = menu.buildAppMenuTemplate();
    const editItem = template.find((item) => (item as { role?: string }).role === 'editMenu');
    expect(editItem, 'no { role: "editMenu" } top-level entry').toBeTruthy();
    const positions = template.map((item) => (item as { role?: string }).role ?? (item as { label?: string }).label);
    // Windows convention: File, Edit, then the app's own groups.
    expect(positions.slice(0, 2)).toEqual(['File', 'editMenu']);
  });

  it('editable target gets clipboard set + select all', () => {
    const template = menu.buildContextMenuTemplate({
      isEditable: true, selectionText: '', mediaType: 'none', editFlags: {}
    } as never);
    const roles = rolesOf(template);
    expect(roles).toEqual(expect.arrayContaining(['undo', 'redo', 'paste', 'selectAll']));
    expect(roles).not.toContain('cut');
    expect(roles).not.toContain('copy');
  });

  it('editable target WITH selection gains cut + copy', () => {
    const roles = rolesOf(menu.buildContextMenuTemplate({
      isEditable: true, selectionText: 'hello', mediaType: 'none', editFlags: {}
    } as never));
    expect(roles).toEqual(expect.arrayContaining(['cut', 'copy', 'paste', 'selectAll']));
  });

  it('non-editable selection gets Copy only; plain click gets nothing (no empty popups)', () => {
    expect(rolesOf(menu.buildContextMenuTemplate({
      isEditable: false, selectionText: 'text', mediaType: 'none', editFlags: {}
    } as never))).toEqual(['copy']);
    expect(menu.buildContextMenuTemplate({
      isEditable: false, selectionText: '', mediaType: 'none', editFlags: {}
    } as never)).toEqual([]);
  });

  it('a context-menu listener is actually registered on the main window webContents, and it pops edit-aware menus', async () => {
    // The real boot ran at import time (whenReady resolves under this mock).
    const handlers = tracks.webContentsHandlers.get('context-menu') ?? [];
    expect(handlers.length, 'no webContents.on("context-menu") registered').toBe(1);
    tracks.poppedMenus.length = 0;
    handlers[0]({}, { isEditable: true, selectionText: 'sel', mediaType: 'none', editFlags: {} });
    expect(tracks.poppedMenus).toHaveLength(1);
    expect(rolesOf(tracks.poppedMenus[0].template)).toEqual(
      expect.arrayContaining(['cut', 'copy', 'paste', 'selectAll'])
    );
    tracks.poppedMenus.length = 0;
    handlers[0]({}, { isEditable: false, selectionText: '', mediaType: 'none', editFlags: {} });
    expect(tracks.poppedMenus, 'empty template must not pop a menu').toHaveLength(0);
  });
});

describe('m10 — playback rows stop advertising unregistered accelerators', () => {
  it('Space/Left/Right are gone from the transport rows; F11 (truly registered) stays; clicks intact', () => {
    const template = menu.buildPlaybackMenuTemplate();
    const byLabel = new Map(template.filter((i) => i.label).map((i) => [i.label as string, i]));
    for (const label of ['Play/Pause', 'Rewind 10s', 'Forward 10s']) {
      const item = byLabel.get(label) as Record<string, unknown> | undefined;
      expect(item, `row ${label} disappeared`).toBeTruthy();
      expect(item?.accelerator, `row ${label} still displays an accelerator`).toBeUndefined();
      expect(item?.registerAccelerator, `row ${label} carries dead registerAccelerator`).toBeUndefined();
      expect(typeof item?.click).toBe('function');
    }
    expect((byLabel.get('Fullscreen') as Record<string, unknown>).accelerator).toBe('F11');
  });
});

describe('M6/m11 — preference checkboxes exist on View AND tray, write on click, stay in lockstep', () => {
  function checkboxIn(template: ReadonlyArray<object>, label: string) {
    return template.find((raw) => {
      const i = raw as { label?: unknown; type?: unknown };
      return i.label === label && i.type === 'checkbox';
    }) as
      | { checked?: boolean; click?: (mi: { checked: boolean }) => void }
      | undefined;
  }
  function viewSubmenu() {
    const view = menu.buildAppMenuTemplate().find((i) => (i as { label?: string }).label === 'View') as {
      submenu: Array<Record<string, unknown>>;
    };
    return view.submenu;
  }

  it('View submenu carries both toggles, checked follows the store default', () => {
    const submenu = viewSubmenu();
    const minimize = checkboxIn(submenu, 'Minimize to tray');
    const notifications = checkboxIn(submenu, 'Notifications');
    expect(minimize, 'no Minimize-to-tray checkbox in View').toBeTruthy();
    expect(notifications, 'no Notifications checkbox in View').toBeTruthy();
    expect(minimize!.checked).toBe(true);
    expect(notifications!.checked).toBe(true);
  });

  it('the tray menu carries the SAME two toggles (README:39-style surfaces agree)', () => {
    const trayTemplate = menu.buildTrayMenuTemplate();
    expect(checkboxIn(trayTemplate, 'Minimize to tray')).toBeTruthy();
    expect(checkboxIn(trayTemplate, 'Notifications')).toBeTruthy();
  });

  it('clicking a toggle persists, rebuilds the app menu, and the new state is reflected on BOTH surfaces', () => {
    const before = tracks.appMenusRebuilt.count;
    const item = checkboxIn(viewSubmenu(), 'Notifications')!;
    item.click!({ checked: false });
    expect(tracks.storeData.get('notificationsEnabled')).toBe(false);
    expect(tracks.appMenusRebuilt.count).toBeGreaterThan(before);
    expect(checkboxIn(viewSubmenu(), 'Notifications')!.checked).toBe(false);
    expect(checkboxIn(menu.buildTrayMenuTemplate(), 'Notifications')!.checked).toBe(false);
  });

  it('minimizeToTray round-trips identically from the tray surface', () => {
    const trayItem = checkboxIn(menu.buildTrayMenuTemplate(), 'Minimize to tray')!;
    trayItem.click!({ checked: false });
    expect(tracks.storeData.get('minimizeToTray')).toBe(false);
    expect(checkboxIn(viewSubmenu(), 'Minimize to tray')!.checked).toBe(false);
  });
});
