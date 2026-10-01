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
 * map present-but-empty), RE-ADDED at the contracts v0.5.2 re-pin (2026-09-25: the
 * direct pin advanced past ui's still-#v0.5.1 request, so the divergence class — and
 * its single exact-match waiver — were back), and RETIRED AGAIN at the ui v0.99.7
 * re-pin (2026-09-25: ui v0.99.7 requests the direct pin `#v0.5.2` outright, measured
 * via git show at bc1d29bf — the waiver's written law had then fired three times;
 * byte-equality restored, map present-but-empty), CARRIED at the ui v0.99.8 re-pin
 * (2026-09-30: v0.99.8 requests `#v0.5.2` outright too, measured via git show at
 * a580410f), and ENDED at the contracts v0.5.3 re-pin (2026-10-01: the direct pin
 * advanced to `#v0.5.3` while installed ui v0.99.8 still speaks `#v0.5.2` — the
 * divergence class returned for the fourth time under the same law, re-ratified as a
 * fresh exact-match waiver keyed @v0.5.2, version AND sha of the hoisted 0.5.3@430981e
 * copy). The denominators below pin that
 * single-waiver reality.
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

// The hoisted contracts node's honest version at the v0.5.3 pin (field re-normalized
// at v0.5.2 by ac669ca and carried at v0.5.3 — the manifestVersion override era is
// over; see contractsPin.test.mjs).
const CONTRACTS_HONEST_VERSION = '0.5.3';

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

  it('REGRESSION: flags contracts resolution drift on the root edge (rule 1) AND the ui edge (waiver drift), in every direction', () => {
    // Since the contracts v0.5.3 re-pin the two contracts edges walk DIFFERENT laws:
    // root declares `#v0.5.3` and walks PLAIN rule 1 (no override — the manifestVersion
    // era is over for the whole @phlix/* set, both fields honest at their tags, measured
    // via git show); ui v0.99.8 still declares `#v0.5.2` and walks the exact-match
    // waiver keyed @v0.5.2, which pins version AND sha of the hoisted 0.5.3@430981e copy.
    // Three hand-edits of the hoisted contracts node, each must go RED on BOTH edges:
    //  a) rolled back to the real v0.5.2 peel with that release's honest 0.5.2 field
    //     (the behind direction — an honest snapshot of yesterday's tree: rule 1 flags
    //     version 0.5.2≠0.5.3 on root; the waiver flags ratified-hoist-drift on ui);
    //  b) falsely claiming a version the tag never shipped (0.4.7 — a dead skew word
    //     from the v0.5.0/v0.5.1 era — at the current peel);
    //  c) sha-only drift under the honest version (a same-field foreign commit: root
    //     flags the peel naming, ui flags hoist drift since the sha no longer matches).
    const mutated = [
      { version: '0.5.2', resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#7afb6a9171c33c18a2303716516572a4dfc405d9' },
      { ...lock.packages['node_modules/@phlix/contracts'], version: '0.4.7' },
      { ...lock.packages['node_modules/@phlix/contracts'], resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#0000000000000000000000000000000000000000' },
    ];
    for (const edit of mutated) {
      const broken = structuredClone(lock);
      broken.packages['node_modules/@phlix/contracts'] = edit;
      const { findings } = walk(broken);
      const rv = findings.filter((f) => f.startsWith('request-vs-resolved:'));
      // Root requests #v0.5.3: plain rule 1 (no override — the wanted version reads
      // 0.5.3 straight off the tag).
      const rootEdge = rv.find((f) => f.includes('(root) requests @phlix/contracts#v0.5.3'));
      expect(rootEdge).toBeDefined();
      if (edit.version === CONTRACTS_HONEST_VERSION) {
        // Case (c): sha-only drift under the honest version — the peel naming fires.
        expect(rootEdge).toContain('not the pinned v0.5.3 peel 430981e3b231a04c9464382642f54c2eeea33c1c');
      } else {
        // Cases (a)/(b): wrong version line — rule 1 names the tag-derived truth.
        expect(rootEdge).toContain('pinned version line reads 0.5.3');
      }
      // ui requests #v0.5.2 and rides the waiver — every hoist-copy mutation that
      // lights root's rule-1 edge ALSO trips ratified-hoist-drift on the ui edge
      // (the waiver pins version AND sha, so version drift, false-version, and sha
      // drift are all detectable from either direction).
      expect(
        findings.some(
          (f) =>
            f.startsWith('ratified-hoist-drift:') &&
            f.includes('node_modules/@phlix/ui requests @phlix/contracts#v0.5.2'),
        ),
      ).toBe(true);
    }
  });

  it('REGRESSION: flags the ui lock version line moving off the honest tag-derived truth', () => {
    // v0.99.8 re-pin truth: the tag manifest's `version` field is HONEST — it reads
    // 0.99.8 at a580410f (measured via git show), carrying the honest-field era that
    // OPENED at v0.99.7, when the exact-match `manifestVersion: '0.99.4'` override's
    // written retirement condition fired at bc1d29bf. Rule 1 checks the lock against the
    // plain TAG-derived version, mirroring the contracts-row retirement at v0.5.2. Three
    // hand-edits must go RED: a) the stale-manifest word 0.99.4 reviving the dead skew;
    // b) the now-behind word 0.99.7; c) sha-only drift under
    // the honest version. Mutation-proof, exact-match — a hand-revived override cannot
    // make any of these pass, because EXPECTED['@phlix/ui'].manifestVersion is gone
    // (asserted in the zero-override test below).
    const behind = structuredClone(lock);
    behind.packages['node_modules/@phlix/ui'] = {
      ...behind.packages['node_modules/@phlix/ui'],
      version: '0.99.4',
    };
    const staleWord = walk(behind).findings;
    expect(
      staleWord.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.8') &&
          f.includes('version 0.99.4') &&
          f.includes('pinned version line reads 0.99.8'),
      ),
    ).toBe(true);

    const furtherBehind = structuredClone(lock);
    furtherBehind.packages['node_modules/@phlix/ui'] = {
      ...furtherBehind.packages['node_modules/@phlix/ui'],
      version: '0.99.7',
    };
    const ahead = walk(furtherBehind).findings;
    expect(
      ahead.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.8') &&
          f.includes('version 0.99.7') &&
          f.includes('pinned version line reads 0.99.8'),
      ),
    ).toBe(true);

    const shaDrift = structuredClone(lock);
    shaDrift.packages['node_modules/@phlix/ui'] = {
      ...shaDrift.packages['node_modules/@phlix/ui'],
      resolved: 'git+ssh://git@github.com/detain/phlix-ui.git#0000000000000000000000000000000000000000',
    };
    const shaFindings = walk(shaDrift).findings;
    expect(
      shaFindings.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.8') &&
          f.includes('not the pinned v0.99.8 peel a580410fd2e6667cf6cb0d450faca3108f679812'),
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

describe('contracts v0.5.3 re-pin — the waiver era is back: one exact-match ratified hoist, divergence re-ratified', () => {
  it('RATIFIED_HOISTS carries exactly one entry: the fourth firing of the written law', () => {
    // The equality era that opened at the ui v0.99.7 re-pin (carried at v0.99.8) ENDED
    // at the contracts v0.5.3 re-pin (2026-10-01): the direct pin advanced to `#v0.5.3`
    // while installed ui v0.99.8 still requests `#v0.5.2` (measured via git show at
    // a580410f AND off the installed node's manifest). The divergence class — fourth
    // era under this same law (v0.4.5-era, v0.4.7-era, v0.5.1-era, now v0.5.2-era) —
    // returned as a fresh exact-match entry (version AND sha of the hoisted
    // 0.5.3@430981e copy), never a wildcard. It dies when a ui tag requests
    // `#v0.5.3`-or-newer outright.
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([
      'node_modules/@phlix/ui>@phlix/contracts@v0.5.2',
    ]);
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.2']).toEqual({
      version: '0.5.3',
      sha: '430981e3b231a04c9464382642f54c2eeea33c1c',
    });
  });

  it('dead exception keys stay dead, the ui contracts line is byte-pinned to #v0.5.2 (NOT root), the ui override stays retired, and the walk is clean', () => {
    // Mutation-proof in BOTH directions on the ui→contracts edge: the older divergence
    // words (#v0.4.5, #v0.4.7, #v0.5.1) must never silently return as live map keys.
    // ui's request is byte-DIVERGENT from the root's (#v0.5.2 vs #v0.5.3 — the
    // equality-era .toBe law inverts), and the hoisted 0.5.3@430981e copy satisfies
    // root under plain rule 1 and ui under the waiver, with zero walk findings. On the
    // ui row itself: the `manifestVersion: '0.99.4'` override stays retired — its
    // written condition fired when the v0.99.7 tag normalized the field (measured via
    // git show), carried at v0.99.8 — so a hand-revived override goes red here and the
    // lock's honest 0.99.8 version line is checked against the tag-derived truth.
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.5']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.1']).toBeUndefined();
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.2');
    expect(ui.dependencies['@phlix/contracts']).not.toBe(pkg.dependencies['@phlix/contracts']);
    const uiRow = EXPECTED['@phlix/ui'];
    expect(uiRow.tag).toBe('v0.99.8');
    expect(uiRow.sha).toBe('a580410fd2e6667cf6cb0d450faca3108f679812');
    expect(uiRow.manifestVersion).toBeUndefined();
    expect(ui.version).toBe('0.99.8');
    const { findings } = walk(lock);
    expect(findings).toEqual([]);
  });
});
