/**
 * @vitest-environment node
 *
 * Lane S442 contracts-tag currency guard.
 *
 * This is a plain Node .mjs test (not .ts): it reads package.json and
 * package-lock.json off disk and asserts the direct `@phlix/contracts` pin has
 * been advanced to the current error-registry-era tag (v0.5.0, re-pinned
 * 2026-09-23). Like tests/unit/copyright.test.mjs it lives outside the
 * TypeScript project (tsconfig.json's `include` is ["src/renderer"]), so
 * `npm run typecheck` never sees it, while vitest's `include` glob for
 * `.test.mjs` files under tests/ does.
 *
 * The point of the guard is to fail loud the exact drift S442 was created to
 * fix: package.json declaring one contracts tag while the committed lockfile
 * resolves another (it had silently drifted to a v0.4.1-era commit labelled
 * `0.4.0` behind its own `#v0.4.3` declaration). Pin + resolution must agree.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXPECTED, RATIFIED_HOISTS } from '../../scripts/lockwalk.mjs';

// Self-identifying lane marker (survives tokenisation as a plain string const).
const LANE_TOKEN = 'S442WINDOWSPINX5V2';

// The state the contracts v0.5.0 re-pin (error-registry cascade, 2026-09-23) pins
// the repo to. v0.5.0 is the newest contracts tag; its annotated tag peels to this
// commit (live ls-remote, 2026-09-23), which must be what the lockfile resolves.
// The `version` constant stays 0.4.7 THROUGH the bump: the v0.5.0 tag manifest's
// `version` field is stale by the estate's deliberate skew (cut without bumping the
// field, the v0.99.2/ui-v0.99.5 precedent), and npm writes the lock entry's version
// from the MANIFEST, not the tag — the identity proof is the `resolved` peel sha,
// mirrored by lockwalk's exact-match `manifestVersion: '0.4.7'` override.
const EXPECTED_CONTRACTS_RANGE = 'github:detain/phlix-contracts#v0.5.0';
const EXPECTED_CONTRACTS_RESOLVED =
  'git+ssh://git@github.com/detain/phlix-contracts.git#8ef65d30be42623765c29ced34fc86d8ab3c51b5';
const EXPECTED_CONTRACTS_VERSION = '0.4.7';

const root = new URL('../../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

describe('S442 — @phlix/contracts direct pin is current', () => {
  it('is the S442 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S442/);
  });

  it('declares the v0.5.0 tag in package.json', () => {
    expect(pkg.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('mirrors that exact declaration in the lockfile root package', () => {
    expect(lock.packages[''].dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('resolves the hoisted @phlix/contracts to the v0.5.0 target, not a drifted commit', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    expect(entry.resolved).toBe(EXPECTED_CONTRACTS_RESOLVED);
    // The three sources of truth must agree, not just the two on disk: lockwalk's
    // EXPECTED row carries the same tag/peel and the manifestVersion override that
    // keeps rule 1 honest against the stale 0.4.7 field.
    const contracts = EXPECTED['@phlix/contracts'];
    expect(contracts.tag).toBe('v0.5.0');
    expect(contracts.sha).toBe('8ef65d30be42623765c29ced34fc86d8ab3c51b5');
    expect(contracts.manifestVersion).toBe(EXPECTED_CONTRACTS_VERSION);
  });
});

describe('contracts v0.5.0 re-pin — ui diverges honestly: one ratified hoist, zero nested copies', () => {
  // History of this guard: ui's manifest once requested contracts #v0.4.5 while
  // this repo's direct pin rode higher — the divergence S442 documented and the
  // lockwalk ratified until W82 retired that exception; the W85 dual-repin restored
  // byte-IDENTICAL declarations (ui v0.99.3–v0.99.5 request #v0.4.7 against a direct
  // pin of #v0.4.7), which is why the equality law below could exist at all. The
  // equality era ends here by design: the direct pin advances to #v0.5.0 (additive
  // error-registry cascade) while ui v0.99.5's manifest still speaks #v0.4.7 — the
  // S442 divergence class returns, this time ratified exactly in lockwalk's
  // RATIFIED_HOISTS (version AND sha). Fail-loud on every face of the new truth:
  // ui's declaration stays byte-pinned to its own manifest's words (#v0.4.7, never
  // hand-edited to masquerade as the new direct pin), the waiver is the single
  // exact-match one, the lock carries no nested @phlix/contracts node under ui, and
  // node_modules must not grow one on disk either. When a ui tag requests #v0.5.0+
  // outright, restore byte-equality and retire the waiver (lockwalk rule 2).
  it("keeps ui's lock-declared contracts request byte-pinned to its manifest's #v0.4.7", () => {
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.4.7');
    expect(ui.dependencies['@phlix/contracts']).not.toBe(pkg.dependencies['@phlix/contracts']);
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([
      'node_modules/@phlix/ui>@phlix/contracts@v0.4.7',
    ]);
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toEqual({
      version: EXPECTED_CONTRACTS_VERSION,
      sha: '8ef65d30be42623765c29ced34fc86d8ab3c51b5',
    });
  });

  it('ships no nested @phlix/ui → contracts copy in the lock', () => {
    const nestedKeys = Object.keys(lock.packages).filter((k) =>
      /^node_modules\/@phlix\/ui\/node_modules\//.test(k),
    );
    expect(nestedKeys).toEqual([]);
  });

  it('ships no nested @phlix/ui → contracts copy on disk after npm install', () => {
    expect(
      existsSync(fileURLToPath(new URL('node_modules/@phlix/ui/node_modules/@phlix/contracts', root))),
    ).toBe(false);
  });

  it('hoists a single @phlix/contracts resolution at the pinned version, v0.5.0 content on disk', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    const installed = readJson('node_modules/@phlix/contracts/package.json');
    expect(installed.version).toBe(EXPECTED_CONTRACTS_VERSION);
    // The stale-manifest skew means the version field cannot tell 625a5625 (v0.4.7)
    // apart from 8ef65d30 (v0.5.0) — the lock sha pins the declaration, and this
    // content marker pins the INSTALLED tree: dist/error-codes.json shipped for the
    // first time at v0.5.0 (the error-registry addition). A resolution rolled back
    // to the old peel while keeping the honest 0.4.7 field goes RED here.
    expect(
      existsSync(fileURLToPath(new URL('node_modules/@phlix/contracts/dist/error-codes.json', root))),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S490 — the test runner itself is migrated: declared ^5 = resolved 5.x = installed 5.x.
// Same drift class this file exists for, one layer deeper: a package.json that
// claims vitest 5 while the lockfile or node_modules still ships 3 (the
// GHSA-82fw-gwwq-j7x9 advisory family) must fail loud here.
// ---------------------------------------------------------------------------
const S490_VITEST5_TOKEN = 'S490VITEST5X9R5';

describe('S490 — vitest test-runner is migrated to major 5 end to end', () => {
  it('is the S490 lane guard', () => {
    // Runtime use of the token const: a comment-only token cannot pass this line.
    expect(S490_VITEST5_TOKEN).toHaveLength('S490VITEST'.length + '5X9R5'.length);
  });

  it('declares a ^5 range for vitest in package.json', () => {
    expect(pkg.devDependencies.vitest).toMatch(/^\^5\./);
  });

  it('resolves vitest to a 5.x version in the committed lockfile', () => {
    expect(Number(lock.packages['node_modules/vitest'].version.split('.')[0])).toBe(5);
  });

  it('has the 5.x vitest actually installed — the declared runner is the running one', () => {
    const installed = readJson('node_modules/vitest/package.json');
    expect(installed.version.split('.')[0]).toBe('5');
  });
});
