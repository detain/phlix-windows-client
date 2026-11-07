import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';
import log from 'electron-log';

// --- Module mocks -----------------------------------------------------------
// CSS side-effect imports are meaningless under jsdom — stub them out.
vi.mock('@phlix/ui/style.css', () => ({}));
vi.mock('@phlix/ui/fonts.css', () => ({}));

const mountSpy = vi.fn();
const fakeApp = { mount: mountSpy };
const createPhlixApp = vi.fn(() => fakeApp);
// Stub the admin/hub route builders + page components main.ts pulls from @phlix/ui
// to assemble its menu + extraRoutes. The builders return marker route arrays so
// tests can assert the right set was wired per app mode.
const SERVER_ADMIN_ROUTE = { path: '/app/admin/dashboard', name: 'admin-dashboard' };
const HUB_ADMIN_ROUTE = { path: '/app/admin/dashboard', name: 'hub-admin-dashboard' };
const PageStub = { template: '<div />' };
vi.mock('@phlix/ui', () => ({
  createPhlixApp: createPhlixApp as any,
  buildAdminRoutes: () => [SERVER_ADMIN_ROUTE],
  buildHubAdminRoutes: () => [HUB_ADMIN_ROUTE],
  LibraryScanPage: PageStub,
  MyServersPage: PageStub,
  FederationPage: PageStub,
  ManageSharesPage: PageStub,
  SharedWithMePage: PageStub,
  InviteLinksPage: PageStub,
  AcceptInvitePage: PageStub,
  FederationSharesPage: PageStub,
  ServerDetailPage: PageStub,
  // main.ts does not import usePlayerStore, but export a no-op so the mock is
  // safe even if the import surface grows.
  usePlayerStore: vi.fn(() => ({}))
}));

const FAKE_HEADERS = { 'X-Phlix-Device-ID': 'dev', 'X-Phlix-Device-Type': 'windows' };
const buildPhlixHeaders = vi.fn(() => FAKE_HEADERS);
vi.mock('@phlix/contracts', () => ({
  buildPhlixHeaders: buildPhlixHeaders as any
}));

// Exportable mocks for electronBridge
const installElectronBridge = vi.fn(function() { return; });

vi.mock('@/electronBridge', () => ({
  installElectronBridge: installElectronBridge as any
}));

// Prevent overlay.tsx from loading during main entry tests.
// overlay.tsx has module-level router creation (createWebHashHistory)
// that requires a DOM environment (window/location), which is not available
// during main.test.ts module import before jsdom is fully initialized.
// The overlay is tested in overlay.test.ts.
vi.mock('@/overlay', () => ({}));

type WindowLike = { electronAPI?: unknown };
const getWindow = () => globalThis as unknown as { window: WindowLike };

function setElectronApi(api: unknown): void {
  getWindow().window = { electronAPI: api } as WindowLike;
}

function clearElectronApi(): void {
  getWindow().window = {} as WindowLike;
}

