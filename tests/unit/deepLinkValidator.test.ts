/**
 * @vitest-environment node
 *
 * Overrides vitest.config.mts's global `environment: 'jsdom'` for THIS FILE
 * ONLY. The module under test is plain Node.js with no DOM dependencies.
 *
 * W3: deepLinkValidator.ts is the SINGLE canonical deep-link parser (the old
 * inline fork in src/main/index.ts was deleted). These tests cover the
 * unified grammar, the ported ≤256-char token cap, the now-gated `internal`
 * arm (W-low b), log redaction (W3), and the delivery dedupe once-guard
 * (W-low a).
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  parseDeepLinkUrl,
  extractDeepLinkUrl,
  redactDeepLinkUrl,
  createDeepLinkDeduper
} from '../../src/main/deepLinkValidator';

vi.mock('electron-log', () => ({
  default: {
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('parseDeepLinkUrl', () => {
  describe('valid URLs', () => {
    it('accepts valid media ID', () => {
      expect(parseDeepLinkUrl('phlix://media/abc123')).toBe('/app/media/abc123');
    });

    it('accepts media ID with dashes', () => {
      expect(parseDeepLinkUrl('phlix://media/abc-123-def')).toBe('/app/media/abc-123-def');
    });

    it('accepts valid play ID (maps to the ui player route — no /play route exists)', () => {
      expect(parseDeepLinkUrl('phlix://play/episode-456')).toBe('/app/player/episode-456');
    });

    it('accepts valid server ID', () => {
      expect(parseDeepLinkUrl('phlix://server/my-server')).toBe('/app/server/my-server');
    });

    it('accepts valid accept-invite token', () => {
      expect(parseDeepLinkUrl('phlix://accept-invite/abc_123')).toBe('/app/accept-invite/abc_123');
    });

    it('accepts an invite token at exactly the 256-char cap', () => {
      const token = 'a'.repeat(256);
      expect(parseDeepLinkUrl(`phlix://accept-invite/${token}`)).toBe(`/app/accept-invite/${token}`);
    });
  });

  describe('hostile inputs', () => {
    it('rejects path traversal attempt', () => {
      expect(parseDeepLinkUrl('phlix://media/../../etc/passwd')).toBeNull();
    });

    it('rejects HTML injection attempt', () => {
      expect(parseDeepLinkUrl('phlix://media/<script>')).toBeNull();
    });

    it('rejects space in ID', () => {
      expect(parseDeepLinkUrl('phlix://media/has space')).toBeNull();
    });

    it('rejects empty ID', () => {
      expect(parseDeepLinkUrl('phlix://media/')).toBeNull();
    });

    it('rejects control character (newline) in ID', () => {
      // Percent-encoded newline %0A stays encoded in URL.pathname and fails the ID grammar
      expect(parseDeepLinkUrl('phlix://media/has%0Annewline')).toBeNull();
    });

    it('rejects null byte injection', () => {
      expect(parseDeepLinkUrl('phlix://media/has%00null')).toBeNull();
      expect(parseDeepLinkUrl('phlix://media/has\x00null')).toBeNull();
    });

    it('rejects an invite token above the 256-char cap', () => {
      const token = 'a'.repeat(257);
      expect(parseDeepLinkUrl(`phlix://accept-invite/${token}`)).toBeNull();
    });

    it('rejects invite tokens with characters outside base64url', () => {
      expect(parseDeepLinkUrl('phlix://accept-invite/_tok.en!')).toBeNull();
    });
  });

  describe('invalid protocol', () => {
    it('rejects non-phlix protocol', () => {
      expect(parseDeepLinkUrl('https://media/abc123')).toBeNull();
    });

    it('rejects empty string', () => {
      expect(parseDeepLinkUrl('')).toBeNull();
    });

    it('rejects missing protocol', () => {
      expect(parseDeepLinkUrl('media/abc123')).toBeNull();
    });
  });

  describe('invalid hosts', () => {
    it('rejects unknown host', () => {
      expect(parseDeepLinkUrl('phlix://unknown/abc123')).toBeNull();
    });

    it('rejects empty host', () => {
      expect(parseDeepLinkUrl('phlix:///abc123')).toBeNull();
    });
  });

  describe('internal arm is gated like every other host (W-low b)', () => {
    it('accepts a plain multi-segment router path', () => {
      expect(parseDeepLinkUrl('phlix://internal/app/settings')).toBe('/app/settings');
    });

    it('accepts the /app home route itself', () => {
      // '/app' is a real record (browse home) — the /app-root law accepts it
      // exactly, including the no-trailing-slash form.
      expect(parseDeepLinkUrl('phlix://internal/app')).toBe('/app');
    });

    it('M-WINDOWS-15: rejects an internal path outside the /app router base', () => {
      // Every registered route — vendored ui AND this repo's extraRoutes —
      // lives under '/app'; a path outside it matches ZERO records, so
      // router.push() would reject unhandled: a silent no-op. The parser
      // refuses to emit one.
      expect(parseDeepLinkUrl('phlix://internal/settings')).toBeNull();
      expect(parseDeepLinkUrl('phlix://internal/')).toBeNull();
      expect(parseDeepLinkUrl('phlix://internal/app/syncplay')).toBe('/app/syncplay');
    });

    it('M-WINDOWS-15: the /app law is segment-exact, not string-prefix-exact', () => {
      // '/appevil' startsWith('/app') but is a DIFFERENT first segment that
      // no record owns — it must not slip through the '/app' acceptance.
      expect(parseDeepLinkUrl('phlix://internal/appevil')).toBeNull();
      expect(parseDeepLinkUrl('phlix://internal/app-evil')).toBeNull();
    });

    it('dot-segment normalization escaping /app is rejected, not returned', () => {
      // WHATWG URL parsing removes dot-segments: the survivor was '/evil' —
      // routable nowhere. Pre-M-WINDOWS-15 the parser RETURNED it (pinned as
      // inert); the /app-root law now rejects it so the drain can surface the
      // failure honestly instead of shipping a dead push to the renderer.
      expect(parseDeepLinkUrl('phlix://internal/app/../../evil')).toBeNull();
    });

    it('rejects backslash traversal that survives URL parsing with a literal ".."', () => {
      expect(parseDeepLinkUrl('phlix://internal/app\\..\\evil')).toBeNull();
    });

    it('rejects null bytes in an internal path (raw and percent-encoded)', () => {
      // new URL() percent-encodes a raw NUL, so the gate must catch %00 too.
      expect(parseDeepLinkUrl('phlix://internal/app\x00settings')).toBeNull();
      expect(parseDeepLinkUrl('phlix://internal/app%00settings')).toBeNull();
    });

    it('rejects overlong internal paths', () => {
      expect(parseDeepLinkUrl(`phlix://internal/${'a'.repeat(2000)}`)).toBeNull();
    });
  });

  describe('extractDeepLinkUrl', () => {
    it('finds the first phlix:// argument', () => {
      expect(extractDeepLinkUrl(['electron', '--flag', 'phlix://media/abc', 'phlix://play/x'])).toBe('phlix://media/abc');
    });

    it('returns null when absent', () => {
      expect(extractDeepLinkUrl(['electron', '--flag'])).toBeNull();
    });
  });
});

describe('redactDeepLinkUrl (W3)', () => {
  it('replaces the invite token segment with [redacted]', () => {
    expect(redactDeepLinkUrl('phlix://accept-invite/s3cr3t-t0k3n_A')).toBe('phlix://accept-invite/[redacted]');
  });

  it('keeps path prefixes before the token', () => {
    expect(redactDeepLinkUrl('phlix://accept-invite/nested/s3cr3t')).toBe('phlix://accept-invite/nested/[redacted]');
  });

  it('leaves non-sensitive hosts intact', () => {
    expect(redactDeepLinkUrl('phlix://media/abc-123')).toBe('phlix://media/abc-123');
  });

  it('drops query strings and fragments for every host', () => {
    expect(redactDeepLinkUrl('phlix://media/abc?session=xyz#frag')).toBe('phlix://media/abc');
  });

  it('never echoes raw text for unparseable URLs', () => {
    expect(redactDeepLinkUrl('totally not a url')).toBe('[deeplink:unparseable]');
  });
});

describe('createDeepLinkDeduper (W-low a)', () => {
  it('suppresses the same URL inside the window and lets it through after', () => {
    vi.useFakeTimers();
    try {
      const deduper = createDeepLinkDeduper(2000);
      const url = 'phlix://accept-invite/tok';
      expect(deduper.suppresses(url)).toBe(false); // t=0 — first sighting
      vi.advanceTimersByTime(1000);
      expect(deduper.suppresses(url)).toBe(true); // t=1000 — inside window (re-slides it)
      vi.advanceTimersByTime(2000);
      expect(deduper.suppresses(url)).toBe(false); // t=3000 — ≥2000ms past last sighting
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not conflate different URLs', () => {
    const deduper = createDeepLinkDeduper(2000);
    expect(deduper.suppresses('phlix://media/a')).toBe(false);
    expect(deduper.suppresses('phlix://media/b')).toBe(false);
  });
});

describe('src/main/index.ts deep-link wiring (regression shields)', () => {
  // Normalize CRLF for Windows checkouts (same law as notification.test.ts).
  const mainSource = readFileSync(
    resolve(__dirname, '../../src/main/index.ts'),
    'utf-8'
  ).replace(/\r\n/g, '\n');

  it('logs the cold-start URL redacted, never raw', () => {
    expect(mainSource).toMatch(/Cold start URL detected: \$\{redactDeepLinkUrl\(coldStartUrl\)\}/);
    expect(mainSource).not.toMatch(/Cold start URL detected: \$\{coldStartUrl\}/);
  });

  it('has no darwin open-url arm (WIN-41: Windows-only shell)', () => {
    expect(mainSource).not.toMatch(/app\.on\('open-url'/);
  });

  it('dispatches the cold-start deep link exactly once (W-low a)', () => {
    const dispatches = mainSource.match(/handleDeepLinkUrl\(coldStartUrl\)/g) ?? [];
    expect(dispatches).toHaveLength(1);
  });

  it('routes every delivery through the dedupe once-guard', () => {
    expect(mainSource).toMatch(/deepLinkDeduper\.suppresses\(url\)/);
  });

  // M-WINDOWS-06: delivery is event-driven, never time-driven. The former
  // cold-start arm (app.once('browser-window-created') + setTimeout(1000))
  // raced the renderer's late ipcRenderer.on subscription and silently
  // dropped links. These shields keep the cure from rotting back.
  it('has no browser-window-created timed dispatch arm left (M-WINDOWS-06)', () => {
    // Code-shape check (event registration), not prose: the word may occur
    // in history docblocks; only an actual listener arm would revive the race.
    expect(mainSource).not.toMatch(/\.(?:once|on)\(\s*['"]browser-window-created['"]/);
  });

  it('has no setTimeout anywhere on a deep-link dispatch path (M-WINDOWS-06)', () => {
    // The old shape was setTimeout(() => { handleDeepLinkUrl(...) }, 1000).
    expect(mainSource).not.toMatch(/setTimeout\([\s\S]{0,80}handleDeepLinkUrl/);
    expect(mainSource).not.toMatch(/setTimeout\([\s\S]{0,80}drainPendingDeepLinks/);
  });

  it('drains only on the renderer deeplink:ready handshake, with sender identity checked (M-WINDOWS-06)', () => {
    expect(mainSource).toMatch(/ipcMain\.on\(\s*'deeplink:ready',\s*\(event\)/);
    // w10/L1 rotation: the inline identity expression was folded into the
    // shared senderTrusted gate — identical predicate (current, undestroyed
    // main window webContents), single-sourced for the whole deny-by-default
    // sweep. The law is unchanged; its enforcement point moved.
    const ready = mainSource.slice(
      mainSource.indexOf("ipcMain.on('deeplink:ready'"),
      mainSource.indexOf('drainPendingDeepLinks();', mainSource.indexOf("ipcMain.on('deeplink:ready'"))
    );
    expect(ready).toMatch(/if \(!senderTrusted\(event\)\)/);
  });

  it('drops the webContents.send("deeplink:open") to a single delivery point (M-WINDOWS-06)', () => {
    const sends = mainSource.match(/webContents\.send\(\s*'deeplink:open'/g) ?? [];
    expect(sends).toHaveLength(1);
  });

  it('re-arms (drops) readiness on every navigation so reloads cannot drop queued links (M-WINDOWS-06)', () => {
    expect(mainSource).toMatch(/'did-start-loading'[\s\S]{0,120}deepLinkReceiverReady = false/);
    expect(mainSource).toMatch(/'closed',\s*\(\)\s*=>\s*\{[\s\S]{0,400}deepLinkReceiverReady = false/);
  });

  it('classifies deep-link consumption through a SINGLE gate seam (REVIEW-w09L2windows Major)', () => {
    // All delivery arms (cold-start argv, second-instance,
    // notification clickAction) funnel through handleDeepLinkUrl → the one
    // pump, and the pump calls the consent classifier exactly once. A second
    // call site would mean a leg classifying for itself — the shape that let
    // a gate miss become a bypass. Definition + 3 dispatch arms = 4.
    const gateCalls = mainSource.match(/requiresDeepLinkConfirmation\(/g) ?? [];
    expect(gateCalls, 'import carries no parens — exactly one classification call site').toHaveLength(1);
    const dispatches = mainSource.match(/handleDeepLinkUrl\(/g) ?? [];
    expect(dispatches, 'definition + three delivery arms').toHaveLength(4);
  });
});

describe('redactDeepLinkUrl case-fold law (REVIEW-w09L2windows)', () => {
  // The renderer's router reaches the invite view for EVERY letter-case
  // spelling, and the internal arm carries the same route under host
  // 'internal' — so the one-time secret can ride a log line or rejection
  // dialog in shapes the old hostname-exact comparison waved through. The
  // redaction law is total now: any URL whose route touches the invite
  // segment redacts its final segment, whatever the case. Folding the
  // COMPARISON redacts more, never less — over-redaction is the safe
  // direction; the parse grammar (KNOWN_HOSTS, /app base law) stays exact.
  it('redacts the internal-arm invite form (lowercase AND case variants)', () => {
    const lower = redactDeepLinkUrl('phlix://internal/app/accept-invite/SEC-TOKEN');
    expect(lower).not.toContain('SEC-TOKEN');
    expect(lower).toContain('[redacted]');
    const variant = redactDeepLinkUrl('phlix://internal/app/Accept-Invite/SEC-TOKEN');
    expect(variant).not.toContain('SEC-TOKEN');
    expect(variant).toContain('[redacted]');
  });

  it('redacts a case-variant host form without widening acceptance', () => {
    const out = redactDeepLinkUrl('phlix://Accept-Invite/SEC-TOKEN');
    expect(out).not.toContain('SEC-TOKEN');
    expect(out).toContain('[redacted]');
    // Grammar unchanged: the case-variant host is still NOT a known host.
    expect(parseDeepLinkUrl('phlix://Accept-Invite/SEC-TOKEN')).toBeNull();
  });

  it('leaves secret-free routes intact', () => {
    expect(redactDeepLinkUrl('phlix://media/42')).toBe('phlix://media/42');
    expect(redactDeepLinkUrl('phlix://internal/app/settings')).toBe('phlix://internal/app/settings');
  });
});

describe('redactDeepLinkUrl normalization-deferred law (REVIEW-w09L2windows-ff2 Minor)', () => {
  // Segment-exact case-fold (the w09/L2-FF cure) still keys on the LITERAL
  // spelling, so any form that reaches the redactor un-normalized — percent
  // escapes ('%41', '%2D', double-encoded '%2541'), fullwidth/combining
  // Unicode, or Cyrillic/dotless look-alikes — waves a one-time invite token
  // straight through into every log site and the rejection dialog. The redactor
  // now folds BEFORE comparing: bounded percent-decode (max 2 rounds, to a
  // fixed point; a decode throw fails TOWARD redaction) → NFKD → case-fold →
  // documented homoglyph map → strip separators → substring 'acceptinvite'.
  // Over-redaction stays the safe direction; the parse grammar is untouched
  // (this folds only the COMPARISON, same law as the case-fold above).
  //
  // Boundary disclosures (register REVIEW-w09L2windows-ff2): nesting deeper
  // than 2 rounds (e.g. '%252541') and look-alikes outside the map (e.g. Greek
  // 'α') fold to no marker and are treated as non-invite — matching the
  // reviewer's own bounded-decode cap and executed spelling set; the router
  // reaches the invite record for neither form (see the equivalence table in
  // deepLinkRouteContract.test.ts), so no consuming surface is unredacted.
  interface HostileSpelling {
    label: string;
    spelling: string;
    secret: string;
  }

  const HOSTILE_INVITE_SPELLINGS: HostileSpelling[] = [
    { label: 'encoded-A', spelling: '%41ccept-invite', secret: 'FF2S01' },
    { label: 'encoded-dash', spelling: 'accept%2Dinvite', secret: 'FF2S02' },
    { label: 'encoded-e', spelling: 'acc%65pt-invite', secret: 'FF2S03' },
    { label: 'encoded-slash-inside', spelling: 'accept%2Finvite', secret: 'FF2S04' },
    { label: 'encoded-space-pad', spelling: 'accept-invite%20', secret: 'FF2S05' },
    { label: 'double-encoded-A', spelling: '%2541ccept-invite', secret: 'FF2S06' },
    { label: 'double-encoded-slash', spelling: 'accept%252Finvite', secret: 'FF2S07' },
    { label: 'encoded-traversal-prefix', spelling: '%2e%2e%2faccept-invite', secret: 'FF2S08' },
    { label: 'literal-traversal-prefix', spelling: '..%2faccept-invite', secret: 'FF2S09' },
    { label: 'fullwidth-A', spelling: '\uFF21ccept-invite', secret: 'FF2S10' },
    { label: 'combining-dot', spelling: 'acc' + 'e\u0307' + 'pt-invite', secret: 'FF2S11' },
    { label: 'precomposed-e-dot', spelling: 'acc\u0117pt-invite', secret: 'FF2S19' },
    { label: 'dotless-i', spelling: 'accept-\u0131nvite', secret: 'FF2S12' },
    { label: 'cyrillic-e', spelling: 'acc\u0435pt-invite', secret: 'FF2S13' },
    { label: 'cyrillic-i', spelling: 'accept-\u0456nvite', secret: 'FF2S14' },
    { label: 'cyrillic-e-final', spelling: 'accept-invit\u0435', secret: 'FF2S15' },
    { label: 'cyrillic-full-mix', spelling: '\u0430cc\u0435pt-\u0456nvit\u0435', secret: 'FF2S16' },
    { label: 'trailing-dot', spelling: 'accept-invite.', secret: 'FF2S17' },
    { label: 'fully-encoded-upper', spelling: '%41%43%43%45%50%54-%49%4E%56%49%54%45', secret: 'FF2S18' }
  ];

  it.each(HOSTILE_INVITE_SPELLINGS)('redacts the token under $label spellings', ({ spelling, secret }) => {
    const out = redactDeepLinkUrl(`phlix://internal/app/${spelling}/${secret}`);
    expect(out, `one-time token leaked raw for ${spelling}`).not.toContain(secret);
    expect(out).toContain('[redacted]');
  });

  it('redacts a malformed percent escape — fail TOWARD redaction, never a raw tail', () => {
    // '%zz' is not valid percent-encoding: the decode loop throws and the fold
    // must treat the route as possibly-invite. A spelling we cannot
    // confidently call NOT invite redacts; that is the totality law.
    const out = redactDeepLinkUrl('phlix://internal/app/accept%zz-invite/FF2MALFORMED-SECRET');
    expect(out).not.toContain('FF2MALFORMED-SECRET');
    expect(out).toContain('[redacted]');
  });

  it('redacts the encoded-escape HOST leg without widening parse acceptance', () => {
    // WHATWG lowercases hostnames but keeps %2D: 'accept%2dininvite' must fold
    // through the same seam. The parse grammar stays exact — this is redaction
    // totality, never an invitation for the case/encoding variant to PARSE.
    const out = redactDeepLinkUrl('phlix://Accept%2DInvite/FF2HOST-SECRET');
    expect(out).not.toContain('FF2HOST-SECRET');
    expect(out).toContain('[redacted]');
    expect(parseDeepLinkUrl('phlix://Accept%2DInvite/FF2HOST-SECRET')).toBeNull();
  });

  it('leaves confidently-not-invite routes intact (over-redaction has limits)', () => {
    // The fold must not become a blanket redactor: benign browse paths carry
    // no marker under ANY fold depth and keep their readable log form.
    expect(redactDeepLinkUrl('phlix://media/FF2BENIGN-1')).toBe('phlix://media/FF2BENIGN-1');
    expect(redactDeepLinkUrl('phlix://internal/app/media/FF2BENIGN-2')).toBe('phlix://internal/app/media/FF2BENIGN-2');
  });
});
