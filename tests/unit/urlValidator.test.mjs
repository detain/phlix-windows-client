/**
 * @vitest-environment node
 *
 * Overrides vitest.config.mts's global `environment: 'jsdom'` for THIS FILE
 * ONLY. The module under test is plain Node.js with no DOM dependencies.
 */

import { describe, it, expect } from 'vitest';

import { validateExternalUrl } from '../../dist/main/urlValidator.js';

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
