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
// gate-3 ui v0.99.15 wave, RE-VERIFIED AGAIN 2026-11-04 for the wave-5 contracts
// v0.5.6 + ui v0.99.16 cascade, RE-VERIFIED AGAIN 2026-11-06 for the ui v0.99.17 re-pin,
// RE-VERIFIED AGAIN 2026-11-06 for the ui v0.99.19 re-pin,
// and RE-VERIFIED AGAIN 2026-11-06 for the ui v0.99.20 re-pin,
// and RE-VERIFIED AGAIN 2026-11-06 for the ui v0.99.21 re-pin
// (contracts and syncplay HELD; all three refs below re-peeled against the live remotes
// via `git ls-remote` this window — contracts v0.5.6 obj 9f04fc50 HELD, syncplay v0.1.7
// obj fe687f27 HELD, ui v0.99.21 obj bf70c58f),
// and RE-VERIFIED AGAIN 2026-11-09 for the contracts v0.5.7 + ui v0.99.25 wave
// (all three refs below re-peeled against the live remotes via `git ls-remote` this
// window — contracts v0.5.7 obj eee7e776 ADVANCED, syncplay v0.1.7 obj fe687f27 HELD,
// ui v0.99.25 obj 52ea3cb7 ADVANCED),
// and RE-VERIFIED AGAIN 2026-11-10 for the ui v0.99.26 wave (all three refs re-peeled
// against the live remotes via `git ls-remote` this window — ui v0.99.26 obj 74c120bc
// ADVANCED, contracts v0.5.7 obj eee7e776 HELD, syncplay v0.1.7 obj fe687f27 HELD),
// and RE-VERIFIED AGAIN 2026-11-11 for the ui v0.99.27 wave (all three refs re-peeled
// against the live remotes via `git ls-remote` this window — ui v0.99.27 obj c262b681
// ADVANCED, contracts v0.5.7 obj eee7e776 HELD, syncplay v0.1.7 obj fe687f27 HELD):
//   phlix-contracts v0.5.7 -> bedfe69b  (annotated tag object eee7e776; its manifest
//                                         `version` field is HONEST - reads 0.5.7 at the
//                                         tag (measured off the installed node; npm 11
//                                         accordingly writes lock version 0.5.7), CARRYING
//                                         the normalization the v0.5.2 release commit
//                                         ac669ca opened, so the `manifestVersion` override
//                                         stays RETIRED and the contracts row walks the
//                                         plain tag-derived version. v0.5.7 (peel bedfe69b,
//                                         2026-11-06) is the LW-001..071 docs-currency +
//                                         wire-truth DTO rewrite release (PlaybackInfo +
//                                         stream-session DTOs rewritten to the EXECUTED
//                                         server wire; exactOptionalPropertyTypes enabled
//                                         package-internally). The trio is HELD
//                                         byte-identically (error-codes 5d1783a71a3c4e12...
//                                         205 codes, route-manifest 90b79e355055307d...,
//                                         mcp-scopes 8c92c070... — all three md5-verified
//                                         off THIS wave's installed node), so the
//                                         ErrorCode union windows' TS compiles against is
//                                         UNMOVED — zero TS2741-class cohort this wave, and
//                                         windows imports neither rewritten DTO family
//                                         (grep-measured: `buildPhlixHeaders` + the
//                                         error-code census are the only @phlix/contracts
//                                         consumers in src/ + tests/). The equality era
//                                         RESTORED at the ui v0.99.9 re-pin CARRIES through
//                                         v0.99.10-v0.99.22, the contracts v0.5.7 +
//                                         ui v0.99.25 move, the ui v0.99.26 re-pin,
//                                         and the ui v0.99.27 re-pin
//                                         (2026-11-11: ui's contracts words UNCHANGED —
//                                         `#v0.5.7` still requested outright, measured via
//                                         git show at 1f906979 AND off the installed node):
//                                         ui's manifest requests
//                                         `#v0.5.7` outright (measured via git show at
//                                         6e1ce2d8 AND independently off the installed
//                                         node) - both the root->contracts and
//                                         ui->contracts edges walk plain rule 1 onto the
//                                         one hoisted 0.5.7@bedfe69b copy; the
//                                         RATIFIED_HOISTS waiver stays retired per its own
//                                         written law. The prior row read v0.5.6@c89c8420
//                                         (annotated obj 9f04fc50, the route-manifest REGEN
//                                         mint #36 — payload 412->415 tuples, md5
//                                         91579683...->90b79e35..., registry 5d1783a7 HELD —
//                                         carried the same honest field through)
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
//   phlix-ui        v0.99.21 -> 01acaa12  (annotated tag object bf70c58f; its manifest `version` field stays
//                                         HONEST - reads 0.99.21 at the tag (measured via git show; the
//                                         version-field alignment law has held since v0.99.7, when the
//                                         `manifestVersion: '0.99.4'` skew override's own written retirement
//                                         condition fired at bc1d29bf; v0.99.8 through v0.99.21 CARRY it) -
//                                         the ui row keeps walking the plain tag-derived version and that
//                                         override stays RETIRED, mirroring the contracts-row retirement at
//                                         v0.5.2. No manifestVersion override is active anywhere now; the
//                                         mechanism stays armed for a future stale-field tag.
//                                         v0.99.21 (peel 01acaa12) is the theme-persist consumer wave
//                                         over v0.99.20 — ui's TW-theme-persist work PUTs/GETs the
//                                         selected theme through users/me/settings with silent hub-style
//                                         degradation (server call fails -> theme still applies locally +
//                                         the quiet `settings.themeSavedLocally` hint; catalogue fetch
//                                         fails -> built-ins only + `settings.themeCatalogueUnavailable`
//                                         disclosure + force-refresh affordance + Plugins-page hint)
//                                         + the .21 release bump. The published package.json diff over
//                                         v0.99.20 is again the version field alone — but, like the
//                                         .20 step, the shipped TYPE surface moved ADDITIVELY inside
//                                         dist/: api/themeSettings.d.ts is NEW, and
//                                         composables/useTheme.d.ts / errors.d.ts / messages.d.ts /
//                                         the locale types churn. Windows references NONE of those
//                                         symbols (useTheme / themeSettings / themeCatalogueUnavailable
//                                         / themeSavedLocally: zero hits across src/ + tests/,
//                                         grep-measured this wave), so this repo's compile surface is
//                                         unmoved. dist aggregate md5 0e3b071f... measured this lane
//                                         under the cross-tree recipe over BOTH the codeload tag payload
//                                         and the installed node (888 files each, diff -r byte-ident;
//                                         the ui release record's 34c01469... agg is its own
//                                         venue-specific recipe), with phlix-ui.js 7e4c16b5...,
//                                         player.js fcb3596c..., phlix-ui.umd.cjs 02e3caac..., and
//                                         PlayerPage carriers rotated to BTz2s3yI.js 5b5ac827... /
//                                         ja0Ix1W0.cjs 0dabd9de... replacing BUnWXFam.js / DFDk18x-.cjs.
//                                         The locales tree and `messages.ts` MOVED across
//                                         e48d8d02..01acaa12 (six locale files +2 lines each, tree
//                                         39245de0→4c264a97, messages.ts a49e432a→0a181db6, catalog
//                                         524→526 with zero removals, the index.ts pair held) — a
//                                         genuine re-vendor, the seventh (v0.99.5, v0.99.8, v0.99.12,
//                                         v0.99.14, v0.99.15, v0.99.19, v0.99.21): PIN + SOURCE_REF
//                                         advance to the 01acaa12 peel in this commit. The
//                                         ui->contracts request still speaks
//                                         `#v0.5.6` outright (measured via git show at 01acaa12 AND off
//                                         the installed node) — thirteenth straight equality-era move; the
//                                         ui->syncplay request rides `#v0.1.7` unchanged from v0.99.15.)
export const EXPECTED = {
  '@phlix/contracts': {
    tag: 'v0.5.8',
    sha: 'e5a33809e9659ab40325aae4e92411b464ddbcd7',
    // v0.5.8 re-pin (2026-11-13, CTR-S14 cascade, ui HELD at v0.99.28): the honest-field era carries
    // (reads 0.5.8 at e5a33809; the manifestVersion override stays RETIRED), so this row walks the
    // plain tag-derived version. ui v0.99.28's own manifest STILL requests `#v0.5.7`, so the
    // ui->contracts edge diverges from root again and is ratified in RATIFIED_HOISTS below.
    // PRIOR ROW — v0.5.7 (peel bedfe69b):
    // v0.5.7 re-pin (2026-11-09, the .25 consumer wave — ui v0.99.25's own manifest requests
    // `#v0.5.7`, so BOTH pins advance together and byte-equality holds): the trio HELD
    // byte-identically across v0.5.6→v0.5.7 (error-codes 5d1783a71a3c4e12... 205 codes,
    // route-manifest 90b79e35..., mcp-scopes 8c92c070... — all re-measured md5-ident off
    // THIS wave's installed node), so the ErrorCode union windows' TS compiles against is
    // UNMOVED — zero TS2741-class cohort this wave. The v0.5.7 payload is the LW-001..071
    // docs-currency + wire-truth DTO rewrite wave (PlaybackInfo + stream-session DTOs
    // rewritten to the EXECUTED server wire; exactOptionalPropertyTypes enabled package-
    // internally); windows imports neither rewritten family (grep-measured this wave:
    // `buildPhlixHeaders` + the error-code census are the ONLY @phlix/contracts consumers
    // in src/ + tests/). The `manifestVersion` skew override
    // stays RETIRED — v0.5.7 carries the honest field (reads 0.5.7 at bedfe69b, measured off
    // the installed node; the normalization the v0.5.2 release commit ac669ca opened carries
    // through), so this row walks the plain tag-derived version. The override MECHANISM stays
    // armed for a future stale-field tag; none is active — the ui row retired its own at
    // v0.99.7 (field honest at bc1d29bf) and v0.99.8 through v0.99.27 carry it.
    // PRIOR ROW — v0.5.6 (peel c89c8420, 2026-11-04, wave-5 consumer cascade): the route
    // manifest MOVED then — regen #36 payload 412->415 tuples, md5 91579683...->90b79e35...
    // (registry 5d1783a7 205 codes + mcp-scopes 8c92c070 HELD), honest field at c89c8420.
    repo: 'git+ssh://git@github.com/detain/phlix-contracts.git',
  },
  '@phlix/syncplay': {
    tag: 'v0.1.7',
    sha: '1a80b1d1cbb6d63aa4d3dce0001ff21ac5e85b4d',
    repo: 'git+ssh://git@github.com/detain/phlix-syncplay.git',
  },
  '@phlix/ui': {
    tag: 'v0.99.28',
    sha: 'dfe8fc6586e41728b4dcdc1a22a2bf8d19e74e01',
    // v0.99.28 re-pin (2026-11-12, WIN-S31, the .28 consumer wave over this repo's .27 pin): the
    // honest-field era carries — the annotated tag (object 29b6a8c5) peels to dfe8fc65 and its
    // manifest reads 0.99.28 (lock version 0.99.28), so this row walks the plain tag-derived
    // version; no manifestVersion override. THE CONTRACTS EDGE RIDES UNCHANGED: .28's manifest
    // still requests `#v0.5.7` (measured via git show at dfe8fc65) — root keeps `#v0.5.7`,
    // byte-equality holds, the waiver map stays empty. Locale posture: GENUINE RE-VENDOR, six
    // locale files shifted; SOURCE_REF + PIN advance to the dfe8fc65 peel in this commit.
    // PRIOR ROW — v0.99.27 (peel 1f906979, 2026-11-11):
    // v0.99.27 re-pin (2026-11-11, the .27 session-rows consumer wave over this repo's .26-era pin):
    // the honest-field era carries — the annotated tag (object c262b681) peels to 1f906979 and its
    // manifest reads 0.99.27 (off the codeload tarball AND the installed node; npm 11 writes lock
    // version 0.99.27), so this row keeps walking the plain tag-derived version; no manifestVersion
    // override. The window dc2e70fe..1f906979 is two ui commits: the w31L3 CP-015 cookie-custody
    // WS-protocols test wave (861a715d, test-only) and the session-rows feature + release ritual
    // (1f906979: DeviceSessionsPage surface embedded as the Settings > Sessions tab — the D-1a
    // auth-token family the estate's session-revocation program shipped on server+hub). THE
    // CONTRACTS EDGE RIDES UNCHANGED: .27's manifest still requests `#v0.5.7` outright (measured via
    // git show at 1f906979, off the codeload tag payload package.json AND independently off the
    // installed node_modules/@phlix/ui/package.json) — root keeps `#v0.5.7`, byte-equality holds,
    // plain rule 1, the waiver map stays present-but-empty — the SEVENTEENTH straight equality-era
    // move. The syncplay edge rides ui's unchanged `#v0.1.7` request (0.1.7@1a80b1d1 untouched).
    // The lock delta is EXACTLY 3+/3− (root deps echo + ui node version + resolved) — the pinia peer
    // line rides .26's widened `^3.0.0 || ^4.0.0` UNCHANGED (.27's manifest peers byte-equal; zero
    // new lock lines at this step). Locale posture: GENUINE RE-VENDOR — the NINTH real move
    // (v0.99.5, .8, .12, .14, .15, .19, .21, .25, and this .27): six locale files shifted, +24
    // flattened keys each, zero removals (settings.tabSessions + the 23-key sessions.{...} block —
    // eyebrow/title/desc/cardTitle/count/thisDevice/unknownDevice/created/lastUsed/refresh/
    // loading/revoke/revokeAll/revokeConfirm/revokeAllConfirm/revokeSuccess/revokeError/
    // revokeOthersSuccess/revokeOthersError/loadErrorTitle/loadError/emptyTitle/emptyDescription),
    // locales tree d5e169d0→72f38393, messages.ts 431bf59c→8ba3d1c4, the index.ts pair HELD (blob
    // b921cc0c both sides); catalog 542→566 flattened keys BOTH sides (esbuild-bundle counts
    // executed this lane, methodology calibrated: the .26 side reproduces the registered 542
    // exactly); SOURCE_REF + PIN advance to the 1f906979 peel in this commit. Pre-sync conviction
    // (measured): the installed-bundle law went red on exactly the 24 fresh keys ('settings.tab-
    // Sessions', …(23)) before the re-vendor landed; post-vendor the full i18nLocales suite ran
    // 53/53 GREEN with ZERO test-code edits (the laws are relational). Identity MEASURED this lane,
    // codeload tag payload == installed node byte-ident (diff -r over dist/, 891 files, net +2 over
    // the .26-era 889; tarball md5 79bd2668666fad12e75b9de07436734a, 27,101,204 B): phlix-ui.js
    // c7368aa3..., player.js 530ebbcf..., phlix-ui.umd.cjs d5a51444..., player.umd.cjs
    // 2d0b2509...; PlayerPage carriers rotated to PlayerPage-CHLjXsKa.js
    // 5e4318d73ea09f356e479e9cddcd3165 / PlayerPage-Bf9BUzY8.cjs fe0eb0ed91ebc6a3e1e3b5f1affaa18d
    // (the .26-era pair 5onGq7ES.js / C5iwUiHp.cjs is gone). Version stamp 0.99.27 ×1 and
    // 0.99.26 ×0 in the installed phlix-ui.js. The electronBridge bundle-reality literals
    // ('let t = e.routerBase ?? "/app"' and the `${t}/player/:id` route template) SURVIVED the step
    // byte-identically (measured via grep -o over the installed .27 phlix-ui.js — zero rotation
    // owed, the assertions stayed green THROUGH the bump; the stamp prose re-dated).
    // usePlayerStore-BpohCwDP.js AND shortcuts-BqUhFpRJ.js both rode byte-ident across the bump
    // (md5-measured .26→.27 — chunk-hash identity; the :213+/417 and :295-331/:335 coordinates
    // carry unchanged on the new install). Windows compile surface: the session-rows UI is
    // upstream-side (the thin consumer's vendored route table renders it with zero windows diff);
    // the vue-tsc + tsc gates measure green on the new bytes, this lane.
    // PRIOR ROW — v0.99.26 re-pin (2026-11-10, the .26 consumer wave over this repo's .25-era pin): the
    // honest-field era carries — the annotated tag (object 74c120bc) peels to dc2e70fe and
    // its manifest reads 0.99.26 (off the codeload tarball AND the installed node; npm writes
    // lock version 0.99.26), so this row keeps walking the plain tag-derived version; no
    // manifestVersion override. The window 6e1ce2d8..dc2e70fe is seven ui commits: the w21L4
    // lane (CU-126 pinia peer ^3.0.0||^4.0.0 + LW-072 PageHint named at root barrel), CP-014
    // cookie custody (CookieTokenStore/credentialsPolicy/boot probe), the memo-keying pin
    // test wave, CP-016 401 single-flight refresh + credentials-consistent logout, the
    // CP-017 custody suites, and the w32L2 HOLD/ORDER + multi-tick rounds pins, closed by the
    // release ritual itself. THE CONTRACTS EDGE RIDES UNCHANGED: .26's manifest still requests
    // `#v0.5.7` outright (measured via git show at dc2e70fe, off the codeload tag payload
    // package.json AND independently off the installed node_modules/@phlix/ui/package.json) —
    // root keeps `#v0.5.7`, byte-equality holds, plain rule 1, the waiver map stays
    // present-but-empty — the SIXTEENTH straight equality-era move. The syncplay edge rides
    // ui's unchanged `#v0.1.7` request (0.1.7@1a80b1d1 untouched). The ONE new lock line at
    // this step is the ui node's `peerDependencies.pinia` widening `^3.0.0` → `^3.0.0 ||
    // ^4.0.0` (e2c45746's honest manifest field; the lock records manifest peers, root pinia
    // stays ^3.0.0/3.0.4 hoisted — the widened range only ADDS acceptance, resolution
    // unchanged). Locale posture: deliberate HOLD — ui src/i18n measured EMPTY across
    // 6e1ce2d8..dc2e70fe (0 files), catalog stays 542 both sides, PIN + SOURCE_REF stay
    // anchored at 6e1ce2d8 (eighth deliberate hold). Identity MEASURED this lane, codeload
    // tag payload == installed node byte-ident (diff -r over dist/, 889 files; tarball md5
    // 937a8512fe3d35236fb7ece8893828fd, 27,048,600 B): phlix-ui.js 7cea63d4..., player.js
    // a6428a08..., phlix-ui.umd.cjs e35db384..., player.umd.cjs 01bc6133...; PlayerPage
    // carriers rotated to PlayerPage-5onGq7ES.js 708772c4f3c6f6bc2ca4a314d5ce5357 /
    // PlayerPage-C5iwUiHp.cjs 8e181563bdaa74d6a30392cfdc9f2f02 (the .25-era pair
    // Bp-fkb06.js / BtnPW08u.cjs is gone). The electronBridge bundle-reality literals
    // ('let t = e.routerBase ?? "/app", n = [' and the `${t}/player/:id` route template)
    // SURVIVED the step byte-identically (measured via grep -o over the installed .26
    // phlix-ui.js — zero rotation owed, the assertion stayed green THROUGH the bump; the
    // stamp prose re-dated). usePlayerStore-BpohCwDP.js rode byte-ident too (chunk-hash
    // identity — the .25-era :213+/417 coordinates re-verified accurate on .26 bytes).
    // PRIOR ROW — v0.99.25 re-pin (2026-11-09, the .25 consumer wave over this repo's .22-era pin): the
    // honest-field era carries — the annotated tag (object 52ea3cb7) peels to 6e1ce2d8 and
    // its manifest reads 0.99.25 (off the tarball + the installed node; npm writes lock
    // version 0.99.25), so this row keeps walking the plain tag-derived version; no
    // manifestVersion override. The window a4ede939..6e1ce2d8 is fifteen ui commits: the
    // w11L9/w12L2/w13L1/w14L3/w15L2/w16L1 review-cure waves (focus custody + stacked-overlay
    // routing to the top layer only, the SyncPlay reconnect ladder PARKS instead of dying
    // with a store-visible reconnectExhausted, login guidance, anchor music navigation,
    // catalog-bound rails, dead wire DTOs deleted with stay-retired pins) plus the .23
    // release that landed RED-CI (11 syncplay inbound-decode reds — its release-ritual scope
    // crept the syncplay pin to #v0.1.8), the 1a9f5472 erratum restoring #v0.1.7, and the
    // .24/.25 green cuts. THE CONTRACTS EDGE ADVANCED WITH IT: .25's manifest requests
    // `#v0.5.7` outright (measured via git show at 6e1ce2d8, off the tarball package.json
    // AND independently off the installed node) — root moved to the same tag in that commit,
    // byte-equality holds, plain rule 1, the waiver map stays present-but-empty.
    // The locales tree MOVED (eighth genuine re-vendor — v0.99.5, v0.99.8, v0.99.12,
    // v0.99.14, v0.99.15, v0.99.19, v0.99.21, and that v0.99.25): six locale files shifted
    // (tree 4c264a97→d5e169d0, +16 keys each, zero removals — auth: passwordRecoveryHint,
    // confirmPasswordRequired, sessionExpired, noMediaTitle, noMediaHint; browse:
    // continueWatching, nextUp, recommended, mostWatched, noLibrariesTitle,
    // noLibrariesDescription, the playlist/season loadErrorTitle pair, loadErrorSchedulesTitle,
    // loadErrorTagsTitle, loadErrorStreamLimitsTitle), messages.ts 0a181db6→431bf59c,
    // catalog 526→542, the index.ts pair held; SOURCE_REF + PIN advanced to the 6e1ce2d8
    // peel in that
    // commit (pre-sync conviction: the installed-bundle law went red on exactly the 16 fresh
    // keys, measured). Identity MEASURED this lane, codeload tag payload == installed node
    // byte-ident (diff -r over dist/, 889 files): phlix-ui.js 0083016a..., player.js
    // 0dad2a06..., phlix-ui.umd.cjs cd7be5ef..., player.umd.cjs 50f11c11...; PlayerPage
    // carriers rotated to Bp-fkb06.js / BtnPW08u.cjs (the last pair named in this repo's
    // prose, .21-era BTz2s3yI.js 5b5ac827 / ja0Ix1W0.cjs 0dabd9de, is gone; the .22-era
    // carrier name was rotated by the owner's .22 wave and is not recorded here). The 889th
    // file over the .21-era 888 is pages/ambientBackdrop.d.ts, which arrived with the .22
    // pre-render cure — not new at this step. Windows compile surface: the repo consumes
    // @phlix/ui through its enumerated seam set (createPhlixApp/config, stores, TokenStore,
    // player command bus) — none of the cure waves' additive type-surface churn is imported
    // (the vue-tsc + tsc gates measure green on the new bytes, this lane).
    //
    // v0.99.22 re-pin (2026-11-06, player-fps wave): the honest-field era carries — the tag
    // manifest reads 0.99.22 at a4ede939 (npm writes lock version 0.99.22), so this row keeps
    // walking the plain tag-derived version; no manifestVersion override. The step over
    // v0.99.21 is player-internal only (poster backdrop + ambient glow pre-rendered to
    // bitmaps, hidden chrome drops backdrop-filter): the published package.json diff is
    // version-field-alone, the dist type surface gains only ambient.d.ts helpers +
    // pages/ambientBackdrop.d.ts, which windows references nowhere, and `src/i18n` is
    // UNCHANGED across 01acaa12..a4ede939 — a locale HOLD (SOURCE_REF + PIN stay at 01acaa12).
    // Identity: phlix-ui.js a3a8aa84 (installed node == ui release tree). The contracts
    // `#v0.5.6` and syncplay `#v0.1.7` edges are untouched.
    //
    // v0.99.21 re-pin (2026-11-06, theme-persist consumer wave): the honest-field era
    // OPENED at v0.99.7, when the `manifestVersion: '0.99.4'` skew override's own written
    // condition fired (field re-normalized to 0.99.7 at bc1d29bf, measured via git show).
    // v0.99.8 through this v0.99.21 tag CARRY it — reads 0.99.21 at 01acaa12 (measured via
    // git show; npm writes lock version 0.99.21) — so this row keeps walking the plain
    // tag-derived version; the override stays RETIRED. No manifestVersion override is
    // active anywhere now; the MECHANISM stays armed for a future stale-field tag. The step
    // is the theme server-persistence consumer wave over v0.99.20: ui's TW-theme-persist
    // work PUTs/GETs the selected theme through users/me/settings with silent hub-style
    // degradation (server call fails -> the theme still applies locally + the quiet
    // `settings.themeSavedLocally` hint; catalogue fetch fails -> built-ins only +
    // `settings.themeCatalogueUnavailable` disclosure + force-refresh affordance +
    // Plugins-page hint). The published package.json diff over v0.99.20 is again
    // version-field-alone, and the shipped TYPE surface moved ADDITIVELY inside dist/
    // (api/themeSettings.d.ts NEW; useTheme/errors/messages/locale .d.ts churn). Windows
    // references none of those symbols (grep-measured zero hits across src/ + tests/), so
    // this repo's compile surface is unmoved. Unlike the .20 HOLD, the locales tree and
    // `messages.ts` MOVED across e48d8d02..01acaa12 — six files +2 lines each, tree
    // 39245de0→4c264a97, messages.ts a49e432a→0a181db6, catalog 524→526 with zero
    // removals, index.ts pair held: a genuine re-vendor (seventh — v0.99.5, v0.99.8,
    // v0.99.12, v0.99.14, v0.99.15, v0.99.19, v0.99.21); SOURCE_REF + PIN advance to
    // 01acaa12 in this commit. Identity: phlix-ui.js 7e4c16b5..., player.js fcb3596c...,
    // umd 02e3caac..., carriers BTz2s3yI.js 5b5ac827... / ja0Ix1W0.cjs 0dabd9de... (the
    // .20 BUnWXFam.js/DFDk18x-.cjs pair rotated out); cross-tree recipe agg 0e3b071f...
    // over both the codeload payload and the installed node (888 files, diff -r
    // byte-ident). The syncplay edge rides ui's unchanged `#v0.1.7` request;
    // v0.1.7@1a80b1d1 is untouched by this wave.
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
// CARRIED ONCE MORE at the ui v0.99.17 re-pin (2026-11-06, playback-cure consumer wave): the contracts pin
// HELD at `#v0.5.6` and ui v0.99.17's manifest requests that same tag outright (measured via git show at
// b958fb57 AND independently off the installed node_modules/@phlix/ui/package.json; the lock's ui node
// records the same words) — the TENTH straight equality-era move: the map stays present-but-empty, both
// contracts edges walk plain rule 1 onto the one hoisted 0.5.6@c89c8420 copy (npm 11 `ci` observed a single
// hoisted node, zero nested dirs), and the syncplay edge rides ui's unchanged `#v0.1.7` request
// (0.1.7@1a80b1d1 untouched). Zero ratified hoists on all four edges; the walker measures green.
// CARRIED ONCE MORE at the ui v0.99.19 re-pin (2026-11-06, playback-cure program's final consumer wave):
// the contracts pin HELD at `#v0.5.6` and ui v0.99.19's manifest requests that same tag outright (measured
// via git show at a6c9d466 AND independently off the installed node_modules/@phlix/ui/package.json; the
// lock's ui node records the same words) — the ELEVENTH straight equality-era move: the map stays
// present-but-empty, both contracts edges walk plain rule 1 onto the one hoisted 0.5.6@c89c8420 copy
// (npm 11 `ci` observed a single hoisted node, zero nested dirs), and the syncplay edge rides ui's
// unchanged `#v0.1.7` request (0.1.7@1a80b1d1 untouched). Zero ratified hoists on all four edges; the
// walker measures green.
// CARRIED ONCE MORE at the ui v0.99.20 re-pin (2026-11-06, playback program's URL-contract consumer wave):
// the contracts pin HELD at `#v0.5.6` and ui v0.99.20's manifest requests that same tag outright (measured
// via git show at e48d8d02 AND independently off the installed node_modules/@phlix/ui/package.json; the
// lock's ui node records the same words) — the TWELFTH straight equality-era move: the map stays
// present-but-empty, both contracts edges walk plain rule 1 onto the one hoisted 0.5.6@c89c8420 copy
// (npm 11 `ci` observed a single hoisted node, zero nested dirs), and the syncplay edge rides ui's
// unchanged `#v0.1.7` request (0.1.7@1a80b1d1 untouched). Zero ratified hoists on all four edges; the
// walker measures green.
// CARRIED ONCE MORE at the ui v0.99.21 re-pin (2026-11-06, theme-persist consumer wave):
// the contracts pin HELD at `#v0.5.6` and ui v0.99.21's manifest requests that same tag outright (measured
// via git show at 01acaa12 AND independently off the installed node_modules/@phlix/ui/package.json; the
// lock's ui node records the same words) — the THIRTEENTH straight equality-era move: the map stays
// present-but-empty, both contracts edges walk plain rule 1 onto the one hoisted 0.5.6@c89c8420 copy
// (npm 11 `ci` observed a single hoisted node, zero nested dirs), and the syncplay edge rides ui's
// unchanged `#v0.1.7` request (0.1.7@1a80b1d1 untouched). Zero ratified hoists on all four edges; the
// walker measures green. CARRIED again at the contracts v0.5.7 + ui v0.99.25 wave (2026-11-09): ui
// v0.99.25's manifest requests `#v0.5.7` outright (measured via git show at 6e1ce2d8 AND off the
// installed node) and root advanced to the same tag in the same commit — byte-equality holds on BOTH
// contracts edges, nothing to retire, the map stays present-but-empty, both edges walk plain rule 1
// onto the one hoisted 0.5.7@bedfe69b copy (npm 11 `ci`: single hoisted node, zero nested dirs,
// lock-node identities cross-checked against a fresh-resolve oracle — MATCH on all three @phlix
// nodes), and the syncplay edge rides ui's unchanged `#v0.1.7` request. Zero ratified hoists on all
// four edges; the walker measures green. CARRIED again at the ui v0.99.26 re-pin (2026-11-10): ui
// v0.99.26's manifest STILL requests `#v0.5.7` outright (measured via git show at dc2e70fe AND off
// the installed node) — root's contracts pin UNMOVED, the SIXTEENTH straight equality-era move,
// both edges ride plain rule 1 onto the one hoisted 0.5.7@bedfe69b copy, and the syncplay edge
// rides ui's unchanged `#v0.1.7` request. Zero ratified hoists on all four edges; the walker
// measures green. CARRIED again at the ui v0.99.27 re-pin (2026-11-11): ui v0.99.27's manifest
// STILL requests `#v0.5.7` outright (measured via git show at 1f906979 AND off the installed node) —
// root's contracts pin UNMOVED, the SEVENTEENTH straight equality-era move, both edges ride plain
// rule 1 onto the one hoisted 0.5.7@bedfe69b copy, and the syncplay edge rides ui's unchanged
// `#v0.1.7` request. Zero ratified hoists on all four edges; the walker measures green.
// RE-ADDED at the contracts v0.5.8 re-pin (2026-11-13, CTR-S14 cascade): the direct pin advanced to
// `#v0.5.8` while the INSTALLED ui v0.99.28 still requests `#v0.5.7` (measured via git show at
// dfe8fc65 AND off the installed node_modules/@phlix/ui/package.json). Fresh exact-match entry under
// the same law — version AND sha of the hoisted 0.5.8@e5a33809 copy; npm 11.19.1 observed dedupe (no
// nested node in the lock, no nested dir on disk). It dies when a ui tag requests `#v0.5.8`-or-newer
// outright.
export const RATIFIED_HOISTS = {
  'node_modules/@phlix/ui>@phlix/contracts@v0.5.7': {
    version: '0.5.8',
    sha: 'e5a33809e9659ab40325aae4e92411b464ddbcd7',
  },
};

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
    // WIN-S12: the renderer-only @phlix/* packages ride the root's devDependencies
    // (the vite bundle inlines them), so the root edge set is dependencies + devDependencies.
    const requests = key === '' ? { ...node.dependencies, ...node.devDependencies } : node.dependencies ?? {};
    for (const [dep, spec] of Object.entries(requests)) {
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
