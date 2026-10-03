/**
 * audit-gate — npm-audit wrapper with an explicit, justified advisory allow-list.
 *
 * WHY THIS EXISTS:
 * `npm audit --audit-level=high` on master is red solely on GHSA-ch52-4w7c-c8xp
 * (http-cache-semantics max-stale cross-user response disclosure). That advisory
 * has NO patched target — every published release of http-cache-semantics
 * (<=4.2.0, latest included) is flagged — so no bump can clear it, and npm's own
 * suggested fix (electron-builder 26.5.0 downgrade) was adversarially PROVEN to
 * regress 1 critical + 2 highs. Overrides are impossible (the declaration is a
 * caret range deep in a git-pinned toolchain). The gate therefore ships as a
 * DOCUMENTED ALLOW-LIST: the audit passes only while the reported advisory-id set
 * is a subset of ALLOWED_ADVISORIES below, and turns red the moment ANY other
 * advisory appears — at any severity, unlike the bare --audit-level=high step
 * this replaces, which silently passed sub-high findings.
 *
 * REACH (why this one advisory is acceptable): dev-chain-only. The path is
 * electron-builder → app-builder-lib → @electron/get → got → cacheable-request →
 * http-cache-semantics; the shipped app bundles none of it (package.json keeps
 * electron-builder in devDependencies; `npm audit --json` metadata reports zero
 * prod-path hits). 8 high "vulnerabilities" in npm's human output are 8 affected
 * PACKAGES traced to this ONE advisory id — the JSON-parse below dedupes by id.
 *
 * UPSTREAM WATCH (the removal plan — Option B):
 * cacheable-request declares `http-cache-semantics: ^4.0.0` (got 11.8.6 chain),
 * so ANY fixed release (4.2.1+, if the advisory ever receives one) is inside the
 * declared range. The moment one exists:
 *     npm update http-cache-semantics && node scripts/audit-gate.mjs
 * then DELETE this allow-list entry, its justification, and the ch52 fixtures in
 * tests/unit/audit-gate.test.mjs (which pin the entry's existence and flip red
 * when it is removed while the advisory still reports).
 * Re-verify status by 2027-01-03: https://github.com/advisories/GHSA-ch52-4w7c-c8xp
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
    'GHSA-ch52-4w7c-c8xp',
    {
      package: 'http-cache-semantics',
      justification:
        'dev-chain-only (electron-builder -> @electron/get -> got -> cacheable-request -> ' +
        'http-cache-semantics; zero prod parents, nothing shipped to users); no patched ' +
        'release exists — every published version <=4.2.0 is flagged and npm audit fix --force ' +
        'downgrades electron-builder to 26.5.0, which regresses 1 critical + 2 highs (rejected); ' +
        'overrides impossible under the caret range. UPSTREAM WATCH: got 11.8.6 chain declares ' +
        '^4.0.0, so `npm update http-cache-semantics` clears it the moment 4.2.1+ lands — then ' +
        'REMOVE this entry. Re-verify advisory status by 2027-01-03.',
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
