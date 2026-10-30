/**
 * M-WINDOWS-44 (review windows__secnet 3): rejection paths must not echo the
 * rejected value. A URL that got REFUSED is precisely the one that may carry
 * a secret (malformed invite, probing path, credential bait) — logging it raw
 * defeats the W3 redaction law one layer down, in the log files.
 * Law now: scheme//host summaries for parseable URLs, 'unparseable URL' for
 * junk, length-only for rejected app:// asset paths.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), initialize: vi.fn() }
}));

import log from 'electron-log';
import { validateExternalUrl, validateNavigationUrl, summarizeUrlForLog } from '../../src/main/urlValidator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const warnArgs = () =>
  (log.warn as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));

describe('M-WINDOWS-44: log summaries carry no raw rejected input', () => {
  it('summarizeUrlForLog keeps scheme+host (port is part of host identity)', () => {
    expect(summarizeUrlForLog('https://media.example.com/private/invite/SECRET123?token=abc'))
      .toBe('https://media.example.com');
    expect(summarizeUrlForLog('http://127.0.0.1:8096/x')).toBe('http://127.0.0.1:8096');
    expect(summarizeUrlForLog('not a url at all')).toBe('unparseable URL');
    expect(summarizeUrlForLog('')).toBe('unparseable URL');
  });

  it('external-protocol refusals never quote the payload', () => {
    (log.warn as ReturnType<typeof vi.fn>).mockClear();
    expect(validateExternalUrl('file:///C:/secrets/tok=DO-NOT-LOG')).toBe(false);
    const logged = warnArgs().join('\n');
    expect(logged).toContain('file://');
    expect(logged).not.toContain('DO-NOT-LOG');
    expect(logged).not.toContain('/C:/secrets');
  });

  it('malformed refusals do not round-trip the junk either', () => {
    (log.warn as ReturnType<typeof vi.fn>).mockClear();
    expect(validateExternalUrl('ht!//user:SEKRIT@x')).toBe(false);
    expect(validateNavigationUrl('ht!//user:SEKRIT@x')).toBe(false);
    expect(warnArgs().join('\n')).not.toContain('SEKRIT');
  });

  it('the app:// invalid-path refusal logs a length-only shape', () => {
    const main = readFileSync(resolve(__dirname, '../../src/main/index.ts'), 'utf-8');
    const idx = main.indexOf('[app protocol]');
    expect(idx).toBeGreaterThan(-1);
    const slice = main.slice(idx - 120, idx + 260);
    expect(slice).toMatch(/Invalid path format/);
    expect(slice).toMatch(/urlPath\.length/);
    expect(slice).not.toMatch(/Invalid path format: \$\{urlPath\}/);
  });

  it('the deep-link parser already logs scheme/host only (proof pin, not regression bait)', () => {
    const dv = readFileSync(resolve(__dirname, '../../src/main/deepLinkValidator.ts'), 'utf-8');
    const warns = dv.match(/log\.warn\(`[^\n]+`\)/g) ?? [];
    for (const line of warns) {
      expect(line).not.toMatch(/\$\{url\}/);
      expect(line).not.toMatch(/\$\{candidate\}/);
    }
  });

  it('versionCheck logs no raw apiBase on its refusal path', () => {
    const vc = readFileSync(resolve(__dirname, '../../src/main/versionCheck.ts'), 'utf-8');
    const refuse = vc.slice(vc.indexOf('isFetchableApiBase(apiBase)'));
    expect(refuse.slice(0, 600)).toMatch(/Refused non-fetchable apiBase/);
    expect(refuse.slice(0, 600)).not.toMatch(/\$\{apiBase\}/);
  });
});
