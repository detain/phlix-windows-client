/**
 * @vitest-environment node
 *
 * Batch 5 (review windows__exploiter 1/3, asphp MIN-2/5, crossfe 2/4):
 * the IPC surface hardened in three layers —
 *   m4  sender identity on every config/credential/state channel (was vault-only);
 *   m5  runtime payload laws (boolean / finite-number) on the state mirrors;
 *   m6  notification:show clickAction must be a real string to route;
 *   m13 render-process-gone / closed zero the playing mirrors;
 *   m14 downloads are default-deny per origin (downloadUrlTrusted);
 *   m16 phlix:// protocol registration is packaged-only.
 * Harness follows configWriteValidation.test.ts (boot via mocked electron;
 * plaintext custody fallback through `prefs`; listeners recorded per window).
 */
import { describe, it, expect, vi, type Mock } from 'vitest';

const { prefs, tracks, WIN } = vi.hoisted(() => {
  const prefs = {} as Record<string, unknown>;
  const tracks = {
    ipcOn: new Map<string, (event: unknown, payload?: unknown) => unknown>(),
    ipcHandle: new Map<string, (event: unknown, payload?: unknown) => unknown>(),
    wcOn: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
    winOn: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
    wcSend: [] as Array<[string, unknown]>,
    notifications: [] as Array<{ title?: string; body?: string; onClick?: () => void }>,
    setProgressBar: [] as number[],
    setToolTip: [] as string[],
    blockerStart: [] as boolean[],
    openExternal: [] as string[],
    dialogSync: [] as unknown[],
    powerOn: new Map<string, () => void>()
  };
  // Constructed INSIDE the hoist: the boot path runs on the static import of
  // src/main/index, before any module-body const could exist.
  const WIN = {
    loadURL: () => undefined, loadFile: () => undefined, show: () => undefined,
    hide: () => { WIN.hideCalls += 1; },
    hideCalls: 0,
    close: () => undefined, isDestroyed: () => false, setAlwaysOnTop: (v: unknown) => { WIN.alwaysOnTop.push(v); },
    alwaysOnTop: [] as unknown[],
    setFullScreen: () => undefined, isFullScreen: () => false, isMinimized: () => false,
    isVisible: () => true, focus: () => undefined, restore: () => undefined, isFocused: () => true,
    maximize: () => undefined, isMaximized: () => false,
    // w10/L1: the off-screen restore clamp reads window bounds through the
    // probe; the fake answers with an on-screen rect so every pre-existing
    // exact call-sequence pin stays about the sequence, not the geometry.
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 870 }),
    setBounds: () => undefined,
    setProgressBar: (mode: number) => { tracks.setProgressBar.push(mode); },
    setThumbarButtons: () => undefined,
    webContents: {
      send: (channel: string, payload?: unknown) => { tracks.wcSend.push([channel, payload]); },
      setWindowOpenHandler: () => undefined,
      on: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => { tracks.wcOn.set(channel, fn); },
      openDevTools: () => undefined
    },
    on: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => { tracks.winOn.set(channel, fn); },
    once: () => undefined
  };
  return { prefs, tracks, WIN };
});

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), initialize: vi.fn() }
}));
vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null, autoDownload: false, allowPrerelease: false,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn(), quitAndInstall: vi.fn(),
    on: vi.fn().mockReturnThis(), once: vi.fn()
  }
}));
vi.mock('electron-store', () => ({
  default: class {
    get(key: string, fallback?: unknown) { return key in prefs ? prefs[key] : fallback; }
    set(key: string, value: unknown) { prefs[key] = value; }
  }
}));
vi.mock('electron', () => ({
  // M8 batch 10: index.ts imports powerMonitor — partial electron mocks
  // make the named import throw at boot (exit-7 class, see batch 6).
  powerMonitor: { on: (name: string, cb: () => void) => { tracks.powerOn.set(name, cb); } },
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: () => '/tmp/opencode/windows-fix-c2',
    getAppPath: () => '/tmp/opencode/windows-fix-c2',
    disableHardwareAcceleration: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: vi.fn(() => ({ then: (cb: () => void) => { cb(); } })),
    on: vi.fn(), quit: vi.fn(), getGPUFeatureStatus: vi.fn().mockReturnValue({})
  },
  BrowserWindow: vi.fn(function () { return WIN; }),
  Menu: { buildFromTemplate: vi.fn().mockReturnValue({ popup: vi.fn() }), setApplicationMenu: vi.fn() },
  Tray: vi.fn(function () {
    return { setToolTip: (label: string) => { tracks.setToolTip.push(label); }, setContextMenu: vi.fn(), on: vi.fn() };
  }),
  session: { defaultSession: { on: vi.fn(), setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => { throw new Error('mock safeStorage'); },
    decryptString: () => { throw new Error('mock safeStorage'); }
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, payload?: unknown) => unknown) => { tracks.ipcHandle.set(channel, fn); },
    on: (channel: string, fn: (event: unknown, payload?: unknown) => unknown) => { tracks.ipcOn.set(channel, fn); },
    send: vi.fn()
  },
  shell: { openExternal: (url: string) => { tracks.openExternal.push(url); } },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({ isEmpty: () => false, resize: vi.fn() }),
    // setupThumbarButtons fallback path (index.ts:640) — resume tests drive it.
    createEmpty: vi.fn().mockReturnValue({ isEmpty: () => true, resize: vi.fn() })
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 1 }),
    showMessageBoxSync: (opts: unknown) => { tracks.dialogSync.push(opts); return 1; }
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  screen: {
    getPrimaryDisplay: vi.fn().mockReturnValue({ scaleFactor: 1 }),
    getAllDisplays: vi.fn().mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }])
  },
  powerSaveBlocker: {
    start: (_kind: string, opts?: { blocking?: boolean }) => { tracks.blockerStart.push(opts?.blocking ?? true); return 7; },
    stop: vi.fn(), isStarted: vi.fn().mockReturnValue(false)
  },
  Notification: class {
    static isSupported = vi.fn().mockReturnValue(true);
    // Instance members (not a constructor-returned literal): TS2409 requires a
    // class constructor's return to be the instance type. Same observable shape
    // the boot code consumes — on/show/close per notification, options row
    // tracked for assertions.
    on!: (ev: string, fn: () => void) => void;
    show = vi.fn();
    close = vi.fn();
    constructor(options: { title?: string; body?: string }) {
      const self = { ...options } as { title?: string; body?: string; onClick?: () => void };
      Object.defineProperty(self, 'bind', { value: () => undefined });
      tracks.notifications.push(self);
      this.on = (ev: string, fn: () => void) => { if (ev === 'click') { self.onClick = fn; } };
    }
  }
}));

