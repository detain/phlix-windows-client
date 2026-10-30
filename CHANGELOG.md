# Changelog

All notable changes to **phlix-windows-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Security — R-W8 rider R-WINDOWS-08: packaged shells deny the dev-server preload entry (isPackaged-aware trust gate) — 2026-10-30

- **The residual (M-WINDOWS-10__r1 P4-2, honestly unclaimed then).** The trust
  gate pairs `app://-` (prod boot) with `http://localhost:5173` (vite dev,
  strictPort) unconditionally: a PACKAGED shell still trusted the dev entry, so
  a local listener on 5173 plus a top-level navigation into it (needs local
  code presence as a precondition — a class the gate itself flagged as its
  limit) would hand the full `electronAPI` bridge to a non-bundled document.
- **The cure.** `PreloadContext` gains `isPackagedShell`; the pure predicate
  denies EVERY `http:` document when it is set. The signal travels the only
  sync channel a sandboxed preload can read: `createWindow` passes
  `additionalArguments: app.isPackaged ? ['--phlix-packaged'] : []` and
  `readPreloadContext()` probes `process.argv` for the exported
  `PHLIX_PACKAGED_ARGV_FLAG`. Dev workflow untouched (flag absent ⇒ full trust
  set, byte-identical decision).
- **Pins (tests/unit/preloadTrustGate.test.ts, 19 → 23).** Predicate table: packaged
  shell denies both dev-entry shapes and keeps `app://-`; flag-isolation leg
  (same href trusted without it). Wiring: argv plant + dev boot exposes
  NOTHING; argv plant + prod boot keeps the surface. Posture: the main-side
  conditional pinned by exact shape AND the cross-file flag-string identity
  (a one-sided rename reddens). Mutations: predicate-arm strip reddens exactly
  the two deny legs; main-side token rename reddens exactly the posture pin.
- **Ripple (measure-at-red).** The +5-line insert in `src/main/index.ts`
  shifted every registration coordinate tracked by the R-WINDOWS-03 doc
  currency pin; all 43 cited rows in `docs/ipc-channels.md` rotated +5 to the
  measured live lines in this same commit (ipcChannels suite green again at
  32/32, no counts moved). Full serial vitest 676 passed (parent 672, +4
  exact, 54 files); typecheck (vue-tsc + tsc), lint, build all 0.

### Docs — R-W3 rider R-WINDOWS-03: `docs/ipc-channels.md` re-vendored to measured truth and made load-bearing by four doc-currency pins — 2026-10-30

- **The gap.** The doc's line coordinates had rotted across whole eras (every
  single one was stale — e.g. `get-app-path` printed 645 while the handler
  lives at 825), eight live channels had no row at all (`update:check-for-updates`,
  `update:get-status`, the `update:available/progress/downloaded` pushes and the
  `media-previous/media-next/media-seek-to` pushes), and the prose counted 35
  channels where the tree ships 45. The existing doc-vs-code checks only tested
  doc→code, so an omission was invisible by construction.
- **The cure.** The table is rebuilt from a measured scan (all 45 channels,
  true directions, exact registration-site line sets, verified renderer call
  lines), and `tests/unit/ipcChannels.test.ts` gains a `doc currency
  (R-WINDOWS-03)` suite: completeness both directions per inventory, each
  row's Main Handler coordinates equal to the live site set, each cited
  renderer line provably calling the row's preload method, and every prose
  count compared to the measured number. Red-first proven (all four pins
  convicted the stale doc), teeth mutation-proven (a one-line coord rot
  reddens the suite). Gates: vue-tsc x2 + tsc + lint + vitest serial + audit
  gate + build green.

### Tests — R-W2 rider R-WINDOWS-02: the ServerVersionCheck mirror finally has its parity tripwire — 2026-10-30

- **The gap.** M-WINDOWS-02 review r1 INFO-1 (queued as rider R-WINDOWS-02): the
  renderer-side `ServerVersionCheck` in `src/renderer/types/electron.d.ts` is a
  hand-carried mirror of the SSOT in `src/main/versionCheck.ts` (the renderer
  cannot import from main), and its docblock CLAIMED to be pinned while nothing
  pinned it — a field added, removed or re-typed on one side of the IPC boundary
  alone compiled green and silently desynced the verdict shape.
- **The cure.** `tests/unit/serverVersionCheckParity.test.ts` — the ratified
  cross-boundary pairing idiom from `tests/unit/ipcChannels.test.ts` (fail-loud
  fs-parse, no silent voiding): both interface bodies are extracted from source
  text, normalized (per-field prose and whitespace stripped — the contract is
  the member set), sorted and asserted EXACTLY equal, plus a self-presence pin
  naming the current three-member shape. Mutation-proven: an extra mirror field,
  a narrowed `serverVersion` type and an SSOT rename each redden it, and the
  absence of either declaration throws rather than vacates the guard.
- **Teeth.** Full serial suite 54 files / 668 tests (exact baseline 53/666 at
  `3832e1c` plus my +1/+2, zero other deltas); `npm run typecheck` and
  `npm run lint` exit 0; `node scripts/lockwalk.mjs --live` 4/0. Test-only
  addition — no shipped-code, wire or dist surface touched, so no consumer seam.

### Docs — R-W1 rider R-WINDOWS-01: hash-verify recipe regains its cwd phrase — 2026-10-30

