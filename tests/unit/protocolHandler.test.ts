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
import { readFileSync, statSync, promises as fsPromises } from 'fs';
import { createHash } from 'crypto';

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
  // vitest@5: constructor mocks must be function/class (arrow impls are no longer
  // newable). Same behavior: fresh {get,set} stub per `new Store()`.
  default: vi.fn(function () {
    return {
      get: vi.fn(() => null),
      set: vi.fn()
    };
  })
}));

// ---------------------------------------------------------------------------
// Mock Electron modules (needed for pathUtils import chain)
// ---------------------------------------------------------------------------
const { protocolHandlers } = vi.hoisted(() => {
  const handlers = new Map<string, (request: { url: string }) => Response | Promise<Response>>();
  return { protocolHandlers: handlers };
});

vi.mock('electron', () => ({
  // M8 batch 10: index.ts imports powerMonitor — partial electron mocks
  // make the named import throw at boot (exit-7 class, see batch 6).
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
    handle: vi.fn((scheme: string, handler: (request: { url: string }) => Response | Promise<Response>) => {
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

// ---------------------------------------------------------------------------
// Import the security-critical path safety function and protocol handler
// ---------------------------------------------------------------------------
import { isPathSafe } from '../../src/main/pathUtils';
import { setupAppProtocolHandler, PROD_BOOT_URL, appError } from '../../src/main/index';

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

    function getAppHandler(): ((request: { url: string }) => Response | Promise<Response>) | undefined {
      return protocolHandlers.get('app');
    }

    // MW-113 [review windows__crossfe 5]: red-first law pin. The handler used
    // to run fs.readFileSync/existsSync directly inside a protocol.handle
    // callback — synchronous disk I/O on the browser-process main loop, once
    // per asset/chunk/route on every cold boot. Electron awaits a Promise
    // return, so every answer must now arrive asynchronously.
    it('answers asynchronously — the handler never returns a settled Response (MW-113)', async () => {
      const handler = getAppHandler()!;
      expect(handler).toBeDefined();
      const pending = handler({ url: PROD_BOOT_URL });
      expect(typeof (pending as unknown as Promise<Response>).then).toBe('function');
      expect((await pending).status).toBe(200);
      // The refusal paths answer asynchronously too (no sync early-returns).
      const refused = handler({ url: 'app://-/etc/passwd' });
      expect(typeof (refused as unknown as Promise<Response>).then).toBe('function');
      expect((await refused).status).toBe(403);
    });

    it('returns 403 when hostname is not "-" (invalid app:// URL)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      const response = await handler!({ url: 'app://example.com/app/servers' });
      expect(response.status).toBe(403);
    });

    it('serves index.html for SPA route (no file extension)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      // dist/renderer/index.html should exist in the project
      const response = await handler!({ url: 'app://-/app/servers' });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>'); // index.html should be valid HTML
    });

    it('serves index.html when file not found (fallback)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      // A file that doesn't exist should fall back to index.html
      const response = await handler!({ url: 'app://-/app/assets/nonexistent-file.js' });
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
      const response = await handler!({ url: 'app://-/app/index.html' });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>');
    });

    // --- Production boot contract -------------------------------------------------
    // Defect (found by reviewer on 729a619's gate, empirically reproduced 2026-09-29
    // via headless xvfb boot on Electron 42): createWindow() booted
    // 'app://-/app' while the prefix gate demanded startsWith('/app/'), so the
    // pathname '/app' fell through to 403 'Forbidden' and EVERY production cold
    // boot rendered the error page. The smoke test missed it because it only
    // regex-matches window.url() against /^\/app/ — which an error page at the
    // same URL happily satisfies. These pins keep boot URL and handler in sync.

    it('PROD_BOOT_URL is the canonical trailing-slash form', () => {
      expect(PROD_BOOT_URL).toBe('app://-/app/');
    });

    it('serves 200 + index.html for the exact PROD_BOOT_URL the window loads (cold-boot pin)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      const response = await handler!({ url: PROD_BOOT_URL });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>');
    });

    it('serves 200 + index.html for bare /app (no trailing slash) — SPA root like a real web server', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      // Also covers renderer reloads at router base: vue-router '/app' nav items
      // make window.location '/app', and a reload re-requests it through here.
      const response = await handler!({ url: 'app://-/app' });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('<!DOCTYPE html>');
    });

    it('still 403s paths that merely share the /app letter prefix (no gate bleed)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      expect((await handler!({ url: 'app://-/apple' })).status).toBe(403);
      expect((await handler!({ url: 'app://-/appsecret/main.js' })).status).toBe(403);
    });

    it('still 403s paths outside the /app SPA prefix (root, absolute escapes)', async () => {
      const handler = getAppHandler();
      expect(handler).toBeDefined();
      expect((await handler!({ url: 'app://-/' })).status).toBe(403);
      expect((await handler!({ url: 'app://-/etc/passwd' })).status).toBe(403);
    });
  });
});

