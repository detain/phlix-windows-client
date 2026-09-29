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
      expect(parseDeepLinkUrl('phlix://media/abc123')).toBe('/media/abc123');
    });

    it('accepts media ID with dashes', () => {
      expect(parseDeepLinkUrl('phlix://media/abc-123-def')).toBe('/media/abc-123-def');
    });

    it('accepts valid play ID', () => {
      expect(parseDeepLinkUrl('phlix://play/episode-456')).toBe('/play/episode-456');
    });

    it('accepts valid server ID', () => {
      expect(parseDeepLinkUrl('phlix://server/my-server')).toBe('/server/my-server');
    });

    it('accepts valid accept-invite token', () => {
      expect(parseDeepLinkUrl('phlix://accept-invite/abc_123')).toBe('/accept-invite/abc_123');
    });

    it('accepts an invite token at exactly the 256-char cap', () => {
      const token = 'a'.repeat(256);
      expect(parseDeepLinkUrl(`phlix://accept-invite/${token}`)).toBe(`/accept-invite/${token}`);
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

    it('normalizes slash dot-segments so traversal cannot escape upward', () => {
      // WHATWG URL parsing removes dot-segments: the surviving path is inert.
      expect(parseDeepLinkUrl('phlix://internal/app/../../evil')).toBe('/evil');
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

  it('logs the open-url event redacted, never raw', () => {
    expect(mainSource).toMatch(/open-url event: \$\{redactDeepLinkUrl\(url\)\}/);
    expect(mainSource).not.toMatch(/open-url event: \$\{url\}/);
  });

  it('dispatches the cold-start deep link exactly once (W-low a)', () => {
    const dispatches = mainSource.match(/handleDeepLinkUrl\(coldStartUrl\)/g) ?? [];
    expect(dispatches.length).toBe(1);
  });

  it('routes every delivery through the dedupe once-guard', () => {
    expect(mainSource).toMatch(/deepLinkDeduper\.suppresses\(url\)/);
  });
});
