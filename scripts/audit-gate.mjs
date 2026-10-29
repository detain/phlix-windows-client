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
 * allow-list rides with. ALLOWED_ADVISORIES is now EMPTY: the gate is at
 * maximum strictness. Both founding advisories keep dedicated fail-loud tests
 * in tests/unit/audit-gate.test.mjs proving a reappearing report id reddens the
 * gate — if the lock ever regresses (or GitHub un-withdraws hp3w), CI halts;
 * nothing dormant is silently tolerated.
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
// EMPTY since 2026-10-29 — both founding entries retired for good (ch52: 4.3.0
// taken in-range 2026-10-08; hp3w: WITHDRAWN upstream 2026-10-22, never
// reported again). Additions are reviewed decisions per the header law above.
export const ALLOWED_ADVISORIES = new Map([]);

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
