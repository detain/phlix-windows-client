/**
 * audit-gate — npm-audit wrapper with an explicit, justified advisory allow-list.
 *
 * WHY THIS EXISTS:
 * The bare `npm audit --audit-level=high` step this gate replaces hides every
 * sub-high advisory and treats a broken audit as a green one. The gate is
 * stricter: the audit passes only while the reported advisory-id set is a
 * subset of ALLOWED_ADVISORIES below, and turns red the moment ANY advisory
 * not explicitly allow-listed appears — at any severity.
 *
 * HISTORY: the gate was founded 2026-10-03 for GHSA-ch52-4w7c-c8xp
 * (http-cache-semantics <=4.2.0, no patched release then). Upstream published
 * 4.3.0 on 2026-10-04 — inside cacheable-request's declared `^4.0.0` range —
 * and the documented removal plan ran on 2026-10-08: the lock took 4.3.0, the
 * ch52 entry was deleted, its fixtures rotated. The surviving entry,
 * GHSA-hp3w-g68c-fv3c (sprintf-js — no patched release ever: 1.1.3, published
 * 2023, is still the LAST version), was WITHDRAWN by the GitHub Advisory
 * Database on 2026-10-22 ("it is the responsibility of an application to
 * handle exceptions appropriately"), so npm no longer names it against any
 * lock. The 2026-10-29 time-drift sweep cleared 22 newly-disclosed advisories
 * (vitest/@vitest/mocker, electron, fast-uri, follow-redirects, undici, vite)
 * entirely with in-parent-range bumps — see the CHANGELOG entry this empty
 * allow-list rode with. The list sat EMPTY (maximum strictness) while both
 * founding advisories kept dedicated fail-loud tests in
 * tests/unit/audit-gate.test.mjs proving a reappearing report id reddens the
 * gate — if the lock ever regresses (or GitHub un-withdraws hp3w), CI halts;
 * nothing dormant is silently tolerated. On 2026-11-06 the list reopened for
 * exactly ONE reviewed decision: the two standing dev-chain moderate advisories
 * GHSA-3g3m-2fjr-6pw4 (glob) + GHSA-g3hv-75wg-m249 (minimatch) — every
 * in-parent-range cure measured impossible (whole-tree `npm update` AND a fresh
 * lockless re-resolve both reproduce the same two-id set; npm's own
 * fixAvailable is an electron-builder major downgrade — rejected). See the
 * justifications on the entries below and the CHANGELOG entry they ride with.
 *
 * ADDING AN ENTRY (the reviewed-decision law): only for an advisory that is
 * LIVE in the reported set, has no fix inside any declared parent range, and
 * is dev-chain-justified — with GHSA id, patched-version-absence evidence
 * (`npm view <pkg> versions` cited), and a re-verify-by date. Every entry
 * must carry a mirror fixture proving the exact set stays pinned.
 *
 * ANTI-NEUTERING LAW:
 * A silent gate is worse than no gate. The script distinguishes "audit clean"
 * from "audit broken": unparseable JSON, an unrecognized report shape, a failed
 * spawn, or a nonzero npm exit that reports ZERO advisories all exit with
 * EXIT_STRUCTURE_ERROR (2) — never 0. Unknown advisories exit EXIT_VIOLATION (1).
 *
 * Exit codes: 0 pass (clean or allowed-only) · 1 allow-list violation ·
 * 2 audit itself failed (structural — the verdict is unusable, not "clean").
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const EXIT_OK = 0;
export const EXIT_VIOLATION = 1;
export const EXIT_STRUCTURE_ERROR = 2;

// Exact GHSA ids the gate tolerates, each with the justification CI prints on
// every run. Subset semantics: ANY advisory id missing here reddens the gate.
// 2026-10-29 → 2026-11-06 the list was EMPTY (both founding entries retired
// for good: ch52 took 4.3.0 in-range 2026-10-08; hp3w WITHDRAWN upstream
// 2026-10-22, never reported again). The current two entries are reviewed
// decisions per the header law above — each with measured no-in-range-fix
// evidence, a removal plan, and mirror fixtures in tests/unit/audit-gate.test.mjs.
export const ALLOWED_ADVISORIES = new Map([
  [
    'GHSA-3g3m-2fjr-6pw4',
    {
      package: 'glob',
      justification:
        'dev-chain only — the single flagged copy is the hoisted glob@13.0.6 (EVERY glob ' +
        'node in the lock is dev:true; shipped app deps — electron-log/store/updater, vue, ' +
        'pinia, vue-router, @phlix/* — pull none); npm reports it under rimraf@6.1.3\'s ' +
        'declared ^13.0.3, with @electron/asar and js-beautify as users on the report graph. ' +
        'Moderate / CWE-400: post-timeout filesystem traversal when an AbortSignal is ' +
        'cancelled — triggered only by dev-authored patterns inside build/test tooling; no ' +
        'attacker-reachable input surface; no CVE assigned. NO FIX INSIDE ANY DECLARED ' +
        'PARENT RANGE: vulnerable >=9.0.0 <=14.0.1 flags EVERY published 9.x–13.x line ' +
        '(13.x tops out at 13.0.7, still flagged); the patched 14.0.2+ (latest 14.0.4) is ' +
        'major-reachable from no parent that keeps the hoist: js-beautify@latest (2.0.3, ' +
        'reached through @vue/test-utils\' ^2.4.0 — 2.4.6 declares js-beautify ^1.14.9, ' +
        'test-utils@latest declares ^2.0.0, and both js-beautify lines declare glob ^10/^13 ' +
        'ranges) and @electron/asar@latest still declare the 13.x vulnerable line; only ' +
        'rimraf@6.1.4 has moved (^14.0.3) — insufficient on a name-shared hoist while any ' +
        'vulnerable-range parent remains. npm audit fixAvailable = electron-builder ' +
        'downgrade to 25.1.0 (isSemVerMajor: true) — REJECTED: the ch52/http-cache-semantics ' +
        'era proved downgrading this toolchain regresses real security fixes; forcing majors ' +
        'via overrides is the S430 dodge-class, refused. In-range refusal MEASURED, not ' +
        'assumed: whole-tree `npm update` (every dep at max of its declared range) AND a ' +
        'fresh lockless re-resolve of package.json (both npm 11, 2026-11-06) reproduce this ' +
        'exact two-id advisory set. UPSTREAM WATCH (the removal plan): the moment js-beautify ' +
        'and @electron/asar declare ranges admitting glob >=14.0.2 — run ' +
        '`npm update && node scripts/audit-gate.mjs`, then REMOVE this entry and its mirror ' +
        'fixtures in tests/unit/audit-gate.test.mjs. Re-verify advisory status and parent ' +
        'declarations by 2027-02-04: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4',
    },
  ],
  [
    'GHSA-g3hv-75wg-m249',
    {
      package: 'minimatch',
      justification:
        'dev-chain only — two flagged installed copies: the hoisted minimatch@10.2.6 ' +
        '(declared by @typescript-eslint/typescript-estree ^10.2.2 + app-builder-lib ' +
        '^10.2.5 + glob@13\'s own ^10.2.2) and nested minimatch@9.0.9 under ' +
        '@electron/universal@2.0.3 (^9.0.3) + editorconfig@1.0.7 (^9.0.1); all lint / ' +
        'type-check / packaging tooling (EVERY minimatch node in the lock is dev:true; the ' +
        'shipped app pulls none). Moderate / CWE-405: DoS via brace-expansion amplification ' +
        'on attacker-SUPPLIED patterns — every pattern here is dev-authored build config, ' +
        'no runtime attacker surface; no CVE assigned. NO FIX INSIDE ANY DECLARED PARENT ' +
        'RANGE: vulnerable >=7.0.0 <11.0.1; the 10.x line TOPS OUT at the flagged 10.2.6 ' +
        '(= installed max) and the 9.x line dies at the flagged 9.0.9; patched 11.0.1 ' +
        '(latest 11.0.5) is above every parent line and the parents hold their lines even ' +
        'at latest — app-builder-lib@26.18.0 still declares ^10.2.5, ' +
        '@typescript-eslint/typescript-estree@8.72.1 still ^10.2.2, editorconfig@latest ' +
        'moved only to ~10.2.4 (still flagged), and @electron/universal@latest (3.0.6) ' +
        'dropped minimatch but app-builder-lib@latest still pins universal at EXACT 2.0.3. ' +
        'The pair is COUPLED on the fix side: patched glob@14.0.4 itself declares minimatch ' +
        '^11.0.5, so no chain order resolves either id without a parent major move (S430 ' +
        'refusal). Same electron-builder-25.1.0 downgrade fixAvailable — REJECTED (ch52-era ' +
        'precedent). In-range refusal MEASURED: whole-tree `npm update` AND fresh lockless ' +
        're-resolve (both npm 11, 2026-11-06) reproduce this id. UPSTREAM WATCH (the ' +
        'removal plan): once BOTH app-builder-lib AND typescript-estree declare minimatch ' +
        'ranges admitting >=11.0.1 (and the exact-2.0.3 universal pin frees), run ' +
        '`npm update && node scripts/audit-gate.mjs`, then REMOVE this entry and its mirror ' +
        'fixtures in tests/unit/audit-gate.test.mjs. Re-verify advisory status and parent ' +
        'declarations by 2027-02-04: https://github.com/advisories/GHSA-g3hv-75wg-m249',
    },
  ],
]);

const AUDIT_ARGS = ['audit', '--json', '--audit-level=high'];
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export class AuditGateError extends Error {}

/** Run the real `npm audit --json` the same way the replaced CI step did. */
export function runAudit() {
  // Windows CI legs execute this same step; npm there is npm.cmd, which Node
  // refuses to spawn without a shell since the CVE-2024-27980 hardening. The
  // argv is a fixed constant — no interpolation, no injection surface.
  const result = spawnSync('npm', AUDIT_ARGS, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
    shell: process.platform === 'win32',
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    spawnError: result.error ?? null,
  };
}

