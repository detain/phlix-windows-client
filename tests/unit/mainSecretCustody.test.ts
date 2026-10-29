/**
 * @vitest-environment node
 *
 * M-WINDOWS-11 — real-bytes wiring pins for the safeStorage custody fix.
 *
 * Review windows__exploiter MAJOR-11: persisted secrets (deviceId — the
 * stable install identifier sent as X-Phlix-Device-ID; serverUrl/hubUrl —
 * the auth endpoints the ApiClient auto-attaches tokens to) sat PLAINTEXT
 * in electron-store's config.json, and safeStorage was never imported
 * anywhere. The pure protocol is unit-pinned in tests/unit/secretStore.test.ts;
 * THIS file proves the WIRING in src/main/index.ts over a REAL electron-store
 * writing to a temp dir, so the assertions read the actual persisted BYTES:
 *
 *   - after any custody write, config.json contains the dpapi:v1: envelope
 *     and NOT the plaintext value (the red-on-parent evidence: at the parent
 *     commit these same tests fail because the parent wrote plaintext);
 *   - the pre-fix legacy plaintext row migrates on first read — the
 *     installation identifier SURVIVES the upgrade (never-orphan law);
 *   - the non-secret preference scope stays plaintext (deliberate boundary,
 *     pinned so a future over-encryption of windowBounds-style rows is a
 *     conscious change, not an accident);
 *   - the renderer vault round-trips through secrets.json with the same
 *     envelope law, refuses foreign senders, and fails closed on guards;
 *   - with OS encryption unavailable the app KEEPS WORKING on a disclosed
 *     plaintext fallback (and the disclosure is logged, once).
 *
 * The electron mock mirrors tests/unit/singleInstance.test.ts; safeStorage is
 * a deterministic reversible fake (XOR + marker prefix) delegated to mutable
 * harness state so availability can flip per scenario.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';

const LEGACY_DEVICE_ID = 'windows-legacy-fixed-id-0000000000';

interface Harness {
  dir: string;
  handles: Map<string, (event: unknown, payload?: unknown) => unknown>;
  ons: Map<string, (event: { sender?: unknown; returnValue?: unknown }, payload?: unknown) => void>;
  windows: Array<{ webContents: unknown }>;
  ss: { available: boolean; failEncrypt: boolean; failDecrypt: boolean };
  logs: Array<['info' | 'warn' | 'error', string]>;
}

// Sync hoisted holder — the electron-store/electron mock factories below may
// run the moment the SUT is (dynamically) imported; everything they need is
// filled in synchronously in this module body BEFORE that import fires.
const harness = vi.hoisted((): Harness => ({
  dir: '',
  handles: new Map(),
  ons: new Map(),
  windows: [],
  ss: { available: true, failEncrypt: false, failDecrypt: false },
  logs: []
}));

harness.dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'win11-custody-'));
// Pre-fix state: config.json as the parent commit left it — plaintext deviceId.
fs.writeFileSync(
  nodePath.join(harness.dir, 'config.json'),
  JSON.stringify({ deviceId: LEGACY_DEVICE_ID, connectionMode: 'direct' })
);

// ---------------------------------------------------------------------------
// electron-log mock — every persisted-state disclosure is captured for the
// fallback-warning pins below.
// ---------------------------------------------------------------------------
vi.mock('electron-log', () => ({
  default: {
    initialize: () => undefined,
    info: (msg: string) => harness.logs.push(['info', msg]),
    warn: (msg: string) => harness.logs.push(['warn', msg]),
    error: (msg: string) => harness.logs.push(['error', msg])
  }
}));

// ---------------------------------------------------------------------------
// electron-store mock → REAL Store instances anchored at the temp dir, one
// per store name ('config', 'secrets'). This is what lets the tests read the
// bytes the production code actually persisted.
// ---------------------------------------------------------------------------
vi.mock('electron-store', async () => {
  const actual = (await vi.importActual('electron-store')) as {
    default: new (options?: Record<string, unknown>) => {
      get(key: string): unknown;
      set(key: string, value: unknown): void;
      delete(key: string): void;
    };
  };
  const RealStore = actual.default;
  return {
    default: vi.fn(function (this: void, options?: Record<string, unknown>) {
      const name = (options?.name as string) ?? 'config';
      return new RealStore({ ...options, cwd: harness.dir, name });
    })
  };
});

vi.mock('../../src/main/pathUtils', () => ({
  isPathSafe: vi.fn(() => true)
}));

vi.mock('../../src/main/urlValidator', () => ({
  validateExternalUrl: vi.fn(() => true)
}));

// ---------------------------------------------------------------------------
// electron mock — singleInstance-shaped, extended with safeStorage custody
// fakes + capturing ipcMain registries.
// ---------------------------------------------------------------------------
const XOR_KEY = 0x5a;
const FAKE_PREFIX = 'W11FAKE:';

vi.mock('electron', () => ({
  app: {
    getPath: () => harness.dir,
    getVersion: () => '1.0.0',
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    quit: () => undefined,
    on: () => undefined,
    requestSingleInstanceLock: () => true,
    disableHardwareAcceleration: () => undefined,
    setAsDefaultProtocolClient: () => undefined,
    getGPUFeatureStatus: () => ({})
  },
  BrowserWindow: vi.fn(function (this: void) {
    const instance = {
      loadURL: vi.fn(() => Promise.resolve()),
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
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => false),
      restore: vi.fn(),
      focus: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
      isMaximized: vi.fn(() => false),
      setProgressBar: vi.fn()
    };
    harness.windows.push(instance);
    return instance;
  }),
  ipcMain: {
    handle: (channel: string, fn: (eventOrUnused: unknown, payload?: unknown) => unknown) => {
      harness.handles.set(channel, fn);
    },
    on: (channel: string, fn: (event: { sender?: unknown; returnValue?: unknown }, payload?: unknown) => void) => {
      harness.ons.set(channel, fn);
    }
  },
  protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
  shell: { openExternal: vi.fn() },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: vi.fn(() => false),
      resize: vi.fn(() => ({}))
    }))
  },
  Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
  Tray: vi.fn(function (this: void) {
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
  },
  screen: { getAllDisplays: vi.fn(() => []) },
  powerSaveBlocker: {
    isStarted: vi.fn(() => false),
    start: vi.fn(() => 0),
    stop: vi.fn()
  },
  Notification: vi.fn(function (this: void) {
    return { on: vi.fn(), show: vi.fn() };
  }),
  safeStorage: {
    isEncryptionAvailable: () => harness.ss.available,
    encryptString: (plain: string) => {
      if (!harness.ss.available || harness.ss.failEncrypt) {
        throw new Error('fake safeStorage: encrypt unavailable');
      }
      const raw = Buffer.from(FAKE_PREFIX + plain, 'utf8');
      return Buffer.from(raw.map((b) => b ^ XOR_KEY));
    },
    decryptString: (buf: Buffer) => {
      if (harness.ss.failDecrypt) {
        throw new Error('fake safeStorage: decrypt failed');
      }
      const opened = Buffer.from(buf.map((b) => b ^ XOR_KEY)).toString('utf8');
      if (!opened.startsWith(FAKE_PREFIX)) {
        throw new Error('fake safeStorage: foreign ciphertext');
      }
      return opened.slice(FAKE_PREFIX.length);
    }
  }
}));

// ---------------------------------------------------------------------------
// Import the system under test — registers every handler into the harness and
// starts the boot sequence (whenReady resolves immediately under the mock).
// Dynamic (awaited) so the harness tmp dir + legacy config.json exist before
// the mock factories construct the real stores.
// ---------------------------------------------------------------------------
await import('../../src/main/index');
import { ENVELOPE_PREFIX } from '../../src/main/secretStore';

const configPath = nodePath.join(harness.dir, 'config.json');
const secretsPath = nodePath.join(harness.dir, 'secrets.json');
const readBytes = (file: string): string =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';

/** Await the microtask chain the mocked whenReady kicks off (boot creates the window). */
async function flushBoot(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeAll(flushBoot);

function callHandle(channel: string, payload?: unknown): unknown {
  const fn = harness.handles.get(channel);
  expect(fn, `ipcMain.handle('${channel}') must be registered`).toBeDefined();
  return fn!({ sender: {}, reply: () => undefined }, payload);
}

function callVault(channel: string, payload?: unknown, sender?: unknown): unknown {
  const fn = harness.ons.get(channel);
  expect(fn, `ipcMain.on('${channel}') must be registered`).toBeDefined();
  // The handler writes event.returnValue on the object passed IN — same
  // identity, no copy, mirroring how ipcMain.on answers a sendSync.
  const event: { sender?: unknown; returnValue?: unknown } = { sender };
  fn!(event, payload);
  return event.returnValue;
}

function mainSender(): unknown {
  expect(harness.windows.length, 'boot must have created the main window').toBeGreaterThan(0);
  return harness.windows[harness.windows.length - 1]!.webContents;
}

describe('config.json custody (deviceId/serverUrl/hubUrl)', () => {
  it('MIGRATES the pre-fix plaintext deviceId on first read and persists the envelope', async () => {
    const id = await callHandle('app:get-device-id');
    expect(id).toBe(LEGACY_DEVICE_ID); // never orphaned: the install identity SURVIVES the upgrade
    const bytes = readBytes(configPath);
    expect(bytes).toContain(ENVELOPE_PREFIX);
    expect(bytes).not.toContain(LEGACY_DEVICE_ID); // red-on-parent: the parent stored it raw
  });

  it('serves the sealed deviceId on subsequent reads, byte-stable across calls', async () => {
    const first = await callHandle('app:get-device-id');
    const second = await callHandle('app:get-device-id');
    expect(second).toBe(first);
    expect(first).toBe(LEGACY_DEVICE_ID);
    expect(readBytes(configPath)).not.toContain(String(first));
  });

  it('round-trips serverUrl through custody with zero plaintext on disk', async () => {
    const url = 'https://media.example-internal.test:8443/phlix';
    await callHandle('app:set-server-url', url);
    expect(await callHandle('app:get-server-url')).toBe(url);
    const bytes = readBytes(configPath);
    expect(bytes).toContain(ENVELOPE_PREFIX);
    expect(bytes).not.toContain('media.example-internal.test'); // red-on-parent
  });

  it('seals hubUrl but keeps the non-scope preference rows plaintext (deliberate boundary)', async () => {
    await callHandle('hub:set-config', {
      hubUrl: 'https://hub.secret-stage.test',
      activeServerId: 'srv-alpha',
      connectionMode: 'hub'
    });
    const config = (await callHandle('hub:get-config')) as {
      hubUrl: string | null;
      activeServerId: string | null;
      connectionMode: string;
    };
    expect(config.hubUrl).toBe('https://hub.secret-stage.test');
    expect(config.activeServerId).toBe('srv-alpha');
    expect(config.connectionMode).toBe('hub');
    const bytes = readBytes(configPath);
    expect(bytes).not.toContain('hub.secret-stage.test'); // red-on-parent
    // Honest scope: connectionMode is an enum, activeServerId an opaque
    // selection pointer — both deliberately OUTSIDE the custody boundary.
    expect(bytes).toContain('"hub"');
    expect(bytes).toContain('srv-alpha');
  });

  it('answers null for an absent custody row (no phantom envelope)', async () => {
    await callHandle('app:set-server-url', null as unknown as string); // write(null) removes
    expect(await callHandle('app:get-server-url')).toBeNull();
  });
});

describe('renderer vault (secrets.json)', () => {
  it('set/get/delete round-trips a token with envelope-only bytes on disk', () => {
    const sender = mainSender();
    const token = 'eyJhbGciOi.seed-tok-9f8e7d6c5b4a3f2e1d0c';
    expect(callVault('vault:set', { key: 'ui.access_token', value: token }, sender)).toBe(true);
    expect(callVault('vault:get', { key: 'ui.access_token' }, sender)).toBe(token);
    const bytes = readBytes(secretsPath);
    expect(bytes).toContain(ENVELOPE_PREFIX);
    expect(bytes).not.toContain('seed-tok-9f8e7d6c5b4a3f2e1d0c'); // the on-disk-plaintext mutation target
    expect(callVault('vault:delete', { key: 'ui.access_token' }, sender)).toBe(true);
    expect(callVault('vault:get', { key: 'ui.access_token' }, sender)).toBeNull();
  });

  it('is-available reports the live OS encryption state', () => {
    expect(callVault('vault:is-available', undefined, mainSender())).toBe(true);
  });

  it('refuses every vault channel whose sender is not the current main window', () => {
    const impostor = { send: vi.fn() };
    expect(callVault('vault:get', { key: 'ui.access_token' }, impostor)).toBeNull();
    expect(callVault('vault:set', { key: 'ui.access_token', value: 'x' }, impostor)).toBe(false);
    expect(callVault('vault:delete', { key: 'ui.access_token' }, impostor)).toBe(false);
    expect(callVault('vault:is-available', undefined, impostor)).toBe(false);
  });

  it('fails closed on guard-rejecting shapes without persisting them', () => {
    const sender = mainSender();
    expect(callVault('vault:set', { key: 'bad key!@$', value: 'v' }, sender)).toBe(false);
    expect(callVault('vault:set', { key: 'ui.ok_key', value: 42 }, sender)).toBe(false);
    expect(callVault('vault:set', { key: 'ui.ok_key', value: undefined }, sender)).toBe(false);
    expect(callVault('vault:get', { key: 42 }, sender)).toBeNull();
    expect(readBytes(secretsPath)).not.toContain('42');
  });
});

describe('disclosed plaintext fallback (encryption unavailable)', () => {
  it('keeps the app functional, persists plaintext ONCE-disclosed, and says so in the log', async () => {
    harness.ss.available = false;
    const url = 'https://fallback.visible-stage.test:8096';
    await callHandle('app:set-server-url', url);
    expect(await callHandle('app:get-server-url')).toBe(url); // function despite no OS crypto
    expect(readBytes(configPath)).toContain(url); // disclosed degradation (documented in the fixlog)
    expect(callVault('vault:is-available', undefined, mainSender())).toBe(false);

    const warnCount = harness.logs.filter(([level, msg]) => level === 'warn' && msg.includes('[custody]')).length;
    expect(warnCount).toBe(1); // disclosed exactly once per custody instance, not per write

    // Re-arming encryption re-seals on the next read (opportunistic migration).
    harness.ss.available = true;
    expect(await callHandle('app:get-server-url')).toBe(url);
    expect(readBytes(configPath)).not.toContain(url);
  });
});
