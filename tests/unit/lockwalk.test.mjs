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
 * (retirement condition checked, did not fire), and finally RETIRED at the ui
 * v0.99.6 re-pin (2026-09-24): ui v0.99.6's manifest requests the direct pin
 * `#v0.5.1` outright (measured via git show at 98a5bf38), the waiver key misses,
 * byte-equality is restored, and the map sits present-but-empty. The
 * denominators below pin that zero-edge reality.
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

  it('REGRESSION: flags contracts resolution drift on BOTH edges via rule 1, in every direction', () => {
    // Since the ui v0.99.6 retirement both contracts edges walk PLAIN rule 1 (the
    // ratified-hoist-drift family is dead — the zero-waiver test below proves it).
    // Three hand-edits of the hoisted contracts node, all must go RED on BOTH the
    // (root) and the ui request-vs-resolved edges:
    //  a) rolled to a foreign commit with a falsely-normalized 0.5.1 field;
    //  b) the lock line falling further behind the stale-manifest truth (0.4.6 at
    //     the real peel) and c) falsely claiming the field re-normalized with the
    //     tag (0.5.1 at the real peel) — both directions of the manifestVersion
    //     skew, mirroring the ui-row proof below. The v0.5.1 tag manifest's
    //     `version` field is STALE — it reads 0.4.7 at e3c14f07 (measured via git
    //     show, as it did at v0.5.0), so rule 1 checks the lock against the
    //     MANIFEST field, not the tag.
    const mutated = [
      { version: '0.5.1', resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#0000000000000000000000000000000000000000' },
      { ...lock.packages['node_modules/@phlix/contracts'], version: '0.4.6' },
      { ...lock.packages['node_modules/@phlix/contracts'], version: '0.5.1' },
    ];
    for (const edit of mutated) {
      const broken = structuredClone(lock);
      broken.packages['node_modules/@phlix/contracts'] = edit;
      const { findings } = walk(broken);
      // Root requests #v0.5.1: plain rule 1.
      const rv = findings.filter((f) => f.startsWith('request-vs-resolved:'));
      expect(rv.some((f) => f.includes('(root) requests @phlix/contracts#v0.5.1'))).toBe(true);
      expect(rv.some((f) => f.includes('pinned version line reads 0.4.7'))).toBe(true);
      // ui requests #v0.5.1 too since the v0.99.6 re-pin — the SAME rule-1 edge,
      // not a waiver: the behind (0.4.6) and falsely-normalized (0.5.1) lock lines
      // must light up ui's edge exactly as they light up root's.
      expect(
        rv.some((f) => f.includes('node_modules/@phlix/ui requests @phlix/contracts#v0.5.1')),
      ).toBe(true);
      // The dead waiver family must stay silent: no ratified-hoist-drift finding
      // can ever be produced for an edge that no longer has a waiver.
      expect(findings.some((f) => f.startsWith('ratified-hoist-drift:'))).toBe(false);
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

describe('ui v0.99.6 re-pin — the waiver era is over: zero ratified hoists, byte-equality restored', () => {
  it('RATIFIED_HOISTS is present-but-empty: the written retirement condition fired', () => {
    // The contracts v0.5.0-era divergence ended at the ui v0.99.6 re-pin (2026-09-24):
    // ui v0.99.6's manifest requests the direct pin `#v0.5.1` outright (measured via
    // git show at 98a5bf38), so the waiver key missed, the entry retired per its own
    // written law, and byte-equality was restored — the map now sits present-but-empty
    // exactly as it did from W82 to the v0.5.0 re-pin. A future divergence must return
    // as a fresh exact-match entry (version AND sha), never a wildcard.
    expect(RATIFIED_HOISTS).toEqual({});
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([]);
  });

  it('both retired exception keys stay dead, the ui contracts line is byte-equal to root, and the walk is clean', () => {
    // Mutation-proof in BOTH directions on the ui→contracts edge: the divergence-era
    // words (#v0.4.7 — behind) and the older S442-era words (#v0.4.5) must never
    // silently return, in the map or in the lock line. ui's request is now byte-EQUAL
    // to the root's (#v0.5.1 — equality era restored), and the hoisted 0.4.7@e3c14f07
    // copy satisfies every contracts edge under plain rule 1 with zero findings.
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.5']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toBeUndefined();
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.1');
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    const { findings } = walk(lock);
    expect(findings.filter((f) => f.includes('@phlix/contracts'))).toEqual([]);
  });
});
