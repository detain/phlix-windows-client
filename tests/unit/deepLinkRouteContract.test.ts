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
import { parseDeepLinkUrl, requiresDeepLinkConfirmation } from '../../src/main/deepLinkValidator';

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
 *  actually runs in until M-WINDOWS-17 wires hub config — windows__gameux M6). */
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
  // M-WINDOWS-17's hub-mode cure, not this grammar contract.)
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

// ---------------------------------------------------------------------------
// REVIEW-w09L2windows-ff2 CRUX adjudication, CI-resident.
//
// The ff2 brief claimed percent/Unicode spellings "reach the classifier
// BEFORE percent-decode/unicode-normalization, so the consent gate can still
// be skipped" for the invite-consuming route. Executed at 83e9a416 against a
// REAL hub-mode router (26/26 spellings by the reviewer, all 18 below re-run
// by this lane — table evidence in .reviews/2026-11-08/FIX-w09L2windows-ff2.md):
// the router does NOT decode path segments, so every normalization-deferred
// spelling falls to the '/app/:pathMatch(.*)*' catch-all and can NEVER consume
// the one-time token. Only letter-case spellings reach the record — and every
// one of those is gate-confirmed since w09/L2-FF. The invariant that makes the
// gate sound is therefore: ROUTER-CONSUMED ⇒ GATE-CONFIRMED. This table pins
// it. If a future vue-router (or a config flip such as `sensitive`/decode
// changes) starts reaching the record for a form the case-fold gate misses,
// the consumed=false expectation reddens HERE, in the same commit that becomes
// unsafe — forcing gate widening at the moment it becomes necessary, instead
// of silently re-opening the bypass.
// ---------------------------------------------------------------------------

const FF2_HOSTILE_SPELLINGS: Array<{ label: string; spelling: string }> = [
  { label: 'encoded-A', spelling: '%41ccept-invite' },
  { label: 'encoded-dash', spelling: 'accept%2Dinvite' },
  { label: 'encoded-e', spelling: 'acc%65pt-invite' },
  { label: 'encoded-slash-inside', spelling: 'accept%2Finvite' },
  { label: 'encoded-space-pad', spelling: 'accept-invite%20' },
  { label: 'double-encoded-A', spelling: '%2541ccept-invite' },
  { label: 'double-encoded-slash', spelling: 'accept%252Finvite' },
  { label: 'encoded-traversal-prefix', spelling: '%2e%2e%2faccept-invite' },
  { label: 'literal-traversal-prefix', spelling: '..%2faccept-invite' },
  { label: 'fullwidth-A', spelling: '\uFF21ccept-invite' },
  { label: 'combining-dot', spelling: 'acc' + 'e\u0307' + 'pt-invite' },
  { label: 'precomposed-e-dot', spelling: 'acc\u0117pt-invite' },
  { label: 'dotless-i', spelling: 'accept-\u0131nvite' },
  { label: 'cyrillic-e', spelling: 'acc\u0435pt-invite' },
  { label: 'cyrillic-i', spelling: 'accept-\u0456nvite' },
  { label: 'cyrillic-e-final', spelling: 'accept-invit\u0435' },
  { label: 'cyrillic-full-mix', spelling: '\u0430cc\u0435pt-\u0456nvit\u0435' },
  { label: 'trailing-dot', spelling: 'accept-invite.' },
  { label: 'fully-encoded-upper', spelling: '%41%43%43%45%50%54-%49%4E%56%49%54%45' }
];

const FF2_LETTER_CASES: Array<{ spelling: string }> = [
  { spelling: 'accept-invite' },
  { spelling: 'Accept-Invite' },
  { spelling: 'ACCEPT-INVITE' },
  { spelling: 'AcCePt-iNvItE' }
];

describe('consent gate ↔ router reachability equivalence (ff2 crux law)', () => {
  it.each(FF2_HOSTILE_SPELLINGS)('$label: cannot reach the record ⇒ no gate needed, and none fires', ({ spelling }) => {
    const path = `/app/${spelling}/EQTOKEN1`;
    const deepest = deepestMatchedPath(hubRouter(), path);
    // RE-INFLATION DETECTOR: this must stay false for as long as the gate
    // stays case-fold-only. True here with requiresDeepLinkConfirmation false
    // below = a live consent bypass, cured the same commit.
    expect(deepest, `${spelling} unexpectedly reaches the invite record`).not.toBe('/app/accept-invite/:token');
    expect(requiresDeepLinkConfirmation(path)).toBe(false);
  });

  it.each(FF2_LETTER_CASES)('$spelling: reaches the record ⇒ the gate confirms it', ({ spelling }) => {
    const path = `/app/${spelling}/EQTOKEN1`;
    expect(deepestMatchedPath(hubRouter(), path)).toBe('/app/accept-invite/:token');
    expect(requiresDeepLinkConfirmation(path)).toBe(true);
  });

  it('the trailing-slash reachable form is gate-confirmed too', () => {
    // vue-router defaults are non-strict: '/app/accept-invite/T/' matches the
    // record. The gate's startsWith('/app/accept-invite/') already covers it.
    const path = '/app/accept-invite/EQTOKEN1/';
    expect(deepestMatchedPath(hubRouter(), path)).toBe('/app/accept-invite/:token');
    expect(requiresDeepLinkConfirmation(path)).toBe(true);
  });

  it("bare /app/accept-invite (no token) does not reach the record; the gate over-confirms — safe direction", () => {
    // The record requires its :token segment, so nothing consumes here. The
    // gate still says true: over-confirming is the documented safe direction
    // (a dialog the user declines asks for nothing; a bypass burns a secret).
    const path = '/app/accept-invite';
    expect(deepestMatchedPath(hubRouter(), path)).not.toBe('/app/accept-invite/:token');
    expect(requiresDeepLinkConfirmation(path)).toBe(true);
  });

  it('the whole class: router-consumed ⇒ gate-confirmed (the no-bypass invariant)', () => {
    const paths = [
      ...FF2_HOSTILE_SPELLINGS.map((s) => `/app/${s.spelling}/EQTOKEN1`),
      ...FF2_LETTER_CASES.map(({ spelling }) => `/app/${spelling}/EQTOKEN1`),
      '/app/accept-invite/EQTOKEN1/',
      '/app/accept-invite'
    ];
    for (const path of paths) {
      const consumed = deepestMatchedPath(hubRouter(), path) === '/app/accept-invite/:token';
      if (consumed) {
        expect(requiresDeepLinkConfirmation(path), `${path} consumed WITHOUT confirmation`).toBe(true);
      }
    }
  });
});