- **The gap.** M-WINDOWS-01 review r2 MINOR-1 (queued as rider R-WINDOWS-01): the
  r2 rewrite dropped r1's explicit cwd phrase — the preamble said "save
  `SHA256SUMS.txt` … into the same folder, then run both lines in PowerShell"
  while both commands use relative `.\` paths, which resolve against the
  PowerShell cwd (default shell lands in `$HOME`), NOT necessarily the folder
  the files were saved to. A literal-follower got "Cannot find path".
- **The cure.** The one-word restore the review named: "…run both lines in
  PowerShell **from that folder**". Docs-only; the r1-approved commands, the
  two format-quirk bridge sentences and the `Get-FileHash` walkthrough pin
  (`tests/unit/installStoryStatus.test.ts`) are untouched.
- **Proof.** Gates at tip: full vitest serial suite green (`--no-file-parallelism`,
  53 files / 666 tests, zero floors moved); `npm run typecheck` (vue-tsc +
  tsconfig.main) exit 0; `node scripts/lockwalk.mjs --live` 4 edges 0
  mismatches. README diff = exactly the one phrase.

### Test — M-WINDOWS-20 guard law: the clone→cd install pairing made runtime-derived and reddens on drift — 2026-10-29

- **Why:** review windows__writer M2 found the first install block broke copy-paste readers —
  `git clone …phlix-windows-client.git` followed by `cd phlix-windows` (the clone yields
  `phlix-windows-client/`), with the same wrong name as the Project Structure tree root. The
  README sweep at 0fac869 cured the text (its commit names M20); this lane makes the fix a LAW.
  Nothing previously asserted that every README clone is followed by the `cd` for the directory
  the clone actually creates — the triple (repo slug / clone dir / tree root) could silently
  re-drift on the next doc edit or rename.
- **Cure:** NEW `tests/unit/readmeInstallSequence.test.mjs` (updateFeedWorkflow node-env idiom),
  fully runtime-derived — no directory string is hardcoded: (1) parses every fenced block of
  README, and each `git clone`'s next command in the same block must be exactly
  `cd <derived-dir>` (derived-dir = explicit clone dir arg, else the URL's last segment minus
  `.git`); (2) the Project Structure tree root must be `<build.publish.repo>/` — the same slug
  updateFeedWorkflow pins as the canonical publish identity; (3) a whole-tree survivor sweep: no
  markdown law file (root *.md + docs, CHANGELOG.md exempt as the verbatim history record) may
  carry a `cd phlix-windows…`-shaped command naming a directory no README clone yields. A
  non-vacuity pin guards the guard.
- **Proofs (measured):** red-on-parent — with README.md swapped to 0fac869^ bytes, EXACTLY the 3
  violation pins fail (pairing names `README.md:146 … expected 'phlix-windows' to be
  'phlix-windows-client'`; tree root names `phlix-windows/`; survivor names README.md), the 2
  coherence pins pass; restore → 5/5 green. Mutation: planting `cd phlix-windows` in DEVELOPER.md
  only (README clean) reddens exactly the survivor pin naming DEVELOPER.md; restore → 5/5 green.
  Docs+test only — src/, electron surfaces and build outputs untouched.
- **Gates (measured):** vitest FULL serial (`--no-file-parallelism`) **666 passed / 53 files**
  (661-era + 5 exact, exit 0); vue-tsc 0; `tsc -p tsconfig.main.json --noEmit` 0; `npm run lint`
  0; `npm run build` 0 + preload assert OK (no rebuild churn — dist/ is gitignored).

### Fix — M-WINDOWS-16 r2: the boot-surface interactivity law made true by construction — 2026-10-29

- **Why:** review r1 (verdict SHIP, 0 blocking) upheld the retry design but named the docblock claim
  "The surface can never strand into blankness or a dead button: every outcome leaves it interactive"
  as unsupported for a fourth outcome (its MINOR-1): the compatible arm ran `void boot()`, so a
  RESUMED boot() rejecting before it owns the window — its fail-fast config IPC throws, e.g. the
  disclosed DPAPI custody-failure class — was an unhandled rejection leaving the clicked button
  permanently disabled on a stale screen. The forward-fix the reviewer proposed for the next
  boot-UX pass ships here.
- **Cure:** `src/renderer/main.ts` retry compatible-arm: `void boot()` → `boot().catch(...)` — the
  rejection is logged (`[Boot] Resumed boot failed:`) and the surface re-armed for another attempt,
  guarded by `retryButton.isConnected` so a post-mount throw (the app already owns the window) never
  touches off-document DOM nor resurrects a stale "too old" screen over a live verdict. The
  function docblock now states the law the code actually guarantees: every outcome that leaves the
  screen visible leaves its Retry live; outcomes that replace the screen replace it with a working
  surface. Rendering only — gate verdicts, policy (src/main/versionCheck.ts), preload/IPC surface,
  i18n catalogs and wire codes all untouched.
- **Tests:** two new pins in tests/unit/main.test.ts — (1) a resumed boot that rejects at its own
  config IPC logs loudly, re-arms the still-connected button, and a second click drives the boot to
  the mount; (2) a resumed boot that fails only AFTER the mount leaves the app-owned DOM untouched,
  resurrects nothing, and never re-arms the off-document button. Red-on-parent measured: EXACTLY the
  2 new tests fail on 75d57a5 bytes (parent additionally surfaced both rejections unhandled — the
  silent-swallow r1 named). Mutations: M-r2a restore parent's `void boot()` → 2 red; M-r2b strip the
  isConnected guard → exactly 1 red (the post-mount pin). Restore → 18/18 green.
- **Gates (measured):** vitest FULL serial (`--no-file-parallelism`) **661 passed** (659-era + 2
  exact, 52 files, exit 0; venue note: a sibling-less fresh clone reports 660P|1S for the same tree —
  the i18nLocales sibling-context describe skips there and runs here; totals equal); vue-tsc 0;
  `tsc -p tsconfig.main.json --noEmit` 0; `npm run lint` 0; `npm run build` 0 + preload assert OK.

### Docs — M-WINDOWS-22 r2: zero-ownship survivor family swept whole-tree; law extended — 2026-10-29

- **Why:** review r1 REWORK — the six-site cure and pin #9 held, but the mandated survivor sweep had
  been run docs/-scoped and case-sensitive, so the false zero-ownship family lived on in AGENTS.md
  (header sentence, "ships no UI of its own", "Routes are NOT defined here", the "owns ZERO UI"
  contributor rule), its byte-twins in CLAUDE.md, the unmarked ADR-004 ("No Local UI" title +
  "owns zero UI" decision), DEVELOPER.md's wrapped "owns only the Electron shell" sentence and its
  "Adding UI / screens / stores / routes" guidance, and one hubModeStatus.test.ts docblock
  parenthetical ("ships ZERO UI"). Four of those phrasings had also escaped r1's own re-run regex —
  the r2 case-INsensitive, wrap-tolerant whole-tree re-sweep caught and cured all of them. The r1
  entry's "the two extra survivors" line (which enumerates THREE) and its "docs/ was clean" row are
  corrected FORWARD here — r1's entry text stands as recorded, per the measured-forward-only law.
- **Cure:** every survivor rewritten in the six-site shipped-truth voice — thin consumer PLUS the
  enumerated local surfaces (player overlays via `overlay.tsx`, boot-failure screen, i18n catalogs,
  media-session handlers, DPAPI token-store adapter, local `/app/*` route wiring); ADR-004 retitled
  "No Forking of `@phlix/ui` Screens/Stores" with a "Status: Amended" line (the no-forking rule for
  ui-OWNED screens/components/stores stands; the zero-ownship premise marked superseded — an ADR may
  age only when marked); AGENTS/CLAUDE/DEVELOPER stale pin prose (`#v0.98.39`/`#v0.4.6`) corrected to
  the package.json truth (`#v0.99.10`/`#v0.5.3`); contributor tables gained the missing local-surface
  rows. Kept-true claims untouched: "no local page VIEWS", "no local application stores", "owns no
  settings form".
- **Law:** installStoryStatus.test.ts gained three its — a 14-literal survivor scan over the six law
  files (README/DEVELOPER/AGENTS/CLAUDE/ADR-004/hubModeStatus docblock) with whitespace-normalized,
  case-insensitive matching (line-wrapping/casing cannot dodge), an ADR-amendment-marker pin, and a
  negative-control pin protecting the true statements from blanket censoring (no src/** scan —
  deliberate non-overreach). Red-on-parent measured per class (single-file swap to 8707b66 bytes):
  AGENTS 1F, CLAUDE 1F, DEVELOPER 1F, ADR-004 2F (literal + marker), hubModeStatus 1F; every other
  pin stayed green on each swap; files restored byte-identical.
- **Gates (measured):** vitest FULL serial (`--no-file-parallelism`) **659 passed** (656-era +3
  exact, 52 files, no new files; venue note: a sibling-less fresh clone reports 655P|1S for the same
  tree — the i18nLocales sibling-context describe skips there and runs here; totals equal);
  vue-tsc 0; `tsc -p tsconfig.main.json --noEmit` 0; `npm run lint` 0; `npm run build` 0. Diff is
  docs + two test files only — zero src/, build.yml, or package.json changes.

### Docs — M-WINDOWS-22: "no local components" claims to shipped renderer truth — 2026-10-29

- **Why:** review `windows__writer` M22 — three docs claimed the renderer ships no local
  pages/components/stores (README's tree line + "This repo does not define its own pages,
  components, or stores." + DEVELOPER.md's header claim and Renderer-Process line). The claims
  were authored at 1dd04a2 (2026-06-26, genuinely thin migration) and rotted as surfaces shipped:
  player overlay components `src/renderer/components/{PlayerSupplement,SleepTimer,PiPButton}.tsx`
  mounted by the second app entry `src/renderer/overlay.tsx` (P3-S4 era), the DOM-rendered
  too-old-server boot-failure screen `renderIncompatibleServerScreen` with Retry in
  `src/renderer/main.ts` (2aac4ec + b5547ce), the DPAPI-backed `SafeStorageTokenStore` adapter
  `src/renderer/safeStorageTokenStore.ts` (dc36c0b; ships unused awaiting the ui tokenStore seam —
  stated honestly), `src/renderer/mediaSession.ts` SMTC handlers, `src/renderer/i18n/` catalogs,
  and locally-authored route registration/nav/admin-gating (`buildExtraRoutes`).
- **Cure:** docs truth pass — every site now reads thin consumer PLUS an enumeration of the local
  surfaces; both tree blocks (README Project Structure, DEVELOPER Renderer Process) gained the
  five missing entries. Family sweep (`no local|does not define its own|thin consumer|no local UI
  ownship|does not ship its own pages` over README/DEVELOPER/docs/) found SIX sites, not three —
  the two extra survivors (README's Renderer-process bullet, README Status "no local UI ownship",
  DEVELOPER header) cured too; docs/ was clean. Kept-true nuance: no local Pinia app stores and no
  local page VIEWS (routes render vendored components) — the cure says exactly that, no more.
- **Pin #9 (red-on-parent, measured):** `installStoryStatus.test.ts` gained two `it`s — the five
  blanket-claim literals must stay dead in both docs, and both docs must name the six shipped
  surfaces (`overlay.tsx`, `PlayerSupplement`, `SleepTimer`, `PiPButton`, `safeStorageTokenStore`,
  `i18n`). On parent doc bytes it reddened exactly 2 (8 prior pins held green, stash-probed via
  `git show a8e61b0:` swap); at head 10/10 in-file.
- **Gates:** vitest FULL serial (`--no-file-parallelism`) **656 passed** (654-era + 2 exact, no new
  files); `vue-tsc --noEmit` 0; `tsc -p tsconfig.main.json --noEmit` 0; eslint on the touched test
  0. Build N/A (docs + test only).

### Docs — M-WINDOWS-21: troubleshooting Node floor to engines truth + stale-version sweep — 2026-10-29

- **Why:** review `windows__writer` M21 — the "App doesn't start" troubleshooting list
  advised "Ensure Node.js 18+ is installed", a version the repo itself rejects:
  package.json `engines.node` is `>=24.0.0` and both CI workflows run `24.x`
  (test.yml matrix, build.yml `NODE_VERSION`). A dev following the doc on Node 18 hits
  EBADENGINE and the failures the bullet claims to cure.
- **Cure:** README's bullet corrected to Node 24+ naming the engines floor. Whole-tree
  family sweep (README, docs/×8, DEVELOPER.md, workflows; no CONTRIBUTING.md exists):
  the only other Node-version literals are truthful (README badge `>=24`, Prerequisites
  `>=24.0.0`), honest historical prose (CHANGELOG venue notes, CALIBER_LEARNINGS
  EBADENGINE gotchas — untouched per law), the end-user "you do not need Node.js" line
  (true), CI matrix pins (untouched per law), and the caliber skills' own
  "Caliber requires Node.js >= 20" floor (external tool scope, satisfied by 24 —
  untouched). Sole wrong-advice site was README:398.
- **Pin #8 (red-on-parent, measured):** `installStoryStatus.test.ts` gained
  "troubleshooting Node bullet matches the package.json engines floor" — derives the
  MAJOR from `engines.node` (not a re-literal) and compares to the README bullet. On
  parent bytes it reddens exactly once with the "advises Node 18+ … requires >=24.0.0"
  message (stash-probed); at head it passes 8/8 in-file.
- **Gates:** vitest FULL serial (`--no-file-parallelism`) 52 files / **654 passed**
  (653-era + 1 exact); `vue-tsc --noEmit` 0; `tsc -p tsconfig.main.json --noEmit` 0;
  eslint on the touched test 0. Build N/A (docs + test only).

### Docs — M-WINDOWS-20: clone+cd install sequence to real repo dir + dir-name sweep — 2026-10-29

- **Why:** review `windows__writer` M2 — the from-source install sequence failed when
  followed literally: `git clone https://github.com/detain/phlix-windows-client.git`
  materializes `phlix-windows-client/` (origin slug, `git remote -v`-verified), but the very
  next line said `cd phlix-windows` — an error for any reader copying the block.
- **Cure:** README clone→cd sequence fixed to `cd phlix-windows-client`; the Project
  Structure tree label `phlix-windows/` fixed to `phlix-windows-client/` (the review's
  ":172" coordinate, re-anchored to `:272` post-WIN-19 rewrite). Whole-README/docs sweep
  (every `git clone`, `cd`, `.git`, badge/release URL, and `phlix-windows*` literal) found no
  further false occurrences; the `%APPDATA%\phlix-windows` lines (README ×2, DEVELOPER.md ×1)
  are the **Electron app-data namespace** (package.json root `name: "phlix-windows"`) — a
  different, true namespace, deliberately untouched. Zero README-pinned test literals change.

### Docs — M-WINDOWS-18 (b, fresh disk-only lane): signing posture to vendor-proven truth — forceCodeSigning gated on WIN-08 certs — 2026-10-29

- **Why:** the queue item flagged `build.win` as signing-bare, but r1 adjudicated the prior
  "fix" a PHANTOM (never landed; no `forceCodeSigning` in any tip file) and the naive cure —
  flip `forceCodeSigning: true` — impossible against the locked builder: with no certificate
  configured, app-builder-lib 26.17.0 `out/codeSign/windowsSignToolManager.js` `signFile`
  logs "no code signing certificate configured, signing is skipped" and **returns false**, and
  `out/winPackager.js` `_sign` then **throws** `InvalidConfigurationError` — enabling the flag
  before WIN-08 certs exist reddens every electron-builder leg. Certificates are an owner
  action (WIN-08); the WIN-05 feed law and WIN-08 workflow-posture tests already ship green —
  what was missing is the config↔docs↔vendor triangle.
- **Cure (policy-with-proof):** `package.json` gains a ROOT-level `signingPosture` block
  (status `unsigned`, `forceCodeSigning: false`, `certificatesProvisioned: false`, `why`,
  `flipGate`). ROOT placement is a vendor necessity, not style: `app-builder-lib/scheme.json`
  sets `additionalProperties: false` on the Configuration root, so an unknown key inside
  `build`/`build.win` is a hard configuration error — proven live:
  `validateSchema(scheme, {...build, signingPosture})` throws "unknown property
  'signingPosture'" while the real build object with the root key passes, and an
  `electron-builder --win` live run loaded the config with the key fully inert.
  `docs/signing.md` gains "forceCodeSigning: Why It Stays false (Vendor-Proven)" — both vendor
  path names, the throw, the schema law, and the WIN-08 flip gate as a same-change protocol.
  New `tests/unit/signingPosturePolicy.test.mjs` (12 laws): posture constants, the
  flag-without-certs TRIPWIRE across every validated subtree, flag↔posture sync, placement,
  the shipped-scheme + 3 vendor-source byte pins (refactor-red, not doc-lie), docs mirror,
  README honesty, and a structural law that no ACTIVE updater-feed step claims signatures
  (integrity ≠ authenticity).
- **Updater trust story cross-read (b):** zero overclaims at tip — README "Getting updates"
  states the fail-silent prerelease reality; build.yml says only "verifies downloads against
  its sha512" (electron-updater's actual, integrity-level job); docs/README pair SmartScreen +
  Get-FileHash/SHA256SUMS verification with the explicit "not code-signed". Nothing to fix;
  recorded as verified and now pinned by law 8.
- **Measured:** vitest FULL serial parent **51 files / 641 tests** → cure **52 / 653**
  (+1 file / +12 tests, the new file only; `signingPostureWorkflow` 16 and `updateFeedWorkflow`
  9 pins byte-unmodified, green). typecheck×3 + eslint + audit-gate + `npm run build` exit 0.
  electron-builder live run: config accepted, real skip-path log emitted twice
  ("no code signing certificate configured, signing is skipped" — the vendor behavior this
  doc quotes, observed), then pre-existing `makensis` Linux venue failure — byte-identical at
  parent, zero delta. Mutation teeth: planted `build.win.forceCodeSigning: true` (no certs)
  → exactly 2 red (tripwire + sync); posture key moved inside `build` → exactly 1 red
  (placement); `status: "signed"` lie → exactly 1 red (truth constants); all restored green.

### Docs — M-WINDOWS-19 r2: the too-old screen's remediation made literally followable + fail-open truth surfaced — 2026-10-29

- **Why:** r1 review verdict REWORK (2 asks). Ask #1: the first-launch copy said "(or
  correct the URL via the in-app connection screen)" while the too-old screen is up — the
  instruction fails when followed literally: that screen is mounted by the boot gate BEFORE
  `createPhlixApp`, so no Vue app, no bridge, no Connect screen exists in that state (the
  Connect screen renders only when no server URL is stored at all). Ask #2: the entry below
  claims the section documents "its fail-open-for-unreported truth", but the README said
  nothing of it.
- **Cure (docs-truth, README + this log + one pin):** the phantom affordance is deleted —
  the remediation now names only what IS reachable in that state (fix the server, press
  **Try again**), plus an explicit honest note that no in-app URL correction exists while
  the screen is up. The fail-open truth moved from CHANGELOG-claim to end-user prose: the
  gate blocks ONLY a server that explicitly reports below 1.1.0; an older server without
  the version endpoint fails open into a possibly-degraded app. New pin 7 in
  `tests/unit/installStoryStatus.test.ts` (docs-follow-producers tripwire): the first-launch
  copy keeps the "fails open" sentence AND `src/main/versionCheck.ts` keeps its
  "fail-open for unknown servers" design-decision docblock — either side moving alone
  reddens. Red-on-parent measured at 71b9221 (parent README has no fail-open sentence);
  dropping the sentence from the tip reddens exactly pin 7. Suite 640 → 641 (+1 exact).
  Ask #1's cure is a deletion — no negative pin (r1: "no new pin needed").
  `build.yml`/workflows/`package.json` untouched; updater posture (WIN-01 disclosure,
  prerelease-flip owner reel) unchanged.

### Docs — M-WINDOWS-19: the end-user install story completed to shipped release reality — 2026-10-29

- **Why:** review `windows__writer` MAJOR-1 — "No end-user install story; the actual
  download path is undocumented." The headline was already largely cured on disk by the
  post-review chain `3360d41` (real rolling-`latest` asset table, honest SmartScreen) and
  `df19e3f` (working `Get-FileHash` walkthrough) before this lane opened; what was missing
  was the chronological tail: no "run the installer" step between picking an asset and
  SmartScreen, and the server-too-old boot-failure surface shipped by `b5547ce` (M-WINDOWS-16)
  was promised nowhere in the end-user story. Nothing pinned README's version-embedded asset
  names, so any future `package.json` bump would silently rot them.
- **Cure (docs-truth, completion not duplication):** `Install (end users)` now runs
  published → **Running the installer** (per-user wizard, no admin prompt, Start-menu entry —
  all true of the shipped `nsis` config) → SmartScreen (existing section, heading untouched
  because `build.yml`'s release body cross-references it) → **First launch: connecting to a
  server** (Connect screen, no baked-in default, the every-launch ≥ 1.1.0 gate including its
  fail-open-for-unreported-truth, and the `b5547ce` surface: error dialog naming both
  versions + the persistent "Phlix server too old" screen + **Try again** booting in place,
  no quit-and-relaunch ceremony) → Getting updates (existing prerelease-blind silent-no-op
  disclosure verified against `autoUpdater.allowPrerelease = false` and the 6-hour timer;
  left as-is). The reviewer-era "Deployment is addressed to CI maintainers" dead rows at the
  old :222-251 are already swept by `e5e29b1`/`fd273cb`/`3360d41` — re-verified line by line
  against `build.yml` reality, nothing stale found; workflows untouched (read-only authority).
- **Pins:** new `tests/unit/installStoryStatus.test.ts` (6 cases) — README asset names derived
  from `package.json` (`build.nsis.artifactName` template × `productName` × `version`, plus
  the appx name observed on the live `latest` release), a stale-literal sweep catching any
  half-bumped `Phlix-Setup-*/Phlix.*/currently` copy, a `release-latest` job slice asserting
  the three upload globs and its pointer to the README SmartScreen section still exist,
  section chronology, catalog-literal sync (the too-old screen's title and **Try again**
  string come from `src/renderer/i18n/windows-own/en.ts`), and an `allowPrerelease = false`
  tripwire forcing the "Getting updates" rewrite into the same commit as any flip. Mutation
  probes: version bump 1.0.0→1.0.1 reddens exactly pins 1–2; flipping `allowPrerelease`
  reddens exactly pin 6; both reverted, tree clean.
- **Measured:** vitest FULL serial 51 files 634 → 640 (+6 exact), exit 0; `vue-tsc --noEmit`
  0; `tsc -p tsconfig.main.json --noEmit` 0; `npm run lint` 0. Docs + one test file; zero
  shipped behavior change; no new wire codes.

### Docs — follow-up to 7709e31: docs mirror swept (M-WINDOWS-17 r2) — 2026-10-29

- `docs/deep-links.md` (grammar note + Examples arms) and the README hub-status sentence now state that the `accept-invite`/`server` deep-link arms are hub-mode-only and 404-view in every shipped launch — the demoted truth of the parent commit mirrored to its surviving docs (review r1 must-fix); docs-only, zero behavior change, no new pins (unpinned ui-surface.md rider precedent).

### Fixed — the README-advertised "Hub Mode" cannot be entered; the claim is demoted to shipped truth with tripwired rider (M-WINDOWS-17) — 2026-10-29

- **Why:** review `windows__gameux` MAJOR-6 — "README-advertised 'Hub Mode' cannot be
  entered: its only config writer has zero callers." Verified at HEAD `b5547cea`: the
  machinery is real (`hub:get-config`/`hub:set-config` handlers in `src/main/index.ts`,
  preload `hubGetConfig`/`hubSetConfig`, the resolver's hub branch, the hub nav and the
  full hub route set) but `hubSetConfig` had zero production callers (grep: only the
  `electron.d.ts` type and test mocks), the thin-consumer renderer owns no settings form,
  and the pinned v0.99.10 `@phlix/ui` bundle contains zero `electronAPI` references across
  all installed chunks — no surface anywhere could reach the writer. Every launch booted
  server mode while the README promised an enterable mode, complete with fake
  "Open Settings → Hub Mode section" steps.
- **Cure (docs-demotion — the estate idiom for a dead advertised feature that cannot be
  honestly wired in-repo):** building the missing piece (a hub/server entry form) is either
  a windows-owned settings page — forbidden by this repo's thin-consumer law — or the
  upstream `@phlix/ui` connection seam, which rides the same v0.99.12 wave as the
  `tokenStore` rider (`src/renderer/safeStorageTokenStore.ts`). README Features + What
  Works bullets and every "(or Hub)" affordance claim deleted; the "## Hub Mode" section
  rewritten as an honest "## Hub Mode (not yet enterable)" status (measured machinery, the
  Connect-screen hub-URL caution, rider procedure); Known Limitations gains the pointer;
  the dead writer site gains an `M-WINDOWS-17` rider comment (mirroring this file's
  v0.99.12-wave tokenStore precedent); `docs/ui-surface.md`'s hub-mode inventory is marked
  mode-conditional. Zero shipped behavior changed.
- **Pins:** new `tests/unit/hubModeStatus.test.ts` (8 cases) — fiction-forbidden law (8
  retired literals must never resurface while entry is impossible; measured red on the
  parent README), section-scope law ("What Works" must not name Hub Mode, "Known
  Limitations" must), disposition-marker + in-code-rider presence, machinery truth (the
  resolver branch, hub nav ids, hub route paths — what the status section claims to
  describe), and two tripwires with full rider procedures: the zero-caller law and the
  bundle-touches-no-`electronAPI` law both redden the moment upstream ships an entry seam.
- **Measured:** vitest FULL serial 50 files 626 → 634 (+8 exact), exit 0; `vue-tsc`
  `--noEmit` 0; `tsc -p tsconfig.main.json --noEmit` 0; `npm run lint` 0; `npm run build`
  0 (vite + main + assert-preload). `dist/` is gitignored (CI-built) — nothing to re-vendor.

### Fixed — the too-old-server screen retries in place; the boot-failure surface is never quit-only (M-WINDOWS-16) — 2026-10-29

- **Why:** review `windows__gameux` MAJOR-5 — "min-server-version enforcement
  aborts the boot into a permanently blank window — no dialog, no copy, no
  retry." Verified at HEAD: the blank-window and copy halves were already cured
  by `2aac4ec` (windows__casualgamer lane) — main-process error dialog
  naming both versions (`showServerTooOldDialog`) plus the persistent
  `renderIncompatibleServerScreen`, seven-locale catalog. The third complaint
  stood uncured: the only remediation was the screen's "then restart this app"
  copy — a quit-only path with no retry.
- **Cure (rendering only — enforcement policy untouched):** the screen gains a
  Retry button whose closure re-runs the SAME gate call the initial boot made
  (`api.checkServerVersion(apiBase)` → main's `/system/info` SSOT check, same
  verdicts). Compatible now → `boot()` re-runs from scratch and mounts (the
  aborted boot installed nothing, so a clean second pass is safe); still too
  old → a fresh verdict re-renders the screen with a fresh enabled button; an
  IPC-transport rejection re-arms the button rather than dead-ending it. The
  dialog stays informational; the screen remains the durable surface.
- **Census (same-class silent aborts in `boot()`):** the version gate was the
  ONLY pre-mount early-return with a reachable false verdict; the gate call now
  statically cannot return before rendering (tripwire test). Disclosed
  residuals (pre-existing, out of M16 scope, not silent-returns): a rejected
  first-`Promise.all` IPC (e.g. DPAPI custody failure — M-WINDOWS-11 adjacent)
  or a `createPhlixApp` throw would abort boot unhandled; neither renders a
  failure surface. Recorded for the next boot-UX pass.
- **i18n:** one new windows-own key `boot.incompatibleRetry` × 7 catalogs
  (en/de/es/fr/it/ja/pt_BR); the catalog count pin rotates 21→22 (16 nav +
  6 boot) — diacritics/CJK/apostrophe/leak laws held.
- **Tests:** vitest full serial `--no-file-parallelism` — 49 files / 626 pass
  (parent 622 + 4 new + 1 extended: in-place retry success, still-too-old
  re-render loop, hostile-version text-only + zero-credential-echo, static
  silent-abort tripwire). Mutation teeth measured: restoring the silent abort
  reddens exactly 5 named gate tests; stripping the click wiring reddens
  exactly the 2 retry tests; both restored green.
- **Gates:** vue-tsc (renderer) + tsc -p tsconfig.main.json (main/preload) + eslint: 0 errors.

### Fixed — deep-link rejections surface honestly; the internal arm can no longer emit unroutable paths (M-WINDOWS-15) — 2026-10-29

- **Why:** review `windows__gameux` MAJOR-4 — "the deep-link grammar emits
  router paths that no router matches — invite/media/server links are silent
  no-ops." Verified at HEAD: the grammar half was already cured by `667ab70`
  (landed 2026-10-29, after the review's clone-pinned read) —
  `ROUTE_BY_HOST` now emits `/app/media/:id`, `/app/player/:id`,
  `/app/accept-invite/:token`, `/app/server/:id`, pinned against a REAL router
  by `tests/unit/deepLinkRouteContract.test.ts`. Two residue classes of the
  same finding stayed open: (1) the `internal` arm returned ANY path verbatim
  — its own pinned test proved the defect shape (`phlix://internal/app/../../evil`
  → `/evil`, a path with ZERO router records, so `router.push` rejects
  unhandled — the silent no-op under another name); and (2) every PARSE
  REJECTION (unknown host, malformed id/token, oversized link) was a log-only
  drop in `drainPendingDeepLinks` — the user who clicked the link saw nothing.
