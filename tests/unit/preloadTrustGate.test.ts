/**
 * @vitest-environment node
 *
 * M-WINDOWS-10 — the privileged preload bridge must reach ONLY the app's own
 * boot documents (trusted origin + main frame).
 *
 * Root cause guarded (review windows__exploiter MAJOR-1):
 *   src/preload/index.ts used to call contextBridge.exposeInMainWorld at
 *   module top level with ZERO checks on window.location or
 *   process.isMainFrame. The bridge is tied to the window, not the URL, so
 *   any renderer-initiated top-level navigation allowed by the deliberate
 *   external-navigation posture (will-navigate accepts every https:/http:
 *   URL via validateExternalUrl, src/main/urlValidator.ts) woke the target
 *   page with the full electronAPI: hubSetConfig()/setServerUrl() could flip
 *   the persisted auth endpoint (credential-channel hijack on the next
 *   launch), getDeviceId()/getAppPath() leaked identity, and
 *   checkServerVersion() became a main-process SSRF probe.
 *
 * Cure: isTrustedPreloadContext() — a pure predicate pinned by the table
 * below — gates the single exposeInMainWorld call site. These tests pin
 * (a) the predicate itself, (b) the module-level WIRING (fresh-import
 * behavior with a mocked electron: untrusted contexts never expose, the
 * trusted prod/dev boot still gets the complete surface), and (c) the
 * MAIN-SIDE posture the gate complements (sandboxed contextIsolation shell;
 * every boot URL the main process actually navigates to is covered by the
 * predicate, and every trusted entry is actually used; window-open stays
 * deny→openExternal and will-navigate stays the scheme allowlist — the
 * navigation posture is deliberately NOT duplicated here, the preload-side
 * trust gate is the minimal complement).
 *
 * R-WINDOWS-08 adds the isPackaged-aware deny: a packaged shell (main stamps
 * '--phlix-packaged' into additionalArguments iff app.isPackaged) must NOT
 * trust the dev vite entry http://localhost:5173; pinned at the predicate
 * table, through the argv channel in the wiring legs, and at the main-side
 * conditional in the posture section.
 *
 * Mutation law: deleting the gate (always expose), flipping the predicate,
 * or editing the boot-URL posture each reddens named tests below.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// electron module mock — capture every exposeInMainWorld call the preload
// entry makes while (re)evaluating. jsdom cannot host contextBridge, so the
// file runs in the node environment with the electron import fully faked.
// ---------------------------------------------------------------------------

const exposeInMainWorld = vi.fn();
const invoke = vi.fn();
const send = vi.fn();
const on = vi.fn();
const removeListener = vi.fn();

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, send, on, removeListener }
}));

type PreloadModule = typeof import('../../src/preload/index');
type PreloadContext = { href: string; isMainFrame: boolean; isPackagedShell?: boolean };

let isTrustedPreloadContext: (context: PreloadContext) => boolean;
let TRUSTED_BOOT_TARGETS: ReadonlyArray<{ protocol: string; host: string }>;
let PHLIX_PACKAGED_ARGV_FLAG: string;

beforeAll(async () => {
  // Load once in a NEUTRAL context (no window stub, no isMainFrame) — the
  // fail-closed path. Exposes nothing; yields the pure exports.
  const mod: PreloadModule = await import('../../src/preload/index');
  isTrustedPreloadContext = mod.isTrustedPreloadContext;
  TRUSTED_BOOT_TARGETS = mod.TRUSTED_BOOT_TARGETS;
  PHLIX_PACKAGED_ARGV_FLAG = mod.PHLIX_PACKAGED_ARGV_FLAG;
});

/** Stub the document/process facts a sandboxed preload can observe. */
function setPreloadEnv(
  href: string | undefined,
  isMainFrame: boolean | undefined,
  packagedShell = false
): void {
  const g = globalThis as unknown as { window?: { location?: { href?: string } } };
  if (href === undefined) {
    delete g.window;
  } else {
    g.window = { location: { href } };
  }
  const proc = process as unknown as { isMainFrame?: boolean };
  if (isMainFrame === undefined) {
    delete proc.isMainFrame;
  } else {
    proc.isMainFrame = isMainFrame;
  }
  // R-WINDOWS-08 argv channel: strip any inherited flag, then plant it when
  // the leg models a packaged shell.
  const argIdx = process.argv.indexOf('--phlix-packaged');
  if (argIdx !== -1) {
    process.argv.splice(argIdx, 1);
  }
  if (packagedShell) {
    process.argv.push('--phlix-packaged');
  }
}

/** Fresh module evaluation = a fresh "preload run" against current stubs. */
async function loadPreload(): Promise<void> {
  vi.resetModules();
  await import('../../src/preload/index');
}

beforeEach(() => {
  exposeInMainWorld.mockReset();
  invoke.mockReset();
});

afterEach(() => {
  setPreloadEnv(undefined, undefined);
});