import '../../src/main/index';
import { downloadUrlTrusted } from '../../src/main/index';

const FOREIGN = { sender: { fake: 'attacker-window' } };
const TRUSTED = { sender: WIN.webContents };

function invoke(channel: string, event: unknown, payload?: unknown): unknown {
  const fn = tracks.ipcHandle.get(channel) ?? tracks.ipcOn.get(channel);
  if (!fn) throw new Error(`no handler registered for ${channel}`);
  return fn(event, payload);
}

describe('m4: sender identity on every config/credential channel', () => {
  it('hub:set-config from a foreign sender writes nothing and answers false', () => {
    delete prefs.hubUrl;
    expect(invoke('hub:set-config', FOREIGN, { hubUrl: 'https://evil.example' })).toBe(false);
    expect('hubUrl' in prefs).toBe(false);
  });
  it('app:set-server-url from a foreign sender cannot poison the boot input', () => {
    delete prefs.serverUrl;
    expect(invoke('app:set-server-url', FOREIGN, 'https://evil.example')).toBe(false);
    expect('serverUrl' in prefs).toBe(false);
  });
  it('hub:get-config from a foreign sender answers neutral defaults', () => {
    prefs.activeServerId = 'srv-secret-pointer';
    prefs.connectionMode = 'hub';
    expect(invoke('hub:get-config', FOREIGN)).toEqual({ hubUrl: null, activeServerId: null, connectionMode: 'direct' });
  });
  it('app:get-server-url from a foreign sender reads nothing', () => {
    prefs.serverUrl = 'https://media.example';
    expect(invoke('app:get-server-url', FOREIGN)).toBe(null);
  });
  it('app:get-device-id from a foreign sender neither reads nor mints an id', () => {
    delete prefs.deviceId;
    expect(invoke('app:get-device-id', FOREIGN)).toBe(null);
    expect('deviceId' in prefs).toBe(false);
  });
  it('app:check-server-version from a foreign sender answers the inert verdict without probing or dialoging', async () => {
    const verdict = await invoke('app:check-server-version', FOREIGN, { apiBase: 'http://127.0.0.1:8096' }) as {
      compatible: boolean; serverVersion: string | null; minimumVersion: string;
    };
    expect(verdict.compatible).toBe(true);
    expect(verdict.serverVersion).toBe(null);
    expect(tracks.dialogSync.length).toBe(0);
  });
  it('notification:show from a foreign sender constructs no toast', () => {
    const before = tracks.notifications.length;
    expect(invoke('notification:show', FOREIGN, { title: 't', body: 'b' })).toBe(false);
    expect(tracks.notifications.length).toBe(before);
  });
  it('a trusted sender still works on every guarded channel (no regression)', () => {
    expect(invoke('app:set-server-url', TRUSTED, 'https://media.example')).toBe(true);
    expect(invoke('app:get-server-url', TRUSTED)).toBe('https://media.example');
    expect(invoke('hub:get-config', TRUSTED)).toEqual({ hubUrl: null, activeServerId: 'srv-secret-pointer', connectionMode: 'hub' });
  });
});