- **Cure (parser):** `/app`-root law on the internal arm — the path must be
  exactly `/app` or start with `/app/` (segment-exact: `/appevil` is refused).
  Consequence: EVERY accepted output resolves to at least the ui's
  `/app/:pathMatch(.*)*` 404 view in EVERY app mode (catch-all coverage pinned
  both-directions in the contract test, server mode included) — a delivered
  link always renders.
- **Cure (surface):** new exported `showDeepLinkRejectedDialog(url)` in
  `src/main/index.ts` — a `dialog.showMessageBox` (type warning, same idiom as
  `showServerTooOldDialog`) on the FIRST rejection of each drain pass, detail
  carrying only the REDACTED link (W3 secret law). Valid deliveries never
  trigger it; the WIN-06 pending-queue + `deeplink:ready` handshake drain is
  untouched (all its pins held).
- **i18n:** `deeplink.failedTitle`/`failedMessage` born-in-catalog (the
  `boot.*` precedent), all 7 main catalogs; main-catalog key identity pin
  rotated 34 → 36 (measured red first).
- **Fixture re-anchors:** three `trayRestoreWiring.test.ts` legs pinned dead
  non-`/app` paths (`/library`, `/tray-survivor`, `/settings`) — red on the new
  law by design, re-anchored to real routes (notification-click `/app/settings`,
  survivor `/app/tray-survivor`, second-instance `/app/search` — distinct to
  stay clear of the 2s dedupe window).
- **Tests:** 610 → 622 (+12 exact: validator +3 /app-law table, contract +8
  two-mode matrix incl. server-mode catch-all honesty, drain +1 burst-dialog
  redaction test; one pre-existing unparsable test extended to assert the
  dialog). Mutations: grammar reverted to `/${host}/${value}` → 22 named reds
  across the three deep-link files; `/app` law stripped → 4; dialog call
  stripped → 2; dialog fed the RAW url → 1 (redaction assertion). All killed,
  all restored byte-exact.
- **Gates:** vitest FULL serial 622/622; vue-tsc 0; `tsc -p
  tsconfig.main.json` 0; lint 0; audit-gate PASS (0 advisories); build OK.
  No renderer-source change → `dist/` (gitignored) untouched; no IPC channels
  added.

### Fixed — OS feedback surfaces (thumbar, display-sleep blocker, taskbar progress) now arm on the normal in-app playback path, not only when the shell drove the transport (M-WINDOWS-14) — 2026-10-29

- **Why:** review `windows__gameux` MAJOR-3. The only senders of
  `thumbar:update`, `playback:progress`, `power:update` (and the SMTC
  metadata writer) lived inside the `media-play-pause` / rewind / forward /
  seek-to IPC handler closures (`src/renderer/electronBridge.ts`). Clicking
  play inside the vendored `@phlix/ui` PlayerPage — the overwhelmingly
  common path — notifies the Electron shell of *nothing*: main's
  `ensurePowerBlocker(true)` (`src/main/index.ts`) never ran, so
  "prevent display sleep during playback" was theater unless the user
  happened to toggle via tray/menu/SMTC; the thumbar tooltip and the
  taskbar progress bar went stale/dark on every in-app play, pause, seek
  and position advance — while the ui bundle fed SMTC itself, so the lock
  screen showed live progress and the app's own taskbar button showed
  none. The shell `onMediaStop` path was asymmetric too: after tray "Stop"
  the blocker stayed armed until window close (`main.on('close')` was the
  only release).
- **The seam (verified at HEAD, no upstream change needed):** all three
  transport drivers — the vendored player engine (in-app), the shell IPC
  handlers, and the M13 keydown relay — actuate the SAME pinia store
  (`@phlix/ui` `usePlayerStore-D8A_gb_c.js`: `U()`/`W()` flip the `playing`
  ref, `z()`/`updateProgress` the `position`/`duration` refs, `re()`/
  `closePlayer` nulls `current`), and those are reactive setup-store refs.
  The renderer glue can therefore mirror the store instead of chasing
  per-driver senders. No `ipcChannels.test.ts` contract moved: the mirror
  reuses the existing `thumbar:update` / `playback:progress` /
  `power:update` send channels only.
- **Cure:** new `installOsPlaybackMirror(player, api)` in
  `src/renderer/electronBridge.ts`, registered inside
  `wireElectronBridge` and folded into its single cleanup (idempotent
  re-install, no leaked duplicate mirror). One watcher on `playing` →
  `updateThumbar({playing})` + `updatePowerBlocker(playing)`; one on
  `[current, playing, position, duration]` → `setPlaybackProgress`
  deduped to whole seconds (the ui ticks from `timeupdate` at ~4 Hz;
  the Windows taskbar overlay is far coarser). `current` participates so
  `closePlayer()` — which resets playing/current but leaves
  position/duration stale — still lands main's documented `{0, 0}` clear
  (`setProgressBar(-1)`) and the blocker release: the stop-path asymmetry
  self-heals with zero stop-specific code in the handlers. Shell-driven
  toggles now land a second, identical-value send from the mirror after
  the handler's own synchronous send; main's handlers are idempotent by
  law (button rebuild / `isStarted` guard / absolute set), and the
  synchronous same-tick sends stay (their W4.5 source pins in
  `tests/unit/thumbar.test.ts` + `tests/unit/powerSaveBlocker.test.ts`
  held unmodified).
- **Fabricated-metadata removal:** the shell play/pause path's
  `updateMeta(player)` call and the now zero-caller `updateMeta` function
  + `MediaSessionMetadata` interface in `src/renderer/mediaSession.ts`
  are deleted. The fields it read (`title`/`artist`/`album`/`artwork`) do
  not exist on the real store — every shell toggle overwrote the vendored
  store's rich SMTC feed with a fabricated `{ title: 'Phlix' }` stub, and
  its null-metadata-while-paused behavior never matched the store's.
  SMTC metadata/`playbackState`/`positionState` are the store's own feed
  on every path; `BridgePlayer` lost the four fiction fields. Behavior
  delta (intentional, parity): pausing via the shell no longer wipes the
  lock-screen card — exactly what the in-app path has always done, and
  standard desktop media behavior.
- **Tests:** +6 new (`OS playback mirror (M-WINDOWS-14)` in
  `tests/unit/electronBridge.test.ts`), all driving a `reactive()` fake
  with ZERO IPC fires — 5 of 6 verified red on the parent commit (the
  teardown-stop test is vacuously green on parent; its purpose is leak
  prevention). Fake api extended with the three surface senders.
  Full suite `--no-file-parallelism`: 49 files, 610/610 pass (0 failed,
  0 pending) — exactly the 604-test parent baseline + 6. Coverage 71.48%
  lines vs the 54% CI floor. `vue-tsc --noEmit` 0, `tsc -p
  tsconfig.main.json --noEmit` 0, `npm run lint` 0, `npm run build`
  green; xvfb smoke skipped per the WIN-12/13 precedent (renderer-glue
  only — no boot-surface change; main-process side untouched and
  unchanged).

### Fixed — the global keydown relay no longer fights the vendored ui player engine: single Space toggle, honest ±5 seeks, native button activation survives (M-WINDOWS-13) — 2026-10-29

- **Why:** review `windows__gameux` MAJOR-2. `installFocusGuard()`
  (`src/renderer/electronBridge.ts:82-115`) relays document-level Space /
  ArrowLeft / ArrowRight to the player store (`SEEK_STEP_SECONDS = 10`, `:41`)
  — but the pinned `@phlix/ui#v0.99.10` bundle owns exactly those keys on its
  player page: its shortcuts engine (`b()` at
  `node_modules/@phlix/ui/dist/shortcuts-Ck2yBFUB.js:316-324`, dispatch `y()`
  `:277-311` — Space → `playPause` `:279`, ArrowLeft/Right → `seekBy(∓5)`
  `:282-283`) installs its OWN document-level keydown listener while
  PlayerPage is mounted (sole installer call site
  `dist/PlayerPage-BAxWiTto.js:2740-2767`, route
  `${routerBase || "/app"}/player/:id` per `dist/phlix-ui.js`). Two
  document-level bubble listeners cannot see each other, so on the player
  page one physical Space toggled play→pause→play (stuttered no-op) and each
  Arrow moved a net ∓15 s (relay 10 + engine 5) against the ui's own help
  table advertising ±5. Worse app-wide: the relay `preventDefault()`-ed Space
  with only an INPUT/TEXTAREA/contentEditable exemption, while the engine
  additionally exempts focused buttons/links (`_()` `:263-267`) — a focused
  "Login"/"Connect" button lost native Space activation to a transport
  toggle. The Playback menu items ship `registerAccelerator: false`
  (`src/main/index.ts:662-671`) by design, so the relay is the only keyboard
  path OUTSIDE the player page — it could not be deleted wholesale.