describe('boot (renderer entry)', () => {
  beforeEach(() => {
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    buildPhlixHeaders.mockClear().mockReturnValue(FAKE_HEADERS);
    installElectronBridge.mockClear().mockReturnValue((() => {}) as any);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('resolves Electron config, mounts the app, and installs the bridge', async () => {
    const api = {
      hubGetConfig: vi.fn(async () => ({
        hubUrl: 'https://hub.example.com',
        activeServerId: null,
        connectionMode: 'hub'
      })),
      getDeviceId: vi.fn(async () => 'device-abc'),
      getServerUrl: vi.fn(async () => null),
      checkServerVersion: vi.fn(async () => ({ compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' }))
    };
    setElectronApi(api);

    const mod = await import('@/main');
    // The module's top-level `void boot()` already ran on import; await it
    // settling, then call the exported boot directly to assert behaviour.
    await mod.boot();

    expect(api.hubGetConfig).toHaveBeenCalled();
    expect(api.getDeviceId).toHaveBeenCalled();
    expect(api.getServerUrl).toHaveBeenCalled();
    expect(api.checkServerVersion).toHaveBeenCalled();

    expect(buildPhlixHeaders).toHaveBeenCalledWith({
      deviceId: 'device-abc',
      deviceName: 'Phlix for Windows',
      deviceType: 'windows'
    });

    expect(createPhlixApp).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'hub',
        apiBase: 'https://hub.example.com',
        requireConnection: true,
        onConnectionChange: expect.any(Function),
        home: '/app/servers',
        features: { resumeSync: false },
        deviceHeaders: FAKE_HEADERS,
        defaultTheme: 'nocturne',
        branding: { wordmark: 'Phlix' }
      })
    );
    // M-WINDOWS-04 rider, leg 4 (seam-free posture): hub mode writes NOTHING to
    // window.__PHLIX__ — an wsUrl hint there would override the :8804 relay
    // dials wholesale (upstream hubRelay.ts) — and its config carries no
    // wsUrl key at all.
    const hubCfg = (createPhlixApp.mock.calls as any).at(-1)?.[0] as Record<string, unknown>;
    expect(hubCfg).not.toHaveProperty('wsUrl');
    expect((getWindow().window as unknown as { __PHLIX__?: unknown }).__PHLIX__).toBeUndefined();

    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
    expect(installElectronBridge).toHaveBeenCalledWith(fakeApp);
  });

  // M-WINDOWS-02 (review windows__casualgamer): the pre-fix behavior on a
  // too-old server was `log.error(...); return;` — the Vue app never mounted
  // and the user saw the permanently dark window (#1a1a2e) with zero
  // explanation. The cure must keep blocking the mount (policy unchanged) but
  // render an explicit, informative screen in its place. Mutation teeth:
  // revert boot() to the log-only abort and the container stays empty — red.
  it('renders the incompatible-server screen when the version gate blocks the mount', async () => {
    const api = {
      hubGetConfig: vi.fn(async () => ({
        hubUrl: 'https://hub.example.com',
        activeServerId: null,
        connectionMode: 'hub'
      })),
      getDeviceId: vi.fn(async () => 'device-abc'),
      getServerUrl: vi.fn(async () => null),
      checkServerVersion: vi.fn(async () => ({ compatible: false, serverVersion: '1.0.7', minimumVersion: '1.1.0' }))
    };
    setElectronApi(api);

    // Import FIRST: the module's top-level auto-boot is guarded by the
    // presence of #phlix-app (it isn't in the document yet) — then create the
    // mount point and drive boot() explicitly.
    const mod = await import('@/main');
    const container = document.createElement('div');
    container.id = 'phlix-app';
    document.body.appendChild(container);
    try {
      await mod.boot();

      expect(api.checkServerVersion).toHaveBeenCalled();
      // Blocked means blocked: the app itself must NOT mount…
      expect(createPhlixApp).not.toHaveBeenCalled();
      expect(mountSpy).not.toHaveBeenCalled();
      // …but the window must NOT be dark: the explanation is on screen.
      expect(container.textContent).toContain('1.0.7');
      expect(container.textContent).toContain('1.1.0');
      expect(container.textContent).toMatch(/too old/i);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      // M-WINDOWS-16: the surface carries the in-place Retry affordance —
      // no quit-and-relaunch-only path.
      const retry = container.querySelector('button');
      expect(retry, 'boot-failure surface must offer a Retry button').not.toBeNull();
      expect(retry?.textContent).toBe('Try again');
      // windows__gameux 5[m] (MW-089): the screen is built one-Enter-away from
      // recovery — focus lands on Retry at render, not on <body>.
      expect(document.activeElement, 'Retry must own keyboard focus at render').toBe(retry);
    } finally {
      container.remove();
    }
  });

  // ---------------------------------------------------------------------------
  // M-WINDOWS-16 (review windows__gameux MAJOR-5): 2aac4ec cured the dark
  // window itself (dialog + persistent screen), but left the review's third
  // complaint standing — "no retry": the only remediation path was the copy's
  // restart-the-app ceremony. These pins cover the completion: an in-place
  // Retry that re-runs the SAME gate (policy untouched — same check, same
  // verdicts) and either resumes the boot or re-renders, plus the silent-
  // abort census and the failure surface's data-hygiene laws.
  // ---------------------------------------------------------------------------

  const TOO_OLD = { compatible: false, serverVersion: '1.0.7', minimumVersion: '1.1.0' };
  const OK_VERDICT = { compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' };

  /** api mock whose checkServerVersion walks a scripted verdict queue. */
  function makeGateApi(verdicts: Array<typeof TOO_OLD | typeof OK_VERDICT | { compatible: boolean; serverVersion: string | null; minimumVersion: string }>) {
    const queue = [...verdicts];
    return {
      hubGetConfig: vi.fn(async () => ({
        hubUrl: 'https://hub.example.com',
        activeServerId: null,
        connectionMode: 'hub'
      })),
      getDeviceId: vi.fn(async () => 'device-abc'),
      getServerUrl: vi.fn(async () => null),
      checkServerVersion: vi.fn(async () => {
        const next = queue.shift();
        if (!next) throw new Error('unexpected extra checkServerVersion call');
        return next;
      })
    };
  }

  /** Import first (top-level auto-boot is guarded out), mount point after, drive boot(). */
  async function bootIntoFailureScreen() {
    const mod = await import('@/main');
    const container = document.createElement('div');
    container.id = 'phlix-app';
    document.body.appendChild(container);
    await mod.boot();
    return container;
  }

  it('retry re-runs the gate in place and, once the server passes, completes the boot without a restart', async () => {
    const api = makeGateApi([TOO_OLD, OK_VERDICT, OK_VERDICT]);
    setElectronApi(api);
    const container = await bootIntoFailureScreen();
    try {
      expect(api.checkServerVersion).toHaveBeenCalledTimes(1);
      expect(mountSpy).not.toHaveBeenCalled();

      container.querySelector('button')!.click();

      // Same closure, same SSOT endpoint verdict path: gate + retry click +
      // the resumed boot()'s own check must all run through the gate.
      await vi.waitFor(() => expect(mountSpy).toHaveBeenCalledWith('#phlix-app'));
      expect(api.checkServerVersion).toHaveBeenCalledTimes(3);
      expect(createPhlixApp).toHaveBeenCalled();
    } finally {
      container.remove();
    }
  });

  it('retry against a still-too-old server re-renders a fresh interactive screen — never blank, never quit-only', async () => {
    const api = makeGateApi([TOO_OLD, TOO_OLD, TOO_OLD]);
    setElectronApi(api);
    const container = await bootIntoFailureScreen();
    try {
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(api.checkServerVersion).toHaveBeenCalledTimes(2));

      expect(mountSpy).not.toHaveBeenCalled();
      expect(createPhlixApp).not.toHaveBeenCalled();
      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      // Fresh button, enabled, on the replacement screen (the clicked one is
      // gone with the old render) — the surface cannot dead-end.
      const second = alert!.querySelector('button');
      expect(second).not.toBeNull();
      expect(second!.disabled).toBe(false);
      expect(second!.textContent).toBe('Try again');

      second!.click();
      await vi.waitFor(() => expect(api.checkServerVersion).toHaveBeenCalledTimes(3));
      expect(mountSpy).not.toHaveBeenCalled();
    } finally {
      container.remove();
    }
  });

  // ---------------------------------------------------------------------------
  // M-WINDOWS-16 r2 (review windows__gameux MINOR-1): r1 upheld the retry
  // design but caught the docblock claim "every outcome leaves it interactive"
  // as unsupported for a fourth outcome — a resumed boot() that REJECTS before
  // it owns the window (its fail-fast config IPC throws: DPAPI custody
  // failure class) was discarded via `void boot()`, leaving the clicked button
  // disabled forever on a stale screen. Cure: catch, log, re-arm a still
  // connected surface. Red on parent for each pin below (parent strands the
  // button AND swallows the rejection unlogged/unhandled).
  // ---------------------------------------------------------------------------

  it('a resumed boot that rejects before it owns the window re-arms the live screen instead of stranding a dead button', async () => {
    // Four gate verdicts: initial boot, retry #1 (resumed boot() dies at its
    // own config IPC), retry #2 (resumed boot() runs whole).
    const api = makeGateApi([TOO_OLD, OK_VERDICT, OK_VERDICT, OK_VERDICT]);
    // One-shot config outage on the SECOND boot() — the resumed one. The
    // initial boot's config (call 1) and the third boot's (call 3) succeed.
    let configCalls = 0;
    api.hubGetConfig = vi.fn(async () => {
      configCalls += 1;
      if (configCalls === 2) throw new Error('DPAPI custody unavailable');
      return {
        hubUrl: 'https://hub.example.com',
        activeServerId: null,
        connectionMode: 'hub'
      };
    });
    const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
    setElectronApi(api);
    const container = await bootIntoFailureScreen();
    try {
      expect(container.querySelector('button')).not.toBeNull();
      container.querySelector('button')!.click();
      // Retry check passed, resumed boot() re-checked the gate and then died
      // at its own config IPC before ever mounting.
      await vi.waitFor(() => expect(configCalls).toBe(2));
      expect(api.checkServerVersion).toHaveBeenCalledTimes(2);
      expect(mountSpy).not.toHaveBeenCalled();
      // The failure is loud, not swallowed…
      await vi.waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          '[Boot] Resumed boot failed:',
          expect.objectContaining({ message: 'DPAPI custody unavailable' })
        )
      );
      // …and the surface stays live: same button, back in the document,
      // re-armed. On parent this assertion is the strand: disabled forever.
      const button = container.querySelector('button')!;
      await vi.waitFor(() => expect(button.disabled).toBe(false));
      expect(button.isConnected).toBe(true);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      // Genuinely interactive: a second click drives the boot to the mount.
      button.click();
      await vi.waitFor(() => expect(mountSpy).toHaveBeenCalledWith('#phlix-app'));
      expect(api.checkServerVersion).toHaveBeenCalledTimes(4);
    } finally {
      errorSpy.mockRestore();
      container.remove();
    }
  });

  it('a resumed boot that fails only after the mount leaves the app-owned DOM untouched and never resurrects the stale screen', async () => {
    const api = makeGateApi([TOO_OLD, OK_VERDICT, OK_VERDICT]);
    const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
    setElectronApi(api);
    const container = await bootIntoFailureScreen();
    try {
      const button = container.querySelector('button')!;
      // The pre-existing "mount threw" residual class: the mount takes the
      // container and THEN fails. The app owns the window from that moment —
      // the catch must log without repainting a stale screen over it, and the
      // isConnected guard must never re-arm an off-document button.
      mountSpy.mockImplementationOnce(() => {
        container.replaceChildren();
        const owned = document.createElement('div');
        owned.id = 'app-owned-after-throw';
        container.appendChild(owned);
        throw new Error('overlay init failed after mount');
      });
      button.click();
      await vi.waitFor(() => expect(mountSpy).toHaveBeenCalledWith('#phlix-app'));
      await vi.waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          '[Boot] Resumed boot failed:',
          expect.objectContaining({ message: 'overlay init failed after mount' })
        )
      );
      // App DOM survives; no boot-failure screen resurrected over it.
      expect(container.querySelector('#app-owned-after-throw')).not.toBeNull();
      expect(container.querySelector('[role="alert"]')).toBeNull();
      // Guard teeth (mutation M-r2b, stripping isConnected): an off-document
      // button is left exactly as it was, not silently re-armed.
      expect(button.isConnected).toBe(false);
      expect(button.disabled).toBe(true);
    } finally {
      errorSpy.mockRestore();
      container.remove();
      mountSpy.mockReset();
    }
  });

  it('failure surface renders a hostile reported version as text only and echoes no credentials', async () => {
    const hostile = { ...TOO_OLD, serverVersion: '<img src=x onerror="steal(document.tokens)">' };
    const api = makeGateApi([hostile]);
    setElectronApi(api);
    const tokenStub = 'tok-SUPERSECRET-8f2c1d';
    localStorage.setItem('phlix.token', tokenStub);
    const container = await bootIntoFailureScreen();
    try {
      // Network input is never parsed as HTML…
      expect(container.querySelector('img')).toBeNull();
      // …but is shown verbatim, so the operator can see exactly what the
      // server reported.
      expect(container.textContent).toContain('onerror');
      // No credential reaches the surface, and the gate call carries ONLY
      // the base URL — no token, no header.
      expect(container.textContent).not.toContain(tokenStub);
      expect(container.innerHTML).not.toContain(tokenStub);
      expect(api.checkServerVersion.mock.calls[0]).toEqual(['https://hub.example.com']);
    } finally {
      container.remove();
      localStorage.removeItem('phlix.token');
    }
  });

  it('census: the version gate leaves no silent pre-mount abort path (static shape pin)', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/renderer/main.ts'), 'utf8');
    // The pre-fix arm logged 'aborting boot' and returned into the dark
    // window — that wording is the permanent regression tripwire.
    expect(source).not.toContain('aborting boot');
    const gate = source.match(/if \(!versionCheck\.compatible\) \{([\s\S]*?)\n {4}\}/);
    expect(gate, 'version-gate block not found — boot() changed shape; re-run the silent-abort census').not.toBeNull();
    // The only pre-mount return on this path must be preceded by rendering.
    expect(gate![1]).toContain('renderIncompatibleServerScreen(versionCheck');
    expect(gate![1]).toMatch(/return;/);
    // boot()'s other pre-mount early exit is the browser-dev-context guard
    // (`if (api)` skips the gate entirely and mounts); every remaining path
    // to mount is straight-line. Restated: NO silent-return arm exists
    // outside the rendered one — the retry-failure branch above cannot
    // return early either (it re-renders or re-runs boot()).
  });

  it('uses the persisted direct server URL when hub is not configured', async () => {
    const api = {
      hubGetConfig: vi.fn(async () => ({
        hubUrl: null,
        activeServerId: null,
        connectionMode: 'direct'
      })),
      getDeviceId: vi.fn(async () => 'device-xyz'),
      getServerUrl: vi.fn(async () => 'http://my-server:8096'),
      checkServerVersion: vi.fn(async () => ({ compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' }))
    };
    setElectronApi(api);

    const mod = await import('@/main');
    await mod.boot();

    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: 'http://my-server:8096' })
    );
    // M-WINDOWS-04 rider, second leg: the wsUrl socket hint rides BOTH the
    // config and the live window mirror — socketHint.ts reads the global at
    // every dial, so this is what makes the vendored /app/syncplay page
    // connect to the real server host instead of the app:// dead origin.
    const cfg = (createPhlixApp.mock.calls as any).at(-1)?.[0] as Record<string, unknown>;
    expect(cfg).toHaveProperty('wsUrl', 'ws://my-server:8097');
    expect((getWindow().window as unknown as { __PHLIX__?: { wsUrl?: string | null } }).__PHLIX__)
      .toMatchObject({ wsUrl: 'ws://my-server:8097' });
    expect(installElectronBridge).toHaveBeenLastCalledWith(fakeApp);
  });

  it('falls back to browser defaults when window.electronAPI is undefined', async () => {
    clearElectronApi();
    vi.stubEnv('VITE_PHLIX_SERVER_URL', '');
    const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => {});

    const mod = await import('@/main');
    await mod.boot();

    // Browser fallback: no api → app:'server', per-session UUID device ID (not a
    // shared constant), and an EMPTY base → @phlix/ui shows the first-run Connect screen.
    expect(warnSpy).toHaveBeenCalledWith(
      '[Phlix] Electron bridge unavailable — using per-session device ID:',
      expect.stringMatching(/^browser-[0-9a-f-]{36}$/)
    );
    const deviceIdArg = (buildPhlixHeaders.mock.calls as any).at(-1)?.[0]?.deviceId as string;
    expect(deviceIdArg).toMatch(/^browser-[0-9a-f-]{36}$/);
    expect(buildPhlixHeaders).toHaveBeenLastCalledWith({
      deviceId: deviceIdArg,
      deviceName: 'Phlix for Windows',
      deviceType: 'windows'
    });
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: '', requireConnection: true })
    );
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
    expect(installElectronBridge).toHaveBeenLastCalledWith(fakeApp);

    warnSpy.mockRestore();
  });

  it('reports a warning when onConnectionChange is called without a bridge', async () => {
    clearElectronApi();
    vi.stubEnv('VITE_PHLIX_SERVER_URL', 'http://env-server:8096');

    const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => {});

    const mod = await import('@/main');
    await mod.boot();

    // Pull the onConnectionChange callback and exercise the missing-bridge path.
    const cfg = (createPhlixApp.mock.calls as any).at(-1)?.[0] as {
      onConnectionChange: (url: string | null) => void;
    };
    cfg.onConnectionChange('http://chosen:8096');

    // m20: one template string, the URL already reduced to scheme+host.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot persist server URL: Electron bridge unavailable, URL was: http://chosen:8096')
    );

    warnSpy.mockRestore();
  });

  it('uses the build-time env URL as the browser fallback base', async () => {
    clearElectronApi();
    vi.stubEnv('VITE_PHLIX_SERVER_URL', 'http://env-server:8096');

    const mod = await import('@/main');
    await mod.boot();

    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: 'http://env-server:8096' })
    );
  });

  it('mirrors a Connect-screen choice back into Electron-store via setServerUrl', async () => {
    const api = {
      hubGetConfig: vi.fn(async () => ({ hubUrl: null, activeServerId: null, connectionMode: 'direct' })),
      getDeviceId: vi.fn(async () => 'device-1'),
      getServerUrl: vi.fn(async () => null),
      setServerUrl: vi.fn(async () => {}),
      checkServerVersion: vi.fn(async () => ({ compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' }))
    };
    setElectronApi(api);

    const mod = await import('@/main');
    await mod.boot();

    // Pull the onConnectionChange callback handed to @phlix/ui and exercise it.
    const cfg = (createPhlixApp.mock.calls as any).at(-1)?.[0] as {
      onConnectionChange: (url: string | null) => void;
    };
    cfg.onConnectionChange('http://chosen:8096');
    expect(api.setServerUrl).toHaveBeenCalledWith('http://chosen:8096');
    // M-WINDOWS-04 rider, second leg: the live hint follows the choice —
    // boot started seam-free (serverUrl null → wsUrl null), the callback
    // rewrites it, and socketHint picks the new value up on the NEXT dial.
    const hintWindow = () => (getWindow().window as unknown as { __PHLIX__?: { wsUrl?: string | null } }).__PHLIX__;
    expect(hintWindow()).toMatchObject({ wsUrl: 'ws://chosen:8097' });
    // A clear (null) writes an empty string so resolveAppConfig re-seeds cleanly.
    cfg.onConnectionChange(null);
    expect(api.setServerUrl).toHaveBeenLastCalledWith('');
    expect(hintWindow()).toMatchObject({ wsUrl: null });
  });
});

describe('buildMenu', () => {
  it('server mode: Browse, Music, Books, Audiobooks, Photos, Search, Watch History, Explore, Recommendations, SyncPlay, Settings, Admin', async () => {
    const { buildMenu, buildExtraRoutes } = await import('@/main');
    const menu = buildMenu('server');
    const menuIds = menu.map((m) => m.id);

    // EXACT ARRAY FORM WAS HARMFUL: locking the nav list as a frozen 3-item array
    // made every new nav entry a breaking-change test-failure.  The assertions below
    // express intent — every required entry is present and its route is registered —
    // so legitimate new entries do not demand a test update.

    // Membership: all entries required for a usable server-mode nav are present.
    for (const id of ['browse', 'music', 'books', 'audiobooks', 'photos', 'search',
                       'history', 'explore', 'recommendations', 'syncplay', 'settings', 'admin']) {
      expect(menuIds).toContain(id);
    }

    // Reachability: every registered route in the menu has a corresponding route
    // in buildExtraRoutes (browse's "/" is handled by the shell; admin is added by
    // buildAdminRoutes; media-type/library entries come from @phlix/ui).
    const extraRoutePaths = buildExtraRoutes('server').map((r) => r.path);
    for (const item of menu) {
      if (!item.to) continue;
      if (item.to === '/app') continue; // browse root: shell handles this
      // buildMenu registers paths under /app/* that must appear in buildExtraRoutes
      if (item.to.startsWith('/app/') && !item.to.startsWith('/app/music') &&
          !item.to.startsWith('/app/books') && !item.to.startsWith('/app/audiobooks') &&
          !item.to.startsWith('/app/photo') && !item.to.startsWith('/app/search') &&
          !item.to.startsWith('/app/history') && !item.to.startsWith('/app/explore') &&
          !item.to.startsWith('/app/recommendations') &&
          // M-WINDOWS-04 second leg: the SyncPlay route is registered by the
          // vendored shell (ui router), not by buildExtraRoutes — same skip-list
          // family as the ui-provided history/explore/recommendations above.
          !item.to.startsWith('/app/syncplay') &&
          !item.to.startsWith('/app/settings')) {
        expect(extraRoutePaths).toContain(item.to);
      }
    }

    expect(menu.find((m) => m.id === 'browse')?.libraryLinks).toBe(true);
    expect(menu.find((m) => m.id === 'music')).toMatchObject({ to: '/app/music', requiresLibraryType: 'music' });
    expect(menu.find((m) => m.id === 'books')).toMatchObject({ to: '/app/books', requiresLibraryType: 'book' });
    expect(menu.find((m) => m.id === 'audiobooks')).toMatchObject({ to: '/app/audiobooks', requiresLibraryType: 'audiobook' });
    expect(menu.find((m) => m.id === 'photos')).toMatchObject({ to: '/app/photo/albums', requiresLibraryType: 'photo' });
    expect(menu.find((m) => m.id === 'search')).toMatchObject({ to: '/app/search' });
    expect(menu.find((m) => m.id === 'history')).toMatchObject({ to: '/app/history' });
    expect(menu.find((m) => m.id === 'explore')).toMatchObject({ to: '/app/explore' });
    expect(menu.find((m) => m.id === 'recommendations')).toMatchObject({ to: '/app/recommendations' });
    // M-WINDOWS-04 rider, second leg (v0.99.12 wave): the desktop nav entry —
    // present ONLY in server mode, its hub counterpart pinned below.
    expect(menu.find((m) => m.id === 'syncplay')).toMatchObject({ to: '/app/syncplay' });
    expect(menu.find((m) => m.id === 'settings')).toMatchObject({ to: '/app/settings' });
    const admin = menu.find((m) => m.id === 'admin');
    expect(admin).toMatchObject({ to: '/app/admin/dashboard', requiresAdmin: true });
  });

  it('hub mode: My Servers, Federation, Shares, Watch History, Explore, Recommendations, admin-gated Admin', async () => {
    const { buildMenu, buildExtraRoutes } = await import('@/main');
    const menu = buildMenu('hub');
    const menuIds = menu.map((m) => m.id);

    // EXACT ARRAY FORM WAS HARMFUL: locking the hub nav list as a frozen 10-item
    // array made every new hub nav entry a breaking-change test-failure.

    // Membership: all entries required for a usable hub-mode nav are present.
    for (const id of ['my-servers', 'federation', 'manage-shares', 'shared-with-me',
                       'invite-links', 'history', 'explore', 'recommendations', 'admin']) {
      expect(menuIds).toContain(id);
    }

    // Reachability: hub-only menu entries that have /app/* routes must appear in
    // buildExtraRoutes (history/explore/recommendations come from @phlix/ui).
    const extraRoutePaths = buildExtraRoutes('hub').map((r) => r.path);
    for (const item of menu) {
      if (!item.to) continue;
      if (item.to.startsWith('/app/') && !item.to.startsWith('/app/history') &&
          !item.to.startsWith('/app/explore') && !item.to.startsWith('/app/recommendations')) {
        expect(extraRoutePaths).toContain(item.to);
      }
    }

    expect(menu.find((m) => m.id === 'history')).toMatchObject({ to: '/app/history' });
    expect(menu.find((m) => m.id === 'explore')).toMatchObject({ to: '/app/explore' });
    expect(menu.find((m) => m.id === 'recommendations')).toMatchObject({ to: '/app/recommendations' });
    expect(menu.find((m) => m.id === 'admin')?.requiresAdmin).toBe(true);
    // M-WINDOWS-04 rider, leg 4: watch-party nav is SERVER-mode only. The hub
    // transport runs the :8804 relay and the same wsUrl seam would override
    // relay dials wholesale (upstream hubRelay.ts) — no hub entry until
    // relay-aware evidence lands. This pin FAILS if someone adds one casually.
    expect(menuIds).not.toContain('syncplay');
  });

  it('hub entries appear only in hub mode — server mode must not include them', async () => {
    const { buildMenu } = await import('@/main');
    const serverMenuIds = buildMenu('server').map((m) => m.id);
    // These entries are hub-only and must not leak into server mode
    const hubOnlyIds = ['my-servers', 'federation', 'manage-shares', 'shared-with-me', 'invite-links'];
    for (const id of hubOnlyIds) {
      expect(serverMenuIds).not.toContain(id);
    }
  });
});

// ---------------------------------------------------------------------------
// M-WINDOWS-04 rider, second leg (tag-wave C4, @phlix/ui v0.99.12): the
// SyncPlay socket-hint derivation. Upstream socketHint.ts accepts a valid
// window.__PHLIX__.wsUrl over EVERY same-origin derivation, grammar
// /^wss?:\/\/[^/?#@]+$/i — anything else (malformed, absent, null) is NO_HINT
// and the vendored dial stays byte-identical to pre-seam builds. These pins
// hold deriveSyncPlayWsUrl inside that contract.
// ---------------------------------------------------------------------------
describe('deriveSyncPlayWsUrl (SyncPlay socket hint)', () => {
  const SEAM_GRAMMAR = /^wss?:\/\/[^/?#@]+$/i;

  it('maps http→ws and https→wss, pinning :8097 regardless of the server port', async () => {
    const { deriveSyncPlayWsUrl } = await import('@/main');
    expect(deriveSyncPlayWsUrl('http://my-server:8096')).toBe('ws://my-server:8097');
    expect(deriveSyncPlayWsUrl('https://media.example.com')).toBe('wss://media.example.com:8097');
    expect(deriveSyncPlayWsUrl('https://media.example.com:9443/base')).toBe('wss://media.example.com:8097');
  });

  it('output satisfies the upstream seam grammar (no path/query/userinfo survives)', async () => {
    const { deriveSyncPlayWsUrl } = await import('@/main');
    const hint = deriveSyncPlayWsUrl('http://user:pw@evil.example:1/top?q=1');
    expect(hint).toBe('ws://evil.example:8097');
    expect(hint).toMatch(SEAM_GRAMMAR);
  });

  it('fail-soft to null on anything unusable — the legacy dial stays byte-identical', async () => {
    const { deriveSyncPlayWsUrl } = await import('@/main');
    expect(deriveSyncPlayWsUrl(null)).toBeNull();
    expect(deriveSyncPlayWsUrl('')).toBeNull();
    expect(deriveSyncPlayWsUrl('not a url')).toBeNull();
    expect(deriveSyncPlayWsUrl('ftp://host:8096')).toBeNull();
    expect(deriveSyncPlayWsUrl('app://-/')).toBeNull();
  });
});

describe('buildExtraRoutes', () => {
  it('server mode: admin section + the library-scan route', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes('server').map((r) => r.name);
    expect(names).toContain('admin-dashboard');
    expect(names).toContain('library-scan');
    // L-4 follow-up: the scan route is admin-gated (see library-scan-route.test.ts).
    expect(buildExtraRoutes('server').find((r) => r.name === 'library-scan')?.meta).toEqual({
      requiresAdmin: true
    });
  });

  it('hub mode: hub pages + the hub admin section', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes('hub').map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['my-servers', 'server-detail', 'federation', 'federation-shares', 'manage-shares', 'shared-with-me', 'invite-links', 'accept-invite', 'hub-admin-dashboard'])
    );
  });
});

