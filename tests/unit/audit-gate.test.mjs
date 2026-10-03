/**
 * @vitest-environment node
 *
 * Guard tests for scripts/audit-gate.mjs — the npm-audit allow-list gate wired
 * into .github/workflows/test.yml + build.yml. The gate exists because master CI
 * is red on GHSA-ch52-4w7c-c8xp (http-cache-semantics), an advisory with NO
 * patched release, reachable only through the electron-builder dev chain. It may
 * pass ONLY while every reported advisory id is explicitly allow-listed, and it
 * must fail LOUD on every neutering vector: unparseable JSON, unknown report
 * shape, a failed spawn, or a nonzero audit exit reporting zero advisories.
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_ADVISORIES,
  AuditGateError,
  EXIT_OK,
  EXIT_STRUCTURE_ERROR,
  EXIT_VIOLATION,
  collectAdvisoryIds,
  decide,
} from '../../scripts/audit-gate.mjs';

const CH52 = 'GHSA-ch52-4w7c-c8xp';

/** v3 npm-audit advisory object for an arbitrary GHSA (url carries the id). */
function advisory(ghsa, name = 'some-package', severity = 'high') {
  return {
    source: 1,
    name,
    dependency: name,
    title: `synthetic ${ghsa}`,
    url: `https://github.com/advisories/${ghsa}`,
    severity,
    range: '*',
  };
}

/** Minimal v3 report (auditReportVersion 3, `vulnerabilities` keyed by package). */
function v3Report(entries) {
  const vulnerabilities = {};
  for (const [pkg, vias] of Object.entries(entries)) {
    vulnerabilities[pkg] = { name: pkg, severity: 'high', isDirect: false, via: vias, effects: [] };
  }
  return { auditReportVersion: 3, vulnerabilities, metadata: { vulnerabilities: { total: 1, high: 1 } } };
}

const json = (report) => JSON.stringify(report);

describe('collectAdvisoryIds', () => {
  it('dedupes the eight affected electron-builder-chain packages down to the single real advisory', () => {
    // Condensed from the live `npm audit --json` on master @ 344b9bb: npm counts
    // 8 vulnerable PACKAGES but the advisory set is exactly one GHSA.
    const chain = ['@electron/get', 'app-builder-lib', 'cacheable-request', 'dmg-builder',
      'electron-builder', 'electron-builder-squirrel-windows', 'got'];
    const report = v3Report({
      ...Object.fromEntries(chain.map((pkg) => [pkg, [pkg === 'electron-builder' ? 'got' : pkg]])),
      'http-cache-semantics': [advisory(CH52, 'http-cache-semantics')],
    });
    expect([...collectAdvisoryIds(json(report))]).toEqual([CH52]);
  });

  it('collects every distinct advisory id across packages', () => {
    const report = v3Report({
      a: [advisory(CH52, 'a')],
      b: [advisory('GHSA-aaaa-bbbb-cccc', 'b'), 'a'],
    });
    expect([...collectAdvisoryIds(json(report))].sort()).toEqual(['GHSA-aaaa-bbbb-cccc', CH52]);
  });

  it('falls back to a github_advisory_id field when the url lacks a GHSA path', () => {
    const report = v3Report({ a: [{ name: 'a', severity: 'high', github_advisory_id: 'GHSA-zzzz-zzzz-zzzz' }] });
    expect([...collectAdvisoryIds(json(report))]).toEqual(['GHSA-zzzz-zzzz-zzzz']);
  });

  it('reads the legacy v2 `advisories`-keyed shape', () => {
    const report = { auditReportVersion: 2, advisories: { 100: { github_advisory_id: CH52, module_name: 'http-cache-semantics' } }, metadata: {} };
    expect([...collectAdvisoryIds(json(report))]).toEqual([CH52]);
  });

  it('throws on unparseable output instead of guessing', () => {
    expect(() => collectAdvisoryIds('not json {{{')).toThrow(AuditGateError);
  });

  it('throws on a recognized-object report missing both known shapes', () => {
    expect(() => collectAdvisoryIds(json({ auditReportVersion: 9, message: 'future npm' }))).toThrow(/unrecognized npm audit JSON shape/);
  });

  it('throws on an advisory entry that carries no resolvable GHSA id', () => {
    expect(() => collectAdvisoryIds(json(v3Report({ a: [{ name: 'a', severity: 'high' }] })))).toThrow(/no resolvable GHSA id/);
  });
});

