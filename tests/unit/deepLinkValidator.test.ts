/**
 * @vitest-environment node
 *
 * Overrides vitest.config.mts's global `environment: 'jsdom'` for THIS FILE
 * ONLY. The module under test is plain Node.js with no DOM dependencies.
 */

import { describe, it, expect } from 'vitest';

import { parseDeepLink } from '../../src/main/deepLinkValidator';

describe('parseDeepLink', () => {
  describe('valid URLs', () => {
    it('accepts valid media ID', () => {
      const result = parseDeepLink('phlix://media/abc123');
      expect(result).not.toBeNull();
      expect(result?.route).toBe('/media/abc123');
    });

    it('accepts media ID with dashes', () => {
      const result = parseDeepLink('phlix://media/abc-123-def');
      expect(result).not.toBeNull();
      expect(result?.route).toBe('/media/abc-123-def');
    });

    it('accepts valid play ID', () => {
      const result = parseDeepLink('phlix://play/episode-456');
      expect(result).not.toBeNull();
      expect(result?.route).toBe('/play/episode-456');
    });

    it('accepts valid server ID', () => {
      const result = parseDeepLink('phlix://server/my-server');
      expect(result).not.toBeNull();
      expect(result?.route).toBe('/server/my-server');
    });

    it('accepts valid accept-invite token', () => {
      const result = parseDeepLink('phlix://accept-invite/abc_123');
      expect(result).not.toBeNull();
      expect(result?.route).toBe('/accept-invite/abc_123');
    });
  });

  describe('hostile inputs', () => {
    it('rejects path traversal attempt', () => {
      const result = parseDeepLink('phlix://media/../../etc/passwd');
      expect(result).toBeNull();
    });

    it('rejects HTML injection attempt', () => {
      const result = parseDeepLink('phlix://media/<script>');
      expect(result).toBeNull();
    });

    it('rejects space in ID', () => {
      const result = parseDeepLink('phlix://media/has space');
      expect(result).toBeNull();
    });

    it('rejects empty ID', () => {
      const result = parseDeepLink('phlix://media/');
      expect(result).toBeNull();
    });

    it('rejects control character (newline) in ID', () => {
      // Percent-encoded newline %0A should be rejected as it decodes to a control char
      const result = parseDeepLink('phlix://media/has%0Annewline');
      expect(result).toBeNull();
    });

    it('rejects null byte injection', () => {
      const result = parseDeepLink('phlix://media/has%00null');
      // The URL parser will decode %00 to \x00
      // The path segment will contain the null byte after parsing
      expect(result).toBeNull();
    });
  });

  describe('invalid protocol', () => {
    it('rejects non-phlix protocol', () => {
      const result = parseDeepLink('https://media/abc123');
      expect(result).toBeNull();
    });

    it('rejects empty string', () => {
      const result = parseDeepLink('');
      expect(result).toBeNull();
    });

    it('rejects missing protocol', () => {
      const result = parseDeepLink('media/abc123');
      expect(result).toBeNull();
    });
  });

  describe('invalid hosts', () => {
    it('rejects unknown host', () => {
      const result = parseDeepLink('phlix://unknown/abc123');
      expect(result).toBeNull();
    });

    it('rejects empty host', () => {
      const result = parseDeepLink('phlix:///abc123');
      expect(result).toBeNull();
    });
  });
});
