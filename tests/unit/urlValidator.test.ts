/**
 * @vitest-environment node
 *
 * Overrides vitest.config.mts's global `environment: 'jsdom'` for THIS FILE
 * ONLY. The module under test is plain Node.js with no DOM dependencies.
 */

import { describe, it, expect } from 'vitest';

import { validateExternalUrl, scrubErrorForLog, summarizeUrlForLog } from '../../src/main/urlValidator';

describe('validateExternalUrl', () => {
  it('allows https: URLs', () => {
    expect(validateExternalUrl('https://example.com')).toBe(true);
    expect(validateExternalUrl('https://example.com/path?query=value')).toBe(true);
    expect(validateExternalUrl('https://user:pass@example.com')).toBe(true);
  });

  it('allows http: URLs', () => {
    expect(validateExternalUrl('http://example.com')).toBe(true);
    expect(validateExternalUrl('http://localhost:8080')).toBe(true);
    expect(validateExternalUrl('http://example.com/path?query=value')).toBe(true);
  });

  it('blocks file: protocol', () => {
    expect(validateExternalUrl('file:///etc/passwd')).toBe(false);
    expect(validateExternalUrl('file://C:\\Windows\\System32')).toBe(false);
  });

  it('blocks ms-settings: protocol', () => {
    expect(validateExternalUrl('ms-settings:network')).toBe(false);
  });

  it('blocks search-ms: protocol', () => {
    expect(validateExternalUrl('search-ms:query=test')).toBe(false);
  });

  it('blocks javascript: protocol', () => {
    expect(validateExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('blocks data: protocol', () => {
    expect(validateExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(validateExternalUrl('data:,Hello%20World')).toBe(false);
  });

  it('blocks malformed strings', () => {
    expect(validateExternalUrl('not a url')).toBe(false);
    expect(validateExternalUrl('://missing-protocol')).toBe(false);
    expect(validateExternalUrl('')).toBe(false);
  });
});

// m20 (review secnet m3): the fault-handler scrub law.
describe('scrubErrorForLog', () => {
  it('reduces every URL in an Error (message, stack and cause chain) to scheme+host', () => {
    const inner = new Error('connect failed https://user:pass@phlix.example.com:8097/sync?token=AB12CD')
    const outer = new Error('undici fetch https://api.phlix.example/net/', { cause: inner })
    outer.stack = outer.stack + '\n  at socket (https://meta.example.internal/x/y)'
    const out = scrubErrorForLog(outer)
    expect(out).not.toContain('AB12CD')
    expect(out).not.toContain('user:pass')
    expect(out).not.toContain('/sync')
    expect(out).not.toContain('/x/y')
    expect(out).toContain('https://phlix.example.com:8097')
    expect(out).toContain('https://api.phlix.example')
    expect(out).toContain('Caused by:')
    expect(out).toContain('Error: connect failed')
  })

  it('stringifies non-Error rejections and scrubs them the same way', () => {
    expect(scrubErrorForLog('restarted https://srv.example/deep/secret')).toBe('restarted https://srv.example')
    expect(scrubErrorForLog(null)).toBe('null')
    expect(scrubErrorForLog(undefined)).toBe('undefined')
  })

  it('keeps the fault text readable while reducing ANY URL shape (file: included)', () => {
    const err = new TypeError('store.get is not a function')
    err.stack = 'TypeError: store.get is not a function\n    at boot (file:///app/main.js:1:2)'
    expect(scrubErrorForLog(err)).toContain('store.get is not a function')
    expect(scrubErrorForLog(err)).toContain('file://(no host)')
    expect(scrubErrorForLog(err)).not.toContain('main.js:1:2')
  })

  it('summarizeUrlForLog survives garbage (the law never throws on the fault path)', () => {
    expect(summarizeUrlForLog('')).toBe('unparseable URL')
    expect(summarizeUrlForLog('http://')).toBe('unparseable URL')
    expect(summarizeUrlForLog('file://')).toBe('file://(no host)')
  })
})