// ---------------------------------------------------------------------------
// (a) The pure predicate — the trust decision itself.
// ---------------------------------------------------------------------------

describe('isTrustedPreloadContext (pure trust predicate)', () => {
  it('trusts the production boot document app://-', () => {
    expect(isTrustedPreloadContext({ href: 'app://-/app/', isMainFrame: true })).toBe(true);
    expect(isTrustedPreloadContext({ href: 'app://-/app/settings', isMainFrame: true })).toBe(true);
  });

  it('trusts the dev-server document http://localhost:5173', () => {
    expect(isTrustedPreloadContext({ href: 'http://localhost:5173/', isMainFrame: true })).toBe(true);
    expect(
      isTrustedPreloadContext({ href: 'http://localhost:5173/src/renderer/main.ts', isMainFrame: true })
    ).toBe(true);
  });

  it('does NOT trust an attacker-controlled https page (the M10 vector)', () => {
    expect(isTrustedPreloadContext({ href: 'https://evil.test/phlix', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'http://evil.test/', isMainFrame: true })).toBe(false);
  });

  it('does NOT trust near-miss localhost origins (scheme/port/host all matter)', () => {
    expect(isTrustedPreloadContext({ href: 'https://localhost:5173/', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'http://localhost:5174/', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'http://127.0.0.1:5173/', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'http://localhost.evil.test:5173/', isMainFrame: true })).toBe(false);
  });

  it('does NOT trust a foreign host on the app: scheme', () => {
    expect(isTrustedPreloadContext({ href: 'app://evil/', isMainFrame: true })).toBe(false);
  });

  it('does NOT trust the trusted origin inside a child frame (main-frame law)', () => {
    expect(isTrustedPreloadContext({ href: 'app://-/app/', isMainFrame: false })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'http://localhost:5173/', isMainFrame: false })).toBe(false);
  });

  it('does NOT trust file:, javascript:, data: or opaque documents', () => {
    expect(isTrustedPreloadContext({ href: 'file:///C:/app/index.html', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'javascript:alert(1)', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'data:text/html,<script>bad()</script>', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'about:blank', isMainFrame: true })).toBe(false);
  });

  it('fails CLOSED on empty or unparseable href', () => {
    expect(isTrustedPreloadContext({ href: '', isMainFrame: true })).toBe(false);
    expect(isTrustedPreloadContext({ href: 'not a url', isMainFrame: true })).toBe(false);
  });

  it('R-WINDOWS-08: a packaged shell denies the dev-server entry but keeps the prod boot', () => {
    expect(
      isTrustedPreloadContext({ href: 'http://localhost:5173/', isMainFrame: true, isPackagedShell: true })
    ).toBe(false);
    expect(
      isTrustedPreloadContext({
        href: 'http://localhost:5173/src/renderer/main.ts', isMainFrame: true, isPackagedShell: true,
      })
    ).toBe(false);
    expect(
      isTrustedPreloadContext({ href: 'app://-/app/', isMainFrame: true, isPackagedShell: true })
    ).toBe(true);
    // The flag is the ONLY difference — same href stays trusted without it.
    expect(
      isTrustedPreloadContext({ href: 'http://localhost:5173/', isMainFrame: true })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (b) Module wiring — the gate is actually around the real expose call.
// ---------------------------------------------------------------------------

describe('preload module wiring (fresh evaluation per committed document)', () => {
  it('exposes the full electronAPI surface for the prod boot document', async () => {
    setPreloadEnv('app://-/app/', true);
    await loadPreload();

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, api] = exposeInMainWorld.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('electronAPI');

    // The named members the exploit relied on stay INTACT for the trusted
    // boot (preservation law: this fix must not shrink the surface).
    for (const key of [
      'hubSetConfig', 'setServerUrl', 'getDeviceId', 'getAppPath', 'checkServerVersion',
      'notifyDeeplinkReady', 'onDeeplink', 'showNotification', 'setAlwaysOnTop', 'updateThumbar'
    ]) {
      expect(typeof api[key], key).toBe('function');
    }

    // And they are live: invoking one reaches ipcRenderer with its channel.
    (api['getVersion'] as () => unknown)();
    expect(invoke).toHaveBeenCalledWith('get-version');
  });

  it('exposes NOTHING to an in-window http(s) navigation (M10 vector)', async () => {
    setPreloadEnv('https://evil.test/phlix', true);
    await loadPreload();
    expect(exposeInMainWorld).not.toHaveBeenCalled();
  });

  it('exposes NOTHING to a plain http navigation either', async () => {
    setPreloadEnv('http://evil.test/', true);
    await loadPreload();
    expect(exposeInMainWorld).not.toHaveBeenCalled();
  });

  it('exposes NOTHING to a child frame of the app itself', async () => {
    setPreloadEnv('app://-/app/settings', false);
    await loadPreload();
    expect(exposeInMainWorld).not.toHaveBeenCalled();
  });

  it('exposes NOTHING when frame identity is unreadable (fail closed)', async () => {
    setPreloadEnv('app://-/app/', undefined);
    await loadPreload();
    expect(exposeInMainWorld).not.toHaveBeenCalled();
  });

  it('exposes the bridge for the dev boot document', async () => {
    setPreloadEnv('http://localhost:5173/', true);
    await loadPreload();
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
  });

  it('R-WINDOWS-08: packaged argv flag reaches the gate — dev boot exposes NOTHING', async () => {
    setPreloadEnv('http://localhost:5173/', true, true);
    await loadPreload();
    expect(exposeInMainWorld).not.toHaveBeenCalled();
  });

  it('R-WINDOWS-08: packaged argv flag keeps the prod boot fully wired', async () => {
    setPreloadEnv('app://-/app/', true, true);
    await loadPreload();
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, api] = exposeInMainWorld.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('electronAPI');
    expect(typeof api['getVersion']).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// (c) Main-side posture the gate complements (structural wiring).
// ---------------------------------------------------------------------------

describe('main-process posture the preload gate relies on', () => {
  const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf8');

  it('keeps the window sandboxed with context isolation and no node integration', () => {
    expect(mainSource).toMatch(/contextIsolation:\s*true/);
    expect(mainSource).toMatch(/sandbox:\s*true/);
    expect(mainSource).toMatch(/nodeIntegration:\s*false/);
  });

  it('R-WINDOWS-08: main stamps the packaged argv flag gated on app.isPackaged', () => {
    // The exact conditional shape (flag array iff packaged, empty otherwise).
    expect(mainSource).toMatch(
      /additionalArguments:\s*app\.isPackaged\s*\?\s*\['--phlix-packaged'\]\s*:\s*\[\]/
    );
    // Cross-file string identity: the exported preload constant is the SAME
    // token main plants — a rename on one side without the other reddens.
    expect(PHLIX_PACKAGED_ARGV_FLAG).toBe('--phlix-packaged');
  });

  it('covers EVERY boot URL the main process navigates to with the trust predicate', () => {
    // Enumerate every literal navigation target in main: direct loadURL
    // strings + the PROD_BOOT_URL constant (dev branch + prod branch).
    const literals: string[] = [];
    for (const match of mainSource.matchAll(/loadURL\(\s*'([^']+)'/g)) {
      literals.push(match[1]);
    }
    const prodBoot = mainSource.match(/export const PROD_BOOT_URL = '([^']+)'/);
    expect(prodBoot, 'PROD_BOOT_URL literal must exist').not.toBeNull();
    literals.push(prodBoot![1]);

    // Every navigable boot document must be trusted by the predicate…
    for (const href of literals) {
      expect(isTrustedPreloadContext({ href, isMainFrame: true }), href).toBe(true);
    }
    // …and no trusted entry may be dead weight (stale-list guard, both
    // directions): each TRUSTED_BOOT_TARGETS entry must match some boot URL.
    for (const target of TRUSTED_BOOT_TARGETS) {
      const covered = literals.some((href) => {
        const parsed = new URL(href);
        return parsed.protocol === target.protocol && parsed.host === target.host;
      });
      expect(covered, `${target.protocol}//${target.host} has no boot URL`).toBe(true);
    }
  });

  it('keeps window.open deny→openExternal (external posture, untouched by design)', () => {
    expect(mainSource).toMatch(/setWindowOpenHandler\(\s*\(\s*\{\s*url\s*\}\s*\)\s*=>\s*\{/);
    expect(mainSource).toMatch(/return\s*\{\s*action:\s*'deny'\s*\}/);
    expect(mainSource).toMatch(/if\s*\(validateExternalUrl\(url\)\)\s*\{\s*shell\.openExternal\(url\)/);
  });

  it('keeps will-navigate as the scheme allowlist the preload gate complements', () => {
    // The navigation posture intentionally still allows http(s) in-window
    // (OAuth-style flows); what changed is that such a page no longer gets
    // the bridge. This pin documents the complement — do not duplicate the
    // trust decision into will-navigate without retiring this reasoning.
    expect(mainSource).toMatch(/on\(\s*'will-navigate'.*?=>\s*\{.*?if\s*\(!validateExternalUrl\(url\)\)/s);
    expect(mainSource).toMatch(/event\.preventDefault\(\)/);
  });

  it('has exactly ONE exposeInMainWorld call site in the preload, behind the gate', () => {
    const preloadSource = readFileSync(resolve(PROJECT_ROOT, 'src/preload/index.ts'), 'utf8');
    const calls = preloadSource.match(/contextBridge\.exposeInMainWorld\(/g) ?? [];
    expect(calls).toHaveLength(1);
    // …and it sits inside the trust-gate conditional, not at bare top level.
    expect(preloadSource).toMatch(
      /if\s*\(isTrustedPreloadContext\(readPreloadContext\(\)\)\)\s*\{\s*contextBridge\.exposeInMainWorld\(/
    );
  });
});
