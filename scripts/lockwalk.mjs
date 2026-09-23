/**
 * @phlix/* lockwalk — package-lock self-consistency walker (lane S450).
 *
 * The defect class this catches: the committed lockfile once declared, under
 * `node_modules/@phlix/ui`, a request for `@phlix/syncplay #v0.1.4` while the
 * single hoisted syncplay resolution sat at version `0.1.2` (resolved at the
 * v0.1.2 tag commit `2fdf70bf`). npm 11 does NOT self-heal that divergence —
 * neither `npm install` nor a cold-cache re-derivation flags an unsatisfied
 * git-tag edge once the tree entry exists — so `npm ci` fidelity silently
 * degraded and no gate noticed. The S450-era repair landed syncplay at
 * `0.1.4` / `673e3d41` (the v0.1.4 annotated tag peeled), matching what
 * @phlix/ui v0.99.1's own manifest requests.
 *
 * Rules enforced (structural, network-free — safe for CI):
 *  1. Every `github:detain/<repo>#<tag>` request for an @phlix/* package, from
 *     the root package or from any @phlix/* lock entry, must resolve to a lock
 *     node whose `version` equals the tag — or, where the tagged upstream
 *     manifest ships a stale `version` field, equals that field pinned
 *     explicitly as `manifestVersion` in EXPECTED below (lived three times so
 *     far: @phlix/ui v0.99.2 was tagged with its manifest `version` still
 *     reading 0.99.1 — override retired when v0.99.3–v0.99.4 normalized the
 *     field, revived at v0.99.5 which again ships `version: 0.99.4` under the
 *     tag; @phlix/contracts v0.5.0 is the third case — the estate cut the
 *     error-registry tag with the field deliberately left at 0.4.7, per the
 *     v0.99.2 precedent; the field is STILL stale at v0.5.1, so the contracts
 *     override carries forward through that re-pin —
 *     the identity byte-check remains the `resolved` peel sha) — and whose
 *     `resolved` sha equals the pinned peel sha.
 *     An override is exact-match, never a wildcard waiver.
 *  2. RATIFIED_HOISTS carries the exact-match waivers for edges whose requested
 *     tag differs from the single hoisted resolution this repo standardizes on.
 *     History: the S442-era exception (ui v0.99.1 requesting contracts `#v0.4.5`
 *     over a hoisted `0.4.6`) retired at the W82 re-pin when ui v0.99.2 requested
 *     `#v0.4.6` outright, and the map sat present-but-empty until the contracts
 *     v0.5.0 re-pin (2026-09-23) re-added one under its own written rule: ui
 *     v0.99.5's manifest still requests contracts `#v0.4.7` while the direct pin
 *     advanced past it (error-registry cascade), so npm dedupes ui's edge onto
 *     the hoisted copy. The waiver pins version AND sha exactly; it
 *     dies the moment a ui tag requests the direct pin's tag-or-newer outright
 *     (key miss -> the edge re-enters plain rule-1 territory), mirroring the
 *     v0.4.5 retirement. At the v0.5.1 re-pin (registry expansion, 2026-09-23)
 *     the retirement condition was checked and did NOT fire - ui v0.99.5's
 *     manifest still speaks `#v0.4.7` (measured via git show at 3017f443) - so
 *     the entry carries, its sha re-ratified exactly to the hoist's new peel.
 *  3. No nested @phlix copies (no `node_modules/@phlix/<dep>/node_modules/@phlix/<dep>`)
 *     — single-resolution invariant, mirrors S447's "no consumer may read the
 *     stale nested copy" ruling.
 *  4. Every @phlix/* lock node must be the resolution of at least one edge
 *     (orphan-node detector — a hand-edit that leaves an unreferenced copy
 *     shows up here).
 *
 * `--live` additionally peels each EXPECTED tag against its remote via
 * `git ls-remote` (annotated `^{}` peeled, lightweight as-is) and proves the
 * pinned shas still name the tags they claim. It needs ssh access and is run
 * lane-side / on demand, never from the unit test.
 *
 * Exit code 0 = walk clean; 1 = findings (printed one per line).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GIT_SPEC_RE = /^github:detain\/([\w.-]+)#([\w.-]+)$/;
const PHLIX_PKG_RE = /^@phlix\/[\w-]+$/;
const DIRECT_NODE_RE = /^node_modules\/(@phlix\/[\w-]+)$/;
const NESTED_NODE_RE = /\/node_modules\/@phlix\/[\w-]+$/;

// Single resolutions: package -> the tag this repo standardizes on and
// the commit that tag peels to (re-verified against the live remotes via
// `git ls-remote ... refs/tags/<tag>^{}` on 2026-09-23, contracts v0.5.1 re-pin):
//   phlix-contracts v0.5.1 -> e3c14f07  (annotated tag object cf0163ee; its manifest `version` field is
//                                         STILL STALE at the tag - reads 0.4.7, the deliberate v0.99.2-style skew
//                                         the estate cut the error-registry tags with (v0.5.0 kept it, v0.5.1
//                                         kept it - measured via git show at e3c14f0) - hence the exact-match
//                                         `manifestVersion` override below, carried forward. ui v0.99.5's manifest
//                                         still requests #v0.4.7; that edge dedupes onto this copy via
//                                         RATIFIED_HOISTS)
//   phlix-syncplay  v0.1.5 -> b82d4f36  (unchanged; ui v0.99.5 still requests #v0.1.5)
//   phlix-ui        v0.99.5 -> 3017f443  (annotated tag object 5b67c2a9; its manifest `version` field is STALE again —
//                                         reads 0.99.4 at the tag, exactly the case rule 1's `manifestVersion` override
//                                         was written for; the estate cut v0.99.5 without bumping the field, per the
//                                         v0.99.2 precedent where the tag/grader never reads package.json `version`)
export const EXPECTED = {
  '@phlix/contracts': {
    tag: 'v0.5.1',
    sha: 'e3c14f07e8927224978a921e1f79406629ceb6c5',
    // contracts v0.5.1 re-pin (error-registry expansion, 2026-09-23): the tag manifest's
    // `version` field is STILL stale — it reads 0.4.7 at e3c14f0 too (measured via git show;
    // the estate cut v0.5.1 the same deliberate-skew way as v0.5.0, per the v0.99.2/ui-v0.99.5
    // precedent where the tag/grader never reads package.json `version`). npm therefore keeps
    // writing the lock entry's version from the manifest, not the tag. Exact-match override
    // carried forward unchanged — same machinery as the ui row; a contracts release that
    // re-normalizes the field to 0.5.0+ must retire it again.
    manifestVersion: '0.4.7',
    repo: 'git+ssh://git@github.com/detain/phlix-contracts.git',
  },
  '@phlix/syncplay': {
    tag: 'v0.1.5',
    sha: 'b82d4f361e9b1e3097f37ee2d1dfedf337fd4107',
    repo: 'git+ssh://git@github.com/detain/phlix-syncplay.git',
  },
  '@phlix/ui': {
    tag: 'v0.99.5',
    sha: '3017f443f33a4368cb7b94c67f47814fe0db0bff',
    // v0.99.5 re-pin cascade: the tag manifest's `version` field is stale — it
    // still reads 0.99.4 (measured via git show at 3017f443; npm therefore
    // writes the lock entry's version from the manifest, not the tag). That is
    // precisely the trigger written into the v0.99.2-era override's retirement
    // note ("if ui ever ships the field stale again, re-adding an exact-match
    // pin is the fix"), so the exact-match `manifestVersion` override returns.
    // A ui release that re-normalizes the field to 0.99.5+ must retire it again.
    manifestVersion: '0.99.4',
    repo: 'git+ssh://git@github.com/detain/phlix-ui.git',
  },
};

// "dependentKey>package@requested-tag" -> the exact hoist accepted upstream of rule 1.
// History: the S442-era waiver (ui `#v0.4.5` over hoisted 0.4.6) retired 2026-09-13 (W82
// winsump) when ui v0.99.2 requested `#v0.4.6` outright; the map sat empty through the
// W85/W87 re-pins. RE-ADDED for the contracts v0.5.0 re-pin (2026-09-23): ui v0.99.5's own
// manifest still requests contracts `#v0.4.7` while the direct pin advanced (error-registry
// cascade, purely additive) and npm dedupes ui's edge onto the single hoisted copy — proven
// nested-free both in the lock and on disk by tests/unit/contractsPin.test.mjs. Exact-match
// like its predecessor: version AND sha. CARRIED at the contracts v0.5.1 re-pin (2026-09-23):
// the retirement condition was checked and did not fire — ui v0.99.5's manifest still speaks
// `#v0.4.7` (measured via git show at 3017f443) — so the waiver stays and its sha re-ratifies
// exactly to the hoisted copy's new peel e3c14f07.
// Retirement condition: a ui tag whose manifest requests the direct pin (`#v0.5.1`)-or-newer
// outright makes this key miss on the next re-pin — delete the entry then and restore
// byte-equality.
export const RATIFIED_HOISTS = {
  'node_modules/@phlix/ui>@phlix/contracts@v0.4.7': {
    version: '0.4.7',
    sha: 'e3c14f07e8927224978a921e1f79406629ceb6c5',
  },
};

export function readRepoJson(name) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8'));
}

export function parsePhlixGitSpec(spec) {
  const m = GIT_SPEC_RE.exec(spec);
  return m ? { repo: m[1], tag: m[2] } : null;
}

const resolvedSha = (entry) => (entry?.resolved ?? '').split('#').pop() ?? '';

/**
 * Walk the root package.json plus lock, applying rules 1-4.
 * Returns { findings, edges } — findings are human-readable strings,
 * edges records every @phlix request inspected.
 */
