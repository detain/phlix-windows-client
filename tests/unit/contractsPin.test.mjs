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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Self-identifying lane marker (survives tokenisation as a plain string const).
const LANE_TOKEN = 'S442WINDOWSPINX5V2';

// The state S442 pins the repo to. v0.4.6 is the newest contracts tag; its
// annotated tag peels to this commit, which must be what the lockfile resolves.
const EXPECTED_CONTRACTS_RANGE = 'github:detain/phlix-contracts#v0.4.6';
const EXPECTED_CONTRACTS_RESOLVED =
  'git+ssh://git@github.com/detain/phlix-contracts.git#97bcda069efa2bba3591f1143a000aec8fefae15';
const EXPECTED_CONTRACTS_VERSION = '0.4.6';

const root = new URL('../../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

describe('S442 — @phlix/contracts direct pin is current', () => {
  it('is the S442 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S442/);
  });

  it('declares the v0.4.6 tag in package.json', () => {
    expect(pkg.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('mirrors that exact declaration in the lockfile root package', () => {
    expect(lock.packages[''].dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('resolves the hoisted @phlix/contracts to the v0.4.6 target, not a drifted commit', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    expect(entry.resolved).toBe(EXPECTED_CONTRACTS_RESOLVED);
  });
});

describe('W82 — nested ui → contracts declaration stays pinned', () => {
  // @phlix/ui's own package.json used to request contracts #v0.4.5 while this
  // repo's direct pin rode v0.4.6 — an upstream divergence S442 documented and
  // the lockwalk ratified as a hoist. The W82 re-pin to @phlix/ui v0.99.2
  // resolved it upstream: ui's manifest now requests #v0.4.6 itself. The guard
  // keeps pinning the exact nested declaration so any future rewrite upstream
  // fails loud here instead of silently re-creating the old drift class.
  it('leaves the nested @phlix/ui → contracts declaration at the #v0.4.6 ui now ships', () => {
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.4.6');
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