// M4 (review windows exploiter #1 / crossfe #1 / secnet M1): boot() must wire
// the DPAPI vault TokenStore into createPhlixApp when the bridge is live,
// fold pre-wiring plaintext rows across (vault-wins, plaintext cleared only on
// a CONFIRMED seal), and omit the key entirely for bridge-less boots.
describe('M4 vault token custody wiring (boot)', () => {
  function makeVaultApi(opts: { failSeal?: boolean } = {}) {
    const sealed = new Map<string, string>();
    const api = {
      hubGetConfig: vi.fn(async () => ({ hubUrl: null, activeServerId: null, connectionMode: 'server' })),
      getDeviceId: vi.fn(async () => 'device-vault'),
      getServerUrl: vi.fn(async () => 'http://srv.example:8096'),
      checkServerVersion: vi.fn(async () => ({ compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' })),
      setServerUrl: vi.fn(async () => {}),
      vaultGet: (k: string) => sealed.get(k) ?? null,
      vaultSet: (k: string, v: string) => {
        if (opts.failSeal) return false; // seal silently never lands
        sealed.set(k, v);
        return true;
      },
      vaultDelete: (k: string) => {
        sealed.delete(k);
        return true;
      },
      vaultIsAvailable: () => true
    };
    return { api, sealed };
  }

  it('passes SafeStorageTokenStore through the config and folds plaintext rows', async () => {
    const { SafeStorageTokenStore } = await import('@/safeStorageTokenStore');
    const { api, sealed } = makeVaultApi();
    setElectronApi(api);
    localStorage.setItem('access_token', 'PLAIN-ACCESS');
    localStorage.setItem('refresh_token', 'PLAIN-REFRESH');
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));

    const mod = await import('@/main');
    await mod.boot();

    const cfg = (createPhlixApp.mock.calls as any).at(-1)?.[0] as Record<string, unknown>;
    expect(cfg.tokenStore).toBeInstanceOf(SafeStorageTokenStore);
    expect(sealed.get('ui.access_token')).toBe('PLAIN-ACCESS');
    expect(sealed.get('ui.refresh_token')).toBe('PLAIN-REFRESH');
    expect(sealed.get('ui.user')).toBe(JSON.stringify({ id: 'u1' }));
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('vault value wins over a stale plaintext row; plaintext is still cleared', async () => {
    const { api, sealed } = makeVaultApi();
    sealed.set('ui.access_token', 'VAULT-KEEP');
    setElectronApi(api);
    localStorage.setItem('access_token', 'PLAIN-STALE');

    const mod = await import('@/main');
    await mod.boot();

    expect(sealed.get('ui.access_token')).toBe('VAULT-KEEP');
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('an unconfirmable seal PRESERVES the plaintext row (no orphaned session) and boot proceeds', async () => {
    const { api } = makeVaultApi({ failSeal: true });
    setElectronApi(api);
    localStorage.setItem('access_token', 'PLAIN-KEEP');

    const mod = await import('@/main');
    await mod.boot();

    expect(createPhlixApp).toHaveBeenCalled();
    expect(localStorage.getItem('access_token')).toBe('PLAIN-KEEP');
  });

  it('bridge-less boot (no vault* on the API) omits the tokenStore key', async () => {
    const api = {
      hubGetConfig: vi.fn(async () => ({ hubUrl: null, activeServerId: null, connectionMode: 'server' })),
      getDeviceId: vi.fn(async () => 'device-novault'),
      getServerUrl: vi.fn(async () => 'http://srv.example:8096'),
      checkServerVersion: vi.fn(async () => ({ compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' })),
      setServerUrl: vi.fn(async () => {})
    };
    setElectronApi(api);

    const mod = await import('@/main');
    await mod.boot();

    const cfg = (createPhlixApp.mock.calls as any).at(-1)?.[0] as Record<string, unknown>;
    expect(cfg).not.toHaveProperty('tokenStore');
  });
});

// m7(a) (review casualgamer #4): boot() fail-fasts by design, but until this
// batch the auto-boot arm discarded the rejection — a main-side throw left the
// pre-JS splash spinning forever. Surface = renderBootFailure + its call site.
describe('m7 boot-failure surface (renderBootFailure)', () => {
  it('replaces the splash with the catalog panel, carries Retry, and is idempotent', async () => {
    const mod = await import('@/main');
    const splash = document.createElement('div');
    splash.id = 'boot-splash';
    document.body.appendChild(splash);
    try {
      mod.renderBootFailure();
      const panel = document.getElementById('boot-failure');
      expect(panel, 'panel did not mount').toBeTruthy();
      expect(document.getElementById('boot-splash'), 'splash must retire').toBeNull();
      expect(panel!.textContent).toContain('Phlix could not start');
      const button = panel!.querySelector('button');
      expect(button, 'panel must carry a Retry affordance').toBeTruthy();
      expect(button!.textContent).toBe('Try again');
      expect(panel!.getAttribute('role')).toBe('alert');
      // windows__gameux 5[m] (MW-089): same focus-by-construction law as the
      // incompatible screen — the panel's Retry owns the keyboard.
      expect(document.activeElement, 'Retry must own keyboard focus at render').toBe(button);
      mod.renderBootFailure();
      expect(document.querySelectorAll('#boot-failure').length).toBe(1);
    } finally {
      splash.remove();
      document.getElementById('boot-failure')?.remove();
    }
  });

  it('the auto-boot arm catches, and the Retry re-arms instead of stranding (M-WINDOWS-16 r2 discipline)', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/renderer/main.ts'), 'utf8');
    expect(source).toMatch(/void boot\(\)\.catch/);
    expect(source).toMatch(/retry\.disabled = true;/);
    expect(source).toMatch(/retry\.disabled = false;/);
    // No detail from the rejection reaches the screen — only the log keeps it.
    expect(source).toMatch(/renderBootFailure\(\)/);
    expect(source).not.toMatch(/renderBootFailure\([^)]*err/);
  });
});

describe('m3 hub-only deep-link refusal (server mode never 404s a link)', () => {
  // casualgamer #5: a friend's invite clicked while the window runs direct-
  // server mode routed to /app/accept-invite/{token} — a route registered
  // ONLY by hub mode's extraRoutes — landing on the shared shell's 404 page
  // *after* the app had already asked "Follow this Phlix link?". The cure
  // refuses hub-only paths with an explicit native notification naming the
  // mode mismatch. /app/server/:id is the same route family (same header
  // comment in src/renderer/main.ts).
  let pushSpy: ReturnType<typeof vi.fn>;
  let routerApp: unknown;
  beforeEach(() => {
    vi.resetModules();
    pushSpy = vi.fn();
    routerApp = {
      mount: mountSpy,
      config: { globalProperties: { $router: { isReady: () => Promise.resolve(), push: pushSpy } } }
    };
    createPhlixApp.mockClear().mockReturnValue(routerApp as never);
    buildPhlixHeaders.mockClear().mockReturnValue(FAKE_HEADERS);
    installElectronBridge.mockClear().mockReturnValue((() => {}) as any);
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  function makeLinkApi(mode: 'server' | 'hub') {
    const listeners: Array<(path: string) => void> = [];
    const api = {
      hubGetConfig: vi.fn(async () => ({
        hubUrl: mode === 'hub' ? 'https://hub.example.com' : null,
        activeServerId: null,
        connectionMode: mode
      })),
      getDeviceId: vi.fn(async () => 'device-m3'),
      getServerUrl: vi.fn(async () => 'http://srv.example:8096'),
      checkServerVersion: vi.fn(async () => ({ compatible: true, serverVersion: '2.0.0', minimumVersion: '1.1.0' })),
      setServerUrl: vi.fn(async () => {}),
      showNotification: vi.fn(async () => true),
      onDeeplink: vi.fn((cb: (path: string) => void) => {
        listeners.push(cb);
        return () => {};
      }),
      notifyDeeplinkReady: vi.fn()
    };
    setElectronApi(api);
    return { api, listeners };
  }

  it('server mode: an invite link notifies with the hub-mode explanation and never routes', async () => {
    const { api, listeners } = makeLinkApi('server');
    const mod = await import('@/main');
    await mod.boot();
    expect(listeners.length).toBeGreaterThan(0);
    listeners[0]('/app/accept-invite/abc123');
    await Promise.resolve(); await Promise.resolve();
    expect(api.showNotification).toHaveBeenCalledWith(
      'This link belongs to a Phlix Hub',
      expect.stringMatching(/^Invite links come from a Phlix Hub\./)
    );
    expect(pushSpy).not.toHaveBeenCalledWith('/app/accept-invite/abc123');
  });

  it('server mode: the /app/server/:id family is refused the same way', async () => {
    const { api, listeners } = makeLinkApi('server');
    const mod = await import('@/main');
    await mod.boot();
    listeners[0]('/app/server/7');
    await Promise.resolve(); await Promise.resolve();
    expect(api.showNotification).toHaveBeenCalledWith(
      'This link belongs to a Phlix Hub',
      expect.stringMatching(/^Server-card links belong to a Phlix Hub\./)
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('hub mode: the same invite link routes normally (no refusal)', async () => {
    const { api, listeners } = makeLinkApi('hub');
    const mod = await import('@/main');
    await mod.boot();
    listeners[0]('/app/accept-invite/abc123');
    await Promise.resolve(); await Promise.resolve();
    expect(pushSpy).toHaveBeenCalledWith('/app/accept-invite/abc123');
    expect(api.showNotification).not.toHaveBeenCalled();
  });

  it('server mode: ordinary media links still route (the gate is hub-only paths)', async () => {
    const { api, listeners } = makeLinkApi('server');
    const mod = await import('@/main');
    await mod.boot();
    listeners[0]('/app/media/tt0111161');
    await Promise.resolve(); await Promise.resolve();
    expect(pushSpy).toHaveBeenCalledWith('/app/media/tt0111161');
    expect(api.showNotification).not.toHaveBeenCalled();
  });
});
