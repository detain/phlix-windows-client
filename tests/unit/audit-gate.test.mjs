/**
 * @vitest-environment node
 *
 * Guard tests for scripts/audit-gate.mjs — the npm-audit allow-list gate wired
 * into .github/workflows/test.yml + build.yml. The gate is STRICTER than the
 * bare `npm audit --audit-level=high` step it replaces: it may pass ONLY while
 * every reported advisory id is explicitly allow-listed (at any severity), and
 * it must fail LOUD on every neutering vector: unparseable JSON, unknown
 * report shape, a failed spawn, or a nonzero audit exit reporting zero
 * advisories.
 *
 * HISTORY: the founding entry was GHSA-ch52-4w7c-c8xp (http-cache-semantics);
 * upstream 4.3.0 landed 2026-10-04 inside the declared ^4.0.0 range and the
 * documented removal plan executed 2026-10-08. The surviving entry,
 * GHSA-hp3w-g68c-fv3c (sprintf-js, no patched release ever published), was
 * WITHDRAWN by the GitHub Advisory Database on 2026-10-22 — npm no longer
 * names it — and the 2026-10-29 time-drift sweep cleared the remaining 22
 * live advisories entirely with in-parent-range bumps. ALLOWED_ADVISORIES is
 * now EMPTY (maximum strictness); both retired ids keep must-stay-gone
 * fail-loud tests below, and the subset/case-insensitivity laws are exercised
 * through decide()'s injected allowList parameter rather than a shipped entry.
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
const SYNTH = 'GHSA-synth-etst-0001';

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
    // HISTORICAL reading (hp3w era, pre-2026-10-22 withdrawal): npm counted 8
    // vulnerable PACKAGES but the advisory set was exactly one GHSA, reached
    // through the optional global-agent → roarr arm. The dedupe-by-id law this
    // fixture guards is load-bearing for the empty-list strictness of today.
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

  it('passes an allowed-only report through the subset law (injected synthetic map; the production list is EMPTY)', () => {
    // The pre-2026-10-29 live reading: npm exited 0 while the JSON still named a
    // moderate sub-threshold advisory — the subset law allowed it, `clean` stayed
    // false. Today no id may ride the production list; the law itself is guarded
    // with an injected map so strictness never rots back into silent tolerance.
    const allowList = new Map([[SYNTH, { package: 'some-package', justification: 'synthetic' }]]);
    const verdict = decide({
      exitCode: 0,
      allowList,
      stdout: json(v3Report({ 'some-package': [advisory(SYNTH, 'some-package', 'moderate')] })),
    });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.clean).toBe(false);
    expect(verdict.allowed).toEqual([SYNTH]);
  });

  it('matches allow-list entries case-insensitively (GHSA ids are case-insensitive by spec)', () => {
    const allowList = new Map([[SYNTH, { package: 'a', justification: 'synthetic' }]]);
    const verdict = decide({
      exitCode: 1,
      allowList,
      stdout: json(v3Report({ a: [advisory(SYNTH.toUpperCase(), 'a')] })),
    });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([SYNTH]); // canonical key form surfaces downstream
  });
});

describe('decide — fail-loud verdicts', () => {
  it('reddens when an allowed advisory is joined by ANY new id — a non-allow-listed id exits 1 (injected map)', () => {
    const allowList = new Map([[HP3W, { package: 'sprintf-js', justification: 'synthetic' }]]);
    const verdict = decide({
      exitCode: 1,
      allowList,
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

  it('rejects BOTH retired founding advisories — ch52 (cleared by 4.3.0) and hp3w (withdrawn upstream) must never ride the empty production list', () => {
    // ch52: http-cache-semantics <=4.2.0 was fixed by taking 4.3.0 in-lockstep
    // with the 2026-10-08 allow-list rotation. hp3w: GitHub WITHDREW the
    // sprintf-js advisory on 2026-10-22 (never any patched release — 1.1.3 is
    // still the last version ever published). If the lock ever regresses, or
    // GitHub ever un-withdraws, and npm names either id again, the now-empty
    // production allow-list must NOT cover it.
    for (const [ghsa, pkg] of [
      ['GHSA-ch52-4w7c-c8xp', 'http-cache-semantics'],
      [HP3W, 'sprintf-js'],
    ]) {
      const verdict = decide({
        exitCode: 1,
        stdout: json(v3Report({ [pkg]: [advisory(ghsa, pkg)] })),
      });
      expect(verdict.code, ghsa).toBe(EXIT_VIOLATION);
      expect(verdict.unknown, ghsa).toEqual([ghsa]);
    }
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
  it('is EMPTY since the 2026-10-29 sweep — both founding entries retired for good; any addition must be a reviewed decision', () => {
    expect([...ALLOWED_ADVISORIES.keys()]).toEqual([]);
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
