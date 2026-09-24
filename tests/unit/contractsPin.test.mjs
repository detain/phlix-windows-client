/**
 * @vitest-environment node
 *
 * Lane S442 contracts-tag currency guard.
 *
 * This is a plain Node .mjs test (not .ts): it reads package.json and
 * package-lock.json off disk and asserts the direct `@phlix/contracts` pin has
 * been advanced to the current error-registry-era tag (v0.5.1, re-pinned
 * 2026-09-23 atop the v0.5.0 error-registry introduction). Like
 * tests/unit/copyright.test.mjs it lives outside the
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

// The state the contracts v0.5.1 re-pin (error-registry expansion, 2026-09-23) pins
// the repo to. v0.5.1 is the newest contracts tag; its annotated tag peels to this
// commit (live ls-remote, 2026-09-23), which must be what the lockfile resolves.
// The `version` constant stays 0.4.7 THROUGH the bump: the v0.5.1 tag manifest's
// `version` field is stale by the estate's deliberate skew (cut without bumping the
// field — v0.5.0 kept it, v0.5.1 kept it — the v0.99.2/ui-v0.99.5 precedent), and npm
// writes the lock entry's version from the MANIFEST, not the tag — the identity proof
// is the `resolved` peel sha, mirrored by lockwalk's exact-match
// `manifestVersion: '0.4.7'` override.
const EXPECTED_CONTRACTS_RANGE = 'github:detain/phlix-contracts#v0.5.1';
const EXPECTED_CONTRACTS_RESOLVED =
  'git+ssh://git@github.com/detain/phlix-contracts.git#e3c14f07e8927224978a921e1f79406629ceb6c5';
const EXPECTED_CONTRACTS_VERSION = '0.4.7';

const root = new URL('../../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

describe('S442 — @phlix/contracts direct pin is current', () => {
  it('is the S442 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S442/);
  });

  it('declares the v0.5.1 tag in package.json', () => {
    expect(pkg.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('mirrors that exact declaration in the lockfile root package', () => {
    expect(lock.packages[''].dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('resolves the hoisted @phlix/contracts to the v0.5.1 target, not a drifted commit', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    expect(entry.resolved).toBe(EXPECTED_CONTRACTS_RESOLVED);
    // The three sources of truth must agree, not just the two on disk: lockwalk's
    // EXPECTED row carries the same tag/peel and the manifestVersion override that
    // keeps rule 1 honest against the stale 0.4.7 field.
    const contracts = EXPECTED['@phlix/contracts'];
    expect(contracts.tag).toBe('v0.5.1');
    expect(contracts.sha).toBe('e3c14f07e8927224978a921e1f79406629ceb6c5');
    expect(contracts.manifestVersion).toBe(EXPECTED_CONTRACTS_VERSION);
  });
});

describe('ui v0.99.6 re-pin — ui converges honestly: byte-identical contracts requests, zero waivers, zero nested copies', () => {
  // History of this guard: ui's manifest once requested contracts #v0.4.5 while
  // this repo's direct pin rode higher — the divergence S442 documented and the
  // lockwalk ratified until W82 retired that exception; the W85 dual-repin restored
  // byte-IDENTICAL declarations (ui v0.99.3–v0.99.5 request #v0.4.7 against a direct
  // pin of #v0.4.7). The equality era ended by design at the contracts v0.5.0 re-pin:
  // the direct pin advanced (additive error-registry expansion) while ui v0.99.5's
  // manifest still spoke #v0.4.7 — the S442 divergence class, ratified exactly in
  // lockwalk's RATIFIED_HOISTS (version AND sha) and carried at v0.5.1. It ENDED
  // again at the ui v0.99.6 re-pin (2026-09-24): ui v0.99.6's manifest requests the
  // direct pin #v0.5.1 outright (measured via git show at 98a5bf38), the waiver's
  // written retirement condition FIRED, the entry retired, and byte-equality is
  // restored — mirroring the v0.4.5-era retirement. Fail-loud on every face of the
  // new truth, BOTH directions: BEHIND — divergence-era words (#v0.4.7) returning in
  // ui's lock line, or a waiver re-spliced into the map; FALSELY-NORMALIZED — any
  // hand-edited tag the INSTALLED ui manifest does not actually speak (the installed
  // tree is the independent witness). The edge walks plain lockwalk rule 1 from here.
  it("keeps ui's lock-declared contracts request byte-pinned to #v0.5.1 — equal to root and to the installed manifest", () => {
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.1');
    // Equality era: root and ui declare the IDENTICAL spec — the divergence-era
    // .not.toBe law inverts, and a regression to #v0.4.7 goes red on both lines.
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    // The installed tree independently proves the lock line is the manifest's verbatim
    // words, not a hand-edit: falsifying either tag here trips this witness.
    const installed = readJson('node_modules/@phlix/ui/package.json');
    expect(installed.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.1');
    expect(installed.dependencies['@phlix/syncplay']).toBe('github:detain/phlix-syncplay#v0.1.5');
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([]);
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.1']).toBeUndefined();
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

  it('hoists a single @phlix/contracts resolution at the pinned version, v0.5.1 content on disk', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    const installed = readJson('node_modules/@phlix/contracts/package.json');
    expect(installed.version).toBe(EXPECTED_CONTRACTS_VERSION);
    // The stale-manifest skew means the version field cannot tell 625a5625 (v0.4.7),
    // 8ef65d30 (v0.5.0) or e3c14f07 (v0.5.1) apart — the lock sha pins the declaration,
    // and this content marker pins the INSTALLED tree. dist/error-codes.json shipped
    // first at v0.5.0 (the error-registry addition), so mere existence stopped
    // discriminating at this re-pin: the v0.5.1 expansion (PR #78) grew the registry
    // from 147 to 202 codes (verified purely additive — zero removed), so the COUNT is
    // the marker now. A resolution rolled back to the v0.5.0 peel — or older — while
    // keeping the honest 0.4.7 field goes RED here.
    const errorCodes = readJson('node_modules/@phlix/contracts/dist/error-codes.json');
    expect(errorCodes.codes).toHaveLength(202);
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
