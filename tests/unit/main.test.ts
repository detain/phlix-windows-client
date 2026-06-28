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
  // main.ts does not import usePlayerStore, but export a no-op so the mock is
  // safe even if the import surface grows.
  usePlayerStore: vi.fn(() => ({}))
}));

const FAKE_HEADERS = { 'X-Phlix-Device-ID': 'dev', 'X-Phlix-Device-Type': 'windows' };
const buildPhlixHeaders = vi.fn(() => FAKE_HEADERS);
vi.mock('@phlix/contracts', () => ({
  buildPhlixHeaders: (...args: unknown[]) => buildPhlixHeaders(...args)
}));

const installElectronBridge = vi.fn(() => () => {});
vi.mock('@/electronBridge', () => ({
  installElectronBridge: (...args: unknown[]) => installElectronBridge(...args)
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

    const mod = await import('@/main');
    await mod.boot();

    // Browser fallback: no api → app:'server', device 'windows-dev', and an EMPTY
    // base (no localhost guess) → @phlix/ui shows the first-run Connect screen.
    expect(buildPhlixHeaders).toHaveBeenLastCalledWith({
      deviceId: 'windows-dev',
      deviceName: 'Phlix for Windows',
      deviceType: 'windows'
    });
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: '', requireConnection: true })
    );
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
    expect(installElectronBridge).toHaveBeenLastCalledWith(fakeApp);
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
  it('server mode: Browse (libraryLinks) + Settings + admin-gated Admin', async () => {
    const { buildMenu } = await import('@/main');
    const menu = buildMenu('server');
    expect(menu.map((m) => m.id)).toEqual(['browse', 'settings', 'admin']);
    expect(menu.find((m) => m.id === 'browse')?.libraryLinks).toBe(true);
    const admin = menu.find((m) => m.id === 'admin');
    expect(admin).toMatchObject({ to: '/app/admin/dashboard', requiresAdmin: true });
  });

  it('hub mode: My Servers + Federation + Shares + admin-gated Admin', async () => {
    const { buildMenu } = await import('@/main');
    const menu = buildMenu('hub');
    expect(menu.map((m) => m.id)).toEqual(['my-servers', 'federation', 'manage-shares', 'admin']);
    expect(menu.find((m) => m.id === 'admin')?.requiresAdmin).toBe(true);
  });
});

describe('buildExtraRoutes', () => {
  it('server mode: admin section + the library-scan route', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes('server').map((r) => r.name);
    expect(names).toContain('admin-dashboard');
    expect(names).toContain('library-scan');
  });

  it('hub mode: hub pages + the hub admin section', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes('hub').map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['my-servers', 'federation', 'manage-shares', 'hub-admin-dashboard'])
    );
  });
});
