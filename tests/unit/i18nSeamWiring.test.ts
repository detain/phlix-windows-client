/**
 * Seam wiring proof: the renderer boot path must hand the locale-resolved
 * override map to createPhlixApp as `config.messages` — and must OMIT the key
 * entirely when there is nothing to override (the byte-identical-English
 * guarantee for the shipped configuration).
 *
 * createPhlixApp is mocked here (same pattern as tests/unit/main.test.ts) so we
 * can inspect the EXACT config object boot() assembles: env → resolveLocale() →
 * messagesForLocale() → createPhlixApp(config). The merge behavior once the map
 * is inside @phlix/ui is asserted against the real package in
 * tests/unit/rendererI18n.test.ts, and the full mounted render is covered by the
 * smoke workflow.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Module mocks (mirrors tests/unit/main.test.ts) --------------------------
vi.mock('@phlix/ui/style.css', () => ({}));
vi.mock('@phlix/ui/fonts.css', () => ({}));

const mountSpy = vi.fn();
const fakeApp = { mount: mountSpy };
const createPhlixApp = vi.fn(() => fakeApp);
const PageStub = { template: '<div />' };
vi.mock('@phlix/ui', () => ({
  createPhlixApp: createPhlixApp as never,
  buildAdminRoutes: () => [],
  buildHubAdminRoutes: () => [],
  LibraryScanPage: PageStub,
  MyServersPage: PageStub,
  FederationPage: PageStub,
  ManageSharesPage: PageStub,
  SharedWithMePage: PageStub,
  InviteLinksPage: PageStub,
  AcceptInvitePage: PageStub,
  FederationSharesPage: PageStub,
  ServerDetailPage: PageStub,
  usePlayerStore: vi.fn(() => ({}))
}));

vi.mock('@phlix/contracts', () => ({
  buildPhlixHeaders: vi.fn(() => ({ 'X-Phlix-Device-ID': 'dev' }))
}));

vi.mock('@/electronBridge', () => ({
  installElectronBridge: vi.fn(() => () => {})
}));

// Overlay needs full app context; irrelevant to the config seam.
vi.mock('@/overlay', () => ({}));

type WindowLike = { electronAPI?: unknown };
const getWindow = () => globalThis as unknown as { window: WindowLike };

function lastCreatePhlixAppConfig(): Record<string, unknown> {
  const calls = createPhlixApp.mock.calls as unknown[][];
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe('createPhlixApp messages wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    // No electronAPI: boot takes the browser-fallback path — still assembles
    // and passes the full PhlixAppConfig.
    getWindow().window = {} as WindowLike;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('passes the locale-resolved override map as config.messages', async () => {
    // vi.resetModules() gives every dynamic import a FRESH @/i18n instance;
    // register through that same fresh graph so boot() sees the registration
    // ('@/main' resolves './i18n' to the very module id imported here).
    const { registerLocaleOverrides } = await import('@/i18n');
    registerLocaleOverrides('zz', { common: { close: 'ZZZ-TEST' } });
    vi.stubEnv('VITE_PHLIX_LOCALE', 'zz');

    const mod = await import('@/main');
    await mod.boot();

    const config = lastCreatePhlixAppConfig();
    expect(config.messages).toEqual({ common: { close: 'ZZZ-TEST' } });
    expect(createPhlixApp).toHaveBeenCalled();
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
  });

  it('omits the messages key entirely when the locale has no overrides', async () => {
    vi.stubEnv('VITE_PHLIX_LOCALE', 'qq'); // registered nowhere

    const mod = await import('@/main');
    await mod.boot();

    const config = lastCreatePhlixAppConfig();
    expect('messages' in config).toBe(false);
    // The rest of the shipped config still flows.
    expect(config.app).toBe('server');
    expect(config.defaultTheme).toBe('nocturne');
  });

  it('omits the messages key for the shipped English configuration', async () => {
    // Default jsdom navigator.language is English; 'en' registers an empty map.
    const mod = await import('@/main');
    await mod.boot();

    expect('messages' in lastCreatePhlixAppConfig()).toBe(false);
  });

  it('passes the vendored es bundle through as config.messages (registry-driven)', async () => {
    // No test-side registration: the REAL six-bundle registry installed at
    // module load must be what boot hands the seam.
    const { LOCALE_MESSAGES } = await import('@/i18n/ui-locale-bundles');
    vi.stubEnv('VITE_PHLIX_LOCALE', 'es');

    const mod = await import('@/main');
    await mod.boot();

    expect(lastCreatePhlixAppConfig().messages as unknown).toBe(LOCALE_MESSAGES.es);
  });
});

/**
 * R-review fix F2: buildMenu's labels are client-supplied MenuItem.label raw
 * strings the ui seam cannot reach — they now come from the windows-own
 * catalog. The English table below is copied VERBATIM from the literals that
 * buildMenu hardcoded before feat/i18n-locales: any drift goes red.
 */
const ORIGINAL_RENDERER_NAV_LABELS: Record<string, string> = {
  'my-servers': 'My Servers',
  federation: 'Federation',
  'manage-shares': 'Shares',
  'shared-with-me': 'Shared with Me',
  'invite-links': 'Invite Links',
  history: 'Watch History',
  explore: 'Explore',
  recommendations: 'Recommendations',
  admin: 'Admin',
  browse: 'Browse',
  music: 'Music',
  books: 'Books',
  audiobooks: 'Audiobooks',
  photos: 'Photos',
  search: 'Search',
  settings: 'Settings'
};

describe('buildMenu windows-own nav labels', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the 16 English labels byte-identically by default', async () => {
    const { setWindowLocale } = await import('@/i18n/windows-own');
    setWindowLocale('en');
    const { buildMenu } = await import('@/main');

    for (const item of [...buildMenu('server'), ...buildMenu('hub')]) {
      expect(item.label, `label drift at nav id '${item.id}'`).toBe(ORIGINAL_RENDERER_NAV_LABELS[item.id]);
    }
  });

  it('switches every label when the windows-own locale changes (es proof)', async () => {
    const { setWindowLocale } = await import('@/i18n/windows-own');
    const { WIN_ES } = await import('@/i18n/windows-own/es');
    setWindowLocale('es');
    const { buildMenu } = await import('@/main');

    const server = Object.fromEntries(buildMenu('server').map((m) => [m.id, m.label]));
    const hub = Object.fromEntries(buildMenu('hub').map((m) => [m.id, m.label]));
    expect(server.browse).toBe(WIN_ES.nav.browse);
    expect(server.settings).toBe(WIN_ES.nav.settings);
    expect(server.history).toBe(WIN_ES.nav.history);
    expect(hub['my-servers']).toBe(WIN_ES.nav.myServers);
    expect(hub['shared-with-me']).toBe(WIN_ES.nav.sharedWithMe);

    setWindowLocale('en'); // leave the default state for any later test in-file
  });
});
