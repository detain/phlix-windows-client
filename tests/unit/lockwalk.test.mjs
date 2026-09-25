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
 * via git show at bc1d29bf — the waiver's written law has now fired three times;
 * byte-equality restored, map present-but-empty). The denominators below pin that
 * zero-waiver reality.
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

  it('REGRESSION: flags contracts resolution drift on BOTH edges via plain rule 1, in every direction', () => {
    // Since the ui v0.99.7 re-pin BOTH contracts edges walk PLAIN rule 1: root and ui
    // declare the identical `#v0.5.2` spec (byte-equality restored — the waiver retired
    // per its own written law), and the manifestVersion override era is over for the
    // whole @phlix/* set (both fields honest at their tags, measured via git show).
    // Three hand-edits of the hoisted contracts node, all must go RED on BOTH the
    // (root) and the ui request-vs-resolved edges:
    //  a) rolled back to the real v0.5.1 peel with that release's stale 0.4.7 field
    //     (the behind direction — an honest snapshot of yesterday's tree);
    //  b) falsely claiming a field the tag never shipped (0.5.1 at the real peel —
    //     a dead skew word from the v0.5.0/v0.5.1 era);
    //  c) sha-only drift under the honest version (a same-field foreign commit).
    // The dead waiver family must stay silent: no ratified-hoist-drift finding can
    // ever be produced for an edge that no longer has a waiver.
    const mutated = [
      { version: '0.4.7', resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#e3c14f07e8927224978a921e1f79406629ceb6c5' },
      { ...lock.packages['node_modules/@phlix/contracts'], version: '0.5.1' },
      { ...lock.packages['node_modules/@phlix/contracts'], resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#0000000000000000000000000000000000000000' },
    ];
    for (const edit of mutated) {
      const broken = structuredClone(lock);
      broken.packages['node_modules/@phlix/contracts'] = edit;
      const { findings } = walk(broken);
      const rv = findings.filter((f) => f.startsWith('request-vs-resolved:'));
      // Root requests #v0.5.2: plain rule 1 (no override — the wanted version reads
      // 0.5.2 straight off the tag).
      const rootEdge = rv.find((f) => f.includes('(root) requests @phlix/contracts#v0.5.2'));
      expect(rootEdge).toBeDefined();
      if (edit.version === CONTRACTS_HONEST_VERSION) {
        // Case (c): sha-only drift under the honest version — the peel naming fires.
        expect(rootEdge).toContain('not the pinned v0.5.2 peel 7afb6a9171c33c18a2303716516572a4dfc405d9');
      } else {
        // Cases (a)/(b): wrong version line — rule 1 names the tag-derived truth.
        expect(rootEdge).toContain('pinned version line reads 0.5.2');
      }
      // ui requests #v0.5.2 too since the v0.99.7 re-pin — the SAME rule-1 edge, not a
      // waiver: every mutation that lights up root's edge lights up ui's identically.
      expect(
        rv.some((f) => f.includes('node_modules/@phlix/ui requests @phlix/contracts#v0.5.2')),
      ).toBe(true);
      expect(findings.some((f) => f.startsWith('ratified-hoist-drift:'))).toBe(false);
    }
  });

  it('REGRESSION: flags the ui lock version line moving off the honest tag-derived truth', () => {
    // v0.99.7 re-pin truth: the tag manifest's `version` field is HONEST — it reads
    // 0.99.7 at bc1d29bf (measured via git show), firing the exact-match
    // `manifestVersion: '0.99.4'` override's written retirement condition. Rule 1 now
    // checks the lock against the plain TAG-derived version, mirroring the contracts-row
    // retirement at v0.5.2. Three hand-edits must go RED: a) the stale-manifest word
    // 0.99.4 reviving the dead skew; b) a further-behind 0.99.6; c) sha-only drift under
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
          f.includes('@phlix/ui#v0.99.7') &&
          f.includes('version 0.99.4') &&
          f.includes('pinned version line reads 0.99.7'),
      ),
    ).toBe(true);

    const furtherBehind = structuredClone(lock);
    furtherBehind.packages['node_modules/@phlix/ui'] = {
      ...furtherBehind.packages['node_modules/@phlix/ui'],
      version: '0.99.6',
    };
    const ahead = walk(furtherBehind).findings;
    expect(
      ahead.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.7') &&
          f.includes('version 0.99.6') &&
          f.includes('pinned version line reads 0.99.7'),
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
          f.includes('@phlix/ui#v0.99.7') &&
          f.includes('not the pinned v0.99.7 peel bc1d29bf98cb0e847aca05e44733d41ef2381b10'),
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

describe('ui v0.99.7 re-pin — the waiver era is over again: zero ratified hoists, byte-equality restored', () => {
  it('RATIFIED_HOISTS is present-but-empty: the written retirement condition fired (third time)', () => {
    // The contracts v0.5.2-era divergence ended at the ui v0.99.7 re-pin (2026-09-25):
    // ui v0.99.7's manifest requests the direct pin `#v0.5.2` outright (measured via
    // git show at bc1d29bf), so the waiver key missed, the entry retired per its own
    // written law, and byte-equality was restored — the map now sits present-but-empty
    // exactly as it did from W82 to the v0.5.0 re-pin and from the v0.99.6 re-pin to
    // the v0.5.2 re-pin. This same law has now fired three times. A future divergence
    // must return as a fresh exact-match entry (version AND sha), never a wildcard.
    expect(RATIFIED_HOISTS).toEqual({});
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([]);
  });

  it('both retired exception keys stay dead, the ui contracts line is byte-equal to root, the ui override stays retired, and the walk is clean', () => {
    // Mutation-proof in BOTH directions on the ui→contracts edge: the older divergence
    // words (#v0.5.1 — behind, the honest snapshot of the v0.99.6 era — and #v0.4.7,
    // #v0.4.5) must never silently return in the map or the lock line. ui's request is
    // now byte-EQUAL to the root's (#v0.5.2 — equality era restored), and the hoisted
    // 0.5.2@7afb6a91 copy satisfies BOTH contracts edges under plain rule 1 with zero
    // walk findings. On the ui row itself: the `manifestVersion: '0.99.4'` override
    // stays retired — its written condition fired when the v0.99.7 tag normalized the
    // field (measured via git show) — so a hand-revived override goes red here and the
    // lock's honest 0.99.7 version line is checked against the tag-derived truth.
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.5']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.1']).toBeUndefined();
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.2');
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    const uiRow = EXPECTED['@phlix/ui'];
    expect(uiRow.tag).toBe('v0.99.7');
    expect(uiRow.sha).toBe('bc1d29bf98cb0e847aca05e44733d41ef2381b10');
    expect(uiRow.manifestVersion).toBeUndefined();
    expect(ui.version).toBe('0.99.7');
    const { findings } = walk(lock);
    expect(findings.filter((f) => f.includes('@phlix/contracts'))).toEqual([]);
  });
});