export function walk(lock) {
  const findings = [];
  const edges = [];
  const packages = lock.packages ?? {};
  const resolvedPaths = new Set();

  const edgeSources = Object.entries(packages).filter(
    ([key]) => key === '' || DIRECT_NODE_RE.test(key),
  );

  for (const [key, node] of edgeSources) {
    for (const [dep, spec] of Object.entries(node.dependencies ?? {})) {
      if (!PHLIX_PKG_RE.test(dep)) continue;
      const parsed = parsePhlixGitSpec(spec);
      if (!parsed) {
        findings.push(`non-tag-pin: ${key || '(root)'} requests ${dep} via unpinnable spec ${spec}`);
        continue;
      }
      const { tag } = parsed;
      edges.push({ from: key || '(root)', dep, tag });

      const nestedPath = key === '' ? `node_modules/${dep}` : `${key}/node_modules/${dep}`;
      const hoistedPath = `node_modules/${dep}`;
      const entry = packages[nestedPath] ?? packages[hoistedPath] ?? null;
      if (!entry) {
        findings.push(`missing-resolution: ${key || '(root)'} requests ${dep}#${tag}`);
        continue;
      }
      resolvedPaths.add(packages[nestedPath] ? nestedPath : hoistedPath);

      const ratified = RATIFIED_HOISTS[`${key}>${dep}@${tag}`];
      if (ratified) {
        if (entry.version !== ratified.version || resolvedSha(entry) !== ratified.sha) {
          findings.push(
            `ratified-hoist-drift: ${key || '(root)'} requests ${dep}#${tag}; the ratified hoist ` +
              `(${ratified.version}@${ratified.sha.slice(0, 8)}) now resolves ` +
              `${entry.version}@${resolvedSha(entry).slice(0, 8)} — re-ratify explicitly`,
          );
        }
        continue;
      }

      const expected = EXPECTED[dep];
      const wantedVersion = expected?.manifestVersion ?? tag.replace(/^v/, '');
      const versionMatches = entry.version === wantedVersion;
      const shaMatches = Boolean(expected) && resolvedSha(entry) === expected.sha;
      if (!versionMatches || !shaMatches) {
        findings.push(
          `request-vs-resolved: ${key || '(root)'} requests ${dep}#${tag} but lock resolves ` +
            `version ${entry.version} at ${resolvedSha(entry) || '(no git resolution)'}` +
            (expected && !shaMatches ? ` (not the pinned ${expected.tag} peel ${expected.sha})` : '') +
            (!versionMatches ? ` (pinned version line reads ${wantedVersion})` : ''),
        );
      }
    }
  }

  for (const key of Object.keys(packages)) {
    if (!NESTED_NODE_RE.test(key) && !DIRECT_NODE_RE.test(key)) continue;
    if (NESTED_NODE_RE.test(key)) {
      findings.push(`nested-copy-forbidden: ${key} @ ${packages[key].version}`);
      continue;
    }
    if (!resolvedPaths.has(key)) {
      findings.push(`orphan-node: ${key} @ ${packages[key].version} resolves no @phlix request`);
    }
  }

  return { findings, edges };
}

