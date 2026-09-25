/**
 * @vitest-environment node
 *
 * Lane S442 contracts-tag currency guard.
 *
 * This is a plain Node .mjs test (not .ts): it reads package.json and
 * package-lock.json off disk and asserts the direct `@phlix/contracts` pin has
 * been advanced to the current tag (v0.5.2, re-pinned 2026-09-25 atop the
 * field-re-normalizing release ac669ca + .gitattributes/coordinate-currency era).
 * Unchanged by the ui v0.99.7 re-pin (2026-09-25) that follows here — but that lane
 * restored BYTE-EQUALITY on the ui→contracts edge (ui v0.99.7 requests `#v0.5.2`
 * outright), retiring the exact-match waiver per its own written law and flipping
 * the second describe back to the #50-era three-way equality witness. Like
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

// The state the contracts v0.5.2 re-pin (2026-09-25) pins the repo to. v0.5.2 is the
// newest contracts tag; its annotated tag (object 9676874e) peels to this commit (live
// ls-remote, 2026-09-25), which must be what the lockfile resolves.
// The `version` constant MOVES to 0.5.2 with the tag: the v0.5.0/v0.5.1 stale-field
// skew ENDED at this release — commit ac669ca re-normalized the manifest `version` to
// 0.5.2 at the tag (measured via git show), so npm writes the honest field and the
// lockwalk `manifestVersion: '0.4.7'` override's written retirement condition FIRED.
// The identity proof remains the `resolved` peel sha.
const EXPECTED_CONTRACTS_RANGE = 'github:detain/phlix-contracts#v0.5.2';
const EXPECTED_CONTRACTS_RESOLVED =
  'git+ssh://git@github.com/detain/phlix-contracts.git#7afb6a9171c33c18a2303716516572a4dfc405d9';
const EXPECTED_CONTRACTS_VERSION = '0.5.2';

const root = new URL('../../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

describe('S442 — @phlix/contracts direct pin is current', () => {
  it('is the S442 lane guard', () => {
    expect(LANE_TOKEN).toMatch(/^S442/);
  });

  it('declares the v0.5.2 tag in package.json', () => {
    expect(pkg.dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('mirrors that exact declaration in the lockfile root package', () => {
    expect(lock.packages[''].dependencies['@phlix/contracts']).toBe(EXPECTED_CONTRACTS_RANGE);
  });

  it('resolves the hoisted @phlix/contracts to the v0.5.2 target, not a drifted commit', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    expect(entry.resolved).toBe(EXPECTED_CONTRACTS_RESOLVED);
    // The three sources of truth must agree, not just the two on disk: lockwalk's
    // EXPECTED row carries the same tag/peel — and the manifestVersion skew override
    // is GONE, retired at v0.5.2 when the release commit re-normalized the manifest
    // `version` field to 0.5.2 (measured via git show). Rule 1 now checks this row
    // against the plain tag-derived version again; a hand-revived override goes red here.
    const contracts = EXPECTED['@phlix/contracts'];
    expect(contracts.tag).toBe('v0.5.2');
    expect(contracts.sha).toBe('7afb6a9171c33c18a2303716516572a4dfc405d9');
    expect(contracts.manifestVersion).toBeUndefined();
  });
});

describe('ui v0.99.7 re-pin — ui converges honestly: byte-identical contracts requests, zero waivers, zero nested copies', () => {
  // History of this guard: ui's manifest once requested contracts #v0.4.5 while
  // this repo's direct pin rode higher — the divergence S442 documented and the
  // lockwalk ratified until W82 retired that exception; the W85 dual-repin restored
  // byte-IDENTICAL declarations (ui v0.99.3–v0.99.5 request #v0.4.7 against a direct
  // pin of #v0.4.7). That equality era ended by design at the contracts v0.5.0
  // re-pin, returned at the ui v0.99.6 re-pin (waiver retired, three-way byte-equality
  // witness), ended again at the contracts v0.5.2 re-pin (the direct pin advanced
  // while the installed ui v0.99.6 still spoke #v0.5.1 — divergence re-ratified
  // exactly), and ENDED A THIRD TIME at this ui v0.99.7 re-pin: ui v0.99.7's manifest
  // requests the direct pin `#v0.5.2` outright (measured via git show at bc1d29bf),
  // the waiver's written retirement condition FIRED, the entry retired per its own
  // law, and byte-equality is restored — the edge now walks plain lockwalk rule 1.
  // Fail-loud on every face of the new truth, BOTH directions: BEHIND — divergence-era
  // words (#v0.5.1, #v0.4.7) returning in ui's lock line, or a waiver re-spliced into
  // the map; FALSELY-NORMALIZED — any hand-edited tag the INSTALLED ui manifest does
  // not actually speak (the installed tree is the independent witness).
  it("keeps ui's lock-declared contracts request byte-pinned to #v0.5.2 — equal to root and to the installed manifest", () => {
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.2');
    // Equality era: root and ui declare the IDENTICAL spec — the divergence-era
    // .not.toBe law inverts, and a regression to #v0.5.1 goes red on both lines.
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    // The installed tree independently proves the lock line is the manifest's verbatim
    // words, not a hand-edit: falsifying either tag here trips this witness.
    const installed = readJson('node_modules/@phlix/ui/package.json');
    expect(installed.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.2');
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

  it('hoists a single @phlix/contracts resolution at the pinned version, v0.5.2 content on disk', () => {
    const entry = lock.packages['node_modules/@phlix/contracts'];
    expect(entry.version).toBe(EXPECTED_CONTRACTS_VERSION);
    const installed = readJson('node_modules/@phlix/contracts/package.json');
    expect(installed.version).toBe(EXPECTED_CONTRACTS_VERSION);
    // Both stale-manifest skews are over (contracts re-normalized at v0.5.2 by
    // ac669ca, ui re-normalized at v0.99.7 — each fired its own lockwalk override
    // retirement condition), so the version fields themselves now tell the pins
    // apart — but the census marker stays load-bearing: v0.5.2 (PRs #79-#83:
    // docblock coordinate currency, verify:cites tripwire, .gitattributes LF) did
    // NOT touch dist/error-codes.json (byte-identical across v0.5.1→v0.5.2,
    // verified via git diff), so the registry count remains 202. A resolution
    // rolled back to any older peel — or a future registry expansion silently
    // mis-labelled — goes RED here, field or no field.
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
