/**
 * @vitest-environment node
 *
 * MW-120 (review windows__secnet #1): window-title provenance.
 *
 * Navigation into the main window intentionally still admits every http(s)
 * target (OIDC/GitHub redirect chains — the narrowing alternative is rejected
 * in the enforceTitleProvenance docblock in src/main/index.ts). What ships
 * instead is the title half of the law: only OUR documents — the packaged
 * app://- shell, and in dev mode the vite entry — may relabel the window
 * chrome. Every other document's title update is preventDefault'd, and the
 * window's identity starts from the static `title: 'Phlix'` construction
 * option, so the chrome can never be spoofed by a foreign page.
 *
 * Mock header mirrors tests/unit/serverTooOldDialog.test.ts (the proven
 * index.ts-importable electron harness); nativeImage additionally carries
 * isEmpty() false so a synchronously-running boot path cannot throw on the
 * MW-114/115 asset probing.
 */
import { describe, it, expect, vi } from 'vitest';
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
  default: vi.fn(function () {
    return {
      get: vi.fn(() => null),
      set: vi.fn()
    };
  })
}));

vi.mock('electron', () => ({
  powerMonitor: { on: vi.fn() },
  app: {
    getPath: vi.fn(() => path.join(PROJECT_ROOT, 'dist')),
    getVersion: vi.fn(() => '1.0.0'),
    isPackaged: true,
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(),
    on: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true)
  },
  BrowserWindow: vi.fn(function () {
    return {
      loadURL: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      isFullScreen: vi.fn(() => false),
      setFullScreen: vi.fn(),
      isDestroyed: vi.fn(() => false),
      on: vi.fn(),
      once: vi.fn(),
      webContents: {
        send: vi.fn(),
        getURL: vi.fn(() => ''),
        setWindowOpenHandler: vi.fn(() => ({ action: 'deny' })),
        on: vi.fn()
      }
    };
  }),
  session: { defaultSession: { on: vi.fn(), setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
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
    handle: vi.fn(),
    registerSchemesAsPrivileged: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: () => false,
      resize: vi.fn(() => ({ width: 16, height: 16 }))
    })),
    createEmpty: vi.fn(() => ({
      isEmpty: () => true,
      resize: vi.fn(() => ({ width: 16, height: 16 }))
    }))
  },
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn()
  },
  Tray: vi.fn(function () {
    return {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn()
    };
  }),
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
  }
}));

import { enforceTitleProvenance } from '../../src/main/index';

function titleEvent() {
  return { preventDefault: vi.fn() };
}

describe('enforceTitleProvenance (MW-120)', () => {
  it('the packaged shell document keeps title control (every app://- path)', () => {
    for (const url of ['app://-/app/', 'app://-/app/settings', 'app://-/app/player/x']) {
      const event = titleEvent();
      enforceTitleProvenance(event, url, false);
      expect(event.preventDefault, url).not.toHaveBeenCalled();
    }
  });

  it('foreign documents cannot relabel the chrome — every one is prevented', () => {
    // https external (IdP landing page class), file, data, a hostile loopback
    // page, and the uncommitted empty URL (fail closed — keep last trusted
    // label rather than adopt a mid-transition document's title).
    for (const url of ['https://evil.example.com/title-spoof', 'http://127.0.0.1:5173/', 'file:///C:/x.html', 'data:text/html,<title>X</title>', '']) {
      const event = titleEvent();
      enforceTitleProvenance(event, url, false);
      expect(event.preventDefault, url).toHaveBeenCalledTimes(1);
    }
  });

  it('dev mode admits the vite entry ONLY — and still denies everything else', () => {
    const dev = titleEvent();
    enforceTitleProvenance(dev, 'http://localhost:5173/app/settings', true);
    expect(dev.preventDefault).not.toHaveBeenCalled();
    const hostile = titleEvent();
    enforceTitleProvenance(hostile, 'https://evil.example.com', true);
    expect(hostile.preventDefault).toHaveBeenCalledTimes(1);
    const lookalike = titleEvent();
    enforceTitleProvenance(lookalike, 'http://localhost:5174/', true);
    expect(lookalike.preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe('MW-120 wiring (static pins — the unit law alone cannot see registration)', () => {
  const source = readFileSync(path.resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');

  it('windowOptions carry the static Phlix identity', () => {
    expect(source).toMatch(/\n {4}title: 'Phlix',/);
  });

  it('createWindow registers the provenance gate on page-title-updated, reading the live document URL', () => {
    expect(source).toMatch(
      /webContents\.on\('page-title-updated', \(event\) => \{\s*enforceTitleProvenance\(event, mainWindow\?\.webContents\.getURL\(\) \?\? ''\);/
    );
  });

  it('the navigation allowlist law stays documented at the gate, not silently split', () => {
    // The narrowing-rejection rationale must live next to the shipped cure,
    // or a future reader "fixes" the allowlist the register rejected fixing.
    expect(source).toMatch(/DELIBERATELY REJECTED/);
    expect(source).toMatch(/OIDC\/GitHub/);
  });
});
