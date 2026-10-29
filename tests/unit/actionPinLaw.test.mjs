/**
 * @vitest-environment node
 *
 * M-WINDOWS-09 action-pin law — every third-party GitHub Action is frozen to a
 * full commit SHA with a tag-carrying comment (estate SHA-pin law).
 *
 * WHY: review `windows__devops` MAJ-3 enumerated repo-wide floating major tags
 * (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`,
 * `actions/download-artifact@v8`, `codecov/codecov-action@v6`,
 * `codacy/codacy-coverage-reporter-action@v1`, `softprops/action-gh-release@v3`,
 * `github/codeql-action/{init,analyze}@v3`). Floating tags are mutable refs:
 * an upstream tag re-point (hijack or accident) changes what this repo's CI —
 * including the two `permissions: contents: write` release jobs that publish
 * the installers the auto-update story depends on — executes the next run,
 * with no diff here to review. The estate cured this class during the
 * ubuntu-26.04 migration; this repo was the outlier left unpinned.
 *
 * PROVENANCE of the ledger below (resolved 2026-10-29 via
 * `gh api repos/{owner}/{repo}/git/ref/tags/{major}` peeled to the commit, at
 * the exact major each workflow already floated to — pins are behavior-
 * neutral: each freezes what the float resolved to TODAY):
 *  - actions/checkout       d23441a4… = v6.1.0 — byte-identical to the estate
 *                           precedent (25 pinned uses, e.g. phlix-hub
 *                           .github/workflows/ci.yml + docker.yml).
 *  - codacy/…               89d6c85c… = v1.3.0 — byte-identical to the estate
 *                           precedent (22 pinned uses, e.g. phlix-anidb).
 *  - codecov/…              fb8b3582… = v6.0.2 — the peel the estate recorded
 *                           for its codecov→v6 bump (phlix-mobile 3bec415).
 *  - setup-node             24997072… = v6.5.0 — no estate pin existed; live
 *                           v6 HEAD at resolution time.
 *  - upload-artifact        cf430e03… = v7.0.2 — live v7 HEAD; the earlier
 *                           estate freeze (phlix-console 043fb46d, v7.0.1) is
 *                           one patch BEHIND the float's current target — the
 *                           pin follows the float, not the stale freeze.
 *  - download-artifact      9000827c… = v8.0.2 — same story (console 3e5f45b2
 *                           = v8.0.1 predates the v8.0.2 patch).
 *  - softprops/…            efb35369… = v3.0.3 — live v3 HEAD; console/mobile
 *                           froze v3.0.2 (3d0d9888) before v3.0.3 shipped.
 *  - github/codeql-action   4bfa242a… = v3.39.1 — live v3 HEAD (v3.39.1 tag).
 *
 * Bump procedure: re-resolve refs/tags/{major} upstream, move BOTH the commit
 * and the comment together, and re-pin this ledger in the same commit — a
 * drift between any of the three reddens law 3 by name.
 *
 * LAWS:
 *  1. every non-local `uses:` ref pins a full 40-hex commit SHA (no floating
 *     tag, no partial sha) — names every offending line;
 *  2. every pin line carries a ` # vX.Y.Z` tag comment (legibility law);
 *  3. the parsed {repo → commit, version} map EQUALS the ledger above —
 *     wrong-SHA swaps and silent bumps red here even though law 1 passes;
 *  4. raw-line census and YAML-parse census agree (the laws cannot be dodged
 *     by hiding a step from one of the two views) and the census is non-empty.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');

/** The estate-resolved pin ledger (see header for provenance). */
const PIN_LEDGER = {
  'actions/checkout': { commit: 'd23441a48e516b6c34aea4fa41551a30e30af803', version: 'v6.1.0' },
  'actions/setup-node': { commit: '249970729cb0ef3589644e2896645e5dc5ba9c38', version: 'v6.5.0' },
  'actions/upload-artifact': { commit: 'cf430e030ddbb5b0abf93d22962f4752f3646cd9', version: 'v7.0.2' },
  'actions/download-artifact': { commit: '9000827ccba6bdab643e8b6fd33ac0654aef8333', version: 'v8.0.2' },
  'codecov/codecov-action': { commit: 'fb8b3582c8e4def4969c97caa2f19720cb33a72f', version: 'v6.0.2' },
  'codacy/codacy-coverage-reporter-action': { commit: '89d6c85cfafaec52c72b6c5e8b2878d33104c699', version: 'v1.3.0' },
  'softprops/action-gh-release': { commit: 'efb35369e0ad2afab669f228072c1b0d510eae64', version: 'v3.0.3' },
  'github/codeql-action': { commit: '4bfa242aa49c5f7c6770b98670d354a7dfac05f8', version: 'v3.39.1' },
};

