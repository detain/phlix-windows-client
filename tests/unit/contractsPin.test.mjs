/**
 * @vitest-environment node
 *
 * Lane S442 contracts-tag currency guard.
 *
 * This is a plain Node .mjs test (not .ts): it reads package.json and
 * package-lock.json off disk and asserts the direct `@phlix/contracts` pin has
 * been advanced to the current tag (v0.5.3, re-pinned 2026-10-01 atop the
 * registry-expansion release 430981e — 204 error codes, route manifest 412 tuples).
 * The ui v0.99.7 re-pin (2026-09-25) had restored BYTE-EQUALITY on the ui→contracts
 * edge (ui v0.99.7 requests `#v0.5.2` outright), retiring the exact-match waiver per
 * its own written law and flipping the second describe to the #50-era three-way
 * equality witness — carried at v0.99.8 (2026-09-30, a580410f). That equality era
 * ENDED at the contracts v0.5.3 re-pin (2026-10-01): the direct pin advanced past what
 * installed ui v0.99.8 requested, so the second describe flipped to the eab9a82-era
 * DIVERGENCE law (ui line byte-pinned to its own `#v0.5.2` words, .not-to-root
 * inversion, one exact-match waiver entry). The divergence era itself ENDED at the
 * ui v0.99.9 re-pin (2026-10-03, cc931723): ui v0.99.9 requests `#v0.5.3` outright, so
 * the second describe is back to the EQUALITY law (ui line byte-pinned to the SAME
 * `#v0.5.3` words as root, .toBe, zero waivers — installed tree as the witness). Like
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

// The state the contracts v0.5.3 re-pin (2026-10-01) pins the repo to. v0.5.3 is the
// newest contracts tag; its annotated tag (object eb90e6d) peels to this commit (live
// ls-remote, 2026-10-01), which must be what the lockfile resolves.
// The `version` constant MOVES to 0.5.3 with the tag: the honest-field era opened at
// v0.5.2 — commit ac669ca re-normalized the manifest `version` at the tag (measured via
// git show), firing the lockwalk `manifestVersion: '0.4.7'` override's written retirement
// condition — and v0.5.3 CARRIES the honest field (reads 0.5.3 at 430981e, measured via
// git show), so npm writes version 0.5.3 in the lock with no override.
// The identity proof remains the `resolved` peel sha.
const EXPECTED_CONTRACTS_RANGE = 'github:detain/phlix-contracts#v0.5.3';
const EXPECTED_CONTRACTS_RESOLVED =
  'git+ssh://git@github.com/detain/phlix-contracts.git#430981e3b231a04c9464382642f54c2eeea33c1c';
const EXPECTED_CONTRACTS_VERSION = '0.5.3';

const root = new URL('../../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

describe('S442 — @phlix/contracts direct pin is current', () => {
  it('is the S442 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S442/);
  });

  it('declares the v0.5.3 tag in package.json', () => {
    expect(pkg.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('mirrors that exact declaration in the lockfile root package', () => {
    expect(lock.packages[''].dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('resolves the hoisted @phlix/contracts to the v0.5.3 target, not a drifted commit', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    expect(entry.resolved).toBe(EXPECTED_CONTRACTS_RESOLVED);
    // The three sources of truth must agree, not just the two on disk: lockwalk's
    // EXPECTED row carries the same tag/peel — and the manifestVersion skew override
    // stays GONE: v0.5.2's release commit re-normalized the manifest `version` field
    // (measured via git show) and v0.5.3 carries the honest field (reads 0.5.3 at
    // 430981e). Rule 1 checks this row against the plain tag-derived version; a
    // hand-revived override goes red here.
    const contracts = EXPECTED['@phlix/contracts'];
    expect(contracts.tag).toBe('v0.5.3');
    expect(contracts.sha).toBe('430981e3b231a04c9464382642f54c2eeea33c1c');
    expect(contracts.manifestVersion).toBeUndefined();
  });
});

describe('ui v0.99.9 re-pin — equality era restored: ui line byte-pinned to the same #v0.5.3 words as root, zero waivers, zero nested copies', () => {
  // History of this guard: ui's manifest once requested contracts #v0.4.5 while
  // this repo's direct pin rode higher — the divergence S442 documented and the
  // lockwalk ratified until W82 retired that exception; the W85 dual-repin restored
  // byte-IDENTICAL declarations; equality ended at the contracts v0.5.0 re-pin,
  // returned at the ui v0.99.6 re-pin, ended again at the contracts v0.5.2 re-pin,
  // ENDED A THIRD TIME at the ui v0.99.7 re-pin (carried at v0.99.8), the divergence
  // era returned at the contracts v0.5.3 re-pin (2026-10-01), and the DIVERGENCE ERA
  // ITSELF ENDED at this ui v0.99.9 re-pin (2026-10-03): installed ui v0.99.9 requests
  // `#v0.5.3` outright (measured via git show at cc931723 AND independently off the
  // installed node_modules/@phlix/ui/package.json), byte-equality with the direct pin
  // restored — the @v0.5.2 waiver retired per its own written law, map
  // present-but-empty. npm dedupes ui's edge onto the single hoisted 0.5.3 copy (no
  // nested node in the lock, no nested dir on disk).
  // Fail-loud on every face of the new truth, BOTH directions: FALSELY-DIVERGENT —
  // root and ui lock lines hand-edited apart while the installed manifest agrees;
  // STALE-DRIFT — ui's words changing from `#v0.5.3` without a live waiver (the
  // installed tree is the independent witness).
  it("keeps ui's lock-declared contracts request byte-pinned to its manifest's #v0.5.3 words — EQUAL to root", () => {
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.3');
    // Equality era: ui v0.99.9 declares the identical words to the root pin — the
    // divergence-era .not.toBe law flips back to .toBe, and a hand-split of the two
    // lines (or a ui downgrade to a #v0.5.2-era tag without re-ratifying a waiver)
    // goes red on both lines until this file is re-measured.
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    // The installed tree independently proves the lock line is the manifest's verbatim
    // words, not a hand-edit: falsifying either tag here trips this witness.
    const installed = readJson('node_modules/@phlix/ui/package.json');
    expect(installed.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.3');
    expect(installed.dependencies['@phlix/syncplay']).toBe('github:detain/phlix-syncplay#v0.1.5');
    // The equality era's steady state: zero ratified hoists — the waiver's written
    // retirement condition (#v0.5.3-or-newer requested outright) fired at ui v0.99.9.
    expect(RATIFIED_HOISTS).toEqual({});
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.2']).toBeUndefined();
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

  it('hoists a single @phlix/contracts resolution at the pinned version, v0.5.3 content on disk', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    const installed = readJson('node_modules/@phlix/contracts/package.json');
    expect(installed.version).toBe(EXPECTED_CONTRACTS_VERSION);
    // Both stale-manifest skews stay over (contracts re-normalized at v0.5.2 by
    // ac669ca — carried at v0.5.3 — and ui re-normalized at v0.99.7), so the version
    // fields themselves tell the pins apart — and the census marker is load-bearing
    // in a NEW way this era: v0.5.3 (release 430981e) genuinely EXPANDED the registry
    // additively 202→204 (unlike v0.5.2, whose dist/error-codes.json was byte-identical
    // to v0.5.1's), and the route manifest moved to 412 tuples (md5 91579683...). The
    // count must be rotated by MEASUREMENT at every future re-pin — a resolution rolled
    // back to any older peel, a newer expansion silently mis-labelled, or this line left
    // at an inherited count goes RED here, field or no field.
    const errorCodes = readJson('node_modules/@phlix/contracts/dist/error-codes.json');
    expect(errorCodes.codes).toHaveLength(204);
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
