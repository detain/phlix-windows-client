/**
 * @vitest-environment node
 *
 * Lane S450 lockwalk guard — the committed package-lock.json must be
 * self-consistent with every @phlix/* github-tag request it (or the root
 * package.json) declares. See scripts/lockwalk.mjs for the rule set; in short:
 * the lock once shipped with the hoisted @phlix/syncplay resolution at 0.1.2
 * while @phlix/ui v0.99.1's manifest requested `#v0.1.4`, and npm 11 never
 * self-heals that divergence. The S442 ratified contracts hoist exception
 * retired at the W82 re-pin (ui v0.99.2 requests `#v0.4.6` outright), then the
 * exact same divergence class returned on the contracts v0.5.0 re-pin (2026-09-23):
 * ui v0.99.5's manifest still requests `#v0.4.7` while the direct pin advanced —
 * re-ratified exact-match per the written rule, CARRIED at the v0.5.1 re-pin
 * (retirement condition checked, did not fire), RETIRED at the ui v0.99.6 re-pin
 * (2026-09-24: ui requests the direct pin `#v0.5.1` outright, byte-equality restored,
 * map present-but-empty), and RE-ADDED at the contracts v0.5.2 re-pin (2026-09-25:
 * the direct pin advanced past ui's still-#v0.5.1 request, so the divergence class —
 * and its single exact-match waiver — are back). The denominators below pin that
 * one-waiver reality.
 *
 * Like tests/unit/contractsPin.test.mjs (its S442 sibling) this is plain Node
 * ESM outside the TypeScript project, so `npm run typecheck` never sees it
 * while vitest's `.test.mjs` glob does. No network: `--live` peel verification
 * is a lane/operator command, not CI's job.
 */

import { describe, it, expect } from 'vitest';
import { walk, readRepoJson, EXPECTED, RATIFIED_HOISTS } from '../../scripts/lockwalk.mjs';

// Self-identifying lane marker (survives tokenisation as a plain string const).
const LANE_TOKEN = 'S450LOCKWALKX3V7';

const lock = readRepoJson('package-lock.json');
const pkg = readRepoJson('package.json');

// The hoisted contracts node's honest version at the v0.5.2 pin (field re-normalized
// at the tag — the manifestVersion override era is over; see contractsPin.test.mjs).
const CONTRACTS_HONEST_VERSION = '0.5.2';

describe('S450 — lockwalk: resolutions match requested github-tag pins', () => {
  it('is the S450 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S450/);
  });

  it('walks the real lock with zero findings', () => {
    const { findings, edges } = walk(lock);
    expect(findings).toEqual([]);
    // root -> contracts/ui, root -> (no direct syncplay), ui -> contracts/syncplay
    expect(edges.length).toBeGreaterThanOrEqual(4);
  });

  it('resolves @phlix/syncplay at the requested #v0.1.5 (the W87-repaired state)', () => {
    const entry = lock.packages['node_modules/@phlix/syncplay'];
    expect(entry.version).toBe('0.1.5');
    expect(entry.resolved).toBe(
      'git+ssh://git@github.com/detain/phlix-syncplay.git#b82d4f361e9b1e3097f37ee2d1dfedf337fd4107',
    );
  });

  it('keeps the direct pins (root package.json vs lock root) identical', () => {
    for (const dep of Object.keys(EXPECTED)) {
      if (pkg.dependencies[dep]) {
        expect(lock.packages[''].dependencies[dep]).toBe(pkg.dependencies[dep]);
      }
    }
  });

  it('carries no nested @phlix copies (single-resolution invariant)', () => {
    const nested = Object.keys(lock.packages).filter(
      (k) => /\/node_modules\/@phlix\/[\w-]+$/.test(k),
    );
    expect(nested).toEqual([]);
  });
});