describe('m5: payload laws on the state-mirror channels (trusted sender)', () => {
  it('tray:set-minimize-to-tray refuses the stringified false that would read truthy', () => {
    delete prefs.minimizeToTray;
    invoke('tray:set-minimize-to-tray', TRUSTED, 'false');
    expect('minimizeToTray' in prefs).toBe(false);
    invoke('tray:set-minimize-to-tray', TRUSTED, false);
    expect(prefs.minimizeToTray).toBe(false);
  });
  it('set-always-on-top refuses truthy junk', () => {
    WIN.alwaysOnTop.length = 0;
    invoke('set-always-on-top', TRUSTED, 'yes');
    expect(WIN.alwaysOnTop.length).toBe(0);
    invoke('set-always-on-top', TRUSTED, true);
    expect(WIN.alwaysOnTop).toEqual([true]);
  });
  it('power:update refuses non-boolean playing and arms on real booleans', () => {
    const before = tracks.blockerStart.length;
    invoke('power:update', TRUSTED, { playing: 'truthy' });
    expect(tracks.blockerStart.length).toBe(before);
    invoke('power:update', TRUSTED, null);
    expect(tracks.blockerStart.length).toBe(before);
    invoke('power:update', TRUSTED, { playing: true });
    expect(tracks.blockerStart.length).toBeGreaterThan(before);
  });
  it('playback:progress refuses NaN/junk before it reaches setProgressBar', () => {
    invoke('playback:progress', TRUSTED, { current: NaN, total: 10 });
    invoke('playback:progress', TRUSTED, { current: '5', total: '10' });
    invoke('playback:progress', TRUSTED, null);
    expect(tracks.setProgressBar.length).toBe(0);
    invoke('playback:progress', TRUSTED, { current: 5, total: 10 });
    expect(tracks.setProgressBar).toEqual([0.5]);
  });
  it('thumbar:update with a null payload refuses instead of throwing into the void', () => {
    expect(() => invoke('thumbar:update', TRUSTED, null)).not.toThrow();
    expect(() => invoke('thumbar:update', TRUSTED, {})).not.toThrow();
  });
  it('gpu:set-disable-hardware-acceleration keeps the typed-store shape', () => {
    delete prefs.disableHardwareAcceleration;
    invoke('gpu:set-disable-hardware-acceleration', TRUSTED, 'false');
    expect('disableHardwareAcceleration' in prefs).toBe(false);
    invoke('gpu:set-disable-hardware-acceleration', TRUSTED, true);
    expect(prefs.disableHardwareAcceleration).toBe(true);
  });
});

