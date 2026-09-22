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
});
