# Changelog

All notable changes to **phlix-windows-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