describe('S450 — the walker discriminates (mutation proofs)', () => {
  it('REGRESSION: flags the original S450 defect (syncplay back at 0.1.2)', () => {
    const broken = structuredClone(lock);
    broken.packages['node_modules/@phlix/syncplay'] = {
      version: '0.1.2',
      resolved: 'git+ssh://git@github.com/detain/phlix-syncplay.git#2fdf70bfc90b4b736e7781b6685921d190a2f467',
    };
    const { findings } = walk(broken);
    expect(findings.some((f) => f.startsWith('request-vs-resolved:') && f.includes('@phlix/syncplay#v0.1.5'))).toBe(true);
  });

  it('REGRESSION: flags contracts resolution drift on BOTH edges — root via rule 1, ui via the waiver — in every direction', () => {
    // Since the contracts v0.5.2 re-pin the two contracts edges walk DIFFERENT laws:
    // root's #v0.5.2 edge is plain rule 1 (manifestVersion override RETIRED — the
    // field is honest at 0.5.2 at the tag, measured via git show), while ui's #v0.5.1
    // edge is the single RATIFIED_HOISTS entry. Three hand-edits of the hoisted
    // contracts node, all must go RED on BOTH edges:
    //  a) rolled back to the real v0.5.1 peel with that release's stale 0.4.7 field
    //     (the behind direction — an honest snapshot of yesterday's tree);
    //  b) falsely claiming a field the tag never normalized (0.5.1 at the real peel —
    //     half the old skew law, dead now that rule 1 derives 0.5.2 from the tag);
    //  c) sha-only drift under the honest version (a same-field foreign commit).
    // Every edit must ALSO trip ratified-hoist-drift on ui's waived edge — the waiver
    // pins version AND sha exactly, so it is as brittle as rule 1, never a silent hole.
    const mutated = [
      { version: '0.4.7', resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#e3c14f07e8927224978a921e1f79406629ceb6c5' },
      { ...lock.packages['node_modules/@phlix/contracts'], version: '0.5.1' },
      { ...lock.packages['node_modules/@phlix/contracts'], resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#0000000000000000000000000000000000000000' },
    ];
    for (const edit of mutated) {
      const broken = structuredClone(lock);
      broken.packages['node_modules/@phlix/contracts'] = edit;
      const { findings } = walk(broken);
      // Root requests #v0.5.2: plain rule 1 (no override — the wanted version reads
      // 0.5.2 straight off the tag).
      const rv = findings.filter((f) => f.startsWith('request-vs-resolved:'));
      const rootEdge = rv.find((f) => f.includes('(root) requests @phlix/contracts#v0.5.2'));
      expect(rootEdge).toBeDefined();
      if (edit.version === CONTRACTS_HONEST_VERSION) {
        // Case (c): sha-only drift under the honest version — the peel naming fires.
        expect(rootEdge).toContain('not the pinned v0.5.2 peel 7afb6a9171c33c18a2303716516572a4dfc405d9');
      } else {
        // Cases (a)/(b): wrong version line — rule 1 names the tag-derived truth.
        expect(rootEdge).toContain('pinned version line reads 0.5.2');
      }
      // ui requests #v0.5.1 under the waiver: the ratified-hoist-drift family is ALIVE
      // again and must light up on the same mutations, exactly as rule 1 does for root.
      expect(
        findings.some(
          (f) =>
            f.startsWith('ratified-hoist-drift:') &&
            f.includes('node_modules/@phlix/ui requests @phlix/contracts#v0.5.1'),
        ),
      ).toBe(true);
    }
  });

  it('REGRESSION: flags the ui lock version line moving off the stale-manifest truth', () => {
    const broken = structuredClone(lock);
    // v0.99.6 re-pin truth: the tag manifest's `version` field is STALE — it
    // reads 0.99.4 at 98a5bf38 (measured via git show, exactly as at v0.99.5 —
    // the estate keeps cutting ui tags without bumping the field), so the
    // exact-match `manifestVersion: '0.99.4'` override carries and rule 1 checks
    // the lock against the MANIFEST field, not the tag. Two hand-edits must go
    // RED: one falling further behind (0.99.3), one falsely claiming the field
    // re-normalized with the tag (0.99.6). Mutation-proof, exact-match, not a
    // wildcard waiver.
    broken.packages['node_modules/@phlix/ui'] = {
      ...broken.packages['node_modules/@phlix/ui'],
      version: '0.99.3',
    };
    const behind = walk(broken).findings;
    expect(
      behind.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.6') &&
          f.includes('version 0.99.3') &&
          f.includes('pinned version line reads 0.99.4'),
      ),
    ).toBe(true);

    const falselyNormalized = structuredClone(lock);
    falselyNormalized.packages['node_modules/@phlix/ui'] = {
      ...falselyNormalized.packages['node_modules/@phlix/ui'],
      version: '0.99.6',
    };
    const ahead = walk(falselyNormalized).findings;
    expect(
      ahead.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.6') &&
          f.includes('version 0.99.6') &&
          f.includes('pinned version line reads 0.99.4'),
      ),
    ).toBe(true);
  });

  it('REGRESSION: flags a hand-forced nested @phlix copy', () => {
    const broken = structuredClone(lock);
    broken.packages['node_modules/@phlix/ui/node_modules/@phlix/contracts'] = {
      version: '0.4.5',
      resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#1111111111111111111111111111111111111111',
    };
    const { findings } = walk(broken);
    expect(findings.some((f) => f.startsWith('nested-copy-forbidden:'))).toBe(true);
  });

  it('REGRESSION: flags an unreferenced @phlix node (orphan)', () => {
    const broken = structuredClone(lock);
    delete broken.packages[''].dependencies['@phlix/contracts'];
    delete broken.packages['node_modules/@phlix/ui'].dependencies['@phlix/contracts'];
    const { findings } = walk(broken);
    expect(findings.some((f) => f.startsWith('orphan-node:'))).toBe(true);
  });
});

