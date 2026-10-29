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

    expect(warnSpy).toHaveBeenCalledWith(
      '[Phlix] Cannot persist server URL: Electron bridge unavailable, URL was:',
      'http://chosen:8096'
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
    // A clear (null) writes an empty string so resolveAppConfig re-seeds cleanly.
    cfg.onConnectionChange(null);
    expect(api.setServerUrl).toHaveBeenLastCalledWith('');
  });
});

describe('buildMenu', () => {
  it('server mode: Browse, Music, Books, Audiobooks, Photos, Search, Watch History, Explore, Recommendations, Settings, Admin', async () => {
    const { buildMenu, buildExtraRoutes } = await import('@/main');
    const menu = buildMenu('server');
    const menuIds = menu.map((m) => m.id);

    // EXACT ARRAY FORM WAS HARMFUL: locking the nav list as a frozen 3-item array
    // made every new nav entry a breaking-change test-failure.  The assertions below
    // express intent — every required entry is present and its route is registered —
    // so legitimate new entries do not demand a test update.

    // Membership: all entries required for a usable server-mode nav are present.
    for (const id of ['browse', 'music', 'books', 'audiobooks', 'photos', 'search',
                       'history', 'explore', 'recommendations', 'settings', 'admin']) {
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
