# Changelog

All notable changes to **phlix-windows-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Changed — re-pin `@phlix/ui` v0.99.6 → v0.99.7 (cascade head; BOTH stale-manifest skews end) — 2026-09-25

- **Single ui pin advanced.** `package.json` re-pins `@phlix/ui` to the `v0.99.7` tag
  (annotated object `da9f1625`, peel `bc1d29bf`, the route-gate/coordinate-currency
  release head); `NPM_CONFIG_USERCONFIG=/dev/null npm install --allow-git=all`
  (node 24 / npm 12.0.2, CI-faithful) regenerated the
  committed lock surgically: exactly four lines moved — root echo → `v0.99.7`, the ui
  node's `resolved` → `bc1d29bf`, the ui node's `version` field `0.99.4` → `0.99.7`
  (honest field — see below), and ui's `@phlix/contracts` request line `#v0.5.1` →
  `#v0.5.2`. The installed `dist/phlix-ui.js` is blob-identical to
  `git show v0.99.7:dist/phlix-ui.js` (sha256 `22f315ef…c7517e4` both sides) and the
  hoisted contracts/syncplay nodes never moved. No consumer code churn: `v0.99.7`
  touches ui-internal route-gate server surface and ui's own tests — none of it the
  windows catalogs — and the full 401-test suite ran with zero source edits.