describe('contracts v0.5.2 re-pin — the waiver era is back: one exact-match hoist, divergence honest', () => {
  it('RATIFIED_HOISTS carries exactly one entry: the v0.99.6-era byte-equality died when the direct pin advanced', () => {
    // The equality era that began at the ui v0.99.6 re-pin ENDED at the contracts
    // v0.5.2 re-pin (2026-09-25): the direct pin moved to `#v0.5.2` while the installed
    // ui v0.99.6's manifest still speaks `#v0.5.1` (measured via git show at 98a5bf38),
    // so npm dedupes ui's edge onto the hoisted 0.5.2@7afb6a91 copy and the edge re-enters
    // waiver territory per rule 2's written law — fresh exact-match entry (version AND sha),
    // never a wildcard. A future ui tag requesting `#v0.5.2`-or-newer retires it again.
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([
      'node_modules/@phlix/ui>@phlix/contracts@v0.5.1',
    ]);
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.1']).toEqual({
      version: CONTRACTS_HONEST_VERSION,
      sha: '7afb6a9171c33c18a2303716516572a4dfc405d9',
    });
  });

  it('the retired exception keys stay dead, the ui contracts line names its manifest truth, and the walk is clean', () => {
    // Mutation-proof in BOTH directions on the ui→contracts edge: the older divergence
    // words (#v0.4.5, #v0.4.7 — behind) must never silently return in the map or the lock
    // line, and the equality-era key (#v0.5.2 — falsely-normalized) must not exist either:
    // ui's true request is #v0.5.1, byte-pinned in the lock, while root declares #v0.5.2.
    // The hoisted 0.5.2@7afb6a91 copy satisfies root via plain rule 1 (override RETIRED —
    // the field is honest) and ui via the exact-match waiver, with zero walk findings.
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.5']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.2']).toBeUndefined();
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.1');
    expect(ui.dependencies['@phlix/contracts']).not.toBe(pkg.dependencies['@phlix/contracts']);
    const { findings } = walk(lock);
    expect(findings.filter((f) => f.includes('@phlix/contracts'))).toEqual([]);
  });
});
