# Changelog

All notable changes to **phlix-windows-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

## [W0.8] — 2025-07-/

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