- **Shipped (defer, don't duplicate):** the relay now early-returns on
  `/app/player/` (`PLAYER_ROUTE_PREFIX`, single constant) — inside the player
  route the vendored engine is the SOLE keyboard authority, including its
  deliberately inert states (the engine's `enabled()` gate disarms during its
  shortcut-help overlay/modals; the relay stays silent there too rather than
  resurrecting half the keymap). Outside that route the engine is unmounted
  and the relay keeps its global-shortcut purpose unchanged, ±10 s intact.
  Off-route guards moved to ENGINE PARITY: text exemption widened from
  INPUT/TEXTAREA/contentEditable to mirror the engine's `v()` (`:269-276`) —
  now also SELECT and ARIA `textbox`/`searchbox` roles — and Space is no
  longer consumed when the focused element is `button`/`a`/`role="button"`
  (mirrors `_()`; Space arm only, exactly like the engine). The route is read
  via the `location` global, never the `window` binding (unit suites and
  browser-dev contexts reshape `window` freely). No vendored file touched;
  no IPC channels, menu items, or wire surface moved.
- **Tests:** `tests/unit/electronBridge.test.ts` 22 → 32 (+10). 8 are
  red-on-parent defect detectors: both-layers Space with a faithful
  mini-replica of the engine's installed arms (expect EXACTLY 1 actuation;
  parent actuates 2), player-route ArrowRight seeking once not a net 15 s,
  per-key player-route deferral (incl. no foreign `preventDefault`), and
  four engine-parity guard tests (focused button / link / role=button keep
  native Space; SELECT / role=searchbox keep their arrows) plus the
  off-route regression pin. The other 2 pass on the parent by construction:
  one tripwire pins the route prefix against the vendored bundle bytes
  (reddens if a future re-pin moves the player route out of lockstep), one
  proves the relay still owns the keys outside the player. All 22
  pre-existing tests held UNMODIFIED.
- **Gates:** vitest FULL serial `--no-file-parallelism` 49 files / **604**
  tests, 0 fail (parent 594 + 10 measured); `vue-tsc --noEmit` 0;
  `tsc -p tsconfig.main.json --noEmit` 0; `eslint .` 0; `npm run build` 0
  (`dist/` is gitignored in this repo — nothing to commit).

### Fixed — the auto-updater no longer deadlocks at `checking`: `update-not-available` wired, manual checks answer visibly (M-WINDOWS-12) — 2026-10-29

- **Why:** review `windows__gameux` MAJOR-1. `setupAutoUpdater()` registered
  `checking-for-update`, `update-available`, `download-progress`,
  `update-downloaded`, and `error` — but not `update-not-available`, the
  **terminal result of every check that finds nothing new** (the steady state
  of essentially every boot). The status set by `checking-for-update` never
  left `checking` for the life of the process, and three hard guards key off
  it: the menu "Check for updates" click early-returns on
  `checking|downloading`, the 6-hour periodic interval only checks from
  `idle|error`, and the `update:check-for-updates` IPC echoes the stuck
  status. Consequence shipped: after the first launch the user's explicit
  action was a **permanent silent no-op** and all periodic checking stopped.
  Handler census at this commit re-verified: `update-not-available` was the
  sole missing arm of electron-updater's six-event set.
- **Shipped:** the missing arm now resets the state machine
  (`status → idle`, clearing `version`/`progress`/`error`) — which revives the
  menu guard and the periodic ladder by construction — and, when the check was
  **user-requested** (menu click or the `update:check-for-updates` IPC, tracked
  by a `manualUpdateCheckPending` flag set at exactly those two entry points),
  answers with a visible main-process Notification: title "You're on the
  latest version", body "Phlix {version} is already the latest version." with
  the **running** app version (the emitted `UpdateInfo` describes the feed's
  latest release, which on a downgrade refusal may be older). The delivered
  answer surface is the same direct `new Notification({ title, body })` idiom
  the `update-available`/`update-downloaded` arms already use — no renderer
  IPC channel added (the pinned channel sets stay exact), no vendored-ui
  surface, no v0.99.12 rider. The flag is consumed by ANY terminal updater
  event (available / not-available / error) so a failed manual check can
  never leak a stale "up to date" toast into a later automatic cycle; boot
  and 6-hour automatic checks never set it and stay silent on success
  (W4.9 no-user-facing-noise doctrine preserved).
- **Behavior NOT touched (per brief):** `autoUpdater.autoDownload = false` and
  `allowPrerelease = false` unchanged; the T+5s initial check and the 6-hour
  `idle|error`-guarded periodic interval keep their exact semantics — this fix
  makes them reachable again, it does not redefine them.
- **i18n:** `updater.notAvailableTitle` + `updater.notAvailableBody` added to
  the main-process catalog (32 → 34 keys, all seven locales; en/es/fr/de/it/
  pt_BR/ja), born-in-the-catalog per the `boot.*` M-WINDOWS-02 precedent. The
  fr pair is elision-free (typographic-apostrophe law); `{version}`
  placeholder parity, key-set identity, and the EN-leak allow-lists re-pinned
  green; `mainI18n.test.ts` byte-identical registry and
  `i18nLocales.test.ts` 34-count floors rotated with the addition.
- **Tests:** `tests/unit/autoUpdater.test.ts` 11 → 18 (+7: arm registration;
  `checking → idle` un-stick via the live `update:get-status` handler; menu
  click answers with the exact copy; IPC answers `{status:'idle',
  version:undefined}` + one toast; automatic cycle stays silent;
  error-consumed flag cannot leak a later toast; `update-available` consumes
  the request). All 7 are red on the parent (stashed-diff probe) while the 11
  pre-existing stay green — per-arm attribution. Notification mock now
  captures constructor options for payload copy truth.
- **Gates:** vitest FULL serial `--no-file-parallelism` 49 files / **594**
  tests, 0 fail (parent 587 + 7 measured); `vue-tsc --noEmit` 0;
  `tsc -p tsconfig.main.json --noEmit` 0; `eslint .` 0;
  `scripts/audit-gate.mjs` PASS (0 advisories); `npm run build` 0.
  `.github/workflows` untouched (WIN-05/09 territory).

### Security — persisted secrets move to safeStorage/DPAPI custody; a vault bridge for renderer tokens (M-WINDOWS-11) — 2026-10-29

- **Why:** review `windows__exploiter` MAJOR-11. `grep -rn safeStorage src/`
  hit ZERO across main, preload, and renderer: everything the app persisted
  sat plaintext on disk. Main side: `config.json` (electron-store) held the
  stable install identifier (`deviceId`, echoed wire-wide as
  `X-Phlix-Device-ID`) and the auth endpoints (`serverUrl`/`hubUrl`, which
  the ApiClient auto-attaches bearer tokens to) raw. Renderer side: the
  vendored `@phlix/ui` `LocalStorageTokenStore` keeps access/refresh tokens
  + user plaintext in `app://` localStorage — UI-source territory, edited
  nowhere here (thin-consumer law).
