/**
 * Deep-link grammar ↔ router table contract guard.
 *
 * Review windows__casualgamer C1 / windows__crossfe C1: the parser used to emit
 * unprefixed paths (`/accept-invite/{token}`, `/media/{id}`, `/play/{id}`,
 * `/server/{id}`) that matched NOTHING but the 404 catch-all under the '/app'
 * history base — every OS deep link silently dead-ended. The reachability
 * guard (routeReachability.test.ts) only checks the OTHER direction
 * (registered routes have a way in), so CI could not see this.
 *
 * This file closes the loop: every supported deep-link kind is parsed through
 * the real parser and resolved against a REAL router built exactly the way
 * src/renderer/main.ts builds it (createPhlixApp + buildExtraRoutes('hub')).
 * Resolution must land on the concrete view record — never on the catch-all.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi } from 'vitest';
import { createPhlixApp } from '@phlix/ui';
import { buildExtraRoutes } from '@/main';
import { parseDeepLinkUrl } from '../../src/main/deepLinkValidator';

// The parser logs rejections via electron-log (main-process module).
vi.mock('electron-log', () => ({
  default: {
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

/** Router built identically to the hub-mode boot path. */
function hubRouter(): import('vue-router').Router {
  const app = createPhlixApp({
    app: 'hub',
    apiBase: 'http://localhost:8096',
    menu: [],
    extraRoutes: buildExtraRoutes('hub'),
    requireConnection: true
  });
  return app.config.globalProperties.$router as import('vue-router').Router;
}

/** Router built identically to the SERVER-mode boot path (the mode desktop
 *  actually runs in until M-WINDOWS-16 wires hub config — windows__gameux M6). */
function serverRouter(): import('vue-router').Router {
  const app = createPhlixApp({
    app: 'server',
    apiBase: 'http://localhost:8096',
    menu: [],
    extraRoutes: buildExtraRoutes('server'),
    requireConnection: true
  });
  return app.config.globalProperties.$router as import('vue-router').Router;
}

interface DeepLinkCase {
  /** The OS-facing link. */
  url: string;
  /** What the parser must return. */
  routePath: string;
  /** The concrete registered route record template it must resolve to. */
  recordPath: string;
  /** Route param the target record carries ('' = static route). */
  paramName: string;
  paramValue: string;
}

const CASES: DeepLinkCase[] = [
  {
    url: 'phlix://media/abc-123',
    routePath: '/app/media/abc-123',
    recordPath: '/app/media/:id',
    paramName: 'id',
    paramValue: 'abc-123'
  },
  {
    // The ui router ships NO '/play/:id' record — playback lives at player.
    url: 'phlix://play/episode-456',
    routePath: '/app/player/episode-456',
    recordPath: '/app/player/:id',
    paramName: 'id',
    paramValue: 'episode-456'
  },
  {
    url: 'phlix://accept-invite/tok_en-1',
    routePath: '/app/accept-invite/tok_en-1',
    recordPath: '/app/accept-invite/:token',
    paramName: 'token',
    paramValue: 'tok_en-1'
  },
  {
    url: 'phlix://server/srv-9',
    routePath: '/app/server/srv-9',
    recordPath: '/app/server/:id',
    paramName: 'id',
    paramValue: 'srv-9'
  },
  {
    // The internal arm is prefixed by its producers (notification clickActions);
    // pinned so a regression here cannot hide behind the other arms.
    url: 'phlix://internal/app/settings',
    routePath: '/app/settings',
    recordPath: '/app/settings',
    paramName: '',
    paramValue: ''
  }
];