/**
 * Prove each EXPECTED tag still peels to its pinned sha on the live remotes.
 */
export function livePeelProofs() {
  return Object.entries(EXPECTED).map(([dep, { repo, tag, sha }]) => {
    const out = execFileSync('git', ['ls-remote', repo, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
      encoding: 'utf8',
    });
    const rows = out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t'));
    const tagObject = rows.find(([, ref]) => ref === `refs/tags/${tag}`)?.[0];
    const peel = rows.find(([, ref]) => ref.endsWith('^{}'))?.[0] ?? tagObject;
    return { dep, tag, tagObject, peel, expectedSha: sha, ok: peel === sha };
  });
}

export function main({ live = false } = {}) {
  const { findings, edges } = walk(readRepoJson('package-lock.json'));
  for (const edge of edges) {
    console.log(`edge: ${edge.from} -> ${edge.dep} requests ${edge.dep}#${edge.tag}`);
  }
  if (live) {
    for (const proof of livePeelProofs()) {
      console.log(
        `peel: ${proof.dep} ${proof.tag} tag-object=${proof.tagObject} commit=${proof.peel} ` +
          `pinned=${proof.expectedSha} ${proof.ok ? 'OK' : 'MISMATCH'}`,
      );
      if (!proof.ok) {
        findings.push(`live-peel: ${proof.dep} ${proof.tag} peels to ${proof.peel}, not the pinned ${proof.expectedSha}`);
      }
    }
  }
  if (findings.length === 0) {
    console.log(`lockwalk: ${edges.length} edges walked, 0 mismatches`);
    return 0;
  }
  for (const f of findings) console.error(`lockwalk: ${f}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main({ live: process.argv.includes('--live') });
}
