/**
 * @phlix/* lockwalk — package-lock self-consistency walker (lane S450).
 *
 * The defect class this catches: the committed lockfile once declared, under
 * `node_modules/@phlix/ui`, a request for `@phlix/syncplay #v0.1.4` while the
 * single hoisted syncplay resolution sat at version `0.1.2` (resolved at the
 * v0.1.2 tag commit `2fdf70bf`). npm 11 does NOT self-heal that divergence —
 * neither `npm install` nor a cold-cache re-derivation flags an unsatisfied
 * git-tag edge once the tree entry exists — so `npm ci` fidelity silently
 * degraded and no gate noticed. The S450-era repair landed syncplay at
 * `0.1.4` / `673e3d41` (the v0.1.4 annotated tag peeled), matching what
 * @phlix/ui v0.99.1's own manifest requests.
 *
 * Rules enforced (structural, network-free — safe for CI):
 *  1. Every `github:detain/<repo>#<tag>` request for an @phlix/* package, from
 *     the root package or from any @phlix/* lock entry, must resolve to a lock
 *     node whose `version` equals the tag — or, where the tagged upstream
 *     manifest ships a stale `version` field, equals that field pinned
 *     explicitly as `manifestVersion` in EXPECTED below (lived three times so
 *     far: @phlix/ui v0.99.2 was tagged with its manifest `version` still
 *     reading 0.99.1 — override retired when v0.99.3–v0.99.4 normalized the
 *     field, revived at v0.99.5 which again ships `version: 0.99.4` under the
 *     tag and CARRIES at v0.99.6 (field still 0.99.4 at 98a5bf38, measured via
 *     git show) — but the ui skew ENDED at v0.99.7: that tag ships the field
 *     re-normalized to `0.99.7` (measured via git show at bc1d29bf; npm 12.0.2
 *     accordingly writes lock version 0.99.7), firing the override's own
 *     written retirement condition exactly as it fired for the contracts row;
 *     @phlix/contracts v0.5.0 is the third case — the estate cut the
 *     error-registry tag with the field deliberately left at 0.4.7, per the
 *     v0.99.2 precedent, and v0.5.1 kept it — but the contracts skew ENDED at
 *     v0.5.2: the release commit (ac669ca) re-normalized the field to `0.5.2`
 *     at the tag (measured via git show), firing that override's own written
 *     retirement condition, so the contracts row walks the plain tag-derived
 *     version again — and v0.5.3 CARRIES the honest field (reads 0.5.3 at tag
 *     430981e, measured via git show). With both skews ended, NO override is
 *     currently active — the MECHANISM stays armed for a future stale-field tag.
 *     The identity byte-check remains the `resolved` peel sha) — and whose
 *     `resolved` sha equals the pinned peel sha.
 *     An override is exact-match, never a wildcard waiver.
 *  2. RATIFIED_HOISTS carries the exact-match waivers for edges whose requested
 *     tag differs from the single hoisted resolution this repo standardizes on.
 *     History: the S442-era exception (ui v0.99.1 requesting contracts `#v0.4.5`
 *     over a hoisted `0.4.6`) retired at the W82 re-pin when ui v0.99.2 requested
 *     `#v0.4.6` outright, and the map sat present-but-empty until the contracts
 *     v0.5.0 re-pin (2026-09-23) re-added one under its own written rule: ui
 *     v0.99.5's manifest still requests contracts `#v0.4.7` while the direct pin
 *     advanced past it (error-registry cascade), so npm dedupes ui's edge onto
 *     the hoisted copy. The waiver pins version AND sha exactly; it
 *     dies the moment a ui tag requests the direct pin's tag-or-newer outright
 *     (key miss -> the edge re-enters plain rule-1 territory), mirroring the
 *     v0.4.5 retirement. At the v0.5.1 re-pin (registry expansion, 2026-09-23)
 *     the retirement condition was checked and did NOT fire - ui v0.99.5's
 *     manifest still speaks `#v0.4.7` (measured via git show at 3017f443) - so
 *     the entry carries, its sha re-ratified exactly to the hoist's new peel.
 *     FIRED at the ui v0.99.6 re-pin (2026-09-24): that tag's manifest requests
 *     the direct pin `#v0.5.1` outright (measured via git show at 98a5bf38), the
 *     key misses, the entry retired per its own written rule, and the map sits
 *     present-but-empty again — exactly as it did from W82 to the v0.5.0 re-pin.
 *     RE-ADDED at the contracts v0.5.2 re-pin (2026-09-25): the equality era ended
 *     the moment the direct pin advanced past ui v0.99.6's request — the installed
 *     tree is the witness (ui manifest speaks `#v0.5.1`, measured via git show at
 *     98a5bf38) and a surgical npm install 12.0.2 observed dedupe, not nesting
 *     (zero nested copies in lock and on disk), the same npm-git-edge behavior the
 *     v0.5.0 era proved. New exact-match entry under the same law: key
 *     `node_modules/@phlix/ui>@phlix/contracts@v0.5.1`, version AND sha of the
 *     hoisted copy. It dies when a ui tag requests `#v0.5.2`-or-newer outright.
 *     FIRED at the ui v0.99.7 re-pin (2026-09-25): that tag's manifest requests
 *     the direct pin `#v0.5.2` outright (measured via git show at bc1d29bf), the
 *     key misses, the entry retired per its own written rule, and the map sits
 *     present-but-empty again — the third retirement under this same law
 *     (v0.4.5 era, v0.5.1 era, now v0.5.2 era), byte-equality restored on the
 *     ui→contracts edge, which walks plain rule 1 from here. CARRIED at the ui
 *     v0.99.8 re-pin (2026-09-30): that tag's manifest requests `#v0.5.2` outright
 *     as well (measured via git show at a580410f AND off the installed node's
 *     manifest), so the edge stays waiver-free plain rule 1 and the map stays empty.
 *     ENDED at the contracts v0.5.3 re-pin (2026-10-01): the direct pin advanced to
 *     `#v0.5.3` while installed ui v0.99.8 still requests `#v0.5.2` (measured via git
 *     show at a580410f AND independently off the installed
 *     node_modules/@phlix/ui/package.json) — the divergence class returned for the
 *     fourth time under this same law, re-added as a fresh exact-match entry keyed
 *     `node_modules/@phlix/ui>@phlix/contracts@v0.5.2`, pinning version AND sha of the
 *     hoisted 0.5.3 copy (npm 12.0.2 again observed dedupe, not nesting — zero nested
 *     copies in lock and on disk). It dies when a ui tag requests
 *     `#v0.5.3`-or-newer outright. FIRED at the ui v0.99.9 re-pin (2026-10-03): that tag's
 *     manifest requests the direct pin `#v0.5.3` outright (measured via git show at
 *     cc931723), the key misses, the entry retires per its own written rule — the fourth
 *     retirement under this same law — the map sits present-but-empty again, and the
 *     ui→contracts edge walks plain rule 1 from here. CARRIED at the contracts v0.5.4 +
 *     ui v0.99.12 re-pin (2026-11-02): ui v0.99.12's manifest requests the new direct pin
 *     `#v0.5.4` outright (measured via git show at 1f0046c5) and root advanced to the same
 *     tag — byte-equality holds on BOTH edges, nothing to retire, the map stays
 *     present-but-empty, and both contracts edges walk plain rule 1 onto the one hoisted
 *     0.5.4@c4919853 copy (the v0.5.4 registry is FROZEN — trio md5s byte-ident to v0.5.3).
 *  3. No nested @phlix copies (no `node_modules/@phlix/<dep>/node_modules/@phlix/<dep>`)
 *     — single-resolution invariant, mirrors S447's "no consumer may read the
 *     stale nested copy" ruling.
 *  4. Every @phlix/* lock node must be the resolution of at least one edge
 *     (orphan-node detector — a hand-edit that leaves an unreferenced copy
 *     shows up here).
 *
 * `--live` additionally peels each EXPECTED tag against its remote via
 * `git ls-remote` (annotated `^{}` peeled, lightweight as-is) and proves the
 * pinned shas still name the tags they claim. It needs ssh access and is run
 * lane-side / on demand, never from the unit test.
 *
 * Exit code 0 = walk clean; 1 = findings (printed one per line).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GIT_SPEC_RE = /^github:detain\/([\w.-]+)#([\w.-]+)$/;
const PHLIX_PKG_RE = /^@phlix\/[\w-]+$/;
const DIRECT_NODE_RE = /^node_modules\/(@phlix\/[\w-]+)$/;
const NESTED_NODE_RE = /\/node_modules\/@phlix\/[\w-]+$/;

// Single resolutions: package -> the tag this repo standardizes on and
// the commit that tag peels to (re-verified against the live remotes via
// `git ls-remote ... refs/tags/<tag>^{}` on 2026-11-02, ui v0.99.13 re-pin atop the
// contracts v0.5.4 + ui v0.99.12 wave; RE-VERIFIED 2026-11-04 for the phase-3
// contracts v0.5.5 + ui v0.99.14 cascade; RE-VERIFIED AGAIN 2026-11-04 for the
// gate-3 ui v0.99.15 wave, and RE-VERIFIED AGAIN 2026-11-04 for the wave-5 contracts
// v0.5.6 + ui v0.99.16 cascade (all three refs below re-peeled against the live remotes
// via `git ls-remote` this window — contracts v0.5.6 obj 9f04fc50, syncplay v0.1.7
// obj fe687f27 HELD, ui v0.99.16 obj 743a4b38):
//   phlix-contracts v0.5.6 -> c89c8420  (annotated tag object 9f04fc50; its manifest `version` field is
//                                         HONEST - reads 0.5.6 at the tag (measured via git show; npm 11
//                                         accordingly writes lock version 0.5.6), CARRYING the normalization
//                                         the v0.5.2 release commit ac669ca opened, so the `manifestVersion`
//                                         override stays RETIRED and the contracts row walks the plain
//                                         tag-derived version. v0.5.6 (peel c89c8420, 2026-11-04) is the
//                                         route-manifest REGEN mint — #36 payload 412->415 tuples (md5
//                                         91579683...->90b79e355055307d..., measured off the installed node),
//                                         with the error-code registry HELD byte-identically (205 codes, md5
//                                         5d1783a71a3c4e12...) and mcp-scopes HELD (8c92c070...) — zero
//                                         ErrorCode-union movement, so no TS2741-class cohort this wave. The
//                                         equality era RESTORED at the ui v0.99.9 re-pin CARRIES through
//                                         v0.99.10–v0.99.15 and this v0.99.16 move: ui's manifest requests
//                                         `#v0.5.6` outright (measured via git show at 4d89b3a7 AND
//                                         independently off the installed node) - both the
//                                         root->contracts and ui->contracts edges walk
//                                         plain rule 1 onto the one hoisted 0.5.6@c89c8420 copy; the
//                                         RATIFIED_HOISTS waiver stays retired per its own written law)
//   phlix-syncplay  v0.1.7 -> 1a80b1d1  (annotated tag object fe687f27; ROTATED at the gate-3 ui v0.99.15 re-pin
//                                         (2026-11-04): ui v0.99.15's manifest requests `#v0.1.7` outright (measured
//                                         via git show at 36c04fbe) — the edge that rode #v0.1.6 through v0.99.12,
//                                         v0.99.13 and v0.99.14 (each measured via git show at the respective peel)
//                                         has now advanced. This repo has NO direct syncplay pin — the hoisted node
//                                         exists solely as ui's edge resolution, so it follows ui's words. v0.1.7's
//                                         manifest `version` field is HONEST (reads 0.1.7 at 1a80b1d1, measured via
//                                         git show), so the row walks the plain tag-derived version. The node
//                                         advanced 0.1.6->0.1.7 through the S450-class targeted
//                                         `npm update @phlix/syncplay --package-lock-only` because a plain
//                                         `npm install` rotated the ui deps EDGE line but left the hoisted resolution
//                                         stale (npm does NOT self-heal unsatisfied git-tag edges — the walker red
//                                         at the hoisted node is the standing witness). v0.1.7's dist genuinely
//                                         differs from v0.1.6 (js/umd/maps + client.d.ts/framing.d.ts move;
//                                         index.d.ts byte-ident; zero error-code/frame-type delta — wire unchanged).)
//   phlix-ui        v0.99.16 -> 4d89b3a7  (annotated tag object 743a4b38; its manifest `version` field stays
//                                         HONEST - reads 0.99.16 at the tag (measured via git show; the
//                                         version-field alignment law has held since v0.99.7, when the
//                                         `manifestVersion: '0.99.4'` skew override's own written retirement
//                                         condition fired at bc1d29bf; v0.99.8 through v0.99.16 CARRY it) -
//                                         the ui row keeps walking the plain tag-derived version and that
//                                         override stays RETIRED, mirroring the contracts-row retirement at
//                                         v0.5.2. No manifestVersion override is active anywhere now; the
//                                         mechanism stays armed for a future stale-field tag.
//                                         v0.99.16 (peel 4d89b3a7) is the wave-5 D2-era mint: the tag's
//                                         delta over v0.99.15 is the contracts #v0.5.5->#v0.5.6 pin
//                                         re-advance + the dist stamp literal. The locales tree and
//                                         `messages.ts` are BYTE-IDENTICAL across the .15/.16 peels (git
//                                         diff empty between 36c04fbe AND 4d89b3a7 at src/i18n/locales;
//                                         messages.ts blob df982b17 at both; re-proven on the published
//                                         codeload tag payloads) — a deliberate vendor HOLD (fourth after
//                                         .9/.10/.13): PIN + SOURCE_REF stay at the 36c04fbe peel; the
//                                         catalog holds 523 keys. The ui→syncplay request rides `#v0.1.7`
//                                         unchanged from v0.99.15.)
export const EXPECTED = {
  '@phlix/contracts': {
    tag: 'v0.5.6',
    sha: 'c89c8420cd4d50e51f232885754cb74c92a9e05c',
    // v0.5.6 re-pin (2026-11-04, wave-5 consumer cascade): the route manifest MOVED — regen #36 payload
    // 412->415 tuples at srv 58530ec2, dist/server-route-manifest.json md5 91579683...->90b79e355055307d...
    // (the untagged D2 payload this release minted; measured off the installed node). The error-code
    // registry HELD byte-identically (205 codes, md5 5d1783a71a3c4e128b2021327cad3717 — the v0.5.5
    // expansion's field) and mcp-scopes HELD (8c92c070...), so the ErrorCode union windows' TS compiles
    // against is UNMOVED — zero TS2741-class cohort this wave. The `manifestVersion` skew override
    // stays RETIRED — v0.5.6 carries the honest field (reads 0.5.6 at c89c8420, measured via git show at
    // the peel; the normalization the v0.5.2 release commit ac669ca opened carries through), so this row
    // walks the plain tag-derived version. The override MECHANISM stays armed for a future stale-field
    // tag; none is active — the ui row retired its own at v0.99.7 (field honest at bc1d29bf) and
    // v0.99.8 through v0.99.16 carry it.
    repo: 'git+ssh://git@github.com/detain/phlix-contracts.git',
  },
  '@phlix/syncplay': {
    tag: 'v0.1.7',
    sha: '1a80b1d1cbb6d63aa4d3dce0001ff21ac5e85b4d',
    repo: 'git+ssh://git@github.com/detain/phlix-syncplay.git',
  },
  '@phlix/ui': {
    tag: 'v0.99.16',
    sha: '4d89b3a7d98aa3b22cea59ee6e74ee6594a5ea89',
    // v0.99.16 re-pin (2026-11-04, wave-5 consumer cascade): the honest-field
    // era OPENED at v0.99.7, when the `manifestVersion: '0.99.4'` skew override's own
    // written condition fired (field re-normalized to 0.99.7 at bc1d29bf, measured via
    // git show). v0.99.8 through this v0.99.16 tag CARRY it — reads 0.99.16 at 4d89b3a7
    // (measured via git show; npm writes lock version 0.99.16) — so this row keeps
    // walking the plain tag-derived version; the override stays RETIRED. No
    // manifestVersion override is active anywhere now; the MECHANISM stays armed for a
    // future stale-field tag. The step itself is the D2 contracts-re-advance mint: the
    // tag's delta over v0.99.15 is the contracts pin to #v0.5.6 + the dist stamp
    // literal — the locales tree and `messages.ts` are BYTE-IDENTICAL across the
    // .15/.16 peels (git diff empty; messages.ts blob df982b17 at both; re-proven on the
    // published codeload tag payloads), so — like the deliberate holds at
    // v0.99.9/v0.99.10/v0.99.13 — the locale vendor pin HOLDS at the 36c04fbe peel
    // (fourth deliberate hold), catalog staying at 523 keys. The syncplay edge rides
    // ui's unchanged `#v0.1.7` request; v0.1.7@1a80b1d1 is untouched by this wave.
    repo: 'git+ssh://git@github.com/detain/phlix-ui.git',
  },
};

// "dependentKey>package@requested-tag" -> the exact hoist accepted upstream of rule 1.
// History: the S442-era waiver (ui `#v0.4.5` over hoisted 0.4.6) retired 2026-09-13 (W82
// winsump) when ui v0.99.2 requested `#v0.4.6` outright; the map sat empty through the
// W85/W87 re-pins. RE-ADDED for the contracts v0.5.0 re-pin (2026-09-23): ui v0.99.5's own
// manifest still requests contracts `#v0.4.7` while the direct pin advanced (error-registry
// cascade, purely additive) and npm dedupes ui's edge onto the single hoisted copy — proven
// nested-free both in the lock and on disk by tests/unit/contractsPin.test.mjs. Exact-match
// like its predecessor: version AND sha. CARRIED at the contracts v0.5.1 re-pin (2026-09-23):
// the retirement condition was checked and did not fire — ui v0.99.5's manifest still speaks
// `#v0.4.7` (measured via git show at 3017f443) — so the waiver stays and its sha re-ratifies
// exactly to the hoisted copy's new peel e3c14f07.
// RETIRED at the ui v0.99.6 re-pin (2026-09-24): the written retirement condition FIRED —
// ui v0.99.6's manifest requests the direct pin `#v0.5.1` outright (measured via git show at
// 98a5bf38), so the key misses, the entry is deleted, and byte-equality is restored (root and
// ui now declare the identical spec and dedupe onto the one hoisted copy, exactly like the
// v0.4.5-era retirement and the W85/W87 equality era). The ui→contracts edge walked plain
// rule 1 until the equality era itself ended here. RE-ADDED at the contracts v0.5.2 re-pin
// (2026-09-25): the direct pin advanced to `#v0.5.2` while the INSTALLED ui v0.99.6 still
// requests `#v0.5.1` (measured via git show at 98a5bf38 AND independently off the installed
// node_modules/@phlix/ui/package.json), so the edge diverges again — the waiver's written
// retirement condition has NOT fired (ui would have to request `#v0.5.2`-or-newer). npm
// 12.0.2 observed deduping the ui edge onto the hoisted 0.5.2 copy (no nested node in the
// lock, no nested dir on disk after a surgical install), mirroring the v0.5.0-era behavior.
// Exact-match as always: version AND sha of the hoisted copy.
// RETIRED at the ui v0.99.7 re-pin (2026-09-25): the written retirement condition FIRED —
// ui v0.99.7's manifest requests the direct pin `#v0.5.2` outright (measured via git show at
// bc1d29bf), so the key misses, the entry is deleted, and byte-equality is restored (root and
// ui now declare the identical spec and dedupe onto the one hoisted copy, exactly like the
// v0.4.5-era and v0.5.1-era retirements — this same law has now fired three times). The map
// sits present-but-empty again; the ui→contracts edge walks plain rule 1. A future divergence
// must return as a fresh exact-match entry (version AND sha), never a wildcard.
// CARRIED at the ui v0.99.8 re-pin (2026-09-30): ui v0.99.8's manifest requests `#v0.5.2`
// outright too (measured via git show at a580410f and independently off the installed
// node_modules/@phlix/ui/package.json — the same three-way equality witness
// tests/unit/contractsPin.test.mjs pins), so the equality era, the empty map, and the
// waiver-free plain rule-1 edge all rode through that pin move untouched.
// ENDED at the contracts v0.5.3 re-pin (2026-10-01): the equality era died the moment the
// direct pin advanced to `#v0.5.3` while the INSTALLED ui v0.99.8 still requests `#v0.5.2`
// (measured via git show at a580410f AND independently off the installed
// node_modules/@phlix/ui/package.json). Fresh exact-match entry under the same law — version
// AND sha of the hoisted 0.5.3@430981e copy; npm 12.0.2 again observed dedupe (no nested node
// in the lock, no nested dir on disk after a surgical install), mirroring the v0.5.0-era and
// v0.5.2-era divergences. It dies when a ui tag requests `#v0.5.3`-or-newer outright.
// FIRED at the ui v0.99.9 re-pin (2026-10-03): the written retirement condition EXECUTED —
// ui v0.99.9's manifest requests the direct pin `#v0.5.3` outright (measured via git show at
// cc931723; the lock's ui node records the same words), so the key `…>@phlix/contracts@v0.5.2`
// misses, the entry is deleted, and byte-equality is restored on the ui→contracts edge — the
// FOURTH retirement under this same law (v0.4.5-era, v0.5.1-era, v0.5.2-era, now this
// v0.5.2-edge era). The map sits present-but-empty again; both contracts edges dedupe onto
// the one hoisted 0.5.3@430981e copy and walk plain rule 1. A future divergence must return
// as a fresh exact-match entry (version AND sha), never a wildcard.
// CARRIED at the contracts v0.5.4 + ui v0.99.12 re-pin (2026-11-02): root advanced to `#v0.5.4`
// and ui v0.99.12's manifest requests that same tag outright (measured via git show at 1f0046c5;
// the lock's ui node records the same words) — byte-equality holds on both contracts edges onto
// the one hoisted 0.5.4@c4919853 copy. No waiver existed to retire; the written condition simply
// continues to hold (its fifth straight equality-era move since the v0.99.9 retirement).
// CARRIED again at the ui v0.99.13 re-pin (2026-11-02): ui v0.99.13's manifest still requests the
// direct pin `#v0.5.4` outright (measured via git show at e30bae9f AND independently off the
// installed node_modules/@phlix/ui/package.json; the lock's ui node records the same words) — the
// sixth straight equality-era move, the map stays present-but-empty, both contracts edges walk
// plain rule 1 onto the one hoisted 0.5.4@c4919853 copy, and the syncplay edge rides #v0.1.6.
// CARRIED AGAIN at the contracts v0.5.5 + ui v0.99.14 phase-3 cascade (2026-11-04): root advances to
// `#v0.5.5` and ui v0.99.14's manifest requests that same tag outright (measured via git show at
// a437b995 AND independently off the installed node_modules/@phlix/ui/package.json; the lock's ui node
// records the same words) — the SEVENTH straight equality-era move: the map stays present-but-empty,
// both contracts edges walk plain rule 1 onto the one hoisted 0.5.5@e2159816 copy, and the syncplay
// edge rides ui's unchanged #v0.1.6 request (v0.1.7 exists unreleased-by-any-edge — see the census
// note above; adding a direct syncplay pin here would CONTRADICT the thin-consumer resolution law).
// CARRIED ONCE MORE at the ui v0.99.15 gate-3 wave (2026-11-04): root's contracts pin HELD at `#v0.5.5`
// and ui v0.99.15's manifest requests that same tag outright (measured via git show at 36c04fbe) — the
// EIGHTH straight equality-era move: the map stays present-but-empty and both contracts edges walk plain
// rule 1 onto the one hoisted 0.5.5@e2159816 copy. The syncplay edge ADVANCED — ui v0.99.15 requests
// `#v0.1.7` outright (measured via git show at 36c04fbe), so the hoisted node followed to 0.1.7@1a80b1d1
// under plain rule 1 (requested == resolved — no waiver in play on this edge either; the advance needed the
// S450-class targeted `npm update @phlix/syncplay --package-lock-only` because a plain install left the
// hoisted resolution stale). Zero ratified hoists on all four edges; the walker measures green.
// CARRIED ONCE MORE at the contracts v0.5.6 + ui v0.99.16 wave-5 cascade (2026-11-04): BOTH contracts edges
// move together — root advances to `#v0.5.6` and ui v0.99.16's manifest requests that same tag outright
// (measured via git show at 4d89b3a7 AND independently off the installed node_modules/@phlix/ui/package.json;
// the lock's ui node records the same words) — the NINTH straight equality-era move: the map stays
// present-but-empty, both contracts edges walk plain rule 1 onto the one hoisted 0.5.6@c89c8420 copy (npm 11
// observed dedupe, not nesting — zero nested nodes in the lock, no nested dir on disk), and the syncplay
// edge rides ui's unchanged `#v0.1.7` request (0.1.7@1a80b1d1 untouched). Zero ratified hoists on all four
// edges; the walker measures green.
export const RATIFIED_HOISTS = {};

export function readRepoJson(name) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8'));
}

export function parsePhlixGitSpec(spec) {
  const m = GIT_SPEC_RE.exec(spec);
  return m ? { repo: m[1], tag: m[2] } : null;
}

const resolvedSha = (entry) => (entry?.resolved ?? '').split('#').pop() ?? '';

/**
 * Walk the root package.json plus lock, applying rules 1-4.
 * Returns { findings, edges } — findings are human-readable strings,
 * edges records every @phlix request inspected.
 */