describe('m6: notification clickAction routing needs a real string', () => {
  it('a string clickAction routes on click with the phlix://internal prefix', () => {
    // The receiver must be READY for immediate delivery — otherwise
    // handleDeepLinkUrl legitimately holds the link (M-WINDOWS-06), which
    // would make the object-case emptiness a false green.
    tracks.ipcOn.get('deeplink:ready')!({ sender: WIN.webContents });
    tracks.wcSend.length = 0;
    expect(invoke('notification:show', TRUSTED, { title: 't', body: 'b', clickAction: '/app/settings' })).toBe(true);
    const n = tracks.notifications[tracks.notifications.length - 1]!;
    n.onClick!();
    expect(tracks.wcSend).toEqual([['deeplink:open', '/app/settings']]);
  });
  it('an object clickAction delivers the toast but routes nothing (no [object Object] URL)', () => {
    tracks.wcSend.length = 0;
    expect(invoke('notification:show', TRUSTED, { title: 't', body: 'b', clickAction: { evil: true } })).toBe(true);
    const n = tracks.notifications[tracks.notifications.length - 1]!;
    expect(() => n.onClick!()).not.toThrow();
    expect(tracks.wcSend.length).toBe(0);
  });
});

describe('m19: the version probe is confined to the PERSISTED serverUrl', () => {
  let fetchSpy: Mock;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    tracks.wcSend.length = 0;
    tracks.notifications.length = 0;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('ignores the renderer-supplied apiBase and fetches ONLY the persisted base', async () => {
    prefs.serverUrl = 'https://media.example';
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ version: '2.0.0' }) });
    const verdict = await invoke('app:check-server-version', TRUSTED, { apiBase: 'http://127.0.0.1:9999' }) as { serverVersion: string | null };
    expect(verdict.serverVersion).toBe('2.0.0');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // The whole point: the loopback probe the finding described NEVER happens.
    expect((fetchSpy.mock.calls[0] as unknown as [string])[0]).toBe('https://media.example/system/info');
  });

  it('with no persisted server it answers the INACTIVE verdict WITHOUT fetching', async () => {
    delete prefs.serverUrl;
    const verdict = await invoke('app:check-server-version', TRUSTED, { apiBase: 'http://169.254.169.254' }) as { serverVersion: string | null; compatible: boolean };
    expect(verdict).toEqual({ compatible: true, serverVersion: null, minimumVersion: '1.1.0' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('names a hub-shaped persisted base with one pref-gated notification (M7)', async () => {
    prefs.serverUrl = 'https://hub.example';
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 404 })            // gate: /system/info 404
      .mockResolvedValueOnce({ ok: false, status: 404 })            // detector: same again
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', service: 'phlix-hub' }) });
    const verdict = await invoke('app:check-server-version', TRUSTED, { apiBase: 'https://hub.example' }) as { serverVersion: string | null };
    expect(verdict.serverVersion).toBe(null);
    expect(tracks.notifications).toHaveLength(1);
    expect(tracks.notifications[0]?.title).toBe('This address is a Phlix Hub');
  });

  it('a server-shaped base (reachable /system/info) never gets the hub toast', async () => {
    prefs.serverUrl = 'https://media.example';
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ version: '2.0.0' }) });
    await invoke('app:check-server-version', TRUSTED, { apiBase: 'https://media.example' });
    expect(tracks.notifications).toHaveLength(0);
  });
});

