/**
 * @vitest-environment node
 *
 * Lane S442 contracts-tag currency guard.
 *
 * This is a plain Node .mjs test (not .ts): it reads package.json and
 * package-lock.json off disk and asserts the direct `@phlix/contracts` pin has
 * been advanced to the current cs22-era tag. Like tests/unit/copyright.test.mjs
 * it lives outside the TypeScript project (tsconfig.json's `include` is
 * ["src/renderer"]), so `npm run typecheck` never sees it, while vitest's
 * `include` glob for `.test.mjs` files under tests/ does.
 *
 * The point of the guard is to fail loud the exact drift S442 was created to
 * fix: package.json declaring one contracts tag while the committed lockfile
 * resolves another (it had silently drifted to a v0.4.1-era commit labelled
 * `0.4.0` behind its own `#v0.4.3` declaration). Pin + resolution must agree.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Self-identifying lane marker (survives tokenisation as a plain string const).
const LANE_TOKEN = 'S442WINDOWSPINX5V2';

// The state the W85 dual-repin pins the repo to. v0.4.7 is the newest contracts
// tag; its annotated tag peels to this commit (live ls-remote, 2026-09-13),
// which must be what the lockfile resolves.
const EXPECTED_CONTRACTS_RANGE = 'github:detain/phlix-contracts#v0.4.7';
const EXPECTED_CONTRACTS_RESOLVED =
  'git+ssh://git@github.com/detain/phlix-contracts.git#625a5625fd19a3e887a50548b2cdaca1b0a2bd55';
const EXPECTED_CONTRACTS_VERSION = '0.4.7';

const root = new URL('../../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

describe('S442 — @phlix/contracts direct pin is current', () => {
  it('is the S442 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S442/);
  });

  it('declares the v0.4.7 tag in package.json', () => {
    expect(pkg.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('mirrors that exact declaration in the lockfile root package', () => {
    expect(lock.packages[''].dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('resolves the hoisted @phlix/contracts to the v0.4.7 target, not a drifted commit', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    expect(entry.resolved).toBe(EXPECTED_CONTRACTS_RESOLVED);
  });
});

describe('W85 — ui → contracts declarations converge: one pin, zero nested copies', () => {
  // History of this guard: ui's manifest once requested contracts #v0.4.5 while
  // this repo's direct pin rode higher — the divergence S442 documented and the
  // lockwalk ratified as a hoist until W82 retired that exception. The W85
  // dual-repin lands ui v0.99.3 (manifest requests #v0.4.7) against a direct pin
  // of #v0.4.7: the two declarations are IDENTICAL, so npm can no longer
  // materialise the nested copy that made sequential bumps un-greenable
  // (lockwalk rule 3, nested-copy-forbidden). Fail-loud on all three faces:
  // ui's lock declaration must equal the direct pin byte-for-byte, the lock must
  // carry no nested @phlix/contracts node under ui, and node_modules must not
  // grow one on disk either.
  it("keeps ui's lock-declared contracts request equal to the direct pin", () => {
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    expect(ui.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
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

  it('hoists a single @phlix/contracts resolution at the pinned version', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    const installed = readJson('node_modules/@phlix/contracts/package.json');
    expect(installed.version).toBe(EXPECTED_CONTRACTS_VERSION);
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