const workflowFiles = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f)).sort();

/** `github/codeql-action/init@…` → base key `github/codeql-action`. */
function baseRepo(usesRef) {
  const [beforeAt] = usesRef.split('@');
  return beforeAt.split('/').slice(0, 2).join('/');
}

function isLocal(usesRef) {
  return usesRef.startsWith('./');
}

function parseLine(line, file) {
  // group shape: whitespace / "uses:" / ref / optional " # comment"
  const match = /^(\s*uses:\s+)(\S+)((\s+#\s*.*)?)$/.exec(line);
  if (!match) return null;
  const [, , ref, comment = ''] = match;
  const commentMatch = /^\s+#\s+(v\d+\.\d+\.\d+)\s*$/.exec(comment);
  return {
    file,
    ref,
    line,
    sha: ref.includes('@') ? ref.split('@').pop() : '',
    version: commentMatch ? commentMatch[1] : null,
  };
}

function thirdPartyEntries() {
  return thirdPartyRawLines().map(({ parsed }) => parsed);
}

function thirdPartyRawLines() {
  const entries = [];
  for (const file of workflowFiles) {
    const lines = readFileSync(path.join(workflowsDir, file), 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (!/^\s*uses:\s+\S/.test(line)) return;
      const parsed = parseLine(line, file);
      expect(parsed, `${file}:${idx + 1} uses line must be structurally parseable`).not.toBeNull();
      if (isLocal(parsed.ref)) return;
      entries.push({ file, number: idx + 1, line, parsed });
    });
  }
  return entries;
}

function parsedUsesFromYaml() {
  const found = [];
  for (const file of workflowFiles) {
    const doc = load(readFileSync(path.join(workflowsDir, file), 'utf8'));
    for (const [jobId, job] of Object.entries(doc?.jobs ?? {})) {
      for (const [idx, step] of (job?.steps ?? []).entries()) {
        if (step?.uses && !isLocal(step.uses)) {
          found.push({ where: `${file}#${jobId}.steps[${idx}]`, uses: step.uses });
        }
      }
    }
  }
  return found;
}

describe('M-WINDOWS-09 third-party actions are SHA-pinned (estate law)', () => {
  it('census is live: workflows parsed and third-party uses found (non-vacuous)', () => {
    expect(workflowFiles.length).toBeGreaterThanOrEqual(3);
    expect(thirdPartyRawLines().length).toBeGreaterThanOrEqual(30);
  });

  it('every third-party uses: pins a full 40-hex commit SHA — no floating tags', () => {
    const offenders = thirdPartyRawLines()
      .filter(({ parsed }) => !/^[0-9a-f]{40}$/.test(parsed.sha))
      .map(({ file, number, line }) => `${file}:${number}: ${line.trim()}`);
    expect(
      offenders,
      `floating (non-SHA) action refs violate the estate SHA-pin law:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every SHA pin carries a "# vX.Y.Z" tag comment for legibility', () => {
    const offenders = thirdPartyEntries()
      .filter((e) => /^[0-9a-f]{40}$/.test(e.sha) && e.version === null)
      .map((e) => `${e.file}: ${e.line.trim()}`);
    expect(offenders, `SHA pins without a semver comment:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the pin set equals the estate-resolved ledger (commits AND versions)', () => {
    const observed = {};
    for (const e of thirdPartyEntries()) {
      const key = baseRepo(e.ref);
      const seen = { commit: e.sha, version: e.version };
      if (observed[key] && JSON.stringify(observed[key]) !== JSON.stringify(seen)) {
        expect.fail(`${key} is pinned to more than one target: ${JSON.stringify(observed[key])} vs ${JSON.stringify(seen)}`);
      }
      observed[key] = seen;
    }
    expect(Object.keys(observed).sort()).toEqual(Object.keys(PIN_LEDGER).sort());
    for (const [repo, expected] of Object.entries(PIN_LEDGER)) {
      expect(observed[repo], `${repo} pin drift (bump workflow + comment + ledger together)`).toEqual(expected);
    }
  });

  it('raw-line census and YAML-parse census agree (no step hidden from the law)', () => {
    const rawSet = new Set(thirdPartyEntries().map((e) => e.ref));
    const yamlSet = new Set(parsedUsesFromYaml().map((e) => e.uses));
    expect([...yamlSet].filter((u) => !rawSet.has(u))).toEqual([]);
    expect([...rawSet].filter((u) => !yamlSet.has(u))).toEqual([]);
  });
});