// GHSA ids are case-insensitive by spec. Extraction preserves the reported
// case for display; ALLOW-LIST MATCHING IS CASE-INSENSITIVE (decide() below
// lowercases both sides), so authoring a key as GHSA-… or ghsa-… both work.
function ghsaFromUrl(url) {
  const match = typeof url === 'string' ? /\/(GHSA-[0-9a-z]+(-[0-9a-z]+){2,3})$/i.exec(url) : null;
  return match ? match[1] : null;
}

function advisoryIdOf(via) {
  const fromUrl = ghsaFromUrl(via.url);
  if (fromUrl) return fromUrl;
  if (typeof via.github_advisory_id === 'string' && /^GHSA-/i.test(via.github_advisory_id)) {
    return via.github_advisory_id;
  }
  throw new AuditGateError(
    `advisory entry carries no resolvable GHSA id (url=${JSON.stringify(via.url ?? null)}); ` +
      `refusing to certify an unnamed advisory — ${JSON.stringify(via).slice(0, 200)}`,
  );
}

/** Parse npm audit JSON (report v3 `vulnerabilities`, legacy v2 `advisories`) into a Set of GHSA ids. */
export function collectAdvisoryIds(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new AuditGateError(
      `npm audit --json produced unparseable output: ${JSON.stringify(String(stdout).slice(0, 300))}`,
    );
  }
  if (report === null || typeof report !== 'object') {
    throw new AuditGateError(`npm audit --json produced a non-object report: ${JSON.stringify(report).slice(0, 200)}`);
  }

  const ids = new Set();
  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    for (const node of Object.values(report.vulnerabilities)) {
      for (const via of node?.via ?? []) {
        // v3: `via` strings name affected dependents; objects ARE the advisories.
        if (typeof via === 'object' && via !== null) ids.add(advisoryIdOf(via));
      }
    }
    return ids;
  }
  if (report.advisories && typeof report.advisories === 'object') {
    for (const advisory of Object.values(report.advisories)) {
      if (advisory && typeof advisory === 'object') ids.add(advisoryIdOf(advisory));
    }
    return ids;
  }
  throw new AuditGateError(
    'unrecognized npm audit JSON shape (no `vulnerabilities`/`advisories` key) — ' +
      `refusing to guess at an audit we cannot read: keys=[${Object.keys(report).join(',')}]`,
  );
}

