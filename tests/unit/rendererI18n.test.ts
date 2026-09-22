/**
 * Renderer locale-resolution tests for the @phlix/ui message seam.
 *
 * Covers the priority chain (explicit config → system language → 'en'), the
 * override registry, and — against the REAL @phlix/ui package — the merge
 * semantics the seam promises: per-group override onto English defaults.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { DEFAULT_MESSAGES, createTranslator, mergeMessages } from '@phlix/ui';
import {
  messagesForLocale,
  pickLocale,
  registerLocaleOverrides,
  resolveLocale
} from '@/i18n';

describe('pickLocale priority', () => {
  it('explicit config/env override wins over the system language', () => {
    expect(pickLocale('es', 'en-US')).toBe('es');
  });

  it('system language is used when no override is set', () => {
    expect(pickLocale(null, 'fr-FR')).toBe('fr-FR');
    expect(pickLocale(undefined, 'de')).toBe('de');
  });

  it('falls back to English when neither is available', () => {
    expect(pickLocale(null, null)).toBe('en');
    expect(pickLocale()).toBe('en');
  });

  it('ignores blank/whitespace values and trims real ones', () => {
    expect(pickLocale('   ', '   ')).toBe('en');
    expect(pickLocale('  ', 'ja-JP')).toBe('ja-JP');
    expect(pickLocale(' es ', 'ja-JP')).toBe('es');
  });
});

describe('resolveLocale (environment-driven)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers VITE_PHLIX_LOCALE over navigator.language', () => {
    vi.stubEnv('VITE_PHLIX_LOCALE', 'es-MX');
    expect(resolveLocale()).toBe('es-MX');
  });

  it('falls through to navigator.language when the env var is unset', () => {
    expect(resolveLocale()).toBe(navigator.language);
  });

  it('falls through to "en" when both are blank', () => {
    vi.stubEnv('VITE_PHLIX_LOCALE', '  ');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('');
    expect(resolveLocale()).toBe('en');
    vi.restoreAllMocks();
  });
});

describe('messagesForLocale registry', () => {
  it('returns undefined for "en" — its override map is empty, so nothing is sent to ui', () => {
    expect(messagesForLocale('en')).toBeUndefined();
  });

  it('returns undefined for unregistered locales (English defaults render untouched)', () => {
    expect(messagesForLocale('zz')).toBeUndefined();
    expect(messagesForLocale('zz-ZZ')).toBeUndefined();
    expect(messagesForLocale('')).toBeUndefined();
  });

  it('returns the registered override map, matching exact and base language', () => {
    const overrides = { common: { close: 'ZZZ-TEST' } };
    registerLocaleOverrides('zz', overrides);

    expect(messagesForLocale('zz')).toEqual(overrides);
    expect(messagesForLocale('ZZ')).toEqual(overrides);      // case-insensitive
    expect(messagesForLocale('zz-AU')).toEqual(overrides);   // region → base
  });

  it('rejects an empty locale tag', () => {
    expect(() => registerLocaleOverrides('  ', {})).toThrow(/non-empty locale/);
  });
});

describe('@phlix/ui seam merge semantics (real package)', () => {
  it('createTranslator overlays the client map and keeps English defaults for the rest', () => {
    const tr = createTranslator({ common: { close: 'ZZZ-TEST' } });
    expect(tr('common.close')).toBe('ZZZ-TEST');
    expect(tr('common.retry')).toBe(DEFAULT_MESSAGES.common.retry);
    expect(tr('shell.browse')).toBe(DEFAULT_MESSAGES.shell.browse);
  });

  it('mergeMessages never returns or mutates DEFAULT_MESSAGES', () => {
    const before = DEFAULT_MESSAGES.common.close;
    const merged = mergeMessages({ common: { close: 'ZZZ-TEST' } });
    expect(merged).not.toBe(DEFAULT_MESSAGES);
    expect(merged.common.close).toBe('ZZZ-TEST');
    expect(DEFAULT_MESSAGES.common.close).toBe(before);
    expect(mergeMessages().common.close).toBe(before);
  });
});