describe('deep-link ↔ router contract (C1 guard)', () => {
  it.each(CASES)('$url resolves to a concrete view record, not the 404 catch-all', (c) => {
    expect(parseDeepLinkUrl(c.url)).toBe(c.routePath);

    const resolved = hubRouter().resolve(c.routePath);
    expect(resolved.matched.length, `no record matched ${c.routePath}`).toBeGreaterThan(0);

    const deepest = resolved.matched[resolved.matched.length - 1];
    expect(deepest.path, `${c.routePath} fell through to a different record`).toBe(c.recordPath);
    expect(deepest.path).not.toMatch(/:pathMatch/);
    if (c.paramName) {
      expect(resolved.params[c.paramName]).toBe(c.paramValue);
    }
  });

  it('the legacy unprefixed outputs matched NOTHING at all (the C1 bug shape)', () => {
    // Stronger than a 404-page fallthrough: the catch-all record itself lives
    // under the '/app' base (`/app/:pathMatch(.*)*`), so the old parser output
    // resolved to zero records and router.push() rejected unhandled.
    const router = hubRouter();
    for (const dead of ['/media/abc', '/play/abc', '/accept-invite/abc', '/server/abc']) {
      expect(router.resolve(dead).matched.length, `${dead} unexpectedly matched a record`).toBe(0);
    }
    // And any UNMATCHED path that does live under /app lands on the catch-all —
    // the only surface where the prefix contract protects the user.
    const fallthrough = router.resolve('/app/nonexistent-view').matched;
    expect(fallthrough[fallthrough.length - 1].path).toMatch(/:pathMatch/);
  });

  it('the accept-invite record feeds the vendored page its token prop', () => {
    // @phlix/ui AcceptInvitePage declares `token` as a PROP (v0.99.10
    // src/pages/AcceptInvitePage.vue); vue-router only populates props from a
    // `:token` param when the record opts into `props: true`.
    const record = buildExtraRoutes('hub').find((r) => r.name === 'accept-invite');
    expect(record).toBeDefined();
    expect(record?.path).toBe('/app/accept-invite/:token');
    expect(record?.props).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M-WINDOWS-15 (windows__gameux M4): every ACCEPTED deep link must resolve to
// a RENDERED surface in BOTH app modes — concrete record where the route
// exists, the '/app/:pathMatch(.*)*' 404 view where the current mode does not
// register it (hub-only invite/server in server mode). What must never happen
// is the pre-cure shape: zero matched records → router.push() rejects
// unhandled → the link is a silent no-op.
// ---------------------------------------------------------------------------

/** Deepest record a path falls onto, or '' when NOTHING matches (the bug shape). */
function deepestMatchedPath(router: import('vue-router').Router, path: string): string {
  const matched = router.resolve(path).matched;
  return matched.length > 0 ? matched[matched.length - 1].path : '';
}

describe('M-WINDOWS-15 mode matrix — no parser output dead-ends in either mode', () => {
  // Routes the SERVER-mode router genuinely owns (ui core + this repo's
  // server extraRoutes). These must land on the concrete record in BOTH modes.
  const BOTH_MODE_CONCRETE: Array<{ url: string; recordPath: string }> = [
    { url: 'phlix://media/m-1', recordPath: '/app/media/:id' },
    { url: 'phlix://play/p-1', recordPath: '/app/player/:id' },
    { url: 'phlix://internal/app/settings', recordPath: '/app/settings' },
    { url: 'phlix://internal/app', recordPath: '/app' }
  ];

  it.each(BOTH_MODE_CONCRETE)('$url → concrete record in both modes', (c) => {
    const path = parseDeepLinkUrl(c.url);
    expect(typeof path).toBe('string');
    expect(deepestMatchedPath(hubRouter(), path!)).toBe(c.recordPath);
    expect(deepestMatchedPath(serverRouter(), path!)).toBe(c.recordPath);
  });

  // invite/server are hub-mode extraRoutes. In server mode they cannot land on
  // a concrete view — but they MUST land on the rendered 404 catch-all, never
  // on zero records. (Reaching the concrete invite view in server mode is
  // M-WINDOWS-16's hub-mode cure, not this grammar contract.)
  const HUB_ONLY: string[] = ['phlix://accept-invite/tok-1', 'phlix://server/s-1'];

  it.each(HUB_ONLY)('$url → concrete in hub, rendered 404 catch-all in server mode', (url) => {
    const path = parseDeepLinkUrl(url);
    expect(typeof path).toBe('string');
    expect(deepestMatchedPath(hubRouter(), path!)).not.toBe('');
    expect(deepestMatchedPath(hubRouter(), path!)).not.toMatch(/:pathMatch/);

    const serverDeepest = deepestMatchedPath(serverRouter(), path!);
    expect(serverDeepest, `${path} matched NOTHING in server mode — silent-no-op shape is back`).toMatch(/:pathMatch/);
  });

  it('every accepted output is /app-rooted (the precondition of the catch-all guarantee)', () => {
    const accepted: Array<string | null> = [
      ...CASES.map((c) => c.url),
      'phlix://internal/app',
      'phlix://internal/app/library/scan',
      'phlix://internal/app/deeply/nested-123'
    ].map(parseDeepLinkUrl);
    for (const path of accepted) {
      expect(path, 'CASES entries must parse').toBeTypeOf('string');
      expect(path === '/app' || (path as string).startsWith('/app/'), `${path} escapes the /app router base`).toBe(true);
    }
  });

  it('rejected links never reach the router at all — the drain surfaces them (see deepLinkDrain.test.ts)', () => {
    // Parser-side half of the honest-failure law: anything the parser refuses
    // returns null; it may NOT return a path (a returned-but-dead path is the
    // exact regression the /app law exists to prevent).
    expect(parseDeepLinkUrl('phlix://bogus/x')).toBeNull();
    expect(parseDeepLinkUrl('phlix://media/bad id')).toBeNull();
    expect(parseDeepLinkUrl('phlix://internal/no/base')).toBeNull();
  });
});
