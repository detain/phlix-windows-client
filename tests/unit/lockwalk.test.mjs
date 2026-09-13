/**
 * @vitest-environment node
 *
 * Lane S450 lockwalk guard — the committed package-lock.json must be
 * self-consistent with every @phlix/* github-tag request it (or the root
 * package.json) declares. See scripts/lockwalk.mjs for the rule set; in short:
 * the lock once shipped with the hoisted @phlix/syncplay resolution at 0.1.2
 * while @phlix/ui v0.99.1's manifest requested `#v0.1.4`, and npm 11 never
 * self-heals that divergence. The S442 ratified contracts hoist exception
 * retired at the W82 re-pin (ui v0.99.2 requests `#v0.4.6` outright) — the
 * denominator tests below pin that zero-edge reality.
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

  it('resolves @phlix/syncplay at the requested #v0.1.4 (the repaired state)', () => {
    const entry = lock.packages['node_modules/@phlix/syncplay'];
    expect(entry.version).toBe('0.1.4');
    expect(entry.resolved).toBe(
      'git+ssh://git@github.com/detain/phlix-syncplay.git#673e3d41aff7e7f1c6554915d22f7ad7bb4bf346',
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
    expect(findings.some((f) => f.startsWith('request-vs-resolved:') && f.includes('@phlix/syncplay#v0.1.4'))).toBe(true);
  });

  it('REGRESSION: flags contracts resolution drift on BOTH edges now the hoist exception is retired', () => {
    const broken = structuredClone(lock);
    broken.packages['node_modules/@phlix/contracts'] = {
      version: '0.5.0',
      resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#0000000000000000000000000000000000000000',
    };
    const { findings } = walk(broken);
    const rv = findings.filter((f) => f.startsWith('request-vs-resolved:'));
    expect(rv.some((f) => f.includes('(root) requests @phlix/contracts#v0.4.7'))).toBe(true);
    expect(rv.some((f) => f.includes('node_modules/@phlix/ui requests @phlix/contracts#v0.4.7'))).toBe(true);
    // No ratified exception exists to absorb it any more:
    expect(findings.some((f) => f.startsWith('ratified-hoist-drift:'))).toBe(false);
  });

  it('REGRESSION: flags the ui lock version line moving off the tag-derived truth', () => {
    const broken = structuredClone(lock);
    // W85 truth: ui v0.99.3 normalized its manifest `version` field (measured via
    // git show at cafe978c — reads 0.99.3), so the v0.99.2-era stale-field
    // `manifestVersion` override was retired and rule 1 checks the tag-derived
    // version outright. A hand-edit claiming the field fell back behind the tag
    // must still go RED — mutation-proof, exact-match, not a waiver.
    broken.packages['node_modules/@phlix/ui'] = {
      ...broken.packages['node_modules/@phlix/ui'],
      version: '0.99.2',
    };
    const { findings } = walk(broken);
    expect(
      findings.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.3') &&
          f.includes('version 0.99.2') &&
          f.includes('pinned version line reads 0.99.3'),
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

describe('W82/W85 — the ratified exception stays retired to exactly zero edges', () => {
  it('RATIFIED_HOISTS is empty by its own written rule (ui v0.99.2 requested #v0.4.6; v0.99.3 requests #v0.4.7)', () => {
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([]);
  });

  it('the historical exception key stays dead and the edge itself is rule-1-clean', () => {
    // Mutation-proof: a silently re-added waiver for the old divergence goes RED,
    // and the now-honest edge stays byte-pinned (ui v0.99.3's own manifest asks
    // #v0.4.7, the hoisted 0.4.7@625a5625 satisfies it — walk() sees zero findings there).
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.5']).toBeUndefined();
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.4.7');
    const { findings } = walk(lock);
    expect(findings.filter((f) => f.includes('@phlix/contracts'))).toEqual([]);
  });
});
