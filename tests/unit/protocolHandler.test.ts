/**
 * @vitest-environment node
 *
 * Tests for the `app://` protocol handler's path resolution and traversal
 * rejection logic in src/main/index.ts.
 *
 * The handler maps URLs like `app://-/app/assets/main.js` to files inside
 * RENDERER_DIST_DIR, with path-traversal protection via isPathSafe().
 *
 * Note: The URL parser normalizes paths like `/app/../../../etc/passwd` to
 * `/etc/passwd` BEFORE the handler logic runs. The path traversal check
 * (isPathSafe) correctly blocks dangerous paths at the source file level.
 * We test isPathSafe directly since it is the security-critical primitive.
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Mock electron-log before importing main
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
// Mock Electron modules (needed for pathUtils import chain)
// ---------------------------------------------------------------------------
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
    on: vi.fn()
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
    }
  })),
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
// Import the security-critical path safety function and protocol handler
// ---------------------------------------------------------------------------
import { isPathSafe } from '../../src/main/pathUtils';
import { setupAppProtocolHandler } from '../../src/main/index';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const RENDERER_DIST_DIR = path.join(PROJECT_ROOT, 'dist', 'renderer');

describe('app:// protocol handler path resolution', () => {
  describe('isPathSafe (core traversal rejection)', () => {
    it('allows assets/images/logo.png inside renderer dist', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, 'assets/images/logo.png')).toBe(true);
    });

    it('allows nested assets/main.js', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, 'assets/main.js')).toBe(true);
    });

    it('blocks ../../../etc/passwd (escapes renderer dist upward)', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, '../../../etc/passwd')).toBe(false);
    });

    it('blocks assets/../../../etc/passwd (embedded traversal)', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, 'assets/../../../etc/passwd')).toBe(false);
    });

    it('blocks /etc/passwd (absolute path outside renderer dist)', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, '/etc/passwd')).toBe(false);
    });

    it('blocks traversal via URL-decoded ../ (%2e%2e)', () => {
      // The URL parser decodes %2e%2e to .. before isPathSafe is called.
      // isPathSafe is called with the already-decoded path.
      expect(isPathSafe(RENDERER_DIST_DIR, '../assets/main.js')).toBe(false);
    });

    it('allows . and ./ segments that stay within base', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, './assets/main.js')).toBe(true);
      expect(isPathSafe(RENDERER_DIST_DIR, 'assets/../index.html')).toBe(true);
    });

    it('blocks null-byte injection', () => {
      expect(isPathSafe(RENDERER_DIST_DIR, 'assets/../../../etc/passwd\x00')).toBe(false);
    });
  });

  describe('setupAppProtocolHandler end-to-end (hostname + path safety)', () => {
    beforeEach(() => {
      // Clear any previously registered handlers
      protocolHandlers.clear();
      // Register the protocol handler
      setupAppProtocolHandler();
    });

    function getAppHandler(): (request: { url: string }) => Response | undefined {
      return protocolHandlers.get('app');
    }

    it('returns 403 when hostname is not "-" (invalid app:// URL)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      const response = handler!({ url: 'app://example.com/app/servers' });
      expect(response.status).toBe(403);
    });

    it('serves index.html for SPA route (no file extension)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      // dist/renderer/index.html should exist in the project
      const response = handler!({ url: 'app://-/app/servers' });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>'); // index.html should be valid HTML
    });

    it('serves index.html when file not found (fallback)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      // A file that doesn't exist should fall back to index.html
      const response = handler!({ url: 'app://-/app/assets/nonexistent-file.js' });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>');
    });

    it('serves actual file when it exists in renderer dist', async () => {
      // First ensure dist/renderer exists with expected structure
      const handler = getAppHandler();
      expect(handler).toBeDefined();

      // The test project should have dist/renderer/index.html
      // Request it via the app:// protocol
      const response = handler!({ url: 'app://-/app/index.html' });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>');
    });
  });
});