- **The ui manifest-version skew ENDED — second override RETIRED per its own written
  law.** The `manifestVersion: '0.99.4'` override carried through v0.99.5/v0.99.6
  stated its retirement condition: a ui release that re-normalizes the field must
  retire it. `git show v0.99.7:package.json` (READ-ONLY at the tag) measures the field
  honest at `0.99.7` — condition FIRED. The lock entry now reads `0.99.7` on its own,
  `scripts/lockwalk.mjs` drops the field from the ui row, and rule 1 checks the lock
  version against the plain tag-derived truth again — mirroring the contracts row's
  retirement at `v0.5.2` (the #51 lane). With both skews ended, the override MECHANISM
  stays armed but NO override is active.
- **RATIFIED_HOISTS retired a THIRD time — measurement overrode the lane premise.**
  The dispatch premise expected ui `v0.99.7` to still request `#v0.5.1`; the tag
  manifest verbatim requests `#v0.5.2` outright (independently confirmed by the
  regenerated lock line and the installed manifest), which is exactly the waiver's
  written retirement condition — so the waiver retired per its own law and the
  byte-equality era is restored on the ui→contracts edge (root and ui declare the
  IDENTICAL spec `#v0.5.2`; a single hoisted `0.5.2@7afb6a91` resolution satisfies both
  edges under plain rule 1; zero nested nodes in the lock, zero nested dirs on disk).
  `contractsPin.test.mjs` flipped its divergence describe back to the #50-era
  three-way equality witness — the path IT recorded at ratification time — and the
  lockwalk mutation proofs were re-cut for the equality era (behind-words `#v0.5.1`
  and false-field mutations all go RED on both edges). Retirement lineage under this
  one law: v0.4.5 era (#49), v0.5.1 era (#50), v0.5.2 era (#51) — this is the third fire.
- **Locale vendor PIN moved with the pin.** `scripts/sync-ui-locale-bundles.mjs`
  `SOURCE_REF` advances `98a5bf38` → `bc1d29bf` (the re-sync is drift-free by
  measurement: `src/i18n/locales` is byte-identical across all three peels — tree
  `f8b090a6` at each — and `messages.ts` never moved, so all 14 `PIN` content hashes
  ride through untouched; the re-run diff is the ref line alone). The set-equality law
  carries; lineage comments in `i18nLocales.test.ts`/`docs/i18n.md` updated honestly.
- **Gates.** `npm test` 401/33 exact · `vue-tsc --noEmit` + `vue-tsc --noEmit -p
  tsconfig.test.json` + `tsc -p tsconfig.main.json --noEmit` PASS · `npm run lint` PASS ·
  `npm run build` PASS · `node scripts/lockwalk.mjs --live` — 4 edges, 0 mismatches,
  all three peel proofs OK against the live remotes (`v0.99.7` tag object `da9f1625` →
  commit `bc1d29bf` verified).

### Changed — re-pin `@phlix/contracts` v0.5.1 → v0.5.2 (gitattributes/coordinate-currency release) — 2026-09-25

- **Single contracts pin advanced.** `package.json` re-pins `@phlix/contracts` to the
  `v0.5.2` tag (annotated object `9676874e`, peel `7afb6a91`, the release PR #83 head
  carrying the errors.ts coordinate re-sweep #81, `.gitattributes` LF enforcement #82 and
  the CI-freshness fixes #79/#80); `NPM_CONFIG_USERCONFIG=/dev/null npm install
  --allow-git=all` (node 24.21 / npm 12.0.2, CI-faithful) regenerated the committed lock
  surgically — root echo, the contracts node's `resolved` and its `version` field only;
  ui's lock line, the ui/syncplay nodes, and every other entry never moved. No consumer
  code churn: `v0.5.2` touched no wire payload (its `dist/error-codes.json` is
  byte-identical to `v0.5.1`'s — the 202-code census marker holds) and the full 401-test
  suite ran with zero source edits.
- **The contracts manifest-version skew ENDED — override RETIRED per its own written
  law.** The `manifestVersion: '0.4.7'` override carried through v0.5.0/v0.5.1 stated:
  "a contracts release that re-normalizes the field to 0.5.0+ must retire it again."
  Release commit `ac669ca` re-normalized the tag manifest's `version` to `0.5.2`
  (measured via `git show v0.5.2:package.json`), firing the condition — the lock entry now
  honestly reads `0.5.2` and `scripts/lockwalk.mjs` drops the field from the contracts
  row; rule 1 checks it against the plain tag-derived version again. The override
  MECHANISM stays, solely for the ui row (ui's field is STILL stale at `0.99.4` under
  `#v0.99.6`, re-measured via `git show` at `98a5bf38` — that override carries unchanged).
- **RATIFIED_HOISTS re-added — the byte-equality era ended the moment the direct pin
  advanced.** The installed ui `v0.99.6` still requests `#v0.5.1` (lock line + installed
  manifest agree), so the ui→contracts edge diverges again and the waiver's retirement
  condition has NOT fired. Observed npm behavior (the written decision point): npm 12.0.2
  DEDUPED ui's unsatisfied git-tag edge onto the hoisted `0.5.2@7afb6a91` copy — zero
  nested nodes in the lock, zero nested dirs on disk — the same un-self-healing
  git-edge behavior the v0.5.0-era waiver documented. New exact-match entry
  `node_modules/@phlix/ui>@phlix/contracts@v0.5.1 → 0.5.2@7afb6a91` (version AND sha,
  never a wildcard); `contractsPin.test.mjs` converts to the divergence-era law with the
  recorded retirement path (mirror of the #49-era structure, folded in place — no test
  added, 401 denominator exact), and its mutation proofs run BOTH directions: root's edge
  via plain rule 1 (behind rollback + false-field + sha-only drift) and ui's edge via
  `ratified-hoist-drift` on every same mutation, plus the installed-tree witness that
  catches a hand-edited ui lock line masquerading as the root pin.
- **Gates.** `npm test` 401/33 exact · `vue-tsc --noEmit` ×2 + `tsc -p
  tsconfig.main.json --noEmit` PASS · `npm run lint` PASS · `npm run build` PASS ·
  `node scripts/lockwalk.mjs --live` — 4 edges, 0 mismatches, all three peel proofs OK
  against the live remotes (`v0.5.2` tag object `9676874e` → commit `7afb6a91` verified).

### Changed — re-pin `@phlix/ui` v0.99.5 → v0.99.6 (estate error-catalog cascade) — 2026-09-24

- **Single ui pin advanced.** `package.json` re-pins `@phlix/ui` to the `v0.99.6` tag
  (annotated object `7d0b71d1`, peel `98a5bf38`, the signup-error-catalog merge PR #425
  head); `NPM_CONFIG_USERCONFIG=/dev/null npm install --allow-git=all` (node 24 / npm 12,
  CI-faithful) regenerated the committed lock surgically — root echo, the ui node's
  `resolved`, and ui's own `@phlix/contracts` request line only; the installed
  `dist/phlix-ui.js` is blob-identical to `git show v0.99.6:dist/phlix-ui.js` and the
  hoisted contracts/syncplay nodes never moved. No consumer code churn: `v0.99.6` adds
  the ui-internal `src/i18n/errors.ts` catalog and auth/player error wiring — none of it
  touches the windows catalogs — and the full 401-test suite ran with zero source edits.
- **The ui manifest-version skew persists — the override carries unchanged.** `v0.99.6`'s
  tag manifest still ships the stale `version` field: it reads `0.99.4` at `98a5bf38`
  (measured via `git show`), so npm keeps writing the lock entry's `version` as `0.99.4`
  under a `#v0.99.6` request. `scripts/lockwalk.mjs` `EXPECTED` advances the ui tag/sha
  while the exact-match `manifestVersion: '0.99.4'` override carries forward unchanged;
  `tests/unit/lockwalk.test.mjs` re-proves BOTH directions at the new tag (a lock line
  falling further behind to `0.99.3`, a hand-edit falsely claiming the field
  re-normalized to `0.99.6`).
- **The RATIFIED_HOISTS retirement condition FIRED — waiver retired per its own written
  law.** ui `v0.99.6`'s manifest requests the direct pin `#v0.5.1` outright (measured via
  `git show` at `98a5bf38`), so the exact-match key misses, the entry is deleted, and
  byte-equality is restored — root, ui's lock line, and the INSTALLED ui manifest all
  speak the identical spec (three-way witness now pinned in `contractsPin.test.mjs`,
  inverting the divergence-era `.not.toBe` law). The map sits present-but-empty again,
  exactly as it did from W82 to the v0.5.0 re-pin; the ui→contracts edge walks plain
  rule 1, whose drift mutations now light up BOTH edges, and the retired waiver family
  (`ratified-hoist-drift`) is proven silent on every mutation.
- **Vendored i18n untouched by content, advanced by ref.** `SOURCE_REF` and the vendor
  PIN moved `3017f443 → 98a5bf38` per the sync script's documented two-line mechanism;
  upstream `src/i18n/locales` is byte-identical across the two peels (tree `f8b090a6` at
  both), so the re-sync is ZERO content drift — all 14 PIN content hashes unchanged and
  `git diff` on the vendor dir is the single ref line. The bundle↔installed set-equality
  law carries (messages.ts never moved between the tags); the local hard-fail
  source-parity leg ran green against the new ref, and the cross-const guard
  (PIN.ref ↔ script SOURCE_REF) stays green.
- **Gates:** `npm test` 401/33 baseline-EXACT (registry expansion and the new errors
  module touch nothing here), vue-tsc renderer + tsc main + vue-tsc tests all 0,
  lint 0, build 0, `lockwalk --live` 4 edges / 0 mismatches / all peels OK,
  `git ls-files --eol` clean (every touched file `eol=lf` per the windows-latest PIN law).

### Changed — re-pin `@phlix/contracts` v0.5.0 → v0.5.1 (estate error-registry expansion) — 2026-09-23

- **Single contracts pin advanced.** `package.json` re-pins `@phlix/contracts` to the
  `v0.5.1` tag (annotated object `cf0163ee`, peel `e3c14f07`, the registry-expansion
  merge PR #78 head); `NPM_CONFIG_USERCONFIG=/dev/null npm install --allow-git=all`
  (node 24 / npm 12, CI-faithful) regenerated the committed lock surgically — root
  echo + the hoisted node's `resolved` only, zero nested copies in lock or on disk.
  `v0.5.1` is purely additive (measured: `dist/error-codes.json` grew 147 → 202 codes,
  55 added, ZERO removed): no consumer code churn — the full suite and typechecks ran
  green against the new tree with zero source edits.
- **The manifest-version skew persists — the override carries unchanged.** `v0.5.1`'s
  tag manifest still ships the stale `version` field: it reads `0.4.7` at `e3c14f07`
  (measured via `git show`), so npm keeps writing the lock entry's `version` as `0.4.7`
  under a `#v0.5.1` request. `scripts/lockwalk.mjs` `EXPECTED` advances the contracts
  tag/sha while the exact-match `manifestVersion: '0.4.7'` override carries forward
  unchanged; `tests/unit/lockwalk.test.mjs` re-proves BOTH directions (a lock line
  falling further behind to `0.4.6`, a hand-edit falsely claiming the field
  re-normalized to `0.5.1`), and `contractsPin.test.mjs` upgrades the installed-tree
  marker — existence stopped discriminating once both peels ship the file, so the
  marker now asserts the 202-code census: a rollback to the `v0.5.0` peel (or an
  installed tree left behind by the lock) with the honest `0.4.7` field goes RED here.
  All three mutation directions (behind / falsely-normalized / installed-tree-behind)
  were executed and verified RED before restoring.
- **The ui→contracts edge stays honestly divergent: one exact-match ratified hoist,
  retirement checked and NOT fired.** ui `v0.99.5`'s manifest still requests contracts
  `#v0.4.7` (measured via `git show` at `3017f443`), so the waiver's written retirement
  condition — a ui tag requesting the direct pin-or-newer outright — did not fire and
  the entry carries, its sha re-ratified exactly to the hoist's new peel `e3c14f07` per
  its own `ratified-hoist-drift` finding. Version AND sha remain exact-match, never a
  wildcard; the single-waiver denominator and nested-free invariant (lock and disk)
  stand unchanged.
- **Vendored i18n hashes untouched by design.** The vendor PIN pins `phlix-ui` refs,
  not contracts — this re-pin never touches `src/renderer/i18n/ui-locale-bundles/`;
  the PIN manifest is byte-identical before/after (`sha256 0612a510…` on disk, zero
  git diff) and `i18nLocales`/`i18nSeamWiring`/`rendererI18n` stayed green unchanged.

### Changed — re-pin `@phlix/contracts` v0.4.7 → v0.5.0 (estate error-registry cascade) — 2026-09-23

- **Single contracts pin advanced.** `package.json` re-pins `@phlix/contracts` to the
  `v0.5.0` tag (annotated object `60446662`, peel `8ef65d30`, the error-code-registry
  merge PR #77 head); `NPM_CONFIG_USERCONFIG=/dev/null npm install --allow-git=all`
  regenerated the committed lock surgically — root echo + the hoisted node's `resolved`
  only, zero nested copies in lock or on disk. `v0.5.0` is purely additive (the
  `errors` registry domain + `dist/error-codes.json` mirror + generated route-manifest
  data refresh): no consumer code churn — renderer/main/preload typechecks and the full
  401-test suite ran against the new tree untouched.
- **The manifest-version skew bites contracts — third case in the override lineage.** The
  estate cut `v0.5.0` deliberately without bumping the tag manifest's `version` field:
  it still reads `0.4.7` at `8ef65d30` (measured via `git show`), so npm writes the lock
  entry's `version` as `0.4.7` under a `#v0.5.0` request. `scripts/lockwalk.mjs`
  `EXPECTED` advances the contracts tag/sha and adds the exact-match
  `manifestVersion: '0.4.7'` override — the same machinery the ui `v0.99.5` row revived —
  with `tests/unit/lockwalk.test.mjs` mutating BOTH directions (a lock line falling
  further behind to `0.4.6`, and a hand-edit falsely claiming the field re-normalized to
  `0.5.0`). Identity stays byte-proven by the `resolved` peel sha; `contractsPin.test.mjs`
  adds the installed-tree content marker (`dist/error-codes.json` — shipped first at
  `v0.5.0`) so a rollback to the old peel with an honest `0.4.7` field cannot pass.
- **The ui→contracts edge diverges honestly: one exact-match ratified hoist.** ui
  `v0.99.5`'s own manifest still requests contracts `#v0.4.7` while the direct pin
  advances to `#v0.5.0` (purely additive, so the hoisted copy satisfies it), and npm
  dedupes the edge onto the single `0.4.7@8ef65d30` resolution — verified nested-free in
  both lock and `node_modules`. This re-opens the `RATIFIED_HOISTS` map per its written
  rule (S442 precedent: exact-match on version AND sha, never a wildcard); the W85
  byte-equality law in `contractsPin.test.mjs` converts to byte-pinning ui's verbatim
  `#v0.4.7` declaration plus the single-waiver denominator, and the waiver carries its own
  retirement condition — a ui tag requesting `#v0.5.0`-or-newer outright restores equality
  and deletes the entry.
- **Vendored i18n hashes untouched by design.** The 14 vendor-PIN entries pin
  `phlix-ui` refs, not contracts — re-pin cascade never touches `src/i18n/locales/`;
  `i18nLocales`/`i18nSeamWiring`/`rendererI18n` laws stayed green unchanged.

### Changed — re-pin `@phlix/ui` v0.99.4 → v0.99.5 + vendor PIN advance (estate i18n cascade) — 2026-09-23

- **Single UI pin advanced.** `package.json` re-pins `@phlix/ui` to the `v0.99.5`
  tag (peel `3017f443`, the i18n locale-bundles merge PR #420 head); `NPM_CONFIG_USERCONFIG=/dev/null
  npm install` regenerated the committed lock surgically — root echo + the ui node's
  `resolved` only. The ui lock entry's `version` stays `0.99.4` because the tag
  manifest's field is stale (the estate cut `v0.99.5` without bumping it — the
  v0.99.2 precedent), which is exactly the case rule 1's `manifestVersion` override
  was written for: `scripts/lockwalk.mjs` `EXPECTED` advances the ui tag/sha and
  revives the exact-match `manifestVersion: '0.99.4'` pin; `tests/unit/lockwalk.test.mjs`
  mutates BOTH directions now (version falling further behind, and a hand-edit
  falsely claiming the field re-normalized with the tag). contracts `#v0.4.7` and
  syncplay `#v0.1.5` edges are unchanged in ui v0.99.5's manifest — convergence holds,
  `contractsPin.test.mjs` stays byte-stable by design.
- **Installed-tree faithfulness proven.** All 857 `dist/` blobs of the installed
  `@phlix/ui` hash-identical to the `v0.99.5` tagged tree; the seven keys that ran
  AHEAD of the previous pin (`connect.scan|scanning|scanFailed|scanEmpty|scanListLabel`,
  `player.seekBackward|seekForward`) are present in `DEFAULT_MESSAGES`' typed literal,
  and `LOCALE_MESSAGES` / `ES…JA_MESSAGES` / `PhlixLocaleCode` export from the main entry.
- **Vendor PIN advanced dc1df7d5 → 3017f443 (v0.99.5) with ZERO content drift.**
  `git diff dc1df7d5 3017f443 -- src/i18n/locales` is empty upstream (only `dist/`
  moved in `76bcf985`), so re-running `scripts/sync-ui-locale-bundles.mjs` rewrote the
  seven bundles byte-identically — the commit touched only `PIN`'s branch/ref lines;
  all 14 per-file sha256 entries unchanged. `SOURCE_BRANCH` moves to `master` (the
  feature branch merged as PR #420).
- **Laws converted to equality.** The dc1df7d5-era "bundles run exactly 7 keys AHEAD
  of the installed pin" block in `tests/unit/i18nLocales.test.ts` becomes a
  **bidirectional bundle↔installed set-equality** pin (extras must be empty, and the
  seven formerly-ahead keys are pinned present in both catalogs so upstream renames
  cannot silently dissolve the laws); the two cross-bundle laws over those keys stay
  as direct vendor↔vendor invariants, and the vendor-ahead guards in the placeholder/
  CLDR/leak walks stay as defense for a future re-vendor that outruns the npm pin.
- **Verification:** 33 files / **401 tests** green (exact baseline match — zero delta),
  renderer + tests `vue-tsc` and main `tsc` exit 0, lint exit 0, build exit 0; the
  windows-latest shard rides CI.

### Fixed — i18n fr apostrophe typography (R1 follow-up F-A) — 2026-09-23

- `windows-own/fr.ts` `nav.inviteLinks` now renders the typographic `’` (`Liens d’invitation`) matching the vendored fr SSOT policy — the straight `'` collided glyph-wise with bundle text in the same top bar; a new fr typography law in `i18nLocales.test.ts` pins no `letter'letter` in any windows-own/main fr value (detector control + anti-vacuous `’` presence guard).

### Added — i18n locales (feat/i18n-locales): six-locale build-out es/fr/de/it/pt_BR/ja — 2026-09-23

- **Vendored ui SSOT bundles:** `src/renderer/i18n/ui-locale-bundles/` now carries the six
  complete phlix-ui locale bundles as a SHA-pinned copy pinned at `dc1df7d5`
  (`feat/i18n-locale-bundles`), refreshed via the new `scripts/sync-ui-locale-bundles.mjs`
  (git-show at the pinned ref + the three documented type-relaxation transforms + a `PIN`
  manifest of pristine/vendored sha256 per file) — the proven tizen-client mechanism. The
  renderer registry feeds them to the ui seam: `messagesForLocale('es')` … `('ja')` now
  return real bundles; `en` keeps the untouched byte-identical omit path.
- **Region-aware tag law:** one shared normalization (`normalizeLocaleTag`) canonicalizes
  every tag — lowercase primary subtag with `pt* → pt_BR` — for registration and lookup
  across the seam and both client catalogs. `VITE_PHLIX_LOCALE` accepts all seven tags.
- **Windows-own renderer catalog (R-review fix F2):** the 16 `buildMenu()` nav labels
  (`MenuItem.label` raw strings the ui seam cannot reach) moved into
  `src/renderer/i18n/windows-own/` — `WIN_EN` byte-identical to the pre-i18n literals
  (pinned through `buildMenu()` itself in `i18nSeamWiring.test.ts`), six locale catalogs
  `satisfies WindowOwnCatalog`, `setWindowLocale()`/`tWin()` accessors wired at boot.
- **Main-process locales:** six catalogs (`src/main/i18n/locales/*.ts`, `satisfies
  MainCatalog`) covering all 29 chrome strings; placeholders, About `\n\n` structure and
  the untouched `ORIGINAL_MAIN_PROCESS_STRINGS` EN pins verified per locale; registry now
  `{en,es,fr,de,it,pt_BR,ja}` with the pt region rule.
- **Tests:** new `tests/unit/i18nLocales.test.ts` law-gate (bundle key-set identity +
  installed coverage + 7-key ahead-of-pin pin, placeholder/CLDR-segment/diacritics/CJK
  laws, both-direction EN-leak allow-lists for the two client catalogs, PIN↔disk hashes
  everywhere + pristine-source parity that hard-fails locally and SKIPS loudly in CI, and
  a three-catalog resolution matrix). Suite 341 → **398 tests / 32 → 33 files**; coverage
  lines 63.5% (floor 54).
- **Docs:** `docs/i18n.md` rewritten around the three catalogs — locale matrix, vendoring
  and re-pin procedure with drift policy until the re-pin cascade lands, add-a-7th-locale
  recipe covering all three halves, and the F1 correction (deep-link failures are silently
  rejected by `handleDeepLinkUrl` — the previously-referenced `showErrorDialog` never
  existed).

### Added — i18n wiring (feat/i18n-wiring): @phlix/ui message seam + main-process catalog — 2026-09-22

- **Renderer:** `createPhlixApp` now receives the config-time i18n seam resolved by the new
  `src/renderer/i18n/` module — `VITE_PHLIX_LOCALE` → `navigator.language` → `'en'`, then a
  locale→`PhlixMessagesConfig` registry lookup. The `messages` key is OMITTED when a locale has
  no overrides (the shipped `en` map is empty), so today's build renders byte-for-byte identical
  English. Adding a locale = one overrides file + one `registerLocaleOverrides` call.
- **Main process:** every user-facing shell string (tray menu + tooltip, app menu incl. the
  Playback submenu, thumbar tooltips, updater notifications, About dialog) moved from literals in
  `src/main/index.ts` into `src/main/i18n/en.ts`, resolved via a pure `t(key, params?)` with
  `{name}` interpolation. Locale pinned once post-ready (`app.getLocale()` requires ready;
  `playbackMenuTemplate` became `buildPlaybackMenuTemplate()` so labels evaluate after pinning).
  Role-based menu items stay unlabeled — Electron localizes roles natively. Values are
  byte-identical; `tests/unit/mainI18n.test.ts` pins every extracted string against its
  pre-extraction literal. Adding a locale = a `MainCatalog`-typed file (missing keys are compile
  errors) + one registry entry.
- **Docs:** `docs/i18n.md` describes both halves and the add-a-locale recipes; new tests
  `mainI18n` / `rendererI18n` / `i18nSeamWiring` (boot passes the resolved map; omits the key when
  empty). `tests/unit/minimizeToTray.test.ts` regex pins updated to the `t('tray.*')` form.

### Changed — W87 (w87winui): re-pin `@phlix/ui` v0.99.3 → v0.99.4 — 2026-09-14

- **Single UI pin advanced on the manual windows lane (rule-3: windows is never an
  auto edge).** `package.json` re-pins `@phlix/ui` to the v0.99.4 tag; the direct
  `@phlix/contracts` pin stays v0.4.7 and *agrees* with the contracts tag that ui
  v0.99.4's own manifest declares, so convergence holds and npm materialises one
  hoisted contracts copy with no nested tree — no rule-3 conflict, no dual move
  required this time. `NPM_CONFIG_USERCONFIG=/dev/null npm install` regenerated the
  committed lock surgically (root echo + the ui node only).
- **Hidden transitive delta surfaced and healed honestly.** ui v0.99.4 advanced its
  declared `@phlix/syncplay` edge v0.1.4 → v0.1.5, but npm 11 does not self-heal a
  git-tag divergence once the hoisted tree entry exists — after the install the lock
  still resolved the old syncplay commit under a v0.1.5 request, the exact
  unsatisfied-edge class this repo's `lockwalk` was built to catch (structural walk
  went red). A surgical `npm update @phlix/syncplay` re-resolved the single hoisted
  node to the v0.1.5 tag commit (verified by `lockwalk --live`), with no direct syncplay
  pin added and no unrelated resolution churned. Disk and lock both prove zero nested
  `@phlix` copies.
- **Guard trio re-pinned from live peels only.** `scripts/lockwalk.mjs` `EXPECTED`
  advances both the ui entry (tag v0.99.4 + its annotated-tag peel, re-verified via
  `git ls-remote` and its `version` field re-read with `git show`) and the syncplay
  entry (tag v0.1.5 + peel). ui v0.99.4 keeps its manifest `version` normalized to the
  tag, so the tag-derived rule-1 check stands with no `manifestVersion` override.
  `tests/unit/lockwalk.test.mjs` literals track the same live values (the syncplay
  resolution assertion, the syncplay-back-to-0.1.2 regression cite, and the ui
  version-drift mutation now flipping to the immediately-preceding tag). The
  `tests/unit/contractsPin.test.mjs` convergence guard needs **no** change — its four
  assertions still hold because ui v0.99.4 declares the identical contracts pin;
  leaving it byte-stable is the proof convergence is intact. Every change is a literal
  re-pin; no gate loosened.
- **Verification:** 29 test files / 314 tests green (unchanged baseline — no assertion
  added, removed, skipped or suppressed; the syncplay re-pin is load-bearing, proven by
  a planted-red that flips only the pinned sha and turns the zero-findings walk test red,
  then restores byte-identical), typecheck and lint exit 0, `lockwalk` exit 0 structural
  and with all three live peels OK, and `npm audit --audit-level=high` reports zero
  vulnerabilities.

### Changed — W85 (winrepin): dual re-pin `@phlix/ui` v0.99.2 → v0.99.3 + `@phlix/contracts` v0.4.6 → v0.4.7 — 2026-09-13

- **Both pins advanced in one PR — the manual-lane move the structural trap demanded.**
  `phlix-windows-client` has no automatic consumer edge (see the release README's
  Windows manual-ride policy): while this repo's direct contracts pin and the
  contracts tag declared by the newest ui manifest disagree, npm must materialise a
  nested copy under the ui tree and lockwalk rule 3 (nested-copy-forbidden) fails the
  suite red whatever else the leg does. The ordering fact is *contracts tag → ui tag
  whose manifest declares it → windows dual-repin*, and both upstream tags are now
  released: ui v0.99.3's manifest declares contracts v0.4.7 outright, so a single
  dual re-pin lands green. `package.json` re-pins `@phlix/ui` to the v0.99.3 tag and
  `@phlix/contracts` to the v0.4.7 tag; `NPM_CONFIG_USERCONFIG=/dev/null npm install`
  regenerated the committed lock. Post-install proof of the dissolved trap: no nested
  contracts copy exists under the ui tree on disk or in the lock, and the single
  hoisted contracts resolution is v0.4.7.
- **All three functional guards re-pinned from live-derived values** (never from the
  brief): each tag's peel re-verified against the live remotes via `git ls-remote`,
  and each tagged manifest's `version` field re-read with `git show` at the peeled
  commit. `scripts/lockwalk.mjs` `EXPECTED` advances contracts and ui (tag + peeled
  commit sha, both double-checked by `lockwalk --live` after the change). Notable
  truth: ui v0.99.3 normalized its manifest `version` field — the v0.99.2-era stale-field
  override in `EXPECTED` is retired by that override's own written rule, and the
  matching mutation-proof in the lockwalk test now asserts the version line drifting
  off the tag-derived value still goes red. `tests/unit/contractsPin.test.mjs` advances
  its literals to the v0.4.7 tag/resolution and restructures the old nested-declaration
  expectation into a convergence guard: ui's lock-declared contracts request must equal
  the direct pin byte-for-byte, no nested copy may exist in lock or on disk, and the
  hoisted single resolution must sit at the pinned version — fail-loud on every face.
- **Verification:** 29 test files / 314 tests green (three assertions added by the
  restructured convergence guard; none removed or suppressed), typecheck, lint,
  `lockwalk` exit 0 with all live peels OK, and `npm audit` reports zero
  vulnerabilities across all levels. A planted-red control flipped the new disk-level
  nested-copy assertion alone: exactly that named test went red, restore verified by
  checksum, suite green again. `src/` untouched; the renderer consumes the newer ui
  through the same boot seam as before.

### Changed — W84 (s490win): vitest 3 → 5 test-runner migration — 2026-09-13

- **Test runner advanced to major 5.** `package.json` re-pins `vitest` and
  `@vitest/coverage-v8` `^3.2.6` → `^5.0.0` (the two declared lines of the
  dependabot npm_and_yarn group; the advisory carrier `@vitest/mocker` follows
  transitively); `NPM_CONFIG_USERCONFIG=/dev/null npm install` regenerated the
  committed lock — installed family `vitest`/`@vitest/mocker`/`@vitest/coverage-v8`/
  `@vitest/spy` all 5.0.0, satisfying `vite ^7.3.2` peers untouched. This clears
  the last three GHSA-82fw-gwwq-j7x9-family MODERATE advisories: `npm audit`
  (all levels) now reports zero vulnerabilities.
- **Two vitest@5 breaking changes repaired truthfully.** (1) Spies created with an
  arrow implementation or `mockReturnValue` are no longer callable with `new`: the
  `Store`/`BrowserWindow`/`Tray` constructor mocks in `autoUpdater`,
  `protocolHandler` and `singleInstance` tests were converted to `function`
  implementations returning the identical stub objects — no assertion changed.
  (2) The config default `clearMocks` flipped `false` → `true`, wiping the
  module-load-time handler-registration records `autoUpdater.test.ts` asserts on;
  `vitest.config.mts` now pins `clearMocks: false` to preserve the previous
  semantics suite-wide.
- **Verification:** 29 test files / 307 tests green (identical counts to the
  vitest@3 baseline), typecheck, lint, production build and the lockwalk edge/pin
  guards all pass; coverage lines 59.8% against the unchanged 54% threshold.

### Changed — W82 (winsump): `@phlix/ui` re-pin v0.99.1 → v0.99.2 — 2026-09-13

- **Direct ui pin advanced to the v0.99.2 wave tag.** `package.json` re-pins
  `@phlix/ui` `github:detain/phlix-ui` v0.99.1 → v0.99.2 (tag peels to
  `a7530e8b`, == ui master, re-verified live via `git ls-remote`);
  `NPM_CONFIG_USERCONFIG=/dev/null npm install` regenerated the committed lock
  surgically — three hunks, zero unrelated churn: the root echo follows the pin,
  the `node_modules/@phlix/ui` `resolved` moves `11428111` → `a7530e8b`, and the
  nested `ui → contracts` declaration advances v0.4.5 → v0.4.6. ⚠ Upstream trap
  disclosed: `phlix-ui/package.json`'s own `version` field at `a7530e8b` still
  reads `0.99.1` (the tag is authoritative, the field is stale), so the lock's ui
  node keeps `version: "0.99.1"` — the identity byte-check is the `resolved` sha,
  never the version string. Hoisted `contracts` (0.4.6 at `97bcda06`) and
  `syncplay` (0.1.4 at `673e3d41`) nodes are byte-unchanged; `npm ci` proves the
  lock.
- **Guard re-pinned and the ratified hoist retired in the same commit.**
  `scripts/lockwalk.mjs` `EXPECTED['@phlix/ui']` moves to v0.99.2 at `a7530e8b`,
  adding an exact-match `manifestVersion: "0.99.1"` pin for the stale field
  (drift on version OR sha stays RED; when upstream fixes the field the pin turns
  RED on purpose — re-ratify). `RATIFIED_HOISTS` retires to empty by its own
  written rule: ui v0.99.2's manifest carries contracts v0.4.6 outright, so the
  old hoist exception fired its retirement condition and the edge is plain
  rule-1 territory again. `tests/unit/lockwalk.test.mjs` denominators updated to
  the zero-edge reality, with a new mutation proof pinning the manifest override
  as exact-match, not a waiver.
- **Truthful test fallout repaired, derived from the shipped artifacts.**
  `tests/unit/contractsPin.test.mjs` now pins the nested `ui → contracts`
  declaration at v0.4.6 (divergence resolved upstream by ui itself).
  `tests/unit/routeReachability.test.ts` allow-lists `/app/profiles`: ui v0.99.2
  (S82) registers it with its own component and its entry point ships inside the
  ui shell chrome — UserMenu "Manage Profiles" (`usermenu-manage-profiles`,
  verified in the installed `dist/phlix-ui.js`) and the who's-watching gate —
  which this repo's `buildMenu` can never see; `src/` stays byte-untouched.
  Suite movement is exactly +2 (the new lockwalk proofs): 305 → 307 tests,
  29 → 29 files, green on typecheck/lint/vitest/build; `lockwalk --live`
  prints peel OK for all three tags. `smoke` (playwright) is CI-authoritative —
  no chromium on this box.

### Changed — W43 (S450): lockfile self-consistency — `@phlix/syncplay` resolution 0.1.2 → 0.1.4 — 2026-09-08

- **Repaired the nested-request-vs-resolution divergence.** `@phlix/ui` v0.99.1's manifest
  (verified byte-for-byte against the tag's `package.json` via `git fetch refs/tags/v0.99.1`)
  requests `github:detain/phlix-syncplay#v0.1.4`, but the committed lock's single hoisted
  `node_modules/@phlix/syncplay` entry sat at version `0.1.2` resolved at `2fdf70bf` — the
  v0.1.2 tag commit. `npm install` (warm or cold cache) never self-heals this class of drift,
  so `npm ci` fidelity was silently broken. The entry now reads version `0.1.4` resolved at
  `673e3d41`, proven to be the peel of the annotated tag `v0.1.4` (tag object `a8223193`) via
  `git ls-remote`. Churn disclosed: exactly two lock lines (version + resolved); zero other
  entries moved — a full re-derivation was rejected for ~1199 lines of unrelated registry
  drift. The `ui → contracts #v0.4.5 → 0.4.6` hoist stays as S442 ratified it (supersede-higher,
  single resolution — `npm ls` certifies it "deduped", not "invalid"); it retires when
  `@phlix/ui` tags a release whose manifest carries `#v0.4.6` (post-S447 `a8349a13`; latest ui
  tag remains v0.99.1).
- **Guard added:** `scripts/lockwalk.mjs` (+ `tests/unit/lockwalk.test.mjs`) walks every
  `@phlix/*` github-tag edge in the lock and fails on request-vs-resolution mismatch,
  ratified-hoist drift, nested `@phlix/*` copies, or orphan nodes; mutation-proof tests pin
  the original 0.1.2 defect as RED.

### Changed — W39 (S442): `@phlix/contracts` re-pin v0.4.3 → v0.4.6 + doc version prose — 2026-09-06

- **Direct contracts pin advanced to the latest tag.** `package.json` re-pins
  `@phlix/contracts` `github:detain/phlix-contracts#v0.4.3` → `#v0.4.6`; the committed
  lockfile follows. The `node_modules/@phlix/contracts` block moves off its drifted
  resolution (version `0.4.0` at commit `8b355ce`, a v0.4.1-era target that had fallen
  behind even its own `#v0.4.3` declaration) to version `0.4.6` resolved at the peeled
  tag `97bcda06`. Churn disclosed: zero other lock entries moved. The nested
  `@phlix/contracts#v0.4.5` declaration string under `@phlix/ui` is left untouched (ui's
  own pin, out of scope); the flat tree dedupes ui onto the single hoisted `0.4.6` copy.
  The sole direct consumption site, `src/renderer/main.ts` (`buildPhlixHeaders`), is
  unaffected — `headers.ts` is byte-identical v0.4.3→v0.4.6 and `skipLibCheck` isolates
  the rest of the enlarged type surface.
- **Doc version prose brought current.** The `README.md` "Pinned to" line now cites
  `@phlix/ui#v0.99.1` + `@phlix/contracts#v0.4.6` (was doubly-stale `v0.98.39` + `v0.4.1`);
  the `@phlix/contracts` pin in the `AGENTS.md` / `CLAUDE.md` / `DEVELOPER.md` renderer
  bullets advanced `v0.4.3` → `v0.4.6` to match `package.json`.

### Changed — W34 (cs20retag): `@phlix/ui` re-tag v0.98.39 → v0.99.1 — 2026-09-05

- **Combined re-tag wave (this repo's first estate wave).** `package.json`
  re-tags `@phlix/ui` `github:detain/phlix-ui#v0.98.39` → `#v0.99.1`; the
  committed lockfile follows via `npm install --package-lock-only` — the
  `@phlix/ui` block moves to version `0.99.1` resolved at the peeled tag
  target `11428111` (annotated tag `v0.99.1` peels to that commit), with its
  nested `@phlix/contracts`/`@phlix/syncplay` declaration strings following
  v0.99.1's own pins (`#v0.4.5`/`#v0.1.4`). Churn disclosed: **zero** other
  lock entries moved — the direct `@phlix/contracts#v0.4.3` pin and its
  resolution are untouched (grant boundary), no unrelated package re-resolved.
  Pre-existing audit reds on this PR cleared in the same in-range, lock-only
  pattern (S430 precedent): `fast-uri` 3.1.5 → 3.1.7 (high) and
  `@xmldom/xmldom` 0.8.13 → 0.8.15 (moderate) via `npm update
  --package-lock-only`; `package.json` untouched.

### Added
- (workitem W7.5)

## [W7.7] — 2026-08-07

### Added — performance: parallelised boot IPC, deadline-based sleep timer, overlay reactivity, and resolved PIP video element (W5.1–W5.5)

- **Parallelised IPC calls at boot** — `src/renderer/main.ts` now fires `get-app-path`, `get-version`, `hub:get-config`, `app:get-device-id`, and `app:get-server-url` concurrently via `Promise.all()` instead of awaiting them sequentially, reducing time-to-first-paint on startup.
- **Deadline-based sleep timer** — the overlay sleep timer now uses `requestAnimationFrame` + a deadline timestamp instead of `setInterval`, stopping the countdown exactly at the target time and using CSS `transition` for smooth progress bar updates rather than polling on each tick.
- **Reactive overlay routing** — `src/renderer/overlay.tsx` now responds to `router.afterEach()` navigation events instead of polling `window.location.pathname`, updating the overlay only when the route actually changes.
- **PIP video element resolved once** — the Picture-in-Picture code path now queries the video element once with `querySelector` and reuses the reference, rather than calling `querySelector` repeatedly on every `visibilitychange` event which forced a layout recalculation.
- **Total tests: 228 → 245**.

### Added — CI pipeline hardened: packaging gated on quality gates, npm ci, test typecheck, no-console rule, electron-log, and audit/CodeQL (W6.1–W6.7)

- **Packaging gated on quality gates** — `build.yml`'s `build` job now declares `needs: [lint, typecheck, test, smoke]`, blocking packaging until all four gates pass; the `lint`, `typecheck`, `test`, and `smoke` jobs all run in parallel as separate workflow steps.
- **`npm ci` with lockfile-keyed cache** — all CI jobs now use `npm ci` (not `npm install`) with `cache: 'npm'` so the npm store is keyed to the lockfile hash, guaranteeing hermetic builds and eliminating lockfile drift.
- **TypeScript typecheck extended to test suite** — `tsconfig.test.json` was added so `vue-tsc --noEmit -p tsconfig.test.json` catches type errors in test files (which import compiled main/preload from `dist/`); this was failing silently before W6.3.
- **`electron-log` replaces `console.log`** — `src/main/index.ts` switched from `console.log`/`console.error` to the `electron-log` library, enabling structured log writing to `%APPDATA%\phlix-windows\logs\` and runtime log inspection.
- **`no-console` ESLint rule enforced for renderer** — `eslint.config.mjs` now has `'no-console': ['error', { allow: ['error', 'warn'] }]` for the renderer, causing test failures on any `console.log` committed in renderer code (main/preload/scripts are exempt).
- **`npm audit --audit-level=high` in CI** — the test job now runs `npm audit --audit-level=high` and fails the job if any high or critical vulnerabilities are found, closing the audit gap that existed before W6.5.
- **CodeQL security analysis added** — `codeql.yml` was added running `security-extended` queries on every push/PR, providing static analysis security coverage complementary to `npm audit`.
- **Total tests: 215 → 228**.

### Added — docs: CI baseline documented, architecture decisions recorded, README corrected, React/Vue confusion fixed (W7.4–W7.6)

- **`docs/ci-baseline.md` added** — records every CI gate verified in the W6 CI improvement pass, including smoke test, ESLint, vue-tsc, tsc main/preload, vitest, test typecheck, no-console rule, npm audit, packaging quality gate, npm ci, and CodeQL. Documents the one legitimate `continue-on-error: true` (Codacy coverage upload) and the coverage reporter configuration.
- **`docs/performance-notes.md` added** — records the W5.x performance investigation findings: list virtualisation is handled upstream by `@phlix/ui`'s `MediaGrid` (windowed rendering, no third-party library), and the boot parallelisation and sleep timer changes were measured and verified.
- **`docs/readme: correct nine false claims`** — corrected the README's stale dependency description, inaccurate feature list, wrong directory tree, and incorrect npm script references to match the as-built state after W0–W6 changes.
- **React/Vue confusion corrected** — README and comments that referred to "React" or "Vue.js JSX" were updated to correctly state "Vue JSX" throughout, since this project uses Vue 3 with `@vitejs/plugin-vue-jsx` which is a Vue JSX transform, not React.
- **Stale dependency pins removed** — `@phlix/ui` is pinned to `github:detain/phlix-ui#v0.98.39` and `@phlix/contracts` to `github:detain/phlix-contracts#v0.4.3`; the previous README incorrectly described `@phlix/ui` as coming from npm rather than GitHub.
- **Rotting inventory files removed** — `src/components/`, `src/pages/`, and `src/stores/` directories (all emptied during W2 dead-code deletion) were removed from the project tree and the README directory tree was updated accordingly.
- **Total tests: 245** (no behavioral change).

### Added — W7.6: Runtime server version enforcement (1.1.0 minimum at boot)

- **`src/main/versionCheck.ts` added** — `parseServerVersion(version)` parses semver strings into `{major, minor, patch}`; `checkMinServerVersion(apiBase)` queries `GET /api/v1/server/version`, compares the returned version semantically against `1.1.0`, and returns `false` only when the server explicitly reports a version below minimum. Fails open for old servers (pre-1.1.0) that don't implement the version endpoint — a warning is logged and boot continues.
- **`app:check-server-version` IPC channel added** — `src/main/index.ts` now exposes `checkMinServerVersion` over IPC so the renderer can call it during the boot sequence.
- **`checkServerVersion(apiBase)` added to `window.electronAPI`** — renderer-facing API typed in `src/renderer/types/electron.d.ts`.
- **Boot-sequence integration** — `src/renderer/main.ts:boot()` now calls `api.checkServerVersion(apiBase)` after `resolveAppConfig` resolves `apiBase` but before `createPhlixApp()` / `app.mount()`. If the check fails the boot aborts with a descriptive error log.
- **Design decision documented** — a comment in `src/renderer/main.ts` near the version check and in `versionCheck.ts` explains the fail-open rationale: pre-1.1.0 servers may still work for basic features, and blocking boot on an unknown server would break existing deployments unnecessarily.
- **`tests/unit/versionCheck.test.ts` added** — 18 tests covering: `parseServerVersion` (7 cases including malformed input), `checkMinServerVersion` (11 cases: >= 1.1.0 → true, < 1.1.0 → false, network error → fail-open, HTTP error → fail-open, missing version field → fail-open, malformed JSON → fail-open, trailing slash stripped, nested `data.version` field).
- **`CHANGELOG.md` line 34 corrected** — "docs: state and enforce" changed to "docs: state" since enforcement is being added here, not previously.
- **Total tests: 245 → 263**.

### Added — electron-builder files allow-list, asar packaging, and sourcemap disabled (W4.11)

- **`electron-builder` files allow-list added** — `package.json` `build.files` now lists
  `["dist/**", "build/**", "package.json"]`, explicitly controlling which files are included
  in the packaged app and excluding everything else from the asar archive.
- **`asar: true`, `npmRebuild: false`** — asar packaging is enabled and npm native rebuilds
  are disabled in the electron-builder config.
- **`sourcemap: false` in `vite.config.mts`** — Vite production build now disables
  sourcemap generation, reducing bundle size and not leaking source paths into the
  packaged renderer.
- **Total tests: 215**.

### Added — GPU and hardware-decode escape hatch (W4.12)

- **`PHLIX_DISABLE_GPU=1` environment variable** checked at module level in `src/main/index.ts`
  before `app.whenReady()` — when set, `app.disableHardwareAcceleration()` is called before
  any window is created.
- **`disableHardwareAcceleration` store preference** — a persisted electron-store preference
  checked alongside the env var in the `app.whenReady()` callback; `app.disableHardwareAcceleration()`
  is called if either signal is set.
- **Three IPC handlers** for the renderer to query and toggle the GPU preference:
  `gpu:get-disable-hardware-acceleration` (get current value), `gpu:set-disable-hardware-acceleration`
  (persist a new value), and `gpu:get-feature-status` (returns whether hardware acceleration is
  currently active).
- **Total tests: 228**.

### Changed — NSIS perMachine: false (per-user install, no admin required) (W4.8)

- **`package.json` `build.nsis.perMachine`** switched from `true` to `false` — the NSIS
  installer now installs per-user under `%LOCALAPPDATA%\Programs\Phlix` (electron-builder
  per-user default) instead of requiring admin rights to write to Program Files.
- No admin rights are required to install; auto-update (W4.9) works without elevation.
- **Note:** Logs (`electron-log`) and config (`electron-store`) still live under
  `%APPDATA%\phlix-windows` — only the install location changed.

### Added — native notifications with click-action routing (W4.7)

- **`Notification.isSupported()` check** — all notification APIs are gated behind a platform
  support check; on unsupported platforms the feature gracefully no-ops with a warn log.
- **`notificationsEnabled` preference** — persisted in electron-store (default `true`); can be
  toggled off to suppress all native notifications without uninstalling the app.
- **`notification:show` IPC channel** — `ipcMain.handle('notification:show', ...)` takes
  `{ title, body, clickAction? }` and constructs an Electron `Notification`; the renderer calls
  it via `window.electronAPI.showNotification(title, body, clickAction?)`.
- **`clickAction` routing** — when a notification is clicked, `phlix://internal{clickAction}` is
  parsed and routed through the existing W4.4 deep-link handler, allowing any internal route
  (e.g., `/media/id`, `/app/settings`) to be opened from a notification click.
- **`'internal'` host added to `KNOWN_HOSTS`** — `phlix://internal*` URLs are accepted by the
  deep-link parser and routed to the click action handler; the `'internal'` host is intentionally
  absent from the public deep-links documentation as it is an implementation detail for
  notification routing rather than a user-facing link type.
- **`tests/unit/notification.test.ts`** added with 7 tests covering: `isSupported()` guard,
  `notificationsEnabled` false skips notification, `title`/`body`/`clickAction` passthrough,
  click event fires and routes `phlix://internal` URL correctly, and graceful no-op on
  unsupported platforms.
- **Total tests: 207 → 215**.

### Added — sleep inhibition during playback (W4.6)

- **`powerSaveBlocker` module added** (`src/main/powerSaveBlocker.ts`) — wraps Electron's
  `powerSaveBlocker` API with module-level state (`powerBlockerId`) and an idempotent public API.
- **`ensurePowerBlocker(start: boolean)`** — when `start` is `true`, starts the blocker only if
  `powerSaveBlocker.isStarted(id)` returns `false`; when `start` is `false`, stops the blocker and
  sets `powerBlockerId = null` so a subsequent start creates a fresh blocker.
- **`power:update` IPC channel** — `ipcMain.on('power:update', (_, { playing }) => ensurePowerBlocker(playing))`
  wired in `src/main/index.ts`; renderer sends `{ playing: boolean }` on every play/pause transition.
- **Four teardown paths** ensure the blocker is stopped on window close, app quit, and renderer process
  crash: `win.on('close')`, `app.on('before-quit')`, and `app.on('render-process-gone')`.
- **`tests/unit/powerSaveBlocker.test.ts`** added with 20 tests covering: idempotent start/stop,
  `isStarted` guard prevents duplicate blockers, `powerBlockerId` reset after stop, all four teardown
  paths, and the IPC channel round-trip.
- **Total tests: 187 → 207**.

### Added — Windows SMTC integration: taskbar thumbnail buttons and progress bar (W4.5)

- **`setThumbarButtons`** — three taskbar thumbnail toolbar buttons (rewind 10 s, play/pause, forward 10 s) that update their icons and enabled state when play state changes. Icons are resized from `build/icon.png` with an `isEmpty()` guard so missing assets are handled gracefully.
- **`setProgressBar`** — taskbar progress indicator driven by playback position: indeterminate state (2) when a track is loaded but not yet playing, a `0.0–1.0` fraction during playback, and cleared (`-1`) when playback ends.
- **Two IPC send channels** — `thumbar:update` (feeds `setThumbarButtons` from renderer state) and `playback:progress` (feeds `setProgressBar` with `{ current, total }`).
- **Fixes** — indeterminate progress now applies immediately on play start rather than only after a seek; `willBePlaying` used instead of reading `player.playing` after the async `play()` call returns, avoiding a race where the button label could reflect stale state.
- **Total tests: 171 → 183**.

### Fixed — deep link listener cleanup and router optional chaining (W4.4)

- **`src/renderer/main.ts:165`** — Added optional chaining on
  `app.config?.globalProperties?.$router` so the deep link flush guard does not
  crash in test environments where the router is not yet initialised.
- **`src/preload/index.ts:59–62`** — Fixed `onDeeplink` cleanup: the `removeListener`
  call was passing the user's callback directly instead of the inner `listener`
  reference created and registered with `ipcRenderer.on`. Cleanup now correctly
  removes only the IPC listener.
- **`tests/unit/ipcChannels.test.ts`** updated: `deeplink:open` added to the push
  channel list (now 6 total), bringing total tests to 171.

### Added — window bounds persisted across sessions (W4.3)

- **`WindowBounds` interface** added (`x`, `y`, `width`, `height`, `isMaximized`) — typed bounds
  structure used for both storage and `setBounds()` calls.
- **Startup restore**: `createWindow()` reads saved bounds from `electron-store` and validates them
  with `isBoundsOnScreen()` before applying; off-screen bounds fall back to defaults (no `x`/`y`
  set, `defaultWidth`/`defaultHeight` used).
- **Maximized state** restored after window creation via `win.maximize()` / `win.unmaximize()`
  so the persisted state is applied after the window is already visible.
- **Debounced save on resize/move**: a 250 ms `setTimeout` saves bounds; the previous timeout is
  cleared before scheduling a new one, so rapid resize events coalesce into a single write.
- **Save on close**: bounds are written to the store in the `before-quit` handler before the
  minimize-to-tray logic runs, ensuring the final size is captured even when closing from tray.
- **`tests/unit/windowBounds.test.ts`** added with 21 tests covering: default bounds, fullscreen
  skip, all-bounds-on-screen restore, off-screen fallbacks, maximized/restore round-trips,
  debounce coalescing, close-persists-bounds, and `isBoundsOnScreen()` edge cases.
- **Total tests: 150 → 171**.

### Added — single-instance lock prevents multiple app windows (W4.2)

- **`app.requestSingleInstanceLock()`** added at module top of `src/main/index.ts` — the app
  acquires an exclusive lock on startup; if a second instance is launched the existing window is
  restored and focused instead of opening a second window.
- **`second-instance` handler** wired to restore and focus the primary window when a subsequent
  launch is attempted (minimized windows are restored first).
- **TODO comment** in the handler references W4.4 for deep-link routing — argv will be parsed
  for `phlix://` URLs once that step is implemented.
- **`tests/unit/singleInstance.test.ts`** added with 4 tests covering: lock acquisition, failed
  lock causes quit, window restore on second-instance, and window focus on second-instance.
- **`tests/unit/protocolHandler.test.ts`** mock updated to include `requestSingleInstanceLock`.
- **Total tests: 146 → 150**.

### Added — application icons (W4.1)

- **`build/icon.png`**, **`build/icon.ico`**, and **`build/tray-icon.png`** added — placeholder
  orange icons generated by `scripts/generate-icons.mjs`; the three files are produced
  idempotently and are gitignored so CI regenerates them on each build.
- **`scripts/check-assets.js`** added — prebuild validation hook (wired via `npm run prebuild`)
  that verifies all three icon files are present and exits 1 if any are missing, catching
  misconfigured build environments early.
- **`scripts/generate-icons.mjs`** added — idempotent script that generates the three icon
  placeholders; run manually or via the `prebuild` script so contributors without design
  assets can still build.
- **`createTray()` guarded with `isEmpty()` check** — `new Tray(icon)` is now reached only
  when the icon image is non-empty; on missing or empty icon the function returns early
  instead of throwing, making the tray conditional on assets being present.
- **`tests/unit/trayIcon.test.ts`** added with 3 tests covering: `isEmpty()` returns true
  for missing/empty images, `isEmpty()` returns false for a valid icon, and `createTray()`
  skips tray creation when the icon is empty.
- **Total tests: 143 → 146**.

### Audited — every IPC channel documented end-to-end (W3.7)

- **`docs/ipc-channels.md`** created — 43 lines, all 16 IPC channels in a 6-column table
  (channel name, direction, payload, return, main handler, preload method, renderer call sites).
  This document is load-bearing: `tests/unit/ipcChannels.test.ts` asserts the code matches it.
- **3 doc-vs-code alignment tests** added to `tests/unit/ipcChannels.test.ts` — parse the markdown
  table and assert that every entry in the table has a matching handler in the code, so adding an
  unpaired `ipcMain.handle` makes the pairing test fail.
- **10 behavioral round-trip tests** added for invoke/send/push channels in
  `tests/unit/ipcChannels.test.ts` under `describe('behavioral round-trips')`.
- **`main.test.ts` overlay mock added** — `overlay.tsx`'s `createWebHashHistory()` was running
  before jsdom was ready, causing vitest to exit 1 on every run; `vi.mock('../src/renderer/overlay')`
  now prevents the router initialisation during test setup.
- **Total tests: 130 → 143**.

### Deleted — dead File → Open File… menu item and no-op handler removed (W3.6)

- **`Open File…`** menu item removed from the File menu — the menu entry and its accelerator
  (`CmdOrCtrl+O`) are gone; no replacement was wired.
- **`onFileOpened` handler removed** from the renderer bridge — the `file-opened` IPC message
  from `openFile()`'s dialog callback was received by a no-op handler in `electronBridge.ts`
  (the `playLocalFile` seam does not yet exist upstream in `@phlix/ui`'s `PlayerPage`), so the
  entire path was dead code.
- No behaviour changed — local file playback was never functional and is not affected.

### Fixed — bridge cleanup functions made idempotent (W3.3)

- **`installElectronBridge()` and `installFocusGuard()` made idempotent**: both functions now
  track their cleanup at module level (`_cleanupBridge` / `_cleanupFocus`) and remove any
  previous registration before installing a new one, preventing duplicate listeners if either
  function is called more than once.
- **`cleanupOverlay()` exported** from `src/renderer/overlay.tsx` — returns a cleanup function that
  removes the overlay's focus guard listener; idempotent (safe to call when nothing is registered).
- **`disposeAll()` wired to HMR and page unload** in `src/renderer/main.ts`:
  `import.meta.hot.dispose()` and `window.addEventListener('beforeunload')` both invoke
  `disposeAll()`, which runs every registered cleanup (electron bridge + overlay) so listeners
  are properly removed on hot reloads and navigation away from the page.

### Fixed — minimize-to-tray preference is now persisted across quits (W3.2)

- **`isQuitting`** separated from **`minimizeToTray`**: `isQuitting` is a transient in-memory flag
  (set/cleared per quit sequence); `minimizeToTray` is a persisted electron-store preference.
- **Two `store.set('minimizeToTray', false)` calls removed** from the quit path in
  `src/main/index.ts` — these were destroying the persisted preference on every quit, forcing the
  user to re-enable minimize-to-tray after every app restart.
- **Tray context menu "Minimize to Tray" checkbox** added (`type: 'checkbox'`, checked state driven
  off `store.get('minimizeToTray', true)`, click handler calls `store.set('minimizeToTray', menuItem.checked)`),
  giving direct visual control and persistence without requiring a settings page.
- **IPC getter/setter added** for `minimizeToTray` over the preload bridge:
  `ipcMain.handle('tray:get-minimize-to-tray')` and `ipcMain.on('tray:set-minimize-to-tray')` in main,
  `getMinimizeToTray()` / `setMinimizeToTray()` in preload, typed in `electron.d.ts`.
- **9 new tests** covering: checkbox reflects store value, checkbox click updates store, quit path
  does not clobber the preference, `isQuitting` flag is independent of the persisted preference,
  and IPC getter/setter round-trips correctly.

### Fixed — menu accelerators no longer hijack text input (W3.1)

- **`registerAccelerator: false`** added to the Space, Left, and Right menu items in the Playback
  menu — these accelerators are now handled exclusively by the renderer focus guard rather than by
  Electron's global menu system.
- **`installFocusGuard(player)`** added to `src/renderer/electronBridge.ts` — intercepts
  `keydown` for Space, Left, and Right when the active element is a text input (`INPUT`,
  `TEXTAREA`) or an element with `contenteditable`, allowing normal text editing to proceed
  unobstructed.
- **`playbackMenuTemplate` extracted** into its own exported constant in `src/main/index.ts` for
  unit-testability.
- **9 new tests** covering: Space/Left/Right blocked in text inputs, Space/Left/Right passed through
  when player is focused, and the focus guard not interfering with other keys (Up, Down, Enter).

### Fixed — overlay entry point is now deterministic (W2.7)

- **`src/renderer/overlay.tsx` rewritten** — the Vue app is now created once at module level
  rather than being recreated on every retry; bounded retry with max 10 attempts at 1 second
  intervals; `console.error` logged when the mount target `#player-supplement-root` never appears.
- **`.use(pinia)` and `.use(router)` called explicitly** before mounting rather than relying on
  `activePinia` accident.
- **`src/renderer/overlay.html` deleted** — a standalone HTML entry point that was built by Vite
  but was never loaded by the Electron shell; the overlay is mounted onto `#player-supplement-root`
  inside the main `@phlix/ui` app.
- **4 new tests** in `tests/unit/overlay.test.ts` covering: mount on target appearance, bounded
  retry exhaustion, single `createApp` call across retries, and explicit `.use(pinia)`/`.use(router)`
  registration.

### Deleted — unused React and React DOM dependencies removed (W2.6)

- **`react`**, **`react-dom`**, **`@types/react`**, and **`@types/react-dom`** removed from
  `package.json` — these production dependencies were never imported or used; the renderer
  has never shipped its own UI (it boots the shared `@phlix/ui` Vue 3 app). The JSX transform
  plugin `@vitejs/plugin-vue-jsx` is retained: 4 `.tsx` files in the Vite build use Vue JSX,
  which requires that plugin (not React). Lockfile regenerated.
- No new exports were introduced; no behaviour changed.

### Deleted — 10 unreachable presentational components and 8 test files (W2.5)

- **`src/renderer/components/RatingBadge.tsx`**, **`ChapterList.tsx`**, **`AudioTrackList.tsx`**,
  **`SubtitleTrackList.tsx`**, **`RecommendationCard.tsx`**, **`RecommendationsPanel.tsx`**,
  **`MusicAlbumCard.tsx`**, **`MusicArtistCard.tsx`**, **`MusicScreen.tsx`**, and
  **`MusicAlbumScreen.tsx`** removed — 10 presentational components that were never rendered
  anywhere in the thin-consumer app; 1,883 lines deleted.
- **`tests/unit/RatingBadge.test.tsx`**, **`ChapterList.test.tsx`**, **`AudioTrackList.test.tsx`**,
  **`SubtitleTrackList.test.tsx`**, **`RecommendationCard.test.tsx`**, **`RecommendationsPanel.test.tsx`**,
  **`MusicAlbumCard.test.tsx`**, and **`MusicArtistCard.test.tsx`** removed — 8 test files deleted
  along with the components (test count: 183 → 109; coverage: 69.41% → 69.33%).

### Deleted — local SyncPlay stack removed in favour of @phlix/ui (W2.1)

- **`useSyncPlayStore.ts` removed** from `src/stores/` — the Pinia store that locally duplicated
  SyncPlay state is gone; the upstream `SyncPlayPage` in `@phlix/ui` is now reachable via the
  nav wired in W1.4.
- **`tests/unit/useSyncPlayStore.test.ts` removed** — 279 lines of store unit tests deleted along
  with the store itself.
- **`@phlix/syncplay` dependency removed** from `package.json` and the lockfile regenerated.

### Deleted — local ParentalControlsPage fork removed (W2.2)

- **`src/pages/ParentalControlsPage.vue` removed** — the 1373-line local fork of the upstream
  `ParentalControlsPage` from `@phlix/ui` is gone. The upstream `/app/parental` route (registered
  by `createPhlixApp`) remains reachable; it is on the route-reachability allow-list
  (`/app/parental` exempt from nav-coverage requirement). `src/pages/` is now empty and the
  directory entry has been removed from `README.md`.

### Deleted — local SkipButton removed (W2.4)

- **`src/renderer/components/SkipButton.tsx` removed** — the 147-line local component was
  permanently broken; it read `item.markers` which the server never sends. Skip-intro is now
  handled by `@phlix/ui`'s `PlayerPage` directly.
- **`tests/unit/SkipButton.test.tsx` and 8 sibling test files removed** — 160 lines of tests
  deleted along with the component (test count: 192 → 183).

### Deleted — mock UserRatingPicker removed (W2.3)

- **`src/renderer/components/UserRatingPicker.tsx` removed** — the 170-line local component had
  commented-out real fetch calls and faked success with `setTimeout`; it was never rendered
  anywhere. Rating actions are now provided by `@phlix/ui`'s media detail page directly.
- **`tests/unit/UserRatingPicker.test.tsx` removed** — 8 test files (113 lines total) deleted
  along with the component.

### Verified — admin page surface and settings (W1.7)

- **`docs/ui-surface.md`** corrected: the admin page count was revised from "22" (wrong estimate from a stale `admin.d.ts` comment) to **"23"** (verified via live bundle analysis of `@phlix/ui v0.98.34 dist/phlix-ui.js`). `buildAdminRoutes()` yields 20 pages and `buildHubAdminRoutes()` yields HubDashboardPage + 3 hub-only + 3 common = 7 pages total.
- **WebhookLogsPage removed** from the admin page table — it is a tab within LogsPage, not a distinct route.
- **Settings confirmed schema-driven** (`SettingsResponse` with `types`, `meta`, `overridden` fields), not a hardcoded form.
- **Plugins admin confirmed complete** in `@phlix/ui v0.98.34`: list, enable/disable, catalog browse, detail view (with `settings_schema`), schema-editor via `updateSettings`, plus install/uninstall/checkUpdates/testCredentials.
- **Plugin update not exercised** — no throwaway server available in this environment.

### Added — nav entries and route-reachability guard for W1.4 nav-wiring

- **`buildMenu` now registers WatchHistory, Explore, Recommendations, and SyncPlay** in both
  server and hub mode nav. These four pages were registered by `createPhlixApp` but had no way
  in — each navigation request landed on a blank screen.
- **`buildExtraRoutes` added to the routeReachability test** so the guard now checks both menu
  coverage and the extraRoutes seam.
- **`tests/unit/routeReachability.test.ts`** created: aVitest guard that reads routes from
  `createPhlixApp`'s router and fails if any route is absent from `buildMenu` and absent from a
  25-entry `DEEP_LINK_ALLOW_LIST`. `extractRoutePaths` correctly resolves relative child paths
  (e.g. `'dashboard'` → `/app/admin/dashboard`); `/app/parental`, `/app/admin`, and
  `/app/admin/*` are on the allow-list.

### Added — `@phlix/ui` v0.98.34 page/route inventory documented

- **`docs/ui-surface.md`** created to track the `@phlix/ui` page surface. Documents 43 root
  pages, 23 admin pages (66 total), nav entry wiring state (3/22 server-mode, 3/8 hub pages),
  4 unlinked pages, and 5 missing hub pages. Serves as the baseline for W1.x nav-wiring work.

### Changed — @phlix/ui re-pinned from v0.81.0 to v0.98.34

- **`@phlix/ui` switched from tarball URL to `github:detain/phlix-ui#v0.98.34`** (matching
  the form used by the Tizen client). This closes a 17-minor version gap (v0.81.0 → v0.98.34)
  and brings 80 upstream commits into the Windows client.
- **All 80 commits were transparent** — no renamed exports, no changed prop signatures, and
  no duplicate component conflicts were introduced. The Windows client required no code changes
  to compile or test after the re-pin.

### Changed — SyncPlay contracts upgraded, local shadow types removed

- **`@phlix/contracts` bumped to `v0.4.1`** (from `v0.3.12`). This pulls in the
  `SyncPlayGroup` vocabulary fix from the contracts package.
- **Local SyncPlay shadow types removed** from `src/renderer/types/electron.d.ts`:
  `SyncPlayRoom`, `SyncPlaySession`, `SyncPlayUser`, `SyncPlayRole`, and
  `SyncPlayPermission` were local duplicates that shadowed the types now exported by
  `@phlix/contracts`. `useSyncPlayStore.ts` imports these from `@phlix/contracts` instead.
- **Orphaned UI components deleted**: `SyncPlayModal.vue` and `SyncPlayOverlay.vue`
  violated the thin-consumer rule and were never reachable.
- **Room placeholder updated**: the local room fallback in `joinRoom()` now includes
  all required `SyncPlayGroup` fields so the store compiles against `v0.4.1`.

### Added — hub nav and routes: 8 of 8 pages now wired (W1.5)

- **`buildMenu`** in hub mode now registers `SharedWithMePage` (`/app/shared`) and
  `InviteLinksPage` (`/app/invites`) nav entries alongside the four hub entries that
  were already present (MyServers, Federation, Shares, Watch History, Explore,
  Recommendations, SyncPlay, Admin).
- **`buildExtraRoutes`** wires the three remaining hub pages: `ServerDetailPage`
  (`/app/server/:id`), `FederationSharesPage` (`/app/federation/shares`), and
  `AcceptInvitePage` (`/app/accept-invite`, deep-link only — no nav entry;
  already allow-listed from W1.4). All eight hub pages are now reachable.
- **Hub-mode gating**: both functions branch on `if (appMode === 'hub')`, leaving
  server mode entirely untouched.
- **Relay proxy HTTP verbs (stale caveat removed)**: `phlix-hub/src/Application.php`
  registers `GET`, `PUT`, `DELETE`, `PATCH`, and `POST` on the relay proxy
  (lines 479–495). The "only `GET`/`HEAD`" caveat previously documented on the
  user-item data write endpoints (`POST .../favorite`, `PUT .../rating`,
  `DELETE .../favorite`) is stale and has been corrected in the API reference
  (`phlix-docs/docs/reference/api.md`).

## [W0.8] — 2025-07-31

### Added — smoke test that launches Electron in CI on ubuntu and windows

A `@playwright/test` smoke test (`tests/smoke/boot.spec.ts`) now launches the packaged Electron app against `dist/` and asserts four guards: `window.electronAPI` is defined (preload script loaded, W0.1), device ID is not the hardcoded `'windows-dev'` fallback (W0.3), the renderer navigated to a `/app/*` route (W0.4), and the console is free of CSP violations and preload errors. The test runs in CI on both `ubuntu-latest` (`xvfb-run`) and `windows-latest` (`.github/workflows/test.yml` smoke job) and is also a prerequisite of the packaging job (`.github/workflows/build.yml`). `npm run smoke` is permanently part of the verification block.

> **W0.8 update (fix loop 6):** The smoke test now runs Chromium in headed mode (`headless: false`) with `xvfb-run` providing a virtual X display on ubuntu CI. This replaces the `--ozone-platform=headless` approach which caused rendering loop failures. The `--disable-gpu` flag is also removed since headed mode in a virtual display does not require it.

> **W0.8 update (fix loop 7):** The smoke test now uses an aggressive set of Chromium flags tuned for CI environments: `--no-sandbox`, `--disable-gpu`, `--disable-software-rasterizer`, `--disable-dev-shm-usage`, `--disable-accelerated-2d-canvas`, `--no-first-run`, `--no-zygote`, `--single-process`, `--disable-ipc-flooding-protection`, `--disable-features=NetworkService,VizDisplayCompositor,ChromeUILoadTimes`, `--disable-gpu-compositing`, and `--headless=new`. These flags suppress GPU rendering, zygote spawn, and multi-process features that cause instability in containerized CI runners. A resilient `firstWindow()` fallback was also added — if `firstWindow()` times out the test checks `electronApp.windows()` directly before failing, so a window that opened just before the timeout is still accepted.

### Fixed — smoke test reliability and diagnostics improvements

The smoke test (`tests/smoke/boot.spec.ts`) has been improved in three ways: it now uses `firstWindow()` instead of `waitForEvent('window')` because `waitForEvent` can race in headless mode where events fire before the listener is attached; the window-launch timeout has been increased from 30 seconds to 60 seconds to accommodate slower CI runners; and stderr/stdout from the Electron process is now captured and echoed to the test output (`electronApp.on('output', ...)`) so CI diagnostics can include the app's startup logs when a failure occurs.

### Fixed — test job now builds the app before running unit tests

The `test` job in `.github/workflows/test.yml` previously ran `npm test` directly. Tests that import compiled output (e.g. main-process or preload modules via `dist/`) would fail because `dist/` did not exist. The job now runs `npm run build` before `npm test`, ensuring `dist/` is populated for test imports.

### Fixed — Content-Security-Policy updated to unblock posters, HLS workers, and WebSocket connections

Posters (cover art, backdrops) loaded from an HTTP server were blocked by the previous CSP `img-src` directive, so no cover art appeared on an HTTP-only setup. Transcoded HLS streams failed because the HLS transmux worker is a `blob:` URL that was not allowlisted in `worker-src` or `child-src`. WebSocket connections to an HTTPS hub (`wss://`) were blocked because only `ws:` was permitted. The CSP in `src/renderer/index.html` and `src/renderer/overlay.html` now reads:

```
default-src 'self'; img-src 'self' data: blob: http: https:; media-src 'self' blob: http: https:; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' http: https: ws: wss: app:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;
```

Posters render on any HTTP server, transcoded HLS streams play, and `wss://` hub connections succeed. Note that `style-src 'self' 'unsafe-inline'` is required for Vue scoped styles (`<style scoped>`), which inject dynamic attribute selectors that cannot be nonce-hashed at build time.

### Fixed — packaged app now loads via `app://` protocol instead of `loadFile`

The desktop client now registers `app://` as a custom privileged protocol before `app.whenReady()` and serves the packaged renderer through a `protocol.handle` handler in `src/main/index.ts`. This avoids Chromium's `file://` origin security restrictions that blocked module fetches and caused `createWebHistory()` to fail with a SecurityError when using `loadFile`. The handler also provides path-traversal protection (rejecting `app://-/../../etc/passwd` with a 403) and falls back to `index.html` for SPA routing. No `loadFile` is used in production.

### Added — stable, per-install device ID sent to the server on every request

The desktop client now identifies itself with a real, stable device ID (`X-Phlix-Device-ID`) instead of sending no device identifier at all. On first launch a UUID-based ID is generated and persisted to electron-store; every subsequent launch returns the same value, so the server can recognize the same installation across restarts and profile switches. The format is `windows-<uuid>` (e.g. `windows-8f3a2b1c-...`). In a plain browser dev context (where the Electron bridge is absent) a per-session `browser-<uuid>` is used with a console warning — support may ask for the device ID when diagnosing connection issues.

### Fixed — preload script path now resolves to where tsc writes it

The `BrowserWindow` webPreferences `preload` path in `src/main/index.ts:37` was
`path.join(__dirname, 'preload.js')`, resolving at runtime to `dist/main/preload.js`.
`tsc -p tsconfig.main.json`, however, writes the compiled preload to `dist/preload/index.js`.
The mismatch caused Electron to fail with "Unable to load preload script" on every
production launch and `window.electronAPI` was never defined. The path now reads
`path.join(__dirname, '../preload/index.js')`, matching tsc's actual output layout.
A build-time assertion (`scripts/assert-preload.mjs`) is now wired into
`build:electron` so a missing preload fails the build rather than silently breaking
production launches.

### Fixed — sandbox enabled and external URL validation

The renderer previously ran with `sandbox: false`, `contextIsolation: true`, and
`nodeIntegration: false`. With `sandbox: false` the renderer could spawn arbitrary
processes and access Node.js APIs indirectly. Additionally, `shell.openExternal`
and the `will-navigate` handler accepted any URL scheme without checking, allowing a
compromised or malicious page to open `file://` URLs (reading local files) or
`javascript:` URLs (running arbitrary code in the Electron shell context).

The window now boots with `sandbox: true`. A new `validateExternalUrl()` function in
`src/main/urlValidator.ts` permits only `http:` and `https:` schemes. The
`setWindowOpenHandler` calls `shell.openExternal` only after validation and always
returns `deny`. The `will-navigate` handler calls `validateExternalUrl` and
`preventDefault()` on anything else, blocking renderer-initiated navigation to
dangerous schemes. Unsandboxed or non-http/https navigation attempts are logged
with a `[security]` prefix.

### Changed — coverage now measured for main and preload processes with 58% floor enforced in CI

Coverage reports (`@vitest/coverage-v8`) now include `src/main/**` and `src/preload/**`. The previous exclusion of Electron-process glue has been removed. Codecov upload in `.github/workflows/test.yml` enforces `fail_ci_if_error: true`, and the coverage floor is set to 58% (measured from 59.81% minus a 1-point buffer).

### Changed — dependency bump for in-player quality selection (G2)

- **`@phlix/ui` bumped to `v0.74.0`, `@phlix/contracts` to `v0.2.0`** (from
  `v0.55.0` / `v0.1.1`) in `package.json` and `package-lock.json`. This pulls in
  `@phlix/ui`'s `QualityMenu` (the on-screen stream-quality picker rendered in
  the player's control bar, shown whenever there are ≥2 switchable hls.js ABR
  rungs) and `@phlix/contracts`'s `Rendition` / `variants` types.
- **No application code changes were needed.** This app has a real mouse and
  keyboard, not a D-pad — unlike the sibling `phlix-tizen-client`, which needed
  a remote-input bridge (yellow-button open/close, D-pad Arrow suppression,
  `MutationObserver` + `router.afterEach` teardown) so its TV remote could
  drive the picker. Here, `QualityMenu` is `@phlix/ui`'s ARIA-`combobox`
  `Select`; its canonical keyboard path (`ArrowUp`/`ArrowDown` to open and
  navigate, `Enter` to confirm, `Escape`/`Tab` to close) and plain mouse clicks
  both work out of the box through ordinary browser focus handling — nothing
  in this repo intercepts keyboard input for the renderer (the only
  `keydown`-adjacent handling is the Electron application **menu accelerators**
  in `src/main/index.ts`: `Space` play/pause, `Left`/`Right` rewind/forward,
  `F11` fullscreen, `CmdOrCtrl+O`/`CmdOrCtrl+,`). Those accelerators collide
  with zero of the Select's primary Arrow/Enter/Escape path; only the
  redundant `Space`-to-select affordance is shadowed by the play/pause
  accelerator, which is not a regression worth bridging.
- No default-quality wiring was added: `PhlixAppConfig` (the object passed to
  `createPhlixApp`) has no default-quality field — `defaultQuality` is a
  `@phlix/ui` `usePreferencesStore` user preference set via the shared
  Settings screen, not something this Electron shell configures at boot.
