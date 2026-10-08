/**
 * audit-gate — npm-audit wrapper with an explicit, justified advisory allow-list.
 *
 * WHY THIS EXISTS:
 * The dev toolchain reports GHSA-hp3w-g68c-fv3c (sprintf-js). It has NO patched
 * target — every published release (<=1.1.3, the LAST version ever published,
 * 2023) is flagged — so no bump can clear it, and npm's own suggested fix
 * (downgrading the electron-builder toolchain) was adversarially PROVEN to
 * regress criticals in the founding ch52 era. Being moderate severity, the bare
 * `npm audit --audit-level=high` step this gate replaces exits 0 WITHOUT even
 * naming it. The gate is stricter: the audit passes only while the reported
 * advisory-id set is a subset of ALLOWED_ADVISORIES below, and turns red the
 * moment ANY other advisory appears — at any severity.
 *
 * HISTORY: the gate was founded 2026-10-03 for GHSA-ch52-4w7c-c8xp
 * (http-cache-semantics <=4.2.0, no patched release then). Upstream published
 * 4.3.0 on 2026-10-04 — inside cacheable-request's declared `^4.0.0` range —
 * and the documented removal plan ran on 2026-10-08: the lock took 4.3.0, the
 * ch52 entry was deleted, its fixtures rotated. hp3w is the sole survivor.
 *
 * REACH (why the hp3w advisory is acceptable): dev-chain-only, reached solely
 * through an OPTIONAL dependency: electron-builder → app-builder-lib →
 * @electron/get → global-agent? → roarr → sprintf-js. The shipped app bundles
 * none of it (package.json keeps electron-builder in devDependencies; `npm
 * audit --json` metadata reports zero prod-path hits). The 8 "vulnerabilities"
 * in npm's human output are 8 affected PACKAGES traced to this ONE advisory id
 * — the JSON-parse below dedupes by id.
 *
 * UPSTREAM WATCH (the hp3w removal plan):
 * app-builder-lib declares @electron/get ^3.0.0 at the newest v26 tag (26.17.0);
 * @electron/get 5.1.0 dropped global-agent entirely, and roarr >=3.2.0 drops
 * sprintf-js (unreachable from global-agent 3.0.0's range). The moment
 * app-builder-lib declares @electron/get >=5 (or roarr >=3.2 becomes reachable):
 *     npm update && node scripts/audit-gate.mjs
 * then DELETE this allow-list entry, its justification, and the hp3w fixtures in
 * tests/unit/audit-gate.test.mjs (which pin the entry's existence and flip red
 * when it is removed while the advisory still reports).
 * Re-verify status by 2027-01-03: https://github.com/advisories/GHSA-hp3w-g68c-fv3c
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
export const ALLOWED_ADVISORIES = new Map([
  [
    'GHSA-hp3w-g68c-fv3c',
    {
      package: 'sprintf-js',
      justification:
        'dev-chain-only, reached solely through an OPTIONAL dependency (electron-builder -> ' +
        'app-builder-lib -> @electron/get -> global-agent? -> roarr -> sprintf-js; @electron/get ' +
        'declares global-agent as optionalDependencies ^3.0.0, npm installs it, nothing shipped ' +
        'to users — zero prod parents); no patched release exists — every published version ' +
        '<=1.1.3 is flagged and 1.1.3 is the LAST release ever published (2023), so no bump can ' +
        'clear it; roarr >=3.2.0 drops the sprintf-js dependency entirely but is unreachable ' +
        'from global-agent 3.0.0\'s declared range, and npm audit fix --force downgrades the ' +
        'electron-builder toolchain (same regression class as the historical ch52/' +
        'http-cache-semantics downgrade fix — proven to regress criticals — rejected). ' +
        'The other advisories surfaced alongside it on the ubuntu-26.04 audit (shell-quote ' +
        'CRITICAL GHSA-pqg4, source-map-js + @vue/server-renderer HIGH, postcss-selector-parser ' +
        'MODERATE) ALL had patched targets and were cleared in-range by npm update — see the ' +
        'lockfile commit this entry rides with; only this one has no escape but documentation. ' +
        'UPSTREAM WATCH (the removal plan): app-builder-lib still declares @electron/get ' +
        '^3.0.0 at the newest v26 tag (26.17.0); @electron/get 5.1.0 dropped global-agent ' +
        'entirely. The moment app-builder-lib declares @electron/get >=5 (or roarr >=3.2 becomes ' +
        'reachable): `npm update && node scripts/audit-gate.mjs`, then REMOVE this entry, its ' +
        'justification, and the hp3w fixtures in tests/unit/audit-gate.test.mjs. Re-verify ' +
        'advisory status by 2027-01-03: https://github.com/advisories/GHSA-hp3w-g68c-fv3c',
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
 * Returns { code, clean, allowed[], unknown[], problems[] }.
 */
export function decide({ exitCode, stdout, spawnError = null }) {
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

  const canonicalKeyByLowerId = new Map([...ALLOWED_ADVISORIES.keys()].map((key) => [key.toLowerCase(), key]));
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