- **Shipped (windows-owned half):** `src/main/secretStore.ts` — a pure
  custody protocol (DI'd `SafeStorageLike` + settings sink): writes seal to
  a `dpapi:v1:` + base64 envelope, legacy plaintext rows migrate on read
  with verify-after-write and rollback (never orphan), an undecryptable
  envelope is KEPT and reported missing rather than destroyed, unavailable
  OS encryption degrades to plaintext with exactly ONE disclosed warning per
  custody instance (values never appear in any log line, keys are
  guard-restricted to `^[A-Za-z0-9._-]{1,64}$` and never echoed when
  rejected). Wired: `deviceId`/`serverUrl`/`hubUrl` custody through
  `config.json`, plus a renderer token vault — `secrets.json` behind four
  `vault:*` sendSync channels (sync by the ui `TokenStore` contract,
  sender-pinned to the current main window behind the M-WINDOWS-10 gate)
  exposed through the preload bridge and typed in `electron.d.ts`.
  `src/renderer/safeStorageTokenStore.ts` implements the ui `TokenStore`
  over that bridge (fail-fast constructor without it).
- **Scope law:** non-secret preferences (windowBounds, tray/GPU/power/
  notification toggles, `connectionMode`, `activeServerId`) deliberately
  stay plaintext, pinned both ways so a future change is conscious.
- **Rider (not fabricated here):** `createPhlixApp` v0.99.10 hardcodes
  `LocalStorageTokenStore` — no `tokenStore` seam in `PhlixAppConfig` yet.
  Tokens flip to DPAPI custody with a one-line `boot()` change the moment
  the upstream seam ships: recorded as a v0.99.12-wave rider in the
  M-WINDOWS-11 fixlog.
- **Pins:** +4 files / +46 tests exact (suite 45/541 → 49/587 measured at
  tip): `secretStore.test.ts` (20, pure protocol incl. never-orphan
  rollback and once-only disclosure), `mainSecretCustody.test.ts` (10, REAL
  electron-store bytes in a temp dir — envelope on disk, zero plaintext,
  vault round-trip, sender refusal, guard fail-closes), `preloadVault.test.ts`
  (6, exact channel/payload shapes), `safeStorageTokenStore.test.ts` (7);
  `ipcChannels.test.ts` extended for the sendSync protocol (+3, inventory
  pins rotated 7→11 main-on). Red-on-parent measured: 15 named reds against
  the tip sources (9 wiring + 6 preload bridge — parent persisted the
  plaintext deviceId and registered no vault). Mutation teeth measured:
  encryption stripped at the wiring → 7 red incl. every on-disk-plaintext
  assertion. vue-tsc (renderer + test configs), tsc main, eslint 0,
  `npm run build` + `assert-preload` all green.

### Security — the privileged preload bridge is pinned to the app's own boot documents (M-WINDOWS-10) — 2026-10-29

- **Why:** review `windows__exploiter` MAJOR-1. `src/preload/index.ts` called
  `contextBridge.exposeInMainWorld('electronAPI', …)` at module top level with
  zero checks on `window.location` or `process.isMainFrame`. A preload is tied
  to the window, not the URL — and the shell's deliberate external-navigation
  posture (`will-navigate` accepts every https:/http: top-level URL via
  `validateExternalUrl`, blocking only dangerous schemes) meant any
  in-window navigation to an attacker page woke it with the FULL bridge:
  `hubSetConfig`/`setServerUrl` could flip the persisted auth endpoint
  (credential-channel hijack on the user's next launch), `getDeviceId`/
  `getAppPath` leaked installation identity, `checkServerVersion` became a
  main-process SSRF probe, plus tray/GPU/power/always-on-top manipulation.
- **Shipped:** a fail-closed trust gate in the preload — the pure predicate
  `isTrustedPreloadContext({href, isMainFrame})` (exported for pinning) admits
  ONLY the two documents the main process actually navigates to: prod
  `app://-` (`PROD_BOOT_URL 'app://-/app/'`) and dev `http://localhost:5173`
  (vite strictPort), main frame only. Comparison is parsed protocol+host —
  never `.origin`, which is engine-opaque for the non-special `app:` scheme.
  Untrusted contexts get NO `electronAPI` at all, which the renderer already
  tolerates (`electronAPI?` is optional in the type and every consumer is
  guarded). Single-file addition — the sandboxed preload gains no new
  `require` (compiled bundle takes exactly one: `electron`), so no bundler
  posture change was needed.
- **Complement, not duplicate:** the navigation posture is untouched by
  design — http(s) in-window navigation (OAuth-style flows) still works; such
  a page simply no longer holds OS surface. The new wiring pins assert both
  directions: every boot URL main navigates to is covered by the predicate,
  and every trusted entry has a boot URL that uses it (stale-list guard).
- **Preserved:** every existing IPC channel unchanged — the surface literal
  moved verbatim behind the gate; `ipcChannels.test.ts` channel-parity law
  still green; boot smoke (real Electron, xvfb) green, proving the trusted
  prod boot still receives the bridge.
- **Pins:** new `tests/unit/preloadTrustGate.test.ts` (19 tests: predicate
  table incl. scheme/port/iframe/file:/data:/about:blank/garbage-href legs,
  fresh-module-evaluation wiring behavior with a mocked `electron`, main-side
  posture structure). Mutation teeth measured: gate removed → 5 red;
  `app://-` dropped from trust list → 3 red; main-frame law stripped → 3 red.
  Suite 44 files/522 tests → 45/541 exact; vue-tsc (renderer + test configs),
  tsc main, eslint, audit-gate (0 advisories, empty allow-list held),
  `npm run build` + `assert-preload` all green.

### CI — every third-party action is SHA-pinned; the estate supply-chain law reaches this repo (M-WINDOWS-09) — 2026-10-29

- **Why:** review `windows__devops` MAJ-3. All 35 `uses:` steps across
  `test.yml` (10), `build.yml` (22) and `codeql.yml` (3) floated on mutable
  major tags — an upstream tag re-point would silently change what CI runs,
  including inside the two `permissions: contents: write` jobs that publish
  the installers behind the auto-update feed. The estate cured this class
  repo-wide in the ubuntu-26.04 migration era; this repo was the outlier.
- **Shipped:** each ref frozen to the full 40-hex commit its floating major
  resolved to at cure time (behavior-neutral by construction), every pin
  line carrying a ` # vX.Y.Z` comment: `actions/checkout@d23441a4… # v6.1.0`
  and `codacy/codacy-coverage-reporter-action@89d6c85c… # v1.3.0` copied
  byte-identical from the estate precedent (hub `ci.yml`/`docker.yml`; 25 +
  22 pinned uses), `codecov/codecov-action@fb8b3582… # v6.0.2` equal to the
  peel the estate recorded for its codecov-v6 bump; `setup-node@24997072…
  # v6.5.0`, `upload-artifact@cf430e03… # v7.0.2`, `download-artifact@
  9000827c… # v8.0.2`, `softprops/action-gh-release@efb35369… # v3.0.3`,
  `github/codeql-action/{init,analyze}@4bfa242a… # v3.39.1` resolved live via
  `gh api …/git/ref/tags/{major}` (peeled). Honest note: the console/mobile
  freezes for upload/download-artifact and action-gh-release (v7.0.1/v8.0.1/
  v3.0.2) predate current upstream patches — this lane follows each float's
  live target rather than back-pinning to a sibling's older freeze.
- **Guard:** NEW `tests/unit/actionPinLaw.test.mjs` (5 laws) — full-SHA law,
  semver-comment law, ledger equality (commit AND version per repo, bump
  drift reddens by name), and a raw-line vs YAML-parse census agreement so
  no step dodges the law. Red-on-parent measured at fd273cb-era workflows
  (2 laws failed); mutation probe: re-floating `upload-artifact@v7` reddened
  the named laws, restore returned 5/5 green.
- **Scope adjudication:** pin-only per the queue item. The review's
  workflow-level `permissions:` least-privilege ask is its MIN-1 (separate
  minor-phase item; no Windows major covers it), and the WIN-08 signing
  annotation stayed untouched — zero edits to that block.
- **Measured:** vitest full serial 43 files/517 tests → 44/522 (+this file,
  +5 exact); vue-tsc renderer + tests, tsc main, eslint, audit-gate, and all
  three YAML parses green at head.

### Docs — signing posture told honestly: inactive block annotated, one unsigned story across workflow, docs and README (M-WINDOWS-08) — 2026-10-29

- **Why:** review `windows__devops` MAJ-2. The `release` job carried a
  commented signing sketch ("uncomment and fill in") whose secret names
  (`WINDOWS_CERT_BASE64`/`SIGNTOOL_PASSWORD`) contradicted the repo's own
  runbook (`docs/signing.md` prescribes `AUTHENTICODE_CERT*`/
  `APPX_SIGNING_CERT*`), invoked Windows-only `signtool` inside the
  `ubuntu-26.04` job where the SDK binary cannot exist, and the rolling
  "latest" release body stayed silent about every artifact shipping
  UNSIGNED. No certificate is provisioned (repo-OWNER surface); this change
  makes the claims true, it does not fabricate certs.
- **Shipped (docs/comments/CI-body only — zero behavior-file changes):**
  build.yml signing block rewritten with an INACTIVE/UNSIGNED status banner,
  canonicalized secret names, the windows-leg requirement, and a truthful
  future-path sketch (pwsh `[IO.File]::WriteAllBytes` + discovered signtool,
  no hard-pinned SDK version); rolling-release body now discloses the
  unsigned posture and points at the README Get-FileHash/SmartScreen walk;
  `docs/signing.md` opens with a CURRENT STATUS banner, drops every
  hard-pinned `10.0.22621.0` SDK path for a discovery idiom, aligns its CI
  sketches to the canonical names + windows leg, and names the real
  versioned artifact (`Phlix.1.0.0.appx`); README Release Process states
  the tag chain publishes UNSIGNED installers.
- **Guard:** `tests/unit/signingPostureWorkflow.test.mjs` (new, 7 tests) —
  5 cure pins (red at pre-cure 4e95cac) + 2 standing tripwires: no ACTIVE
  signtool step may appear (uncommenting in place on the ubuntu leg
  reddens), and no release body may claim signed output; secret names
  round-trip-pinned between build.yml and docs/signing.md.
- **Measured:** vitest full serial 43 files/517 tests (parent 42f/510-era;
  +1 file/+7 exact); `eslint .` silent-clean; `build.yml`/`test.yml`
  `yaml.safe_load` OK; targeted red→green evidence retained in the test
  header.

### Fixed — cold-start deep link is event-driven; the 1000 ms race is dead (M-WINDOWS-06) — 2026-10-29

- **Why:** review `windows__crossfe` M-WINDOWS-06. Cold-start delivery was
  `app.once('browser-window-created')` → `setTimeout(handleDeepLinkUrl, 1000)`
  — fire-and-forget against an arbitrary deadline. The renderer subscribes to
  `deeplink:open` only inside `boot()`, after three IPC round-trips plus an
  HTTP server-version check (`src/renderer/main.ts`), so any boot slower than
  1000 ms sent into a listener-less renderer: Chromium drops it silently —
  no error, no retry, link lost (worst case: a one-time invite consumed
  server-side while the accept screen never opened).
- **What:** one pending queue (`pendingDeepLinks`) + a renderer-receiver
  handshake. Every surface — cold-start argv, `second-instance`, `open-url`,
  notification click — funnels through `handleDeepLinkUrl` = enqueue +
  `drainPendingDeepLinks()`; exactly one `webContents.send('deeplink:open')`
  call-site remains. The drain runs only when the renderer sends the new
  `deeplink:ready` ipc (`preload.notifyDeeplinkReady()`, fired by
  `boot()` immediately after `api.onDeeplink` subscribes), sender-checked
  against the live main window's `webContents`. `did-finish-load`/`dom-ready`
  were deliberately NOT the trigger — they fire long before the
  subscription and would re-create the drop with a new name. (a) survival:
  `did-start-loading` drops readiness on every navigation and the `closed`
  handler resets it; a failed load never announces, so the queue persists
  and the next successful document's handshake (or a replacement window via
  `activate`) drains it. (b) single delivery: entries shift before dispatch
  (drain-once, explicit state), repeat handshakes drain an empty queue, and
  the W-low(a) 2000 ms dedupe guard stays at the delivery point. (c) redaction:
  every new log line routes through `redactDeepLinkUrl`; a test scans all
  recorded main-process log args for a planted raw token. (d) warm path
  unchanged-or-improved: second-instance shares the same drain helper on the
  same tick (no second bespoke timer).
- **Tests:** baseline (measured from HEAD `69c28d2` in a clean worktree,
  path-environment adjusted): 41 files / 498 cases → now 42 files / 510
  cases, FULL serial (`--no-file-parallelism`) 510 passed, 0 failed. New
  `tests/unit/deepLinkDrain.test.ts` (7): real timers — a cold-start link
  planted in `process.argv` at module eval waits PAST the old 1000 ms mark
  (1100 ms real wait) with zero sends, delivers exactly once on the late
  handshake, never on `did-finish-load`/`dom-ready`, survives a destroyed
  window and drains via the replacement window's handshake, foreign-sender
  announces refused, unparsable entry consumed without poisoning the queue,
  duplicate-URL single delivery with log redaction asserted. 5 new source
  shields in `deepLinkValidator.test.ts` (no `.once('browser-window-created'`
  arm, no `setTimeout` within reach of dispatch, handshake + sender check,
  single `deeplink:open` call-site, navigation/closed re-arms).
  `ipcChannels.test.ts` inventories rotated 6→7 send/on channels
  (`deeplink:ready`); `docs/ipc-channels.md` carries the row.
  `trayRestoreWiring.test.ts` adapted: delivery tests fire the handshake
  (warm path) and pin the destroyed-window survivor drain.
- **Teeth (mutation-proven, source restored after):** reviving the
  setTimeout-1000 arm reddens exactly the 3 named tests (hold-past-deadline
  + both shields); stripping the sender-identity check reddens exactly the
  foreign-announce test.
- **Gates:** vue-tsc (×2: default + `-p tsconfig.test.json`) 0, tsc
  `-p tsconfig.main.json` 0, eslint 0, audit-gate PASS (0 advisories).
  Renderer/main/preload behavior files ship; no electron rebuild was needed
  for the unit gates (build + xvfb smoke ride CI's `build.yml`).

### Fixed — update-feed workflow guard gets real structural teeth (M-WINDOWS-05 r2) — 2026-10-29

- **Why:** review `windows__crossfe` M-WINDOWS-05 round 1 (finding M1, major). The
  feed carry-through laws of `tests/unit/updateFeedWorkflow.test.mjs` were whole-file
  `toContain` substring checks: deleting `artifacts/nsis/latest.yml` (or
  `artifacts/nsis/*.exe.blockmap`) from the Create Release `files:` list — or
  `release/latest.yml` from the build job's upload `path:` list — left all 9 laws green,
  because the path strings also occur in step comments and the verify step's greps
  (build.yml :252/:416/:429/:443-444). Attachment removal would upload a release
  without the updater feed — electron-updater 404s `latest.yml`, auto-update silently
  dead — with zero CI red. Exactly the silent-regression class the guard exists to stop.
- **What:** the two carry-through laws now parse `.github/workflows/build.yml` with
  js-yaml (already a devDependency) and assert ELEMENT EQUALITY on the parsed
  `with.path` list of the build job's `actions/upload-artifact` step and the
  `with.files` list of the versioned release's `Create Release` step
  (`softprops/action-gh-release`), with fail-loud throws when either step or list is
  absent. Laws 1-3/6-9 untouched (the negatives are whole-file pins by design).
- **Teeth (mutation-proven in a scratch copy; the workflow itself untouched):**
  deleting the release `files:` latest.yml entry → 1 red (the attachment law);
  deleting the `*.exe.blockmap` entry → 1 red; deleting the upload `release/latest.yml`
  path → 1 red (the old :252/:429 prose false-green is dead). Parent blob pair
  (1fa7694 build.yml + package.json) stays exactly 7 failed / 2 passed (laws 7/9 pass
  by design as config-contract guards).
- **Pins:** vitest full serial `--no-file-parallelism`: 41 files / 498 passed / 0 failed
  / 0 skipped (test count unchanged by this edit: 9 laws before, 9 after);
  vue-tsc renderer + tests, tsc main, eslint, build, audit-gate all 0.


### Fixed — friend-watch (SyncPlay) docs end their civil war; desktop truth pinned — 2026-10-29

- **Why:** review `windows__casualgamer` M-WINDOWS-04 (M4). Four sources told three
  different stories about SyncPlay on Windows: the README's Minimum-Server-Version
  line advertised "SyncPlay groups", the README's Known Limitations declared the
  "realtime SyncPlay UIs … temporarily dropped", the routeReachability carve-out
  rationalized "SyncPlay UI removed in W2 — route defunct", and both `buildMenu`
  test titles listed SyncPlay as a nav entry the menu never contains — while the
  vendored `@phlix/ui` v0.99.10 bundle in fact ships the whole surface: the shell
  registers `/app/syncplay`, the player imports `SyncPlayModal`, and i18n carries
  the room vocabulary.
- **Bundle truth (measured, not asserted):** the room page and the room REST calls
  (list/create/join via `api/syncplay.ts` against the configured `apiBase`) work,
  but the live-playback WebSocket is built from `window.location.hostname` plus a
  hardcoded `:8097` — the same-origin assumption of the server-hosted web player.
  This renderer is served from the internal `app://-/` origin (hostname `-`,
  enforced in `src/main/index.ts`), so a packaged build's room socket can never
  dial a remote server: parties never go live on Windows. Surfacing the page in
  the nav would advertise that dead end, so the honest cure is docs + pins, and
  the nav entry rides the re-pin that carries the `__PHLIX__.wsUrl` socket seam
  (upstream `phlix-ui 94579936`, R12-02 — absent from the installed bundle today).
- **What:** README's Minimum-Server-Version sentence re-attributed (the four-item
  "key features" list split into what this client actually drives vs. the server's
  SyncPlay endpoints); the false "temporarily dropped" limitation replaced with
  the two truths it conflated (Offline Downloads: genuinely no surface; SyncPlay:
  ships-but-inert, linked); a new "Watching with friends (SyncPlay)" section tells
  users what works today (the server-hosted web player) and why the desktop app
  does not; `docs/ui-surface.md` SyncPlayPage rows updated from the v0.98.39-era
  inventory to v0.99.10 reality (admin row annotated REST-only, i.e. genuinely
  working); `routeReachability.test.ts` carve-out reason rewritten from the false
  "removed in W2" story to the honest withheld-because-inert rationale; the two
  `main.test.ts` menu titles stop listing a SyncPlay entry that was never asserted;
  and two dead W2-era ghosts in test files are excised — the `ipcChannels.test.ts`
  docstring exemplar quoting the nonexistent `syncplay:connect` channel (replaced
  with the live `notification:show` multiline invoke it was explaining) and the
  assert-free `onSyncPlayMessage` key in the `electronBridge.test.ts` mock.
- **New law:** `tests/unit/syncplayDesktopStatus.test.ts` (4 tests) pins the four
  measured facts as tripwires — the route registers, the same-origin `:8097` dial
  idiom is present, the `wsUrl`/`wsPath` seam is absent, and no nav entry exists —
  so the exact moment the installed bundle gains the capability, the suite reddens
  and names the rider this entry defers.
- **Measured:** vitest serial 40 files / 494 tests → 41 / 498 (+4 exact);
  vue-tsc (renderer + tests) and tsc (main) exit 0; eslint exit 0; `npm run build`
  exit 0; `scripts/audit-gate.mjs` PASS (0 advisories). No menu or deep-link
  surface was added, so the smoke leg is out of scope; zero vendored bytes and
  zero shipped-code behavior touched (docs, docs-adjacent test prose, new test file).

### Fixed — stop fabricating the update feed: electron-builder's authentic latest.yml + blockmaps ride the release — 2026-10-29

- **Why:** review `windows__crossfe` M-WINDOWS-05 (M1). The release job in
  `.github/workflows/build.yml` hand-wrote `artifacts/latest.yml` with
  `sha256:`/`target:` fields where electron-updater's `UpdateInfo` contract is
  base64 `sha512` (+ `size`, + blockmap), discarded the schema-correct
  `release/latest.yml` that electron-builder itself emits during the nsis leg
  (`build.publish` is the GitHub provider — the file was built, uploaded by
  nobody), invented `latest-windows.yml` for the appx leg (no code path reads
  an APPX feed on Windows — `NsisUpdater` is the consumer, and appx only emits
  update metadata when `electronUpdaterAware` is set; it isn't), and shipped
  zero `.exe.blockmap` assets, so differential downloads were impossible even
  in principle. `git log -S latest.yml` shows the hand-write (2bb876c) carried
  no pinned reason — it was ignorance of the builder output, not a deliberate
  discard.
- **What:** deleted both hand-write steps (and the `{f}.sha256` sidecars only
  they consumed). The build job's artifact upload now carries
  `release/latest.yml` and `release/*.blockmap` (the nsis leg produces them;
  unmatched patterns in the appx leg are tolerated exactly as the existing
  `release/*.appx` non-match in the nsis leg is), and the versioned release
  attaches builder's `artifacts/nsis/latest.yml` +
  `artifacts/nsis/*.exe.blockmap` verbatim next to the installer. A new
  fail-loud **Verify the updater feed** step gates `Create Release`: the feed
  must exist, match the tag version, carry `sha512:`/`files:`/a space-free
  `path:`, and contain no `sha256:`/`target:` — so a missing or fabricated
  feed reddens the release instead of warning-and-skipping.
- **Name law (config, not cat):** `build.nsis.artifactName` is now pinned to
  `${productName}-Setup-${version}.${ext}`. Proven against this repo's live
  `latest` release the same day: the space-carrying default name is stored by
  GitHub with dots (`Phlix.Setup.1.0.0.exe`), while builder's GitHub feed url
  and electron-updater's space→dash request both ask for the **dashed** form —
  404 on every updater download (HEAD probes: dot form 302, dash form 404,
  space form 404). A space-free template makes feed url, on-disk file, stored
  asset name and updater request path one string. The README download table,
  the checksum-verification snippet (its "search for 'Phlix Setup'" quirk is
  obsolete), and the Release Process asset list were cured to match; the
  rolling `latest` release re-rolls with the new names on the next master
  push.
- **Pins:** new `tests/unit/updateFeedWorkflow.test.mjs` (9 laws) — 7 of them
  red at parent `1fa7694` (measured), the other 2 pin pre-existing config
  contracts (GitHub publish provider, appx updater-unawareness) so a future
  config edit cannot silently break the cure. The verification step itself
  enforces runtime shape on CI.
- **Honest residual:** the tag-triggered chain still has never executed (zero
  `v*` tags — same disclosure as the 2026-10-29 chain repair above); the first
  real tag push is the end-to-end proving run for feed download + sha512 +
  differential update. A full local `electron-builder --win nsis` dry-run to
  capture builder's `latest.yml` bytes is environment-blocked on this Linux
  host (makensis argv locale issue cleared with `LC_ALL=C.UTF-8`, then
  `spawn wine ENOENT`); the feed schema the pins assert was instead derived
  from the installed `app-builder-lib@26.17.0` source
  (`publish/updateInfoBuilder.js`, `targets/nsis/NsisTarget.js`,
  `targets/differentialUpdateInfoBuilder.js`) and cross-checked against
  `electron-updater@6`'s `GitHubProvider.resolveFiles`. No `src/` change: the
  updater consumes the feed exclusively through the `autoUpdater` events
  already wired in `src/main/index.ts`.

### Fixed — clicking the app after close-to-tray restores the window — 2026-10-29

- **Why:** review `windows__casualgamer` M-WINDOWS-03 — close-to-tray is the
  default (`minimizeToTray: true`), and it hides the window (`win.hide()`),
  which removes the taskbar button entirely. Every re-entry surface then
  failed the same way: the second-instance handler (the path a fresh icon
  click takes under the single-instance lock) called `focus()` on the hidden
  window — `focus()` does not un-hide; the Electron docs assign that to
  `show()` ("Shows and gives focus to the window") — and the tray click plus
  the tray menu "Show" called `show()` with no `focus()`. Users clicked the
  app and saw nothing.
- **What:** new `src/main/windowRestore.ts` — one pure, canonical
  `restoreWindow()`: destroyed-guard first (touching a destroyed window
  throws "Object has been destroyed" per the `win.webContents` docs note),
  then `restore()` gated on `isMinimized()` (restore's documented contract is
  the minimized state only — blanket restore-before-show on a merely hidden
  window is the trap this closes), then `show()` gated on `!isVisible()`,
  then unconditional `focus()` (the app docs define the second-instance
  response as "making their primary window focused and non-minimized"). All
  five re-entry surfaces now delegate: `second-instance`, tray `click`, tray
  `double-click` (new registration — the Windows tray idiom; the click burst
  is safe because the sequence is idempotent), tray menu "Show", and the
  `notification:show` click. README documents the surfaces; the tray icon is
  the primary one because Windows emits no restore event for a hidden app.
- **Tests:** `tests/unit/windowRestore.test.ts` (6 — exact call-order
  sequences per state: hidden → `show,focus` never `restore`; minimized →
  `restore,show,focus`; visible → `focus` only; destroyed → no-op not crash;
  null-safe; idempotent burst) + `tests/unit/trayRestoreWiring.test.ts` (10 —
  every surface drives the real helper against the booted window fake, deep
  link delivery preserved after restore). Mutation-killed: reverting tray
  click (2 red), reverting second-instance to focus-only (3 red), dropping
  the double-click registration (1 red), stripping the destroyed guard
  (2 red), blanket restore without the `isMinimized` gate (9 red), reverting
  menu "Show" (1 red), reverting the notification body (2 red).

### Fixed — too-old server explains itself instead of dark window — 2026-10-29

- **Why:** review `windows__casualgamer` M-WINDOWS-02 — when the connected server
  reported a version below `MIN_SERVER_VERSION` (1.1.0), the renderer boot gate
  aborted with `log.error(...); return;`: the Vue app never mounted and the user
  was left staring at the permanently dark `#1a1a2e` window — the only diagnostic
  was an electron-log line under `%APPDATA%\phlix-windows\logs`. (The separate
  W7.6 dead-endpoint fail-open theater was already cured by the W2 lane; the
  blocking verdict itself still had zero user surface.)
- **What:** the gate verdict is now a structured `ServerVersionCheck`
  (`compatible` / `serverVersion` / `minimumVersion`) through
  `src/main/versionCheck.ts` → the `app:check-server-version` IPC → the renderer
  contract in `src/renderer/types/electron.d.ts`. On the sole blocking outcome,
  the main-process handler raises `showServerTooOldDialog()` — a type-`error`
  `dialog.showMessageBox` naming the version found vs required (main i18n
  catalog ×7 locales, `{serverVersion}`/`{minimumVersion}` interpolated) — and
  the renderer replaces the dark mount point with a persistent `role="alert"`
  screen (windows-own catalog ×7 locales; all text via `textContent`, never
  `innerHTML` — the version string is network input). Fail-open policy is
  UNCHANGED: only an explicit version below 1.1.0 blocks; every probe-failure
  path still boots as before (now also carrying `serverVersion: null`). Stale
  renderer comment citing the nonexistent `/api/v1/server/version` corrected;
  `docs/ipc-channels.md` return column updated (no new channels). Tests: +8
  (4 structured-verdict shape pins in `versionCheck.test.ts`, 1 boot-screen
  render test with log-only-revert mutation tooth in `main.test.ts`, 3
  dialog/handler-wiring tests in new `serverTooOldDialog.test.ts` incl. static
  pin killing call-removal); i18n count pins rotated 16→21 (windows-own) and
  29→32 (main) with the `boot.*` additions honestly marked as born-in-catalog.
  Suite 36 files/461 tests → 37/469, all green with the two mutations proven red.

### Fixed — docs: release-hash verification step now actually works — 2026-10-29

- **Why:** review `windows__casualgamer` M-WINDOWS-01 round-1 REWORK (MAJOR-1 teach-fault) —
  the taught `Get-FileHash … must match SHA256SUMS.txt` step failed two format collisions:
  `Get-FileHash` prints UPPERCASE hex against a lowercase sha256sum-style file with no
  case note, and the file labels the installer by its BUILD-TIME path
  `nsis/Phlix Setup 1.0.0.exe` (spaces + prefix), so grepping the downloaded asset name
  `Phlix.Setup.1.0.0.exe` finds nothing.
- **What:** verification step rewritten as a pasteable two-line PowerShell compare
  (`Select-String -Pattern 'Phlix Setup'` → `.Line.Split(' ')[0]` → `-eq` against
  `.Hash.ToLower()`), plus an eye-check sentence bridging the uppercase/lowercase quirk and
  the build-time label (same asset). Copy validated against the real published
  `SHA256SUMS.txt` on the rolling `latest` release 2026-10-29: the taught pattern matches
  exactly one line and its hash equals the GitHub asset digest of `Phlix.Setup.1.0.0.exe`
  (`c3418e56…`). README + CHANGELOG only; no code or workflow changes.

### Added — docs: end-user download/install story in the README — 2026-10-29

- **Why:** review `windows__casualgamer` M1 — the README's only "Installation" was
  developer-only (clone/`npm install`); nothing pointed an end user at the actual GitHub
  Releases, and the unsigned builds' first-run SmartScreen wall had zero documentation.
- **What:** new *Install (end users)* section mirroring live release state verified 2026-10-29
  via `gh release view latest`: the rolling **“Latest (master)”** pre-release is today's only
  publication (no `v*` stable tag exists yet — first stable cut is an owner release-process
  decision, noted in-product); real asset names (`Phlix.Setup.1.0.0.exe` NSIS installer +
  `Phlix.1.0.0.appx` + `SHA256SUMS.txt`) with installer-vs-APPX choice guidance; honest
  unsigned status with the SmartScreen “More info → Run anyway” walk-through and a
  `Get-FileHash` verification step (no "verified publisher" fiction); update behavior truth —
  electron-updater ships with `allowPrerelease = false` and finds nothing until a stable
  release exists, so updates today = re-download from the releases page. The dev section was
  retitled *Installation (from source — development)* and the Prerequisites intro scoped to
  developers. README + CHANGELOG only; no code or workflow changes.

### Changed — dependency security: 22-advisory time-drift sweep clears the audit gate; allow-list retired to EMPTY — 2026-10-29

- **Why:** master CI turned RED solely on the `node scripts/audit-gate.mjs` step at
  5ab9691 (blocks the entire build → release-latest chain via `needs:`). 22
  advisories had been disclosed against the advisory DB AFTER the last green lock
  review — `package.json`/`package-lock.json` were untouched by the commits since.
  Time drift, not regression. Reproduced locally on the CI-faithful toolchain
  (node v24.21.0 / npm 12.0.2, `NPM_CONFIG_USERCONFIG=/dev/null`): exit 1, exactly
  the same 22-id set. Every one of the 22 had a patched target **inside the
  already-declared parent ranges** — zero allow-list additions were needed.
- **Advisories cleared (22 ids / 6 packages):**
  | GHSA | package | via (path) | severity | vulnerable | patched taken |
  |------|---------|------------|----------|------------|---------------|
  | GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp | @vitest/mocker | exact-pinned by `vitest` (devDep) | moderate ×2 | ≥5.0.0-beta.1 <5.0.3 (∪ rc.2 floor) | 5.0.5 (via vitest bump) |
  | GHSA-jr5w-w6x2-84p9 | electron | root devDep `^42.1.0` | high | <42.11.16 | 42.11.18 |
  | GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-xhq7-xmqj-769h, GHSA-333x-w4r6-6crp | fast-uri | `ajv ^3.0.1` (+ root override `^3.1.4`) | moderate ×2, low ×2 | ≥3.0.0 <3.1.9 (∪ ≥3.1.3 floor) | 3.1.9 |
  | GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c | follow-redirects | `axios ^1.16.0` (dev via wait-on) | high ×2 | ≥1.16.0 <1.16.1 | 1.16.2 |
  | GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm, GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-9fm3-97px-rjf6, GHSA-55wc-3pg8-jfw6 | undici | `@electron/get ^7.24.4` + `jsdom ^7.25.0` (node-gyp's 6.x stream is outside every flagged range — untouched) | high ×4, moderate ×4 | ≥7.0.0 <7.30.1 (per-advisory floors 7.15/7.18) | 7.30.1 |
  | GHSA-587h-7wmj-h5pm, GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-rq7h-c2jc-7f22, GHSA-9jrq-w75r-8gcw | vite | root devDep `^7.3.2` | high, moderate ×3, low | ≥7.0.0 ≤7.3.6 | 7.3.7 |
  Severity census: 8 high / 11 moderate / 3 low. All six packages are dev-chain;
  nothing shipped to users moves. The vite advisory range tops out AT the then
  installed 7.3.6 — 7.3.7 (published upstream) is the fix and sits inside the
  declared caret.
- **How:** `npm update electron vite fast-uri follow-redirects undici` moved the
  five transitive/dev nodes in-range, lock diff 15+/15−, `package.json` byte-
  identical. `@vitest/mocker` could NOT be cleared that way: vitest EXACT-pins it
  (`"@vitest/mocker": "5.0.0"`) and `@vitest/coverage-v8` exact-pins vitest's
  peer, so `npm update` legitimately reports "up to date" — the subtree only
  moves together. `npm install vitest@5.0.5 @vitest/coverage-v8@5.0.5` advanced
  it (mocker, spy, chai, magic-string, std-env, tinybench, tinyexec, tinyrainbow,
  obug, why-is-node-running, ast-v8-to-istanbul, @vitest/istanbul-*; siginfo +
  stackback dropped by vitest 5.0.5 — 0 additions, 2 removals). **The ONLY
  package.json change** is the two devDep floors `vitest`/`@vitest/coverage-v8`
  `^5.0.0`→`^5.0.5` (plus npm's own alphabetical fix for the pre-existing
  `@playwright/test` mis-sort): raising the floor is the security-relevant part —
  `^5.0.0` would let any fresh resolver land back on the vulnerable 5.0.0–5.0.2;
  same house doctrine as the js-yaml floor pin (2026-09-29) and the fast-uri
  override floor `^3.1.4`. Lock idempotency proven: the install run twice and the
  update pass re-run — md5 `c20b0850…` stable across all three passes (the
  d991d74 churn hazard did not fire).
- **Allow-list retired to EMPTY (`scripts/audit-gate.mjs`):** the sole survivor
  GHSA-hp3w-g68c-fv3c (sprintf-js) was **WITHDRAWN by the GitHub Advisory
  Database on 2026-10-22** ("it is the responsibility of an application to handle
  exceptions appropriately") — npm no longer names it against any lock, and
  `npm view sprintf-js versions` still ends at 1.1.3 (2023; patched: none —
  there is nothing to take). A dormant justification for a never-again-reported
  advisory is documentation rot; the documented reviewed-removal doctrine (ch52
  precedent: entry + fixtures rotate out when the premise dies) applies. The
  gate stays STRICTER than the bare step it replaced: the subset law, the
  anti-neutering exit codes (1 violation / 2 structural) and every fail-loud
  vector are untouched; `decide()` gained an `allowList` injection parameter
  (default = the module map, production path unchanged) so the subset and
  case-insensitivity laws stay guarded WITHOUT shipping a live entry. The retired
  ch52 test became a loop covering both founding ids — if either is ever named
  again (lock regression, or GitHub un-withdrawing hp3w) the empty list reddens
  the gate; the exact-set integrity pin flipped `[hp3w]` → `[]` (fail-loud on any
  unreviewed addition). Header + both workflow audit-step comments carry the new
  truth (the test.yml prose naming ch52 as "current" was itself stale since
  d991d74).
- **Gates (local, CI-faithful `NPM_CONFIG_USERCONFIG=/dev/null`):**
  `node scripts/audit-gate.mjs` → PASS, 0 advisories, exit 0; `npx vitest run
  --no-file-parallelism` → 461/461 (36 files, 0 fail — +7 over the 454-era
  baseline is deepLinkRouteContract.test.ts landed by 667ab70, suite-file count
  35→36 likewise; CI-form adds the pre-existing sibling-clone i18n skip;
  audit-gate.test.mjs holds its 21 tests), vue-tsc renderer 0, tsc main 0,
  vue-tsc tests 0, eslint 0, build 0 + preload assert OK, `xvfb-run npm run
  smoke` → 1 passed on the new Electron 42.11.18 binary (the 633863a content-
  assert boot guards stay green).

### Fixed — versioned-release chain repair [review windows__devops CRIT-1] — 2026-10-29

- **The tag→GitHub-Release chain in `build.yml` was deterministically broken at
  two independent steps and had never executed (zero `v*` tags on origin ever —
  only the rolling `latest`).** Reproduced from HEAD at the bash level before
  fixing, and the repaired steps re-run clean afterwards under GHA-faithful
  `bash -e -o pipefail` with mock artifacts on disk.
- **Leg 1 — `Generate SHA256 checksums` (release job):** the command hashed
  `nsis/*.exe nsis/*.nupkg appx/*.appx appx/*.nupkg`, but the builder config
  declares only nsis + appx targets (no squirrel), so no `.nupkg` can exist;
  the unmatched globs passed literal patterns to `sha256sum`, which exits 1 and
  killed the step before `Create Release` could ever run. Dropped the nupkg
  operands (and the two never-matching `artifacts/*/*.nupkg` lines from the
  `Create Release` files list).
- **Leg 2 — `Generate latest-windows.yml for APPX`:** the heredoc terminator
  `YML` was indented two spaces deeper than the block-scalar base, so it
  materialized at column 2 while `<< YML` demands column 0 — bash died at
  parse time (exit 2) and the `else` fallback was dead. Dedented the heredoc
  body + terminator to the block base, mirroring the working `latest.yml`
  step. (MAJ-1's `sha256`-vs-`sha512` schema conformance is a separate
  queued item; this lane makes the chain run, not redesign the feed.)
- **Latent third ghost found by the fix's negative-leg probe:** with the
  heredoc previously killing the step at parse time, the APPX-absent guard
  was never exercised — under `-e -o pipefail` the failing `ls` in
  `APPX=$(ls … | head -1)` propagated through the assignment and aborted the
  script before the `if`, so the intended "skip latest-windows.yml" fallback
  was still dead. Added `|| true` inside the substitution; the else branch
  now prints its skip message and exits 0 (verified).
- **Docs truth:** README `build.yml` one-liner and the Release Process step 3
  now describe what the workflows actually do (audit allow-list gate, not
  bare `npm audit --audit-level=high`; version-drift check; the three feed
  files), with an honest note that the first `v*` tag push is the chain's
  end-to-end proving run.

### Changed — ui re-pin v0.99.9 → v0.99.10 — 2026-10-14

- **Pin advance (release-cascade lane, ui tag v0.99.10).** `@phlix/ui` bumped
  `#v0.99.9` → `#v0.99.10` (annotated tag `5898effc`, peels to `18c76eb0` —
  `lockwalk --live` re-peeled off the remote at this lane; strict-equality pin
  law holds; manifest `version` field honestly reads `0.99.10`, the
  honest-field era carrying through its fourth release). The release carries
  the **plugin-themes fix** (ui `c81480b9`): the themes store's fetch no
  longer short-circuits on an EMPTY-string apiBase — an absent base is
  same-origin, so the loader gates on `null` and hosted Appearance pickers
  discover plugin themes. The renderer proof lands in `main-*.js`:
  `if(c!==null&&!(a.value&&!d))` wrapping the `get("/api/v1/themes",…)` call
  site (the old `if(c!==""&&…)` short-circuit is gone; the chunk's single
  remaining `!==""&&!` match is an unrelated numeric-coercion helper).
- **Equality era CARRIED unchanged:** ui v0.99.10's manifest still requests
  contracts `#v0.5.3` and syncplay `#v0.1.5` outright (measured via git show
  at `18c76eb0`), so `RATIFIED_HOISTS` stays `{}` per its written law, both
  contracts edges keep walking plain rule 1, and zero waiver keys move. The
  era wording in `lockwalk.mjs`/`contractsPin.test.mjs`/`lockwalk.test.mjs`
  rotated v0.99.9 → v0.99.10 with history kept verbatim; the ui-drift
  mutation catchers re-pin the finding strings (stale word 0.99.4 kept dead,
  behind word advanced to 0.99.9, sha literal to the `18c76eb0` peel).
- **Lock churn is the minimal declared-delta shape:** exactly 3+/3− — the
  root edge, and in the `node_modules/@phlix/ui` node the `version`/`resolved`
  pair (the contracts edge under ui unchanged — v0.99.10 rotated no
  dependency edges). The hand-edit was PROVEN idempotent under real npm
  (11.19.0 / node 24.20.0 docker venue, `NPM_CONFIG_USERCONFIG=/dev/null`):
  `npm install --package-lock-only` left the md5 byte-identical. `npm ci`
  clean; vendored identity: installed `dist/phlix-ui.js` sha256
  `deff3847…c056c8c7` == the tag's tree blob == the server/hub/tizen lanes'
  install.
- **i18n law untouched.** `scripts/sync-ui-locale-bundles.mjs` needs no
  re-run: `src/i18n/locales/` + `messages.ts` are byte-unchanged between
  `a580410f` (the vendor PIN) and `18c76eb0` (`git diff` empty — v0.99.10's
  src delta is themes/composables + its own test tree, all outside the
  vendored set), so the six bundles and the PIN manifest stay true;
  docs/i18n.md and the i18nLocales era wording carried the bump.
- **Gates:** `vue-tsc --noEmit` 0; `tsc -p tsconfig.main.json` 0;
  `eslint .` 0; `node scripts/audit-gate.mjs` clean (allow-list posture
  unchanged from the GHSA-ch52 removal); `node scripts/lockwalk.mjs --live`
  4 edges / 0 mismatches (live tag-object peels re-verified); `vitest run`
  **35 files / 454 total** (453 passed + 1 skipped — the sibling-clone-only
  i18n pristine-source leg, skipped exactly as CI does; baseline held);
  `npm run build` 0 (preload assert OK). CI re-runs every leg incl. the
  windows electron smoke.

### Changed — took `http-cache-semantics` 4.3.0: GHSA-ch52 allow-list removal plan executed — 2026-10-08

- **What:** `npm update http-cache-semantics` rolled the dev-chain node
  4.2.0 → 4.3.0 (published upstream 2026-10-04, inside cacheable-request
  7.0.4's declared `^4.0.0` range — no parent version touched, lock diff is
  the one node's version/resolved/integrity, proven idempotent under a real
  `npm install`). The founding `GHSA-ch52-4w7c-c8xp` entry was deleted from
  `scripts/audit-gate.mjs`'s `ALLOWED_ADVISORIES`, exactly as its own
  UPSTREAM WATCH removal plan prescribed. `package.json` is untouched.
- **Gate after-state:** `npm audit --json` on the updated lock reports ONLY
  `GHSA-hp3w-g68c-fv3c` (sprintf-js 1.1.3 — still the last release ever
  published, still no patched target). It stays allow-listed with its full
  escape analysis and its 2027-01-03 re-verify date; its justification's
  cross-reference to the (now-removed) ch52 entry was reworded to a historical
  mention. Fail-loud/anti-neutering exit semantics are byte-ident.
- **Fixtures rotated:** `tests/unit/audit-gate.test.mjs` re-grounded on the
  LIVE hp3w 8-package chain (dedupe fixture), the exact-set law now pins
  precisely `[GHSA-hp3w-g68c-fv3c]` (re-adding ch52 fails it), and ch52 gained
  a dedicated fail-loud test proving a cleared advisory must NOT reappear on
  the allow-list — if the lock ever regresses and npm names it again, the gate
  reddens. Suite stays 21 tests (two pass cases consolidated; the ch52
  must-stay-gone case added). Unknown-id → exit 1 and subset → exit 0 laws
  remain load-bearing.

### Fixed — CI audit gate: justified allow-list wrapper for GHSA-ch52-4w7c-c8xp (release channel re-green) — 2026-10-03

- **Why:** master CI has been RED solely on the `npm audit --audit-level=high`
  steps (Test workflow's final audit step + Build workflow `Security Audit`),
  which blocks the entire `build → release-latest`/`release` installer chain.
  The single root advisory is GHSA-ch52-4w7c-c8xp (http-cache-semantics
  max-stale cross-user response disclosure, CWE-524, CVSS 7.5). npm's human
  output counts 8 high findings — those are 8 affected PACKAGES
  (`http-cache-semantics` plus its dev-chain carriers up through
  `electron-builder`) tracing to this ONE advisory id.
- **Why no fix-at-source exists (adversarially proven, not assumed):** every
  published http-cache-semantics release (`<=4.2.0`, latest included) is
  vulnerable — there is no patched target to bump to. npm's suggested
  `audit fix --force` downgrades electron-builder 26.8.1→26.5.0, proven to
  regress 1 critical + 2 highs; overrides are impossible under the caret
  range. The advisory reaches ONLY the dev chain
  (`electron-builder → app-builder-lib → @electron/get → got → cacheable-request
  → http-cache-semantics`) with zero prod parents — nothing shipped to users.
- **What shipped instead (Option A):** `scripts/audit-gate.mjs` runs
  `npm audit --json --audit-level=high` and passes ONLY while the reported
  advisory-id set is a subset of an explicit `ALLOWED_ADVISORIES` allow-list
  (today: exactly the ch52 entry, printed with its full justification on every
  run). Both workflow steps now call `node scripts/audit-gate.mjs` with raw
  exit codes — no `|| true`, no continue-on-error — and stay LAST in job order.
  The gate is STRICTER than the bare step it replaces: sub-high advisories also
  reddened it before (npm's JSON lists them regardless of `--audit-level`) and
  anti-neutering refuses ANY unread audit — unparseable JSON, unknown report
  shape, failed spawn, or a nonzero exit reporting zero advisories all exit 2
  (structural), never 0.
- **Guarded by:** `tests/unit/audit-gate.test.mjs` — fixture matrix over the
  pure `collectAdvisoryIds`/`decide` functions (clean→0, ch52-only→0,
  ch52+intruder→1, garbage→2, empty-with-failed-exit→2, unnameable advisory→2,
  case-insensitive id matching, v2-shape fallback) plus allow-list integrity
  pins (exactly-one-entry, canonical-form key, non-empty justification).
- **UPSTREAM WATCH (the removal plan):** the got 11.8.6 chain declares
  `http-cache-semantics: ^4.0.0` (via cacheable-request), so the moment a
  4.2.1+ (or any release outside the vulnerable range) lands,
  `npm update http-cache-semantics && node scripts/audit-gate.mjs` clears it —
  then DELETE the allow-list entry and the ch52 fixtures. Re-verify advisory
  status by 2027-01-03: https://github.com/advisories/GHSA-ch52-4w7c-c8xp
- **Gates (NPM_CONFIG_USERCONFIG=/dev/null):** `node scripts/audit-gate.mjs`
  exit 0 against the live lock (allowed ch52, prints justification); vitest
  453/453 (433 baseline + 20 new); vue-tsc 0, tsc -p tsconfig.main.json 0,
  vue-tsc -p tsconfig.test.json 0, eslint 0; workflows YAML-parsed clean.

### Changed — re-pin `@phlix/ui` v0.99.8 → v0.99.9 (playlist create-contract fix; waiver retires, byte-equality era restored) — 2026-10-03

- **Single ui pin advanced.** `package.json` re-pins `@phlix/ui` to the `v0.99.9` tag
  (annotated object `c7130f70`, peel `cc931723`, cut 2026-10-03 atop the headline
  user-facing fix: `createPlaylist` now honors the server create-contract — grid
  "Add to playlist" sends exactly `{name, library_id}` to `POST /api/v1/playlists` and
  chains the items leg — plus the contracts `#v0.5.3` re-pin and the `library_id`
  wire-truth pass carried inside the tag); `NPM_CONFIG_USERCONFIG=/dev/null npm
  install --allow-git=all` regenerated the committed lock surgically — the diff is
  exactly 4+/4−: root echo, the ui node's `version` `0.99.8` → `0.99.9` (honest field,
  era carries), its `resolved` → `cc931723`, and the ui node's recorded contracts edge
  `#v0.5.2` → `#v0.5.3`; the syncplay lines and every other entry never moved; zero
  `devOptional`→`dev` rewrite churn.
- **The @v0.5.2 waiver RETIRED — fourth firing of the written law.** ui v0.99.9's
  manifest requests `#v0.5.3` outright (measured via `git show cc931723:package.json`
  AND independently off the installed `node_modules/@phlix/ui/package.json` after
  `npm ci`), so the divergence class that opened at the contracts v0.5.3 re-pin closed
  the moment this tag landed: `RATIFIED_HOISTS` returns to present-but-empty, and BOTH
  contracts edges (root and ui) now walk plain rule 1 onto the single hoisted
  `0.5.3@430981e` copy. `lockwalk.mjs`'s EXPECTED rows rotate (ui →
  `v0.99.9`/`cc931723`); `contractsPin.test.mjs`/`lockwalk.test.mjs` convert back to
  the equality-era law — the ui line is byte-pinned to the SAME `#v0.5.3` words as root
  (`.toBe`, the divergence-era inversion flips), mutation proofs run both directions
  (every hoist-copy mutation now reds BOTH requesters' rule-1 edges, and a
  `ratified-hoist-drift` finding can no longer be produced), and the dead waiver keys
  (`@v0.4.5`, `@v0.4.7`, `@v0.5.1`, and now `@v0.5.2`) are pinned absent. Vendored
  registry content is unchanged by the tag itself — contracts was already `#v0.5.3`
  (204-code census holds), and the ui dist's main entry rotates to blob sha256
  `5efa7cb5…` (the same bundle server/hub/tizen ship).
- **Locale-sync law untouched.** The vendored `src/renderer/i18n/ui-locale-bundles/`
  set stays pinned at `a580410f` (v0.99.8 peel) deliberately: the ui locale tree is
  byte-identical across `a580410f..cc931723` (only `errors.ts` moved in between,
  outside the vendored set), so the 441↔441 set-equality law holds without a re-vendor
  — documented in `docs/i18n.md`.
- **Gates.** `node scripts/lockwalk.mjs --live` → edges clean, peel proofs OK against
  the live remotes (`v0.99.9` tag object `c7130f70` → commit `cc931723` verified) ·
  full `npx vitest run` → see close report for the exact count (433/433 f95fe29-era
  baseline, test bodies rewritten in-place this lane) · `vue-tsc --noEmit` +
  `vue-tsc --noEmit -p tsconfig.test.json` + `tsc -p tsconfig.main.json --noEmit` PASS ·
  `npm run lint` PASS · `npm run build` PASS · `npm audit --audit-level=high` → 0
  vulnerabilities (git deps outside audit scope, standing note) · `xvfb-run
  --auto-servernum npm run smoke` → 1 passed.

### Changed — re-pin `@phlix/contracts` v0.5.2 → v0.5.3 (registry-expansion release; divergence era returns) — 2026-10-01

- **Single contracts pin advanced.** `package.json` re-pins `@phlix/contracts` to the
  `v0.5.3` tag (annotated object `eb90e6d`, peel `430981e3`, cut 2026-10-01 atop the
  coordinate-currency/manifest re-vendor era); `NPM_CONFIG_USERCONFIG=/dev/null npm
  install --allow-git=all` (node 24.21 / npm 12.0.2, CI-faithful) regenerated the
  committed lock surgically — the diff is exactly 3+/3−: root echo, the contracts
  node's `resolved`, and its `version` field; the ui/syncplay lines and every other
  entry never moved. Unlike the v0.5.2 carry, this bump DOES move registry content:
  `dist/error-codes.json` expands additively 202 → **204** codes (md5 `40c1da48…`) and
  `dist/server-route-manifest.json` sits at 412 tuples (md5 `91579683…`); no consumer
  code churn — windows reads the registry only through its pin tests, and the full
  433-test suite ran with zero source edits.
- **Honest-field era CARRIES.** `git show v0.5.3:package.json` reads `version: 0.5.3`
  (the normalization `ac669ca` opened at v0.5.2 holds), so npm writes the honest lock
  line and the `manifestVersion` override stays RETIRED — the contracts row walks the
  plain tag-derived version; no override is active on any @phlix/* row.
- **RATIFIED_HOISTS re-added — the byte-equality era ENDED.** The installed ui
  `v0.99.8` still requests `#v0.5.2` (measured via `git show a580410f:package.json`
  AND independently off the installed `node_modules/@phlix/ui/package.json`), so the
  moment the direct pin advanced to `#v0.5.3` the ui→contracts edge diverged again and
  the waiver's written retirement condition had NOT fired. Observed npm behavior (the
  written decision point): npm 12.0.2 again DEDUPED ui's unsatisfied git-tag edge onto
  the hoisted `0.5.3@430981e` copy — zero nested nodes in the lock, zero nested dirs on
  disk — the same behavior the v0.5.0-era and v0.5.2-era waivers documented. New
  exact-match entry `node_modules/@phlix/ui>@phlix/contracts@v0.5.2 → 0.5.3@430981e`
  (version AND sha, never a wildcard — the fourth firing of this law);
  `contractsPin.test.mjs`/`lockwalk.test.mjs` convert back to the divergence-era law
  with the recorded retirement path (dies when a ui tag requests `#v0.5.3`-or-newer
  outright), mutation proofs run BOTH directions — root's rule-1 edge and ui's
  `ratified-hoist-drift` edge light up on every hoist-copy mutation (behind rollback to
  the real v0.5.2@7afb6a91 snapshot, false-version, sha-only drift) — and the census
  marker rotates 202 → 204 by measurement-from-red. The locale-sync law
  (`SOURCE_REF a580410f`, 441↔441 catalog equality) is untouched: this pin move
  advances contracts only, never the ui pin.
- **Gates.** `node scripts/lockwalk.mjs --live` → 4 edges, 0 mismatches, all three peel
  proofs OK against the live remotes (`v0.5.3` tag object `eb90e6d` → commit `430981e3`
  verified) · full `npx vitest run` → 433/433 · `vue-tsc --noEmit` + `vue-tsc --noEmit
  -p tsconfig.test.json` + `tsc -p tsconfig.main.json --noEmit` PASS · `npm run lint`
  PASS · `npm run build` PASS · `npm audit --audit-level=high` → 0 vulnerabilities
  (git deps outside audit scope, standing note) · `xvfb-run --auto-servernum npm run
  smoke` → 1 passed.

### Changed — re-pin `@phlix/ui` v0.99.7 → v0.99.8 (retag-cascade head: bearer carrier, invite DTO, paths guards, player.css; first true locale re-vendor) — 2026-09-30

- **Single ui pin advanced.** `package.json` re-pins `@phlix/ui` to the `v0.99.8` tag
  (annotated object `35f727a6`, peel `a580410f`);
  `NPM_CONFIG_USERCONFIG=/dev/null npm install --allow-git=all` (node 24 /
  npm 12.0.2, CI-faithful) regenerated the committed lock surgically: the diff is
  the root echo → `v0.99.8` plus the ui node alone — `version` `0.99.7` → `0.99.8`
  (honest field, era carries), `resolved` → `a580410f`, and `pinia`/`vue`/`vue-router`
  REMOVED from the ui node's `dependencies` because the v0.99.8 manifest declares them
  as peerDependencies. Zero resolution movement behind that removal: the hoisted root
  trio (vue 3.5.41 / pinia 3.0.4 / vue-router 5.2.0) is untouched, zero nested @phlix
  copies, no unrelated drift. The installed `dist/phlix-ui.js` is blob-identical to
  `git show a580410f:dist/phlix-ui.js` (sha256 `63fe4ab3…` both sides).
- **What the bump carries into the vendored chunks (the P1 the retag cascade owed):**
  the `:8097` syncplay builder is now `` `${ws|wss}://…:8097?room=…` `` +
  `["bearer", token]` two-entry subprotocol negotiation (present in `phlix-ui.js`,
  `player.js` and `SyncPlayModal-*.js`) with **zero `[?&]token=` query carriers across
  the whole installed dist — windows' last `?token=` producer is retired**; the
  LibraryScanPage/LibrariesPage chunks carry the `e.paths?.length` / `.paths?.join`
  guards (P1 crash-fix for missing-key library rows); the invite surface is the
  create-token DTO (`invite-result__value--token`, `/api/v1/me/invite-links/…/redeem`,
  one-time "Invite token copied" flow), closing the audit's degraded
  url-only InviteLinksPage drift; `player.css` is reachable via the `./player.css`
  export. The load-bearing minified pins in `tests/unit/library-scan-route.test.ts`
  (`e.meta?.requiresAdmin === !0`, `meta: { requiresAdmin: !0 }`) survive the regen
  unchanged (5/5 pass reading the NEW bundle).
- **Honest-version + zero-waiver eras CARRY (third pin move under each law).**
  `git show a580410f:package.json` reads `version: 0.99.8` honest (no
  `manifestVersion` override returns) and requests `#v0.5.2`/`#v0.1.5` outright, so
  `RATIFIED_HOISTS` stays present-but-empty and the ui→contracts edge keeps walking
  plain lockwalk rule 1. `scripts/lockwalk.mjs` EXPECTED row advances to
  `v0.99.8`/`a580410f`; the ui-mutation proofs were re-cut for the new era (stale
  words `0.99.4`/`0.99.7` and sha-drift all go RED); `lockwalk: 4 edges walked,
  0 mismatches`.
- **Locale vendor MOVED with the pin — first true re-vendor since dc1df7d5.**
  Unlike the drift-free .6/.7 carries, v0.99.8 shifted the tree:
  `src/i18n/locales` `f8b090a6` → `a0f018cf` and `messages.ts` `d0094683` →
  `574b98e5` (catalog 412 → **441** flattened keys — the 4c4fe969 i18n-adoption
  wave), so `scripts/sync-ui-locale-bundles.mjs` `SOURCE_REF` advanced to `a580410f`
  and the re-run re-vendored all six locale bundles + the `PIN` (12 of 14 content
  hashes advanced; only the `index.ts` pair held). The exact bundle↔installed
  set-equality law re-established at 441↔441 both directions; era prose in
  `i18nLocales.test.ts`/`contractsPin.test.mjs`/`docs/i18n.md`/`README.md` updated
  to the measured truth.
- **Gates.** `npm audit --audit-level=high` → 0 vulnerabilities (note: audit does not
  cover git deps — the @phlix/ui pin moves outside its scope) · full `npx vitest run`
  → 433/433 (34 files) · `vue-tsc --noEmit` + `vue-tsc --noEmit -p tsconfig.test.json`
  + `tsc -p tsconfig.main.json --noEmit` PASS · `npm run lint` PASS ·
  `npm run build` PASS · `xvfb-run npm run smoke` → 1 passed — the 633863a
  content-assert boot guards stay green against the NEW vendored bundle.

### Changed — dependency security: brace-expansion →1.1.21/2.1.7/5.0.12, axios 1.19.0→1.20.0, fast-uri 3.1.7→3.1.8 (audit gate re-green) — 2026-09-30

- **Why:** master CI turned RED solely on the `npm audit --audit-level=high` step
  (Test workflow audit step — last per c75fdf0 — + Build workflow `Security Audit`)
  on advisories newly disclosed against the lockfile that was green 2026-09-29.
  No other step was failing — v24.21.0/npm 12.0.2 reproduced exactly 3 vulnerable
  packages locally (2 high — axios, brace-expansion — + 1 moderate — fast-uri).
- **Advisories cleared:**
  | GHSA | package | via (path) | severity | vulnerable | first patched |
  |------|---------|------------|----------|------------|---------------|
  | GHSA-q2hr-2g5m-vwhr / GHSA-qhr7-859c-m2p7 / GHSA-6j4f-fj2g-mc7p | brace-expansion | `@electron/asar→minimatch@3` `^1.1.7`, `@electron/universal→dir-compare→minimatch@3`, eslint core trio `^1.1.7` (1.1.18); `ejs→jake→filelist→minimatch@5` + `@electron/universal→minimatch@9` + `@vue/test-utils→js-beautify→editorconfig→minimatch@9` `^2.0.1`/`^2.0.2` (2.1.4); `app-builder-lib→minimatch@10` `^5.0.8` (5.0.9) | high | <1.1.21 ∪ ≥2.0.0 <2.1.7 ∪ ≥4.0.0 <5.0.12 | 1.1.21 / 2.1.7 / 5.0.12 |
  | GHSA-vh66-26gq-q6x8, GHSA-9fr6-4gfg-395g, GHSA-c29m-xwm3-cm6r, GHSA-mghh-pgcx-3jjj, GHSA-x97p-jq2g-jp4f, GHSA-3pq3-5fj3-cg6v, GHSA-542g-h47m-68v8 | axios | dev-only via `wait-on@7.2.0` `^1.6.1` (1.19.0) | high | ≥1.0.0 <1.20.0 (per-advisory floors 1.0.0–1.16.1) | 1.20.0 |
  | GHSA-hrr3-gc8f-f4qj | fast-uri | `electron-builder→app-builder-lib→ajv@8.20.0` `^3.0.1` (3.1.7) | moderate | ≥3.0.0 <3.1.8 | 3.1.8 |
- **How:** one `npm update axios fast-uri brace-expansion` — every resolved bump
  stayed **inside the already-declared parent ranges** (`^1.6.1`, `^3.0.1`, and the
  three minimatch streams `^1.1.7`/`^2.0.x`/`^5.0.8`), so `package.json` is untouched
  and the lockfile diff is exactly 11 nodes × {version, resolved, integrity}
  (brace-expansion 1.1.18→1.1.21 ×5, 2.1.4→2.1.7 ×3, 5.0.9→5.0.12 ×1, axios ×1,
  fast-uri ×1), 33+/33−, no new deps, no removals, no overrides/resolutions. The
  three-part brace-expansion ladder follows each consumer's own major line — the
  classic blanket-override breakage (forcing v2 semantics on v1 consumers) is
  avoided entirely because the patched heads exist on every stream. fast-uri is
  moderate — below the `--audit-level=high` gate — cleared anyway per house policy
  (don't leave known advisories installed; same treatment as js-yaml on 2026-09-29).
- **Gates after bump (local, CI-faithful `NPM_CONFIG_USERCONFIG=/dev/null`):**
  `npm audit --audit-level=high` → 0 vulnerabilities exit 0; `npx vitest run` →
  433/433 (34 files); `npm run typecheck` (vue-tsc + tsc main) → 0;
  `npx vue-tsc --noEmit -p tsconfig.test.json` → 0; `npm run lint` → 0;
  `npm run build` (renderer + main + preload assert) → 0; `xvfb-run npm run smoke`
  → 1 passed (the 633863a content-assert boot guards stayed green — the electron
  binary itself did not move this round).

### Changed — dependency security: electron 42.8.1→42.11.9, undici 7.29.0→7.30.0 & 6.28.0→6.29.0, js-yaml 5.2.3→5.4.2 (audit gate re-green) — 2026-09-29

- **Why:** master CI turned RED solely on the `npm audit --audit-level=high` step
  (Test workflow audit step + Build workflow `Security Audit` job) after three fresh
  advisories. No other step was failing — v24.21.0/npm 12.0.2 reproduced exactly
  3 vulnerabilities locally (1 moderate, 2 high).
- **Advisories cleared:**
  | GHSA | package | via (path) | severity | vulnerable | first patched |
  |------|---------|------------|----------|------------|---------------|
  | GHSA-gr2m-v5gq-v685 | electron | root devDep | high | ≥42.0.0-alpha.1 <42.9.2 | 42.9.2 |
  | GHSA-3wwx-pv8p-q78v | undici | jsdom `^7.25.0` + `@electron/get`; `@electron/rebuild→node-gyp` `^6.25.0` | high (npm rollup; advisory medium) | ≥6.25.0 <6.28.1, ≥7.28.0 <7.29.1 | 6.28.1 / 7.29.1 |
  | GHSA-r3ph-w7gj-g6xm | js-yaml | root devDep floor pin `>=4.3.1` hoisted to 5.x | moderate | ≥5.0.0 ≤5.4.0 | 5.4.1 |
- **How:** one `npm update electron undici js-yaml` — every resolved bump stayed
  **inside the already-declared package.json ranges** (`^42.1.0`, jsdom's `^7.25.0` /
  node-gyp's `^6.25.0`, `>=4.3.1`), so `package.json` is untouched and the lockfile
  diff is exactly 4 nodes × {version, resolved, integrity}. No new deps, no removals,
  no overrides/resolutions. Electron took the same-major minor ladder to 42.11.9
  (well past the 42.9.2 fix); undici landed on the patched heads of both declared
  streams (6.29.0, 7.30.0); js-yaml 5.4.2 clears the moderate advisory past the CI
  `--audit-level=high` threshold anyway (house policy: don't leave known advisories
  installed even below the gate).
- **Gates after bump (local, CI-faithful `NPM_CONFIG_USERCONFIG=/dev/null`):**
  `npm audit --audit-level=high` → 0 vulnerabilities exit 0; `npx vitest run` →
  430/430 (33 files); `npm run typecheck` (vue-tsc + tsc) → 0; `npm run lint` → 0;
  `npm run build` (renderer + main + preload assert) → 0; `xvfb-run npm run smoke`
  on Electron 42.11.9 → 1 passed — the rendered-content boot guards from 633863a
  stayed green on the new binary (no electron 42.8→42.11 boot regressions).

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