export function walk(lock) {
  const findings = [];
  const edges = [];
  const packages = lock.packages ?? {};
  const resolvedPaths = new Set();

  const edgeSources = Object.entries(packages).filter(
    ([key]) => key === '' || DIRECT_NODE_RE.test(key),
  );

  for (const [key, node] of edgeSources) {
    for (const [dep, spec] of Object.entries(node.dependencies ?? {})) {
      if (!PHLIX_PKG_RE.test(dep)) continue;
      const parsed = parsePhlixGitSpec(spec);
      if (!parsed) {
        findings.push(`non-tag-pin: ${key || '(root)'} requests ${dep} via unpinnable spec ${spec}`);
        continue;
      }
      const { tag } = parsed;
      edges.push({ from: key || '(root)', dep, tag });

      const nestedPath = key === '' ? `node_modules/${dep}` : `${key}/node_modules/${dep}`;
      const hoistedPath = `node_modules/${dep}`;
      const entry = packages[nestedPath] ?? packages[hoistedPath] ?? null;
      if (!entry) {
        findings.push(`missing-resolution: ${key || '(root)'} requests ${dep}#${tag}`);
        continue;
      }
      resolvedPaths.add(packages[nestedPath] ? nestedPath : hoistedPath);

      const ratified = RATIFIED_HOISTS[`${key}>${dep}@${tag}`];
      if (ratified) {
        if (entry.version !== ratified.version || resolvedSha(entry) !== ratified.sha) {
          findings.push(
            `ratified-hoist-drift: ${key || '(root)'} requests ${dep}#${tag}; the ratified hoist ` +
              `(${ratified.version}@${ratified.sha.slice(0, 8)}) now resolves ` +
              `${entry.version}@${resolvedSha(entry).slice(0, 8)} — re-ratify explicitly`,
          );
        }
        continue;
      }

      const expected = EXPECTED[dep];
      const wantedVersion = expected?.manifestVersion ?? tag.replace(/^v/, '');
      const versionMatches = entry.version === wantedVersion;
      const shaMatches = Boolean(expected) && resolvedSha(entry) === expected.sha;
      if (!versionMatches || !shaMatches) {
        findings.push(
          `request-vs-resolved: ${key || '(root)'} requests ${dep}#${tag} but lock resolves ` +
            `version ${entry.version} at ${resolvedSha(entry) || '(no git resolution)'}` +
            (expected && !shaMatches ? ` (not the pinned ${expected.tag} peel ${expected.sha})` : '') +
            (!versionMatches ? ` (pinned version line reads ${wantedVersion})` : ''),
        );
      }
    }
  }

  for (const key of Object.keys(packages)) {
    if (!NESTED_NODE_RE.test(key) && !DIRECT_NODE_RE.test(key)) continue;
    if (NESTED_NODE_RE.test(key)) {
      findings.push(`nested-copy-forbidden: ${key} @ ${packages[key].version}`);
      continue;
    }
    if (!resolvedPaths.has(key)) {
      findings.push(`orphan-node: ${key} @ ${packages[key].version} resolves no @phlix request`);
    }
  }

  return { findings, edges };
}