/**
 * Pure decision: audit-run facts in, gate verdict out.
 * `allowList` defaults to the module-level reviewed set; tests inject synthetic
 * maps to exercise the subset/case-insensitivity laws without shipping a live
 * allow-list entry (the production entry point, main(), never overrides it).
 * Returns { code, clean, allowed[], unknown[], problems[] }.
 */
export function decide({ exitCode, stdout, spawnError = null, allowList = ALLOWED_ADVISORIES }) {
  if (spawnError) {
    return {
      code: EXIT_STRUCTURE_ERROR,
      clean: false,
      allowed: [],
      unknown: [],
      problems: [`npm audit could not be executed: ${spawnError.message}`],
    };
  }

  let ids;
  try {
    ids = collectAdvisoryIds(stdout);
  } catch (error) {
    return {
      code: EXIT_STRUCTURE_ERROR,
      clean: false,
      allowed: [],
      unknown: [],
      problems: [error instanceof AuditGateError ? error.message : `audit parse failed: ${error.message}`],
    };
  }

  const canonicalKeyByLowerId = new Map([...allowList.keys()].map((key) => [key.toLowerCase(), key]));
  const allowed = [...ids]
    .filter((id) => canonicalKeyByLowerId.has(id.toLowerCase()))
    .map((id) => canonicalKeyByLowerId.get(id.toLowerCase()))
    .sort();
  const unknown = [...ids].filter((id) => !canonicalKeyByLowerId.has(id.toLowerCase())).sort();
  const problems = [];
  if (unknown.length > 0) {
    problems.push(
      `${unknown.length} advisory id(s) are NOT on the allow-list: ${unknown.join(', ')} — ` +
        'fix the dependency (preferred) or justify a deliberate, reviewed ALLOWED_ADVISORIES entry.',
    );
  }
  // Anti-neutering: nonzero exit with nothing allow-listable means the audit
  // command itself failed — an unread verdict is never a green verdict.
  if (exitCode !== 0 && ids.size === 0) {
    problems.push(
      `npm audit exited ${exitCode} while reporting ZERO advisories — the audit command failed; ` +
        'refusing to treat a broken audit as a clean one.',
    );
  }
  if (problems.length > 0) {
    return { code: unknown.length > 0 ? EXIT_VIOLATION : EXIT_STRUCTURE_ERROR, clean: false, allowed, unknown, problems };
  }
  return { code: EXIT_OK, clean: exitCode === 0 && ids.size === 0, allowed, unknown, problems };
}

export function main() {
  const audit = runAudit();
  const verdict = decide(audit);

  for (const id of verdict.allowed) {
    const entry = ALLOWED_ADVISORIES.get(id);
    console.log(`audit-gate: ALLOWED ${id} (${entry.package}) — ${entry.justification}`);
  }
  for (const problem of verdict.problems) {
    console.error(`audit-gate: ${problem}`);
  }
  if (verdict.code === EXIT_OK) {
    console.log(
      verdict.clean
        ? 'audit-gate: PASS — npm audit clean (0 advisories, exit 0)'
        : `audit-gate: PASS — ${verdict.allowed.length} advisory id(s) reported, every one allow-listed (npm audit exit ${audit.exitCode})`,
    );
  }
  return verdict.code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
