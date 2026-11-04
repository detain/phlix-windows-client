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
 * a580410f), ENDED at the contracts v0.5.3 re-pin (2026-10-01: the direct pin
 * advanced to `#v0.5.3` while installed ui v0.99.8 still speaks `#v0.5.2` — the
 * divergence class returned for the fourth time under the same law, re-ratified as a
 * fresh exact-match waiver keyed @v0.5.2, version AND sha of the hoisted 0.5.3@430981e
 * copy), and RETIRED AGAIN at the ui v0.99.9 re-pin (2026-10-03: ui v0.99.9 requests
 * the direct pin `#v0.5.3` outright, measured via git show at cc931723 — the waiver's
 * written law had then fired four times; byte-equality restored, map
 * present-but-empty), CARRIED at the ui v0.99.10 re-pin (2026-10-14: ui v0.99.10
 * still requests `#v0.5.3` outright, measured via git show at 18c76eb0), and CARRIED
 * AGAIN at the contracts v0.5.4 + ui v0.99.12 re-pin (2026-11-02: root advanced to
 * `#v0.5.4` while ui v0.99.12 requests that same tag outright, measured via git show at
 * 1f0046c5 — byte-equality holds, no waiver existed to retire, the map rides present-but-
 * empty; the hoisted syncplay node advanced 0.1.5→0.1.6 through the S450-class targeted
 * `npm update @phlix/syncplay --package-lock-only` because npm never self-heals
 * unsatisfied git-tag edges), and CARRIED again at the ui v0.99.13 re-pin (2026-11-02:
 * the direct pins do not move — ui v0.99.13 requests `#v0.5.4` and `#v0.1.6` outright,
 * measured via git show at e30bae9f AND independently off the installed
 * node_modules/@phlix/ui/package.json — byte-equality holds, the map rides present-but-empty),
 * and CARRIED once more at the contracts v0.5.5 + ui v0.99.14 phase-3 cascade (2026-11-04: root
 * advances to `#v0.5.5` while ui v0.99.14 requests that same tag outright, measured via git show
 * at a437b995 AND independently off the installed node_modules/@phlix/ui/package.json — the
 * SEVENTH straight equality-era move, the map rides present-but-empty; the hoisted syncplay node
 * then carried 0.1.6@08168774), and CARRIED ONCE MORE at the ui v0.99.15 gate-3 wave (2026-11-04:
 * contracts equality holds EIGHTH straight — root stays `#v0.5.5`, ui v0.99.15 requests it outright,
 * measured via git show at 36c04fbe — map present-but-empty; the syncplay edge ADVANCES: ui v0.99.15's
 * manifest words are `#v0.1.7`, so the hoisted node followed ui to 0.1.7@1a80b1d1 through the S450-class
 * targeted advance — still plain rule 1, requested == resolved, zero waivers on all four edges),
 * and CARRIED ONCE MORE at the contracts v0.5.6 + ui v0.99.16 wave-5 cascade (2026-11-04: BOTH contracts
 * edges move TOGETHER — root advances to `#v0.5.6` and ui v0.99.16 requests that same tag outright,
 * measured via git show at 4d89b3a7 AND independently off the installed node_modules/@phlix/ui/package.json
 * — the NINTH straight equality-era move, map present-but-empty; the syncplay edge rides ui's unchanged
 * `#v0.1.7` request; 0.1.7@1a80b1d1 untouched. Zero ratified hoists on all four edges; the walker
 * measures green).
 * The denominators below pin that zero-waiver reality.
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

