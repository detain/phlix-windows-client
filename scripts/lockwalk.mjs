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
 *     tag and CARRIES at v0.99.6 (field still 0.99.4 at 98a5bf38, measured via
 *     git show); @phlix/contracts v0.5.0 is the third case — the estate cut the
 *     error-registry tag with the field deliberately left at 0.4.7, per the
 *     v0.99.2 precedent, and v0.5.1 kept it — but the contracts skew ENDED at
 *     v0.5.2: the release commit (ac669ca) re-normalized the field to `0.5.2`
 *     at the tag (measured via git show), firing that override's own written
 *     retirement condition, so the contracts row walks the plain tag-derived
 *     version again; the override MECHANISM now carries solely for the ui row.
 *     The identity byte-check remains the `resolved` peel sha) — and whose
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
 *     FIRED at the ui v0.99.6 re-pin (2026-09-24): that tag's manifest requests
 *     the direct pin `#v0.5.1` outright (measured via git show at 98a5bf38), the
 *     key misses, the entry retired per its own written rule, and the map sits
 *     present-but-empty again — exactly as it did from W82 to the v0.5.0 re-pin.
 *     RE-ADDED at the contracts v0.5.2 re-pin (2026-09-25): the equality era ended
 *     the moment the direct pin advanced past ui v0.99.6's request — the installed
 *     tree is the witness (ui manifest speaks `#v0.5.1`, measured via git show at
 *     98a5bf38) and a surgical npm install 12.0.2 observed dedupe, not nesting
 *     (zero nested copies in lock and on disk), the same npm-git-edge behavior the
 *     v0.5.0 era proved. New exact-match entry under the same law: key
 *     `node_modules/@phlix/ui>@phlix/contracts@v0.5.1`, version AND sha of the
 *     hoisted copy. It dies when a ui tag requests `#v0.5.2`-or-newer outright.
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
// `git ls-remote ... refs/tags/<tag>^{}` on 2026-09-25, contracts v0.5.2 re-pin):
//   phlix-contracts v0.5.2 -> 7afb6a91  (annotated tag object 9676874e; its manifest `version` field is
//                                         HONEST again - reads 0.5.2 at the tag, the release commit ac669ca
//                                         re-normalized it (measured via git show), firing the `manifestVersion`
//                                         override's written retirement condition: the contracts row now walks
//                                         the plain tag-derived version and the override is RETIRED. ui v0.99.6's
//                                         manifest still requests `#v0.5.1` - behind the advanced direct pin -
//                                         so the ui->contracts edge is a RATIFIED_HOISTS waiver again, not a
//                                         rule-1 match (see rule 2))
//   phlix-syncplay  v0.1.5 -> b82d4f36  (unchanged; ui v0.99.6 still requests #v0.1.5)
//   phlix-ui        v0.99.6 -> 98a5bf38  (annotated tag object 7d0b71d1; its manifest `version` field is STILL
//                                         STALE at the tag - reads 0.99.4, the same skew v0.99.5 shipped with,
//                                         measured via git show at 98a5bf38; rule 1's exact-match
//                                         `manifestVersion` override carries; the estate keeps cutting ui tags
//                                         without bumping the field - the tag/grader never reads it)
export const EXPECTED = {
  '@phlix/contracts': {
    tag: 'v0.5.2',
    sha: '7afb6a9171c33c18a2303716516572a4dfc405d9',
    // v0.5.2 re-pin (2026-09-25): the `manifestVersion: '0.4.7'` skew override is
    // RETIRED here — its own written condition fired. The v0.5.0/v0.5.1 tags carried
    // the estate's deliberate stale-field skew (manifest `version` reading 0.4.7), but
    // the v0.5.2 release commit (ac669ca) re-normalized the field to 0.5.2 at the tag
    // (measured via git show; npm 12.0.2 accordingly writes lock version 0.5.2). Rule 1
    // checks this row against the plain tag-derived version again. The override
    // MECHANISM stays — the ui row still needs it (ui's field remains stale at v0.99.6).
    repo: 'git+ssh://git@github.com/detain/phlix-contracts.git',
  },
  '@phlix/syncplay': {
    tag: 'v0.1.5',
    sha: 'b82d4f361e9b1e3097f37ee2d1dfedf337fd4107',
    repo: 'git+ssh://git@github.com/detain/phlix-syncplay.git',
  },
  '@phlix/ui': {
    tag: 'v0.99.6',
    sha: '98a5bf389ad29701a4991986dea4cb264fb1f3ee',
    // v0.99.6 re-pin (2026-09-24): the tag manifest's `version` field is STILL
    // stale — it reads 0.99.4 at 98a5bf38 too (measured via git show; the estate
    // cut v0.99.6 the same deliberate-skew way as v0.99.5, per the v0.99.2
    // precedent where the tag/grader never reads package.json `version`). npm
    // therefore keeps writing the lock entry's version from the MANIFEST, not
    // the tag, so the exact-match `manifestVersion` override carries unchanged.
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
// RETIRED at the ui v0.99.6 re-pin (2026-09-24): the written retirement condition FIRED —
// ui v0.99.6's manifest requests the direct pin `#v0.5.1` outright (measured via git show at
// 98a5bf38), so the key misses, the entry is deleted, and byte-equality is restored (root and
// ui now declare the identical spec and dedupe onto the one hoisted copy, exactly like the
// v0.4.5-era retirement and the W85/W87 equality era). The ui→contracts edge walked plain
// rule 1 until the equality era itself ended here. RE-ADDED at the contracts v0.5.2 re-pin
// (2026-09-25): the direct pin advanced to `#v0.5.2` while the INSTALLED ui v0.99.6 still
// requests `#v0.5.1` (measured via git show at 98a5bf38 AND independently off the installed
// node_modules/@phlix/ui/package.json), so the edge diverges again — the waiver's written
// retirement condition has NOT fired (ui would have to request `#v0.5.2`-or-newer). npm
// 12.0.2 observed deduping the ui edge onto the hoisted 0.5.2 copy (no nested node in the
// lock, no nested dir on disk after a surgical install), mirroring the v0.5.0-era behavior.
// Exact-match as always: version AND sha of the hoisted copy.
export const RATIFIED_HOISTS = {
  'node_modules/@phlix/ui>@phlix/contracts@v0.5.1': {
    version: '0.5.2',
    sha: '7afb6a9171c33c18a2303716516572a4dfc405d9',
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
