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
 * live advisories entirely with in-parent-range bumps, EMPTYING the list to
 * maximum strictness. On 2026-11-06 the list reopened for exactly ONE reviewed
 * decision: the standing dev-chain moderate pair GHSA-3g3m-2fjr-6pw4 (glob) +
 * GHSA-g3hv-75wg-m249 (minimatch), admitted after their in-range cures were
 * MEASURED impossible (whole-tree `npm update` AND a fresh lockless
 * re-resolve both reproduce the same two-id set; the only npm fixAvailable is
 * an electron-builder major downgrade — rejected; see the entry justifications
 * in scripts/audit-gate.mjs). Both retired founding ids keep their
 * must-stay-gone fail-loud tests below; the live pair is pinned by dedicated
 * mirror fixtures exercising the PRODUCTION list, and the
 * subset/case-insensitivity laws stay exercised through decide()'s injected
 * allowList parameter so strictness never rots back into silent tolerance.
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
const G3GM = 'GHSA-3g3m-2fjr-6pw4'; // glob — live reviewed entry since 2026-11-06
const G3HV = 'GHSA-g3hv-75wg-m249'; // minimatch — live reviewed entry since 2026-11-06

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

  it('passes an allowed-only report through the subset law (injected synthetic map; the live production pair has its own mirror fixtures below)', () => {
    // The pre-2026-10-29 live reading: npm exited 0 while the JSON still named a
    // moderate sub-threshold advisory — the subset law allowed it, `clean` stayed
    // false. The injected map keeps guarding the LAW ITSELF so production
    // strictness never rots back into silent tolerance; the shipped 2026-11-06
    // pair is pinned separately against the real report shape.
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
    // GitHub ever un-withdraws, and npm names either id again, the production
    // allow-list (which since 2026-11-06 names ONLY the two reviewed glob/
    // minimatch ids) must NOT cover it.
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
  it('pins the EXACT reviewed set — the 2026-11-06 glob/minimatch pair; any addition, removal or rename is a reviewed-decision violation', () => {
    expect([...ALLOWED_ADVISORIES.keys()].sort()).toEqual([G3GM, G3HV]);
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

  it('carries removal-plan evidence on every entry (advisory URL + removal ritual + Re-verify-by date, per the header law)', () => {
    const reviewedPackages = { [G3GM]: 'glob', [G3HV]: 'minimatch' };
    for (const [key, entry] of ALLOWED_ADVISORIES) {
      expect(reviewedPackages, key).toHaveProperty(key); // a new key must be declared here too — fails loud
      expect(entry.package, key).toBe(reviewedPackages[key]);
      expect(entry.justification, key).toContain(`https://github.com/advisories/${key}`);
      expect(entry.justification, key).toMatch(/removal plan/i);
      expect(entry.justification, key).toMatch(/Re-verify .* by \d{4}-\d{2}-\d{2}/);
    }
  });
});

describe('2026-11-06 reviewed pair — mirror fixtures against the PRODUCTION list (no injection)', () => {
  // Report shapes mirror the live `npm audit` at the pinned lock: moderate
  // severities, npm itself exiting 0 below --audit-level=high. decide() called
  // WITHOUT an allowList argument — the exact production path main() takes.
  it('passes the live glob report (GHSA-3g3m-2fjr-6pw4)', () => {
    const verdict = decide({ exitCode: 0, stdout: json(v3Report({ glob: [advisory(G3GM, 'glob', 'moderate')] })) });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([G3GM]);
    expect(verdict.unknown).toEqual([]);
    expect(verdict.clean).toBe(false);
  });

  it('passes the live minimatch report (GHSA-g3hv-75wg-m249)', () => {
    const verdict = decide({ exitCode: 0, stdout: json(v3Report({ minimatch: [advisory(G3HV, 'minimatch', 'moderate')] })) });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([G3HV]);
    expect(verdict.unknown).toEqual([]);
    expect(verdict.clean).toBe(false);
  });

  it('passes the EXACT current-lock report — both ids together (the standing CI shape)', () => {
    const verdict = decide({
      exitCode: 0,
      stdout: json(v3Report({
        glob: [advisory(G3GM, 'glob', 'moderate')],
        minimatch: [advisory(G3HV, 'minimatch', 'moderate')],
      })),
    });
    expect(verdict.code).toBe(EXIT_OK);
    expect(verdict.allowed).toEqual([G3GM, G3HV]);
    expect(verdict.unknown).toEqual([]);
  });

  it('reddens the moment ANY third id joins the reviewed pair (subset law survives entry admission)', () => {
    const verdict = decide({
      exitCode: 1,
      stdout: json(v3Report({
        glob: [advisory(G3GM, 'glob', 'moderate')],
        minimatch: [advisory(G3HV, 'minimatch', 'moderate')],
        evil: [advisory('GHSA-eeee-eeee-eeee', 'evil', 'high')],
      })),
    });
    expect(verdict.code).toBe(EXIT_VIOLATION);
    expect(verdict.allowed).toEqual([G3GM, G3HV]);
    expect(verdict.unknown).toEqual(['GHSA-eeee-eeee-eeee']);
    expect(verdict.problems.join(' ')).toMatch(/NOT on the allow-list: GHSA-eeee-eeee-eeee/);
  });

  it('refuses the retired founding ids even now that the list is non-empty', () => {
    // Explicit cross-check of the 2026-11-06 state: admitting glob/minimatch
    // must NEVER read as blanket tolerance — ch52/hp3w are still unknowns.
    for (const [ghsa, pkg] of [['GHSA-ch52-4w7c-c8xp', 'http-cache-semantics'], [HP3W, 'sprintf-js']]) {
      const verdict = decide({
        exitCode: 1,
        stdout: json(v3Report({ [pkg]: [advisory(ghsa, pkg)], glob: [advisory(G3GM, 'glob', 'moderate')] })),
      });
      expect(verdict.code, ghsa).toBe(EXIT_VIOLATION);
      expect(verdict.unknown, ghsa).toEqual([ghsa]);
      expect(verdict.allowed, ghsa).toEqual([G3GM]);
    }
  });
});