/**
 * Prove each EXPECTED tag still peels to its pinned sha on the live remotes.
 */
export function livePeelProofs() {
  return Object.entries(EXPECTED).map(([dep, { repo, tag, sha }]) => {
    const out = execFileSync('git', ['ls-remote', repo, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
      encoding: 'utf8',
    });
    const rows = out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t'));
    const tagObject = rows.find(([, ref]) => ref === `refs/tags/${tag}`)?.[0];
    const peel = rows.find(([, ref]) => ref.endsWith('^{}'))?.[0] ?? tagObject;
    return { dep, tag, tagObject, peel, expectedSha: sha, ok: peel === sha };
  });
}

export function main({ live = false } = {}) {
  const { findings, edges } = walk(readRepoJson('package-lock.json'));
  for (const edge of edges) {
    console.log(`edge: ${edge.from} -> ${edge.dep} requests ${edge.dep}#${edge.tag}`);
  }
  if (live) {
    for (const proof of livePeelProofs()) {
      console.log(
        `peel: ${proof.dep} ${proof.tag} tag-object=${proof.tagObject} commit=${proof.peel} ` +
          `pinned=${proof.expectedSha} ${proof.ok ? 'OK' : 'MISMATCH'}`,
      );
      if (!proof.ok) {
        findings.push(`live-peel: ${proof.dep} ${proof.tag} peels to ${proof.peel}, not the pinned ${proof.expectedSha}`);
      }
    }
  }
  if (findings.length === 0) {
    console.log(`lockwalk: ${edges.length} edges walked, 0 mismatches`);
    return 0;
  }
  for (const f of findings) console.error(`lockwalk: ${f}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main({ live: process.argv.includes('--live') });
}
