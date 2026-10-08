/**
 * @vitest-environment node
 *
 * Guard tests for scripts/audit-gate.mjs — the npm-audit allow-list gate wired
 * into .github/workflows/test.yml + build.yml. The gate exists because the dev
 * toolchain reports GHSA-hp3w-g68c-fv3c (sprintf-js), an advisory with NO
 * patched release, reachable only through the electron-builder optional-dep
 * chain — and being moderate severity, the bare --audit-level=high step would
 * swallow it silently. It may pass ONLY while every reported advisory id is
 * explicitly allow-listed, and it must fail LOUD on every neutering vector:
 * unparseable JSON, unknown report shape, a failed spawn, or a nonzero audit
 * exit reporting zero advisories.
 *
 * HISTORY: the founding entry was GHSA-ch52-4w7c-c8xp (http-cache-semantics);
 * upstream 4.3.0 landed 2026-10-04 inside the declared ^4.0.0 range and the
 * documented removal plan executed 2026-10-08 — the entry and its fixtures were
 * deleted, and every "live reported advisory" role below is carried by hp3w.
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

const HP3W = 'GHSA-hp3w-g68c-fv3c';

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
    // Condensed from the live `npm audit --json` on master after http-cache-semantics
    // 4.3.0 cleared ch52: npm counts 8 vulnerable PACKAGES but the advisory set is
    // exactly one GHSA (hp3w), reached through the optional global-agent → roarr arm.
    const report = v3Report({
      '@electron/get': ['global-agent'],
      'app-builder-lib': ['@electron/get', 'dmg-builder', 'electron-builder-squirrel-windows'],
      'dmg-builder': ['app-builder-lib'],
      'electron-builder': ['app-builder-lib', 'dmg-builder'],
      'electron-builder-squirrel-windows': ['app-builder-lib'],
      'global-agent': ['roarr'],
      roarr: ['sprintf-js'],
      'sprintf-js': [advisory(HP3W, 'sprintf-js', 'moderate')],
    });
    expect([...collectAdvisoryIds(json(report))]).toEqual([HP3W]);
  });

  it('collects every distinct advisory id across packages', () => {
    const report = v3Report({
      a: [advisory(HP3W, 'a')],
      b: [advisory('GHSA-aaaa-bbbb-cccc', 'b'), 'a'],
    });
    expect([...collectAdvisoryIds(json(report))].sort()).toEqual(['GHSA-aaaa-bbbb-cccc', HP3W]);
  });

  it('falls back to a github_advisory_id field when the url lacks a GHSA path', () => {
    const report = v3Report({ a: [{ name: 'a', severity: 'high', github_advisory_id: 'GHSA-zzzz-zzzz-zzzz' }] });
    expect([...collectAdvisoryIds(json(report))]).toEqual(['GHSA-zzzz-zzzz-zzzz']);
  });

  it('reads the legacy v2 `advisories`-keyed shape', () => {
    const report = { auditReportVersion: 2, advisories: { 100: { github_advisory_id: HP3W, module_name: 'sprintf-js' } }, metadata: {} };
    expect([...collectAdvisoryIds(json(report))]).toEqual([HP3W]);
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

  it('passes the live hp3w-only state with its documented escape analysis', () => {
    // The real master reading: npm exits 0 (moderate < --audit-level=high) while
    // the JSON still names hp3w — the subset law allows it, `clean` stays false.
    const verdict = decide({
      exitCode: 0,
      stdout: json(v3Report({ 'sprintf-js': [advisory(HP3W, 'sprintf-js', 'moderate')] })),
    });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.clean).toBe(false);
    expect(verdict.allowed).toEqual([HP3W]);
    const hp3w = ALLOWED_ADVISORIES.get(HP3W);
    expect(hp3w.package).toBe('sprintf-js');
    expect(hp3w.justification).toMatch(/optional/i);
    expect(hp3w.justification).toMatch(/no patched release exists/);
    expect(hp3w.justification).toMatch(/UPSTREAM WATCH/);
    expect(hp3w.justification).toMatch(/Re-verify advisory status by 2027-01-03/);
  });

  it('matches allow-list entries case-insensitively (GHSA ids are case-insensitive by spec)', () => {
    const verdict = decide({ exitCode: 1, stdout: json(v3Report({ a: [advisory(HP3W.toUpperCase(), 'a')] })) });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([HP3W]); // canonical key form surfaces downstream
  });
});

describe('decide — fail-loud verdicts', () => {
  it('reddens when hp3w is joined by ANY new advisory — an id NOT on the one-entry allow-list exits 1', () => {
    const verdict = decide({
      exitCode: 1,
      stdout: json(v3Report({
        'sprintf-js': [advisory(HP3W, 'sprintf-js', 'moderate')],
        evil: [advisory('GHSA-dead-beef-cafe', 'evil')],
      })),
    });
    expect(verdict.code).toBe(EXIT_VIOLATION);
    expect(verdict.unknown).toEqual(['GHSA-dead-beef-cafe']);
    expect(verdict.problems.join(' ')).toMatch(/NOT on the allow-list: GHSA-dead-beef-cafe/);
    expect(verdict.allowed).toEqual([HP3W]); // still reported for context
  });

  it('rejects the cleared founding advisory too — re-adding ch52 to the report reddens the gate', () => {
    // http-cache-semantics <=4.2.0 was fixed by taking 4.3.0 in-lockstep with this
    // allow-list rotation; if the lock ever regresses and npm names ch52 again,
    // the one-entry allow-list must NOT cover it.
    const verdict = decide({
      exitCode: 1,
      stdout: json(v3Report({ 'http-cache-semantics': [advisory('GHSA-ch52-4w7c-c8xp', 'http-cache-semantics')] })),
    });
    expect(verdict.code).toBe(EXIT_VIOLATION);
    expect(verdict.unknown).toEqual(['GHSA-ch52-4w7c-c8xp']);
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
  it('contains EXACTLY the one justified entry (hp3w) — ch52 is removed for good, additions/removals must be a reviewed decision', () => {
    expect([...ALLOWED_ADVISORIES.keys()]).toEqual([HP3W]);
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