describe('M8: powerMonitor suspend/resume reach the renderer as pushes', () => {
  beforeEach(() => { tracks.wcSend.length = 0; tracks.blockerStart.length = 0; });

  it('suspend pushes power:suspend to the live main window', () => {
    expect(tracks.powerOn.has('suspend'), 'suspend handler registered').toBe(true);
    tracks.powerOn.get('suspend')!();
    expect(tracks.wcSend.some(([c]) => c === 'power:suspend')).toBe(true);
  });

  it('resume re-asserts a live display-sleep blocker and pushes power:resume', () => {
    // isPlaying's SOLE writer is updateThumbarPlayState (thumbar:update);
    // power:update only drives the blocker itself (measured at this tip).
    invoke('thumbar:update', TRUSTED, { playing: true });
    invoke('power:update', TRUSTED, { playing: true });
    const before = tracks.blockerStart.length;
    tracks.powerOn.get('resume')!();
    expect(tracks.blockerStart.length).toBe(before + 1);
    expect(tracks.wcSend.some(([c]) => c === 'power:resume')).toBe(true);
  });

  it('resume with nothing playing re-asserts NOTHING (only the push)', () => {
    // isPlaying LEAKS across tests (module state) — clear it explicitly, then
    // measure from after the clear (thumbar:false itself never starts blockers).
    invoke('thumbar:update', TRUSTED, { playing: false });
    const before = tracks.blockerStart.length;
    tracks.powerOn.get('resume')!();
    expect(tracks.blockerStart.length).toBe(before);
    expect(tracks.wcSend.some(([c]) => c === 'power:resume')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// w10/L1 (windows__casualgamer #7 / windows__exploiter 1): the m4 law said
// sender identity is THE trust boundary "for every channel that writes config/
// custody or mirrors state into main-process surfaces" — but the exemption was
// a hand-run inventory, and the leftover arms were exactly the ones an
// eventually-foreign document can abuse: minimize-to-tray (hide-the-UI DoS),
// and the pure reads whose answers are configuration and updater state. The
// sweep completes it to deny-by-default: EVERY ipcMain handler now leads with
// senderTrusted, refusals answer with the neutral default (never the live
// value), and the docblock records the completion. update:get-status is
// deliberately the LAST test below: the trusted check leg parks the state
// machine at 'checking' (no updater events fire in this harness), which no
// other block here reads. PLACEMENT LAW: this block must stay BEFORE the
// m13 describe below — m13 fires the window 'closed' handler, which nulls
// mainWindow for the rest of the file (src/main/index.ts), so any trusted
// senderTrusted arm downstream would be silently refused.
// ---------------------------------------------------------------------------
import { app as mockedApp } from 'electron';
import { autoUpdater as mockedUpdater } from 'electron-updater';

describe('w10/L1 sweep: senderTrusted deny-by-default on the previously exempt channels', () => {
  it('minimize-to-tray from a foreign sender cannot hide the window; trusted still can', () => {
    WIN.hideCalls = 0;
    invoke('minimize-to-tray', FOREIGN);
    expect(WIN.hideCalls, 'a foreign document must not be able to hide the shell').toBe(0);
    invoke('minimize-to-tray', TRUSTED);
    expect(WIN.hideCalls).toBe(1);
  });

  it('get-app-path refuses the userData path to a foreign sender', () => {
    expect(invoke('get-app-path', FOREIGN)).toBe('');
    expect(invoke('get-app-path', TRUSTED)).toBe('/tmp/opencode/windows-fix-c2');
  });

  it('get-version refuses the app version to a foreign sender', () => {
    expect(invoke('get-version', FOREIGN)).toBe('');
    expect(invoke('get-version', TRUSTED)).toBe('1.0.0');
  });

  it('tray:get-minimize-to-tray answers the conservative default, not the live store value, to a foreign sender', () => {
    // The refusal shape is the DEFAULT the UI starts from (true = the shipped
    // close-to-tray posture), never the real preference: a foreign sender
    // cannot probe what the user chose.
    prefs.minimizeToTray = false;
    expect(invoke('tray:get-minimize-to-tray', FOREIGN)).toBe(true);
    expect(invoke('tray:get-minimize-to-tray', TRUSTED)).toBe(false);
    delete prefs.minimizeToTray;
  });

  it('gpu:get-disable-hardware-acceleration cannot be probed by a foreign sender', () => {
    prefs.disableHardwareAcceleration = true;
    expect(invoke('gpu:get-disable-hardware-acceleration', FOREIGN)).toBe(false);
    expect(invoke('gpu:get-disable-hardware-acceleration', TRUSTED)).toBe(true);
    delete prefs.disableHardwareAcceleration;
  });

  it('gpu:get-feature-status answers the empty map to a foreign sender', () => {
    const gpu = mockedApp.getGPUFeatureStatus as Mock;
    gpu.mockReturnValue({ canvas: 'disabled' });
    expect(invoke('gpu:get-feature-status', FOREIGN)).toEqual({});
    expect(invoke('gpu:get-feature-status', TRUSTED)).toEqual({ canvas: 'disabled' });
    gpu.mockReturnValue({});
  });

  it('update:check-for-updates refuses foreign senders without kicking the updater or touching the state machine', async () => {
    const check = mockedUpdater.checkForUpdates as Mock;
    check.mockClear();
    const result = await invoke('update:check-for-updates', FOREIGN);
    expect(result).toEqual({ status: 'idle' });
    expect(check, 'a foreign sender must not be able to start an update check').not.toHaveBeenCalled();
    // The state stayed idle: the very next trusted read proves it.
    expect(invoke('update:get-status', TRUSTED)).toEqual({ status: 'idle' });
  });

  it('update:get-status refuses to mirror the LIVE update state to a foreign sender (last: parks status at checking)', async () => {
    const pending = invoke('update:check-for-updates', TRUSTED);
    // Synchronously after the trusted kick the machine IS checking...
    expect((invoke('update:get-status', TRUSTED) as { status: string }).status).toBe('checking');
    // ...and the foreign read still earns only the neutral default.
    expect(invoke('update:get-status', FOREIGN)).toEqual({ status: 'idle' });
    await pending;
  });
});


describe('m13: renderer death zeroes the playback mirrors', () => {
  it('render-process-gone resets the tray tooltip from playing to idle', () => {
    invoke('power:update', TRUSTED, { playing: true });
    expect(tracks.setToolTip[tracks.setToolTip.length - 1]).toContain('—');
    tracks.wcOn.get('render-process-gone')!({}, { reason: 'crashed' });
    expect(tracks.setToolTip[tracks.setToolTip.length - 1]).toBe('Phlix');
  });
  it('closed resets a fresh playing verdict too', () => {
    invoke('power:update', TRUSTED, { playing: true });
    tracks.winOn.get('closed')!({});
    expect(tracks.setToolTip[tracks.setToolTip.length - 1]).toBe('Phlix');
  });
});

describe('m14: downloads are default-deny per origin', () => {
  it('downloadUrlTrusted table: local app doc, dev localhost, persisted bases pass; everything else fails', () => {
    prefs.serverUrl = 'https://media.example';
    expect(downloadUrlTrusted('app://-/app/export.csv')).toBe(true);
    expect(downloadUrlTrusted('http://localhost:5173/bundle.js')).toBe(true);
    // I-w1: the IPv6 loopback dev origin is the same carve-out — WHATWG puts
    // the hostname in brackets, so the bracket form is the only matchable one.
    expect(downloadUrlTrusted('http://[::1]:5173/export.csv')).toBe(true);
    expect(downloadUrlTrusted('https://[::1]:8443/export.csv')).toBe(true);
    expect(downloadUrlTrusted('http://[::2]/payload.exe')).toBe(false); // blast radius stays ::1-only
    expect(downloadUrlTrusted('http://[::ffff:127.0.0.1]/payload.exe')).toBe(false); // v4-mapped normalizes off the arm
    expect(downloadUrlTrusted('https://media.example/files/movie.mkv')).toBe(true);
    expect(downloadUrlTrusted('https://evil.example/payload.exe')).toBe(false);
    expect(downloadUrlTrusted('https://media.example.evil.net/a')).toBe(false);
    expect(downloadUrlTrusted('file:///C:/windows/system32/hosts')).toBe(false);
    expect(downloadUrlTrusted(undefined)).toBe(false);
    expect(downloadUrlTrusted('')).toBe(false);
    expect(downloadUrlTrusted('not a url')).toBe(false);
  });
  it('the will-download listener cancels foreign-origin drops and lets app:// pass', () => {
    const listener = tracks.wcOn.get('will-download');
    expect(listener).toBeDefined();
    let cancelled = 0;
    const event = { preventDefault: () => { cancelled += 1; } };
    listener!(event, { getURL: () => 'https://evil.example/payload.exe' });
    expect(cancelled).toBe(1);
    listener!(event, { getURL: () => 'app://-/app/export.csv' });
    expect(cancelled).toBe(1);
  });
});

describe('m16: protocol registration is packaged-only', () => {
  it('dev boot (isPackaged false) never registers the phlix:// class', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main/index.ts'), 'utf-8');
    const fn = mainSource.slice(
      mainSource.indexOf('function setAsDefaultProtocolClient'),
      mainSource.indexOf('function setAsDefaultProtocolClient') + 1200
    );
    const gate = fn.indexOf('if (!app.isPackaged)');
    const call = fn.indexOf("app.setAsDefaultProtocolClient('phlix'");
    expect(gate).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(gate);
  });
});

// ---------------------------------------------------------------------------
// Batch 10 (M7/M8/m19): the version-gate constraint, the hub-shaped hint, and
// the powerMonitor signal wire — all exercised through the real registrations.
// ---------------------------------------------------------------------------