describe('decide — pass verdicts', () => {
  it('passes a clean audit (exit 0, no advisories)', () => {
    const verdict = decide({ exitCode: 0, stdout: json(v3Report({})) });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.clean).toBe(true);
    expect(verdict.allowed).toEqual([]);
  });

  it('passes the live ch52-only state and names it as allowed', () => {
    const verdict = decide({ exitCode: 1, stdout: json(v3Report({ 'http-cache-semantics': [advisory(CH52, 'http-cache-semantics')] })) });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([CH52]);
    expect(ALLOWED_ADVISORIES.get(CH52).justification).toMatch(/UPSTREAM WATCH/);
    expect(ALLOWED_ADVISORIES.get(CH52).justification).toMatch(/Re-verify advisory status by 2027-01-03/);
  });

  it('matches allow-list entries case-insensitively (GHSA ids are case-insensitive by spec)', () => {
    const verdict = decide({ exitCode: 1, stdout: json(v3Report({ a: [advisory(CH52.toUpperCase(), 'a')] })) });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([CH52]); // canonical key form surfaces downstream
  });
});

describe('decide — fail-loud verdicts', () => {
  it('reddens when ch52 is joined by ANY new advisory', () => {
    const verdict = decide({
      exitCode: 1,
      stdout: json(v3Report({
        'http-cache-semantics': [advisory(CH52, 'http-cache-semantics')],
        evil: [advisory('GHSA-dead-beef-cafe', 'evil')],
      })),
    });
    expect(verdict.code).toBe(EXIT_VIOLATION);
    expect(verdict.unknown).toEqual(['GHSA-dead-beef-cafe']);
    expect(verdict.problems.join(' ')).toMatch(/NOT on the allow-list: GHSA-dead-beef-cafe/);
    expect(verdict.allowed).toEqual([CH52]); // still reported for context
  });

  it('reddens even when npm itself exits 0 below its --audit-level threshold (stricter than the bare step)', () => {
    const verdict = decide({ exitCode: 0, stdout: json(v3Report({ a: [advisory('GHSA-aaaa-bbbb-cccc', 'a', 'moderate')] })) });
    expect(verdict.code).toBe(EXIT_VIOLATION);
    expect(verdict.unknown).toEqual(['GHSA-aaaa-bbbb-cccc']);
  });

  it('refuses to treat a failed spawn as clean', () => {
    const verdict = decide({ exitCode: -1, stdout: '', spawnError: Object.assign(new Error('ENOENT npm'), {}) });
    expect(verdict.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(verdict.problems.join(' ')).toMatch(/could not be executed/);
  });

  it('refuses a nonzero audit exit that reports zero advisories (anti-neutering)', () => {
    const verdict = decide({ exitCode: 1, stdout: json(v3Report({})) });
    expect(verdict.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(verdict.problems.join(' ')).toMatch(/ZERO advisories/);
    expect(verdict.problems.join(' ')).toMatch(/broken audit/);
  });

  it('refuses unparseable output on a nonzero exit', () => {
    const verdict = decide({ exitCode: 1, stdout: '<html>registry error</html>' });
    expect(verdict.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(verdict.problems.join(' ')).toMatch(/unparseable/);
  });

  it('refuses an npm error envelope that parses but names no advisory shape', () => {
    const verdict = decide({ exitCode: 1, stdout: json({ message: '404 Not Found - registry', 'npm-id': 'x' }) });
    expect(verdict.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(verdict.problems.join(' ')).toMatch(/unrecognized npm audit JSON shape/);
  });

  it('refuses an advisory it cannot name', () => {
    const verdict = decide({ exitCode: 1, stdout: json(v3Report({ a: [{ name: 'a', severity: 'high' }] })) });
    expect(verdict.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(verdict.problems.join(' ')).toMatch(/no resolvable GHSA id/);
  });
});

describe('allow-list integrity', () => {
  it('contains EXACTLY the one justified ch52 entry — additions/removals must be a reviewed decision', () => {
    expect([...ALLOWED_ADVISORIES.keys()]).toEqual([CH52]);
  });

  it('keys every entry in the canonical npm-reported GHSA form', () => {
    for (const key of ALLOWED_ADVISORIES.keys()) {
      expect(key).toMatch(/^GHSA-[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/);
    }
  });

  it('requires a non-empty justification on every entry', () => {
    for (const [key, entry] of ALLOWED_ADVISORIES) {
      expect(entry.justification, key).toBeTruthy();
      expect(entry.package, key).toBeTruthy();
    }
  });
});
