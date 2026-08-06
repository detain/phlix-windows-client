import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  createPhlixApp: (...args: unknown[]) => createPhlixApp(...args),
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
  buildPhlixHeaders: (...args: unknown[]) => buildPhlixHeaders(...args)
}));

// Exportable mocks for electronBridge
const installElectronBridge = vi.fn(function() { return; });
const installSyncPlayBridge = vi.fn(function() { return; });
const useSyncPlayStore = vi.fn(() => ({
  setServerUrl: vi.fn(),
  setupWebSocketListeners: vi.fn(function() { return; })
}));

vi.mock('@/electronBridge', () => ({
  installElectronBridge: (...args: unknown[]) => installElectronBridge(...args),
  installSyncPlayBridge: (...args: unknown[]) => installSyncPlayBridge(...args)
}));

vi.mock('../../src/stores/useSyncPlayStore', () => ({
  useSyncPlayStore: () => useSyncPlayStore()
}));

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
    installElectronBridge.mockClear().mockReturnValue(() => {});
    installSyncPlayBridge.mockClear().mockReturnValue(() => {});
    useSyncPlayStore.mockClear();
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
      getServerUrl: vi.fn(async () => null)
    };
    setElectronApi(api);

    const mod = await import('@/main');
    // The module's top-level `void boot()` already ran on import; await it
    // settling, then call the exported boot directly to assert behaviour.
    await mod.boot();

    expect(api.hubGetConfig).toHaveBeenCalled();
    expect(api.getDeviceId).toHaveBeenCalled();
    expect(api.getServerUrl).toHaveBeenCalled();

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

  it('uses the persisted direct server URL when hub is not configured', async () => {
    const api = {
      hubGetConfig: vi.fn(async () => ({
        hubUrl: null,
        activeServerId: null,
        connectionMode: 'direct'
      })),
      getDeviceId: vi.fn(async () => 'device-xyz'),
      getServerUrl: vi.fn(async () => 'http://my-server:8096')
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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('@/main');
    await mod.boot();

    // Browser fallback: no api → app:'server', per-session UUID device ID (not a
    // shared constant), and an EMPTY base → @phlix/ui shows the first-run Connect screen.
    expect(warnSpy).toHaveBeenCalledWith(
      '[Phlix] Electron bridge unavailable — using per-session device ID:',
      expect.stringMatching(/^browser-[0-9a-f-]{36}$/)
    );
    const deviceIdArg = buildPhlixHeaders.mock.calls.at(-1)?.[0]?.deviceId as string;
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

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('@/main');
    await mod.boot();

    // Pull the onConnectionChange callback and exercise the missing-bridge path.
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
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
      setServerUrl: vi.fn(async () => {})
    };
    setElectronApi(api);

    const mod = await import('@/main');
    await mod.boot();

    // Pull the onConnectionChange callback handed to @phlix/ui and exercise it.
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
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
  it('server mode: Browse, Music, Books, Audiobooks, Photos, Search, Watch History, Explore, Recommendations, SyncPlay, Settings, Admin', async () => {
    const { buildMenu, buildExtraRoutes } = await import('@/main');
    const menu = buildMenu('server');
    const menuIds = menu.map((m) => m.id);

    // EXACT ARRAY FORM WAS HARMFUL: locking the nav list as a frozen 12-item array
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
      if (item.to === '/app') continue; // browse root: shell handles this
      // buildMenu registers paths under /app/* that must appear in buildExtraRoutes
      if (item.to.startsWith('/app/') && !item.to.startsWith('/app/music') &&
          !item.to.startsWith('/app/books') && !item.to.startsWith('/app/audiobooks') &&
          !item.to.startsWith('/app/photo') && !item.to.startsWith('/app/search') &&
          !item.to.startsWith('/app/history') && !item.to.startsWith('/app/explore') &&
          !item.to.startsWith('/app/recommendations') && !item.to.startsWith('/app/syncplay') &&
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
    expect(menu.find((m) => m.id === 'syncplay')).toMatchObject({ to: '/app/syncplay' });
    expect(menu.find((m) => m.id === 'settings')).toMatchObject({ to: '/app/settings' });
    const admin = menu.find((m) => m.id === 'admin');
    expect(admin).toMatchObject({ to: '/app/admin/dashboard', requiresAdmin: true });
  });

  it('hub mode: My Servers, Federation, Shares, Watch History, Explore, Recommendations, SyncPlay, admin-gated Admin', async () => {
    const { buildMenu, buildExtraRoutes } = await import('@/main');
    const menu = buildMenu('hub');
    const menuIds = menu.map((m) => m.id);

    // EXACT ARRAY FORM WAS HARMFUL: locking the hub nav list as a frozen 10-item
    // array made every new hub nav entry a breaking-change test-failure.

    // Membership: all entries required for a usable hub-mode nav are present.
    for (const id of ['my-servers', 'federation', 'manage-shares', 'shared-with-me',
                       'invite-links', 'history', 'explore', 'recommendations', 'syncplay', 'admin']) {
      expect(menuIds).toContain(id);
    }

    // Reachability: hub-only menu entries that have /app/* routes must appear in
    // buildExtraRoutes (history/explore/recommendations/syncplay come from @phlix/ui).
    const extraRoutePaths = buildExtraRoutes('hub').map((r) => r.path);
    for (const item of menu) {
      if (item.to.startsWith('/app/') && !item.to.startsWith('/app/history') &&
          !item.to.startsWith('/app/explore') && !item.to.startsWith('/app/recommendations') &&
          !item.to.startsWith('/app/syncplay')) {
        expect(extraRoutePaths).toContain(item.to);
      }
    }

    expect(menu.find((m) => m.id === 'history')).toMatchObject({ to: '/app/history' });
    expect(menu.find((m) => m.id === 'explore')).toMatchObject({ to: '/app/explore' });
    expect(menu.find((m) => m.id === 'recommendations')).toMatchObject({ to: '/app/recommendations' });
    expect(menu.find((m) => m.id === 'syncplay')).toMatchObject({ to: '/app/syncplay' });
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
  it('server mode: admin section + the library-scan route + parental-controls', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes('server').map((r) => r.name);
    expect(names).toContain('admin-dashboard');
    expect(names).toContain('library-scan');
    expect(names).toContain('parental-controls');
  });

  it('hub mode: hub pages + the hub admin section + parental-controls', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes('hub').map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['my-servers', 'server-detail', 'federation', 'federation-shares', 'manage-shares', 'shared-with-me', 'invite-links', 'accept-invite', 'hub-admin-dashboard', 'parental-controls'])
    );
  });
});