// M11 (review crossfe #2) + m7(c) (review casualgamer #4): every app://
// response carries the framing CSP as a HEADER (frame-ancestors cannot ride
// the index.html <meta>), and refusal bodies are branded documents that
// reflect nothing of the requested path (M-WINDOWS-44 echo law).
describe('M11 frame-ancestors header + m7c branded refusal bodies', () => {
  beforeEach(() => {
    protocolHandlers.clear();
    setupAppProtocolHandler();
  });
  const handler = () => protocolHandlers.get('app') as (request: { url: string }) => Promise<Response>;

  it('the SPA document (boot URL) ships frame-ancestors none', async () => {
    const response = await handler()({ url: PROD_BOOT_URL });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  });

  it('real asset responses carry it too (framing refusal is document-agnostic)', async () => {
    const response = await handler()({ url: 'app://-/app/index.html' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  });

  // WIN-S9 (carry of WIN-40): content-hashed assets/ files are cache-forever
  // with an ETag from their bytes; the SPA document and non-assets/ files are
  // NOT (the document must always revalidate).
  it('WIN-40: assets/ files carry immutable Cache-Control and a byte-derived ETag', async () => {
    // The handler serves from src/renderer under vitest (no built assets/ dir
    // there), so feed the one assets/ read through a spy — the header logic
    // under test is the handler's, not the disk's.
    const bytes = Buffer.from('console.log("hashed-asset");');
    const realRead = fsPromises.readFile.bind(fsPromises);
    const readSpy = vi.spyOn(fsPromises, 'readFile').mockImplementation(((p: unknown, ...rest: unknown[]) =>
      String(p).replace(/\\/g, '/').endsWith('/assets/index-abc123.js')
        ? Promise.resolve(bytes)
        : (realRead as (...a: unknown[]) => Promise<unknown>)(p, ...rest)) as typeof fsPromises.readFile);
    try {
      const response = await handler()({ url: 'app://-/app/assets/index-abc123.js' });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(response.headers.get('ETag')).toBe(`"${createHash('sha1').update(bytes).digest('hex')}"`);
    } finally {
      readSpy.mockRestore();
    }
  });

  it('WIN-40: the SPA document never gets the immutable cache headers', async () => {
    const response = await handler()({ url: 'app://-/app/index.html' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBeNull();
    expect(response.headers.get('ETag')).toBeNull();
  });

  it('a wrong-host refusal is a branded HTML document, not bare text, and echoes nothing', async () => {
    const response = await handler()({ url: 'app://evil.example.com/app/secret-page' });
    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
    const text = await response.text();
    expect(text).toContain('Phlix');
    expect(text).not.toContain('evil.example.com');
    expect(text).not.toContain('secret-page');
    expect(text).not.toMatch(/<script/i);
  });

  it('a traversal probe 403s with the same non-echoing body', async () => {
    const response = await handler()({ url: 'app://-/etc/passwd' });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('passwd');
  });

  it('appError is text/html + CSP for all three statuses', async () => {
    for (const status of [403, 404, 500] as const) {
      const response = appError(status);
      expect(response.status).toBe(status);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
    }
  });
});

// ---------------------------------------------------------------------------
// MW-124 [review windows__crossfe 1 — card w14/L4]: deep-route reload boot.
//
// Defect: vite built with base './', so index.html referenced ./assets/… .
// The handler serves that SAME index.html as the SPA fallback for any
// extensionless route, and at a 2+-segment route (e.g. app://-/app/player/3
// — what a reload at a deep route re-requests) './assets/main.js' resolves
// against the ROUTE, not /app/: /app/player/assets/main.js → ENOENT → the
// fallback hands index.html back as the answer to a <script type="module">
// fetch → Electron refuses a text/html module → the window is stranded on
// the boot splash forever. A one-segment route (/app/servers) coincidentally
// resolves './assets' → /app/assets, which is why cold boot and shallow
// reloads always worked and hid the class.
//
// Cure: base '/app/' — every emitted URL is origin-rooted, so resolution is
// route-depth-independent. Venue note that shapes these tests: under vitest
// RENDERER_DIST_DIR resolves __dirname-relative to src/renderer (in the real
// app it is dist/renderer), so a handler-driven probe sees the SOURCE doc
// here, not the build artifact. The BUILT-document law is therefore asserted
// directly against dist/renderer/index.html — CI's test job runs
// `npm run build` before `npm test`, so those bytes are the same artifacts
// production boots from. The static pins keep the config honest, and one
// dynamic pin keeps the served document's refs route-independent by property.
// ---------------------------------------------------------------------------
describe('MW-124 — deep-route reload keeps asset URLs origin-rooted', () => {
  const DEEP_ROUTE = 'app://-/app/player/3'; // 2-segment: './' refs break HERE

  beforeEach(() => {
    protocolHandlers.clear();
    setupAppProtocolHandler();
  });
  const handler = () => protocolHandlers.get('app') as (request: { url: string }) => Promise<Response>;

  function assetRefs(html: string): string[] {
    return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((ref) => !ref.startsWith('data:'));
  }

  it('vite.config.mts pins base "/app/" (static pin)', () => {
    const config = readFileSync(path.join(PROJECT_ROOT, 'vite.config.mts'), 'utf8');
    expect(config).toMatch(/base:\s*'\/app\/'/);
  });

  it('the dev boot arm loads the /app/ entry so dev and prod share one route space (static pin)', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src', 'main', 'index.ts'), 'utf8');
    expect(source).toContain("loadURL('http://localhost:5173/app/')");
  });

  it('the BUILT document carries no route-relative asset refs (real artifact)', () => {
    // readFileSync on the artifact, not a handler probe: under vitest the
    // handler answers from src/renderer (see the venue note above), so only
    // this direct read observes what a production deep-route reload fetches.
    const built = readFileSync(path.join(PROJECT_ROOT, 'dist', 'renderer', 'index.html'), 'utf8');
    const refs = assetRefs(built);
    // Vacuous-pass guard: an html with no refs would silently satisfy the law.
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(
        ref.startsWith('/app/'),
        `relative ref "${ref}" re-resolves against the route on a deep reload (MW-124 boot-splash death)`
      ).toBe(true);
      // The resolution property itself, spelled out: from the deep route the
      // ref must still land on its true asset path.
      expect(new URL(ref, DEEP_ROUTE).pathname).toBe(ref);
    }
  });

  it('every ref in the BUILT document maps to a real non-HTML artifact on disk', () => {
    // The static half of "never the HTML fallback": a ref that points at a
    // missing file is what turns the ENOENT fallback into a poisoned module
    // script. Existence + a non-HTML extension is exactly the handler's
    // success condition; the handler's file-serving path itself is pinned by
    // the 'serves actual file' suite above.
    const built = readFileSync(path.join(PROJECT_ROOT, 'dist', 'renderer', 'index.html'), 'utf8');
    const refs = assetRefs(built).filter((ref) => ref.startsWith('/app/'));
    expect(refs.length, 'nothing to check — the rooted-refs law above already reddened').toBeGreaterThan(0);
    for (const ref of refs) {
      const onDisk = path.join(PROJECT_ROOT, 'dist', 'renderer', ref.slice('/app/'.length));
      expect(statSync(onDisk).isFile(), `${ref} names no artifact under dist/renderer`).toBe(true);
      expect(path.extname(onDisk), `${ref} would answer as HTML — a module script fed text/html`).not.toBe('.html');
    }
  });

  it('whatever document the handler serves on a deep route resolves its refs route-independently', async () => {
    // Property pin over the LIVE handler answer (source doc under vitest,
    // built doc in the app): no ref may resolve differently from the deep
    // route than from /app/ — that divergence IS the MW-124 class.
    const response = await handler()({ url: DEEP_ROUTE });
    expect(response.status).toBe(200);
    const refs = assetRefs(await response.text());
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(
        new URL(ref, DEEP_ROUTE).pathname,
        `ref "${ref}" resolves against the route, not the SPA root`
      ).toBe(new URL(ref, 'app://-/app/').pathname);
    }
  });

  // Fold-bank minor (w13L10 review #2): the MW-113 async law was pinned only
  // behaviorally (a returned-Promise probe); a future edit re-introducing
  // readFileSync inside the handler kept the pin green because every answer
  // still awaited. Mirror the repo's regex-pin style (see the boot-gate census
  // in tests/unit/main.test.ts): the HANDLER REGION itself must be sync-I/O-free.
  it('the handler region is sync-I/O-free by source law (MW-113 regex pin)', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src', 'main', 'index.ts'), 'utf8');
    const regionText = source.match(/protocol\.handle\('app',\s*async[\s\S]*?\n {2}\}\);/)?.[0];
    expect(regionText, 'the app:// handler region vanished — retire this pin deliberately').toBeDefined();
    // The law is about CODE: the region's own history comments name the
    // retired readFileSync/existsSync pair.
    const codeOnly = (regionText ?? '').replace(/^[ \t]*\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/readFileSync|existsSync/);
    expect(codeOnly).toContain('await fs.promises.readFile');
  });
});