// The hoisted contracts node's honest version at the v0.5.6 pin (field re-normalized
// at v0.5.2 by ac669ca and carried through v0.5.3 through v0.5.6 — the manifestVersion override era
// is over; see contractsPin.test.mjs).
const CONTRACTS_HONEST_VERSION = '0.5.6';

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

  it('resolves @phlix/syncplay at the requested #v0.1.7 (the ui v0.99.15 edge, advanced from #v0.1.6 via the S450-class targeted advance)', () => {
    const entry = lock.packages['node_modules/@phlix/syncplay'];
    expect(entry.version).toBe('0.1.7');
    expect(entry.resolved).toBe(
      'git+ssh://git@github.com/detain/phlix-syncplay.git#1a80b1d1cbb6d63aa4d3dce0001ff21ac5e85b4d',
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
    expect(findings.some((f) => f.startsWith('request-vs-resolved:') && f.includes('@phlix/syncplay#v0.1.7'))).toBe(true);
  });

  it('REGRESSION: flags contracts resolution drift on BOTH edges via plain rule 1, in every direction', () => {
    // Since the ui v0.99.9 re-pin (carried at v0.99.10, advanced through the
    // contracts v0.5.4 + ui v0.99.12 re-pin, carried again at the ui v0.99.13
    // re-pin, carried once more at the contracts v0.5.5 + ui v0.99.14 cascade, carried at
    // the ui v0.99.15 gate-3 wave, and carried at THIS wave-5 contracts v0.5.6 + ui v0.99.16
    // cascade)
    // BOTH contracts edges walk PLAIN rule 1:
    // root and ui
    // declare the identical `#v0.5.6` spec (byte-equality restored — the @v0.5.2 waiver
    // retired per its own written law when ui v0.99.9 requested the direct pin outright,
    // measured via git show at cc931723, equality re-confirmed at v0.99.12 requesting
    // `#v0.5.4` outright, measured via git show at 1f0046c5, carried at v0.99.13,
    // measured via git show at e30bae9f, carried at v0.99.14 requesting `#v0.5.5`
    // outright, measured via git show at a437b995, carried at v0.99.15 requesting it
    // outright (measured via git show at 36c04fbe), and carried at THIS wave-5 v0.99.16
    // requesting `#v0.5.6` outright again (measured via git show at 4d89b3a7; no manifestVersion override
    // anywhere in the set, both fields honest at their tags). Three hand-edits of the
    // hoisted contracts node, each must go RED on BOTH edges:
    //  a) rolled back to the real v0.5.5 peel with that release's honest 0.5.5 field
    //     (the behind direction — the immediately-preceding pin, freshest rollback material);
    //  b) falsely claiming 0.4.7 at the current peel — a dead skew word from the
    //     v0.5.0/v0.5.1 era;
    //  c) sha-only drift under the honest version (a same-field foreign commit: the
    //     peel-naming branch fires on both edges).
    const mutated = [
      { version: '0.5.5', resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#e21598166a7be27e305c205097630e9b635fcd99' },
      { ...lock.packages['node_modules/@phlix/contracts'], version: '0.4.7' },
      { ...lock.packages['node_modules/@phlix/contracts'], resolved: 'git+ssh://git@github.com/detain/phlix-contracts.git#0000000000000000000000000000000000000000' },
    ];
    for (const edit of mutated) {
      const broken = structuredClone(lock);
      broken.packages['node_modules/@phlix/contracts'] = edit;
      const { findings } = walk(broken);
      const rv = findings.filter((f) => f.startsWith('request-vs-resolved:'));
      // Root requests #v0.5.6: plain rule 1 (no override — the wanted version reads
      // 0.5.6 straight off the tag).
      const rootEdge = rv.find((f) => f.includes('(root) requests @phlix/contracts#v0.5.6'));
      expect(rootEdge).toBeDefined();
      if (edit.version === CONTRACTS_HONEST_VERSION) {
        // Case (c): sha-only drift under the honest version — the peel naming fires.
        expect(rootEdge).toContain('not the pinned v0.5.6 peel c89c8420cd4d50e51f232885754cb74c92a9e05c');
      } else {
        // Cases (a)/(b): wrong version line — rule 1 names the tag-derived truth.
        expect(rootEdge).toContain('pinned version line reads 0.5.6');
      }
      // ui requests the SAME #v0.5.6 words since the contracts v0.5.6 re-pin, CARRIED at the
      // ui v0.99.16 re-pin (its own tag manifest, measured via git show at 4d89b3a7) — the identical
      // rule-1 edge must light on the ui edge too (mutating the single hoisted node
      // provably reds both requesters).
      const uiEdge = rv.find((f) => f.includes('node_modules/@phlix/ui requests @phlix/contracts#v0.5.6'));
      expect(uiEdge).toBeDefined();
      if (edit.version === CONTRACTS_HONEST_VERSION) {
        expect(uiEdge).toContain('not the pinned v0.5.6 peel c89c8420cd4d50e51f232885754cb74c92a9e05c');
      } else {
        expect(uiEdge).toContain('pinned version line reads 0.5.6');
      }
      // The waiver map is empty — a ratified-hoist finding can never be produced in
      // the equality era (dead-waiver-silent law).
      expect(findings.some((f) => f.startsWith('ratified-hoist-drift:'))).toBe(false);
    }
  });

  it('REGRESSION: flags the ui lock version line moving off the honest tag-derived truth', () => {
    // v0.99.16 wave-5 re-pin truth (equality era carried from v0.99.9): the tag manifest's
    // `version` field is HONEST — it reads
    // 0.99.16 at 4d89b3a7 (measured via git show), carrying the honest-field era that
    // OPENED at v0.99.7, when the exact-match `manifestVersion: '0.99.4'` override's
    // written retirement condition fired at bc1d29bf and has held through
    // v0.99.8 through v0.99.15 and this v0.99.16.
    // Rule 1 checks the lock against the plain TAG-derived version, mirroring the
    // contracts-row retirement at v0.5.2. Three hand-edits must go RED:
    // a) the stale-manifest word 0.99.4 reviving the dead skew;
    // b) the now-behind word 0.99.15 (the immediately-preceding pin — freshest rollback
    // material); c) sha-only drift under the
    // honest version. Mutation-proof, exact-match — a hand-revived override cannot
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
          f.includes('@phlix/ui#v0.99.16') &&
          f.includes('version 0.99.4') &&
          f.includes('pinned version line reads 0.99.16'),
      ),
    ).toBe(true);

    const furtherBehind = structuredClone(lock);
    furtherBehind.packages['node_modules/@phlix/ui'] = {
      ...furtherBehind.packages['node_modules/@phlix/ui'],
      version: '0.99.15',
    };
    const ahead = walk(furtherBehind).findings;
    expect(
      ahead.some(
        (f) =>
          f.startsWith('request-vs-resolved:') &&
          f.includes('@phlix/ui#v0.99.16') &&
          f.includes('version 0.99.15') &&
          f.includes('pinned version line reads 0.99.16'),
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
          f.includes('@phlix/ui#v0.99.16') &&
          f.includes('not the pinned v0.99.16 peel 4d89b3a7d98aa3b22cea59ee6e74ee6594a5ea89'),
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

describe('ui v0.99.9 re-pin carried through v0.99.10, the contracts v0.5.4 + ui v0.99.12 re-pin, the ui v0.99.13 re-pin, the contracts v0.5.5 + ui v0.99.14 cascade, the ui v0.99.15 gate-3 wave, and the contracts v0.5.6 + ui v0.99.16 wave-5 cascade — the waiver era stays over: zero ratified hoists, byte-equality holds', () => {
  it('RATIFIED_HOISTS is empty: the written law fired its retirement condition a fourth time and equality has carried since', () => {
    // The divergence era that opened at the contracts v0.5.3 re-pin (2026-10-01) ENDED
    // at the ui v0.99.9 re-pin (2026-10-03): ui v0.99.9 requests the direct pin
    // `#v0.5.3` outright (measured via git show at cc931723), satisfying the waiver's
    // written retirement condition — `#v0.5.3`-or-newer; the v0.99.10 re-pin CARRIED
    // that state (same request measured via git show at 18c76eb0) and the contracts
    // v0.5.4 + ui v0.99.12 re-pin (2026-11-02) CARRIES IT ON: ui v0.99.12 requests the
    // new direct pin `#v0.5.4` outright (measured via git show at 1f0046c5), so root and
    // ui declare identical words again and no waiver is in play — carried through the
    // ui v0.99.13 re-pin (2026-11-02: same request measured via git show at e30bae9f AND
    // off the installed node) and the contracts v0.5.5 + ui v0.99.14 cascade (2026-11-04:
    // root advanced to `#v0.5.5` and ui v0.99.14 requests that same tag outright, measured
    // via git show at a437b995 AND off the installed node — the seventh straight equality-era
    // move), and the ui v0.99.15 gate-3 wave (2026-11-04: contracts HELD at `#v0.5.5` and ui
    // v0.99.15 requests that same tag outright, measured via git show at 36c04fbe — the EIGHTH
    // straight equality-era move; the syncplay edge advanced with ui's new words, still plain
    // rule 1 — requested == resolved, no waiver in play on any of the four edges), and carried at
    // THIS wave-5 contracts v0.5.6 + ui v0.99.16 cascade (2026-11-04: root and ui BOTH advance
    // together to `#v0.5.6` — ui's own tag manifest requests it outright, measured via git show at
    // 4d89b3a7 AND off the installed node — the NINTH straight equality-era move; the syncplay edge
    // sits untouched at #v0.1.7, still plain rule 1 — no waiver in play on any of the four edges). The map stays
    // present-but-empty,
    // the steady-state monument of the equality eras (this retirement has now fired four
    // times: v0.4.5-era → v0.99.2, v0.4.7-era → v0.99.6…v0.99.7, v0.5.2-edge era → the
    // @v0.5.2 waiver's retirement here at v0.99.9).
    expect(RATIFIED_HOISTS).toEqual({});
    expect(Object.keys(RATIFIED_HOISTS)).toEqual([]);
  });

  it('dead exception keys stay dead, the ui contracts line is byte-pinned to root (#v0.5.6, equality carried), the ui override stays retired, and the walk is clean', () => {
    // Mutation-proof in BOTH directions on the ui→contracts edge: the older divergence
    // words (#v0.4.5, #v0.4.7, #v0.5.1) and the last-live waiver key (@v0.5.2) must
    // never silently return as live map keys. ui's request is now byte-IDENTICAL to the
    // root's (#v0.5.6 both — the equality law carried through the v0.99.9/v0.99.10/#v0.5.3
    // era and the v0.5.4/#v0.99.12–v0.99.15 era into this together-move),
    // the single hoisted 0.5.6@c89c8420 copy satisfies BOTH edges under plain rule 1,
    // with zero walk findings. On the ui row itself: the `manifestVersion: '0.99.4'`
    // override stays retired — its written condition fired when the v0.99.7 tag
    // normalized the field (measured via git show), carried through v0.99.8 through
    // v0.99.15 and this v0.99.16 —
    // so a hand-revived override goes red here and the lock's honest 0.99.16 version
    // line is checked against the tag-derived truth.
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.5']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.4.7']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.1']).toBeUndefined();
    expect(RATIFIED_HOISTS['node_modules/@phlix/ui>@phlix/contracts@v0.5.2']).toBeUndefined();
    const ui = lock.packages['node_modules/@phlix/ui'];
    expect(ui.dependencies['@phlix/contracts']).toBe('github:detain/phlix-contracts#v0.5.6');
    expect(ui.dependencies['@phlix/contracts']).toBe(pkg.dependencies['@phlix/contracts']);
    const uiRow = EXPECTED['@phlix/ui'];
    expect(uiRow.tag).toBe('v0.99.16');
    expect(uiRow.sha).toBe('4d89b3a7d98aa3b22cea59ee6e74ee6594a5ea89');
    expect(uiRow.manifestVersion).toBeUndefined();
    expect(ui.version).toBe('0.99.16');
    const { findings } = walk(lock);
    expect(findings).toEqual([]);
  });
});
