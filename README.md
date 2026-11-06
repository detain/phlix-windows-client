# Phlix for Windows

[![Build](https://github.com/detain/phlix-windows-client/actions/workflows/build.yml/badge.svg)](https://github.com/detain/phlix-windows-client/actions/workflows/build.yml)
[![Test](https://github.com/detain/phlix-windows-client/actions/workflows/test.yml/badge.svg)](https://github.com/detain/phlix-windows-client/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/detain/phlix-windows-client/branch/master/graph/badge.svg)](https://codecov.io/gh/detain/phlix-windows-client)
[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](.github/workflows/test.yml)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows&logoColor=white)

A native Windows desktop application for the Phlix Media Server, built with Electron, Vue 3, and TypeScript. The user interface is provided by the shared **`@phlix/ui`** Vue app; this repo is a thin Electron shell + consumer.

## Project Overview

Phlix for Windows is the native desktop client for your Phlix Media Server, enabling users to browse, stream, and manage their media library with native Windows integration: system tray, media keys, and native menus. The entire renderer UI is the shared `@phlix/ui` app booted via `createPhlixApp(config)`, so screens and theming stay in sync with the other Phlix clients.

## Naming

One product, four identifiers — each with a fixed role (M-WINDOWS-48 retired the loose forms):

| Form | Where it lives | Role |
|---|---|---|
| **Phlix** | `build.productName` | the Start-menu / installed app name |
| **Phlix for Windows** | docs, About dialog | the human name for this client |
| `phlix-windows` / `phlix-windows-client` | npm package name / GitHub repo | machine identity |
| **Phlix Media Server** | server product | what this client *connects to* — never this app |

Developer-facing file headers and log lines keep the descriptive phrase "Phlix Media
Server Client for Windows" (machine-pinned by `tests/unit/copyright.test.mjs`); it reads
as "[[Phlix Media Server] Client] for Windows", and only humans should parse prose.

## Features

- **Media Library Browser** - Browse and search your media collection (provided by `@phlix/ui`)
- **Video Player** - Full-featured video playback with controls
- **System Tray Integration** - Minimize to tray with media controls
- **Native Menus** - Full application menu with keyboard shortcuts
- **Media Key Support** - Media key support via thumbar buttons and tray/menu keyboard accelerators (Play/Pause, Stop, Rewind/Forward 10s bridged into the player)
- **Authentication** - Secure login with session persistence (handled by `@phlix/ui`)
- **Shared UI** - Modern Vue 3 interface from `@phlix/ui` with the Nocturne theme (deliberate default — the client does not follow the OS dark/light preference; one consistent look across every launch is the estate-wide brand posture. Change it any time in Settings, which persists to your server profile)
- **Settings Management** - Configurable preferences including minimize-to-tray behavior and a desktop-notifications toggle (View menu or tray menu)

## Minimum Server Version

Phlix for Windows requires Phlix Media Server **1.1.0** or later — the first server release
where the capabilities this client drives are stable: skip-intro markers, media facets,
and schema-driven settings. (Servers ≥ 1.1.0 also expose SyncPlay group endpoints —
desktop watch parties ride them in server mode; see
[Watching with friends (SyncPlay)](#watching-with-friends-syncplay).)

## Install (end users)

Phlix for Windows is a standalone app — you do **not** need Node.js, a terminal, or any of
the build steps below. It requires **Windows 10 or 11, 64-bit (x64)** — both shipped
installers (NSIS and APPX) are x64-only, and the Electron runtime underneath does not
start on Windows 7/8 or on ARM64 Windows; check your edition in Settings → System →
About before downloading. Download an installer from the releases page and run it:

**Releases:** <https://github.com/detain/phlix-windows-client/releases>

### What is published today

As of 2026-11-07 the releases page carries one rolling build: **“Latest (master)”**, rebuilt
and replaced on every **green** push to `master`. It wears a *Pre-release* label because no stable
`v*` release has been cut yet — the label does not mean “broken”; it is the current official
download. (Publishing the first stable, versioned release is a maintainer release-process
decision — see *Release Process* below.)

The word “green” carries a disclosure: the republish chain is gated end-to-end — install, tests,
smoke, packaging, and the dependency audit gate (`scripts/audit-gate.mjs`) must all pass on the
push before the new build replaces the download. While any of those is red, the rolling release
**freezes at the last green build even as `master` keeps moving**. That is not hypothetical:
the last green master build for a while was `4e55fc02` (2026-10-30); from 2026-11-04 until the
audit-gate decision of 2026-11-06 two standing dev-chain advisories failed every push’s audit
leg, leaving the page up to 27 commits behind `master` while these words promised per-push
rebuilds. The cure went through the gate’s reviewed allow-list law rather than around it
(step 3 of *Release Process* below names the two admitted advisory ids and their re-verify
date); the gate itself stays strict — an advisory outside that list still freezes the chain.

Pick the asset that fits:

| Asset | What it is | Use it if |
|-------|-----------|-----------|
| **`Phlix-Setup-1.0.0.exe`** ([direct download](https://github.com/detain/phlix-windows-client/releases/download/latest/Phlix-Setup-1.0.0.exe)) | NSIS desktop installer — per-user, no admin rights needed, lets you choose the install folder | you are almost everyone else |
| **`Phlix.1.0.0.appx`** | APPX package for Store/sideload distribution | you know why you want this — installing an unsigned `.appx` requires a trusted certificate or Developer Mode; prefer the `.exe` otherwise |
| **`SHA256SUMS.txt`** | SHA-256 hashes of the two installers you download | you want to verify the download (optional) |

Filenames carry the `package.json` version (currently `1.0.0`) and are re-uploaded on each
green master push (the gate mechanism is disclosed above), so always take them from the release
page rather than bookmarking an old link.

**Running the installer:** double-click the downloaded `.exe` and follow the wizard — it
installs inside your Windows profile (no admin prompt; you choose the folder) and adds a
**Phlix** entry to the Start menu. The first time you run it, SmartScreen wants a word:

### First run: “Windows protected your PC”

The installers are **not code-signed** — no Authenticode certificate is provisioned for this
project yet — so SmartScreen shows a blue **“Windows protected your PC”** dialog and reports
the publisher as **Unknown**. That is the expected behavior of unsigned software, not a sign
the file is malicious, and there is no “verified publisher” here. To proceed safely:

1. Optional but recommended — verify the download. Also save `SHA256SUMS.txt` from the
   release page into the same folder, then run both lines in PowerShell from that folder:

   ```powershell
   $expected = (Select-String -Path .\SHA256SUMS.txt -Pattern 'Phlix-Setup\S*\.exe$').Line.Split(' ')[0]
   (Get-FileHash .\Phlix-Setup-1.0.0.exe -Algorithm SHA256).Hash.ToLower() -eq $expected
   ```

   `True` means the bytes match. The pattern is end-anchored on `.exe` because the checksum
   file carries one line per published artifact — today the rolling build lists exactly the two
   installers, the `.exe` and the `.appx`; a future *versioned* release additionally hashes the
   installer's `.blockmap` (differential-update map, hashed for completeness — you never
   download it by hand). Comparing by eye instead, mind the two format quirks the
   snippet above absorbs: `Get-FileHash` prints UPPERCASE hex while `SHA256SUMS.txt` is
   lowercase — the digits must agree, not the case (that is what `.ToLower()` normalizes);
   and the installer's line in `SHA256SUMS.txt` is keyed by its staging path,
   `nsis/Phlix-Setup-1.0.0.exe` — the file name itself is identical to the asset you
   downloaded (the `nsis/` prefix is the only addition).
2. In the SmartScreen dialog, click the small **“More info”** link.
3. Click **“Run anyway”**.

Once a signing certificate is provisioned this dialog will no longer appear
(see [`docs/signing.md`](docs/signing.md) for the developer-side story).

### First launch: connecting to a server

On first launch the app shows a **Connect** screen asking for your Phlix server URL —
there is no default server baked in, so type (or paste) the address of the Phlix Media
Server you use, then sign in with an account on that server.

The server must be **Phlix Media Server 1.1.0 or later** (see *Minimum Server Version*
above). The app checks the server's version at every launch, and the gate is precise
about what it blocks: it stops only a server that *explicitly reports* a version below
the minimum — an older server that does not implement the version endpoint at all fails
open, booting you into a possibly-degraded app instead of showing the screen described
here. When a server is stopped, you will not be left staring at a blank window: an error
dialog names both versions, and the window shows a persistent **"Phlix server too old"**
screen with the reported and required versions and a **Try again** button. Recover by
fixing the server, then press Try again — the check re-runs in place and, once the server
passes, the app boots straight through with no quit-and-relaunch ceremony. While that
screen is up the app's normal interface is not running, so there is no in-app way to
point it at a different server from here; the correction has to happen server-side.

After a successful connect, your server URL and login persist, so later launches go
directly to your library.

### Keyboard shortcuts

Two shortcuts are registered app-wide by the native menu; everything else that a
menu row *displays* is either a player-scoped key or a native role default:

| Keys | What they do | Scope |
|------|--------------|-------|
| `F11` | Toggle fullscreen | Anywhere in the app (registered menu accelerator) |
| `Ctrl` + `,` | Open Settings | Anywhere in the app (registered menu accelerator) |
| `Space`, `←`, `→` | Play/pause, seek −10 s / +10 s | Only while the **player** has focus — these are the shared web player's own keys. The Playback menu rows show them as a hint; they are deliberately *not* registered as menu accelerators, so they never hijack typing in a text field. Tray/thumbar/menu **clicks** route the same actions to the player regardless of focus. |
| `Ctrl` + `Z`/`X`/`C`/`V`, `Ctrl` + `A` | Undo, cut, copy, paste, select all | Editable text and selections (standard Windows Edit-menu roles) |

The transport rows carrying displayed-but-unregistered keys are a deliberate
honesty exception (they document the player's keys where users look for them —
the code comment at `src/main/index.ts` records the reasoning, and
`tests/unit/menuTraySurfaces.test.ts` pins that they register no accelerators).

### HTTPS & certificates

When your server URL is `https://`, its certificate must chain to a root the Windows
certificate store already trusts — a public CA (Let's Encrypt works fine for home
servers with LAN DNS), or your own private CA installed into the machine's trust store.
**Ad-hoc self-signed certificates are refused outright**: the app intentionally has no
accept-once prompt or certificate-pinning flow, so the connection simply fails (electron-log
records a `net::ERR_CERT_*` line) instead of training users to click past transport
security. Fix the certificate, not the client. An in-app trust/pinning ceremony is a
security-review-gated future feature, not available today.

### Getting updates

The app includes an update check (Help → *Check for Updates*, plus a background check about
every 6 hours), but **today it finds nothing and — for now — says nothing**: it deliberately
ignores pre-releases, and only the rolling “Latest (master)” pre-release exists. With no
stable release on the feed to compare against, the check's endpoint answers 404, which the
client files as an offline-class failure — logged, not shown — so even a manual check stays
silent. A reply is reserved for a live stable feed: once the first versioned release is
published, a manual check that finds nothing answers with a “You're on the latest
version” notification, while the background checks stay quiet. Until stable
versioned releases are published, getting a new build means re-downloading the current
installer from the [releases page](https://github.com/detain/phlix-windows-client/releases)
and installing over the old one. Release notes for versioned releases appear on that same
page; the rolling build’s notes name the `master` commit it was built from.

**If an update ever breaks things.** Versioned releases are permanent and the update
feed points at exactly one version at a time; if a published build turns out to be
bad, the maintainers withdraw it (see *Bad release? Withdrawing and rolling back*
under Deployment), but clients that already installed it will **not** downgrade
themselves — the updater only ever moves forward. Recover by installing the previous
version: download its installer from the
[releases page](https://github.com/detain/phlix-windows-client/releases), install it
over the current one, and decline any “update available” prompt until the feed points
at a fixed version. Settings, sign-in and playback state live under `%APPDATA%\Phlix`
and survive an install-over — nothing user-visible is lost.

## Privacy & Update Checks

Phlix for Windows is self-hosted software: your library, accounts, and playback data
live on **your** server. The app makes exactly two kinds of network calls:

1. **Your server (or hub)** — everything you browse, stream, and manage.
2. **GitHub Releases** — the built-in updater's feed: roughly 5 seconds after every
   launch and about every 6 hours while running, electron-updater fetches the
   `latest.yml` release metadata for `detain/phlix-windows-client` from
   GitHub's release API (`api.github.com`, then the asset download host for the
   installer bytes themselves if you accept an update).

There is **no usage data, no analytics, no crash reporting** — nothing that describes
what you watch ever leaves your machine. The device id the app sends *to your server*
is a locally generated random value (`windows-<uuid>`, stored under
`%APPDATA%\Phlix`, never derived from hardware). The GitHub update check discloses
your IP address and the standard Windows User-Agent to GitHub, like any browser
request would — that is the entire phone-home. Blocking `github.com`/`api.github.com`
at the firewall is safe: update checks fail quietly in the log and everything else
keeps working. Unauthenticated GitHub API calls allow 60 requests/hour per IP; the
updater's cadence (~5 s after each launch + one request per 6 h) stays orders of
magnitude below that for any normal LAN. Hosting math for the release feed: each
versioned release permanently accumulates roughly 290 MiB of assets (the measured
`latest` build shipped a 121 MiB NSIS installer and a 171 MiB APPX package) — well
inside GitHub's per-asset limits, with no retention policy needed at this scale.

## Prerequisites

These steps are for **developers building from source**. If you just want to use Phlix, see
*Install (end users)* above. Before setting up the project, ensure you have the following installed:

- **Node.js** >=24.0.0
- **npm** v9.x or later (comes with Node.js)
- **Git** for version control
- **Windows 10/11** as the target platform

For development:
- **Visual Studio Code** (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript and related tools

## Installation (from source — development)

> End users: use the *Install (end users)* section above; you do not need these steps.

1. **Clone the repository**
   ```bash
    git clone https://github.com/detain/phlix-windows-client.git
   cd phlix-windows-client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

   > Behind a restrictive firewall/proxy? `npm install` downloads the prebuilt
   > Electron binary (~110 MB) from GitHub release objects — the single longest
   > step of a source install (CI budgets ~10 min for it). Point it at a mirror
   > with `$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'`
   > (PowerShell) before installing, and give npm its proxy the usual way
   > (`npm config set proxy …` / `https-proxy`). No other build step phones home.

3. **Configure environment** (optional)

   Create a `.env` file in the root directory if you need a custom default server URL (used as the
   build-time fallback when no server URL is persisted):
   ```
   VITE_PHLIX_SERVER_URL=http://localhost:8096
   ```

## Configuration

The application stores configuration in the user's app data directory. The
directory is named after the running app's name — the packaged installer ships
as the product name **Phlix**, while a from-source run uses the package name
`phlix-windows`:
- **Windows (installed app)**: `%APPDATA%\Phlix`
- **Windows (running from source)**: `%APPDATA%\phlix-windows`

### Configuration Options

| Setting (electron-store key) | Default | Description |
|---------|---------|-------------|
| `minimizeToTray` | `true` | Closing the window hides it to the tray instead of quitting. To bring it back: click or double-click the tray icon, use the tray menu's **Show** entry, or launch the app again — the single-instance lock routes the launch to the running window and restores it |
| `notificationsEnabled` | `true` | Gates every desktop notification the app raises, update toasts included — while off, even a manual **Check for updates** answers only in the log. Toggle from the **View** menu or the tray menu (the two checkboxes stay in sync); a flip takes effect immediately |
| `serverUrl` | (none) | Persisted direct media server URL (`app:get/set-server-url`) |
| `deviceId` | Auto-generated | Stable per-install device id `windows-<uuid>` (`app:get-device-id`) |

While hidden there is no taskbar button, and Windows (unlike macOS) emits no
restore event for a hidden app — the tray icon and the relaunch handoff are the
restore surfaces, and both fully restore hidden, minimized, and combined states.

### Closing the Window

Clicking **×** does not quit Phlix by default: with `minimizeToTray` on (the
default, toggleable from the **View** menu), the window hides to the tray and
the app keeps playing. Understand what that means while it is hidden: the
signed-in session stays live — the renderer, any open WebSocket connections
(syncplay rooms, hub relay) and your stored tokens keep working, and anyone
with access to your Windows session can bring the window back from the tray
and act as you. Phlix has no app-level lock screen of its own, so treat the
tray-minimised state like an unlocked laptop: **lock Windows** when you step
away, or quit properly via the tray menu's **Quit** entry (media playback and
the session both end). Turning `minimizeToTray` off in the View menu makes
**×** quit outright instead; media-key/SMTC workflows are unaffected either way.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_PHLIX_SERVER_URL` | (none) | Build-time fallback is empty (user must configure a server URL at first boot) |
| `VITE_PHLIX_LOCALE` | (none) | Build-time UI locale override for the shell's own catalogs (nav/boot/menu/thumbar/overlay) |
| `NODE_ENV` | `development` | Runtime environment |
| `PHLIX_DISABLE_GPU` | (unset) | Set to `1` to switch off hardware acceleration at startup (`app.disableHardwareAcceleration()`) — the escape hatch for GPU-compositor crashes before the first window exists |
| `PHLIX_FORCE_PRODUCTION` | (unset) | Truthy value makes an unpackaged tree boot the production `app://` path instead of the Vite dev server — what the smoke test uses to exercise the real boot URL without a packaged installer |

There is no environment variable for hub mode; its runtime channel (`hub:set-config`) exists in
the shell but ships no caller today — see *Hub Mode (not yet enterable)* below.

## Building the App

### Development Mode

Run the application in development mode with hot reload:

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron app pointed at the dev server. Renderer changes hot-reload via Vite;
  **main-process and preload changes do not** — `dev:electron` launches Electron
  once (`electron .`), so restart the dev command after editing `src/main/**` or
  `src/preload/**` (DEVELOPER.md's troubleshooting entry walks this through).

### Production Build

**Build both renderer and main process:**
```bash
npm run build
```

**Build only the renderer (Vue app):**
```bash
npm run build:vite
```

**Build only the main process (Electron):**
```bash
npm run build:electron
```

### Packaging

Package the app for Windows distribution:

**NSIS Installer (recommended):**
```bash
npm run package
```

**Windows Store (APPX):**
```bash
npm run package:store
```

The packaged output will be in the `release/` directory.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

Tests live in `tests/` — run `npm test` to execute the full suite.

### Linting & Typecheck

```bash
# Run ESLint (flat config: eslint.config.mjs)
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Typecheck the renderer (Vue) and the Electron main/preload
npx vue-tsc --noEmit
npx tsc -p tsconfig.main.json --noEmit
```

## Project Structure

```
phlix-windows-client/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts    # Main entry point, window management, IPC, tray
│   ├── preload/        # Preload script (context bridge)
│   │   └── index.ts    # Secure IPC exposure to renderer
│   └── renderer/       # Thin @phlix/ui consumer PLUS local surfaces (see UI & State)
│       ├── main.ts            # Entry: boot() → createPhlixApp() → mount → installElectronBridge; renders the too-old-server boot-failure screen (renderIncompatibleServerScreen) with Retry
│       ├── overlay.tsx        # Second Vue app entry (dynamic import from boot): mounts player overlays on #player-supplement-root
│       ├── components/        # Local player overlay components: PlayerSupplement · SleepTimer · PiPButton
│       ├── mediaSession.ts    # navigator.mediaSession / SMTC action handlers
│       ├── safeStorageTokenStore.ts # DPAPI-backed TokenStore adapter (seam shipped in the upstream v0.99.12 wave; boot() threads it since 6e0f739f, v0.99.13-pin era)
│       ├── i18n/              # windows-own catalogs (7 locales) + vendored ui locale bundles + overrides
│       ├── resolveConfig.ts   # Pure app-mode + apiBase resolution (hub vs direct server)
│       ├── electronBridge.ts  # Maps Electron media/window IPC → @phlix/ui player store + router
│       ├── index.html         # Mounts #phlix-app + #player-supplement-root
│       ├── test-setup.ts      # jsdom localStorage mock
│       ├── vite-env.d.ts
│       └── types/electron.d.ts
├── tests/
│   └── unit/           # resolveConfig · electronBridge · main
├── build/              # Build resources (icons)
├── release/            # Packaged application output (gitignored)
├── package.json
├── vite.config.mts
├── vitest.config.mts
├── eslint.config.mjs
└── tsconfig.json
```

## Architecture

### Electron Process Model

1. **Main Process** (`src/main/index.ts`)
   - Creates BrowserWindow
   - Manages system tray and menus
   - Handles IPC from renderer (incl. `app:get-server-url`/`app:set-server-url`/`app:get-device-id`)
   - Manages app lifecycle

2. **Preload Script** (`src/preload/index.ts`)
   - Exposes safe APIs via contextBridge (incl. `getServerUrl`/`setServerUrl`/`getDeviceId`)
   - Provides IPC invoke/send methods
   - Relays media control events to the renderer

3. **Renderer Process** (`src/renderer/`)
   - A thin consumer of the shared `@phlix/ui` Vue app, booted via `createPhlixApp(config)` — plus enumerated local surfaces: player overlay components, a boot-failure screen, i18n catalogs, a DPAPI token-store adapter (see *UI & State* below)
   - Vue 3 + Pinia + vue-router (peer deps of `@phlix/ui`)
     - Pinned to `@phlix/ui` `github:detain/phlix-ui#v0.99.22` and `@phlix/contracts` `github:detain/phlix-contracts#v0.5.6`
   - Vite (`@vitejs/plugin-vue`) for development and bundling

### UI & State

All screens, theming, and application state live in the shared **`@phlix/ui`** app (Pinia stores + vue-router), and every route renders a vendored page view. Along that consumer, this repo ships its own local surfaces: player overlay components (`src/renderer/components/PlayerSupplement.tsx`, `SleepTimer.tsx`, `PiPButton.tsx`, mounted by the separate app entry `src/renderer/overlay.tsx`), a DOM-rendered boot-failure screen for too-old servers with a working Retry (`renderIncompatibleServerScreen` in `src/renderer/main.ts`), a DPAPI-backed `TokenStore` adapter wired into the ui `tokenStore` seam — auth tokens seal into `%APPDATA%` via safeStorage instead of localStorage (`src/renderer/safeStorageTokenStore.ts`), `navigator.mediaSession`/SMTC handlers (`src/renderer/mediaSession.ts`), and its own i18n catalogs (`src/renderer/i18n/` — seven windows-own locales over the vendored ui bundles). The route table, nav entries and admin gating that place the vendored pages under `/app/*` are likewise authored locally (the routes and admin gating in `buildExtraRoutes`, the nav entries in `buildMenu` — both in `main.ts`). Configuration passed to `createPhlixApp` (app-mode, `apiBase`, `deviceHeaders`, theme, branding) is resolved at boot from Electron config; device headers are built with `@phlix/contracts` `buildPhlixHeaders`. Electron tray/menu events are bridged into `@phlix/ui`'s player store and router by `src/renderer/electronBridge.ts`.

## Deployment

### GitHub Actions CI/CD

The project uses GitHub Actions for continuous integration:

- **test.yml** - Runs on every push/PR to validate code
- **build.yml** - Builds NSIS + APPX installers on every master push (publishing them to the rolling `latest` prerelease) and, on `v*.*.*` tags, creates the versioned GitHub Release with checksum and updater-feed files attached
- **codeql.yml** - GitHub Code Scanning (`security-extended` queries) on pushes/PRs touching `src/**`; findings land in the repo's Security tab, it gates nothing by itself

> **Note:** For local development use `npm install`. For automated CI pipelines (including the GitHub Actions workflows above), use `npm ci` — it performs a clean, reproducible install from the lockfile, which is faster and safer than `npm install` in CI environments.

### Release Process

0. **Update `CHANGELOG.md` first.** It is hand-maintained (newest entries prepend
   under `## [Unreleased]`-style headers at the top; history below is verbatim and
   never rewritten — corrections ride as new entries). Move the unreleased block
   under a versioned heading as part of the version bump commit. The GitHub
   release *body* is generated automatically from merged PRs
   (`generate_release_notes: true`) and is separate from the CHANGELOG — nobody
   hand-writes it, and it is not a copy of the CHANGELOG.
1. Update version in `package.json`
2. Create git tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. GitHub Actions will automatically:
   - Run ESLint, vue-tsc, tsc -p tsconfig.main.json, vitest, smoke tests (Linux + Windows), and the dependency audit allow-list gate (`scripts/audit-gate.mjs`) before packaging. The audit gate is the chain's hard stop: red, it freezes both the rolling build and any tag release (see *What is published today*). Its allow-list currently carries exactly two reviewed entries — GHSA-3g3m-2fjr-6pw4 (`glob`) and GHSA-g3hv-75wg-m249 (`minimatch`): both dev-chain-only, each with measured no-in-range-fix evidence, an upstream-watch removal plan, and a re-verify-by date of 2027-02-04. The two founding entries were retired before them — ch52 (`http-cache-semantics`) cleared by taking 4.3.0 in-range on 2026-10-08, and hp3w (`sprintf-js`) by upstream withdrawal on 2026-10-22. The semantics stay a strict subset check, not a threshold: any advisory outside the list reddens the gate
   - Build the NSIS and APPX packages
   - Verify the tag version matches `package.json` (drift fails the release)
   - Create the GitHub Release with the NSIS + APPX installers, `SHA256SUMS.txt`, and — attached verbatim, never hand-written — electron-builder's own `latest.yml` updater feed plus the installer's `.blockmap` (differential downloads)
   - Publish them **UNSIGNED**: no Authenticode certificate is provisioned for this repo yet (signing in `build.yml` is an annotated inactive sketch; `docs/signing.md` carries the status and the future path). SmartScreen reporting "Unknown Publisher" on downloaded installers is therefore the expected reality — see *First run: "Windows protected your PC"* above

> **Note:** The tag-triggered chain was repaired on 2026-10-29 (see CHANGELOG — the
> release job had two deterministically-failing steps and had never executed, as no
> `v*` tag exists yet). The first tag push is its end-to-end proving run.

### Bad release? Withdrawing and rolling back

If a versioned release turns out to be broken, the goal is to stop the updater feed
from pointing at it **before** more clients download it, and to plan manual recovery
for clients that already installed it. The feed is the `latest.yml` asset attached to
the most recent **non-prerelease** GitHub release: `autoUpdater.allowPrerelease` and
`autoDownload` are both `false` (`src/main/index.ts`), so nothing is ever
force-installed — a download starts only when the user clicks *Install update*, and
`quitAndInstall` runs only on their explicit *Restart* click.

1. **Withdraw the release from the feed.** Edit the bad release on GitHub and check
   *pre-release*. The updater skips pre-releases, so the feed rolls back to the
   previous stable release without deleting anything — reversible, and the bad
   artifacts stay downloadable for forensics. If the bad one was the **first**
   versioned release (no older stable release exists), the feed 404s instead and
   update checks fail quietly, which is the same no-op-as-today behavior the
   *Getting updates* section already describes.
2. **Prefer a hotfix over a rollback.** If a corrected build is quick, cut the next
   patch tag normally (see *Release Process*): clients that never accepted the bad
   update move straight to the fix on their next check (≤ 6 h, or Help →
   *Check for Updates*).
3. **Never delete an older release.** It **is** the rollback target — its asset trio
   (installer + `latest.yml` + `.blockmap`) is what the feed falls back to. Editing a
   newer release to carry an older `latest.yml` is a no-op: clients compare versions
   and `autoUpdater.allowDowngrade` defaults to `false` (deliberately never set in
   this repo), so an older feed entry is ignored.
4. **Clients already on the bad build do not self-recover.** The feed moving backward
   is invisible to them — they are on a higher version. Say so in the release notes
   or a pinned issue and point at the *Getting updates* recovery note (install the
   previous installer over it; `%APPDATA%\Phlix` survives).
5. **Re-tagging after a deleted tag recreates the same bytes** from the same commit —
   the release job builds what the tag points at. If the release must go, withdraw it
   (step 1) first, then decide about the tag; publishing a fixed version number is
   almost always the better story.

The note above applies here too: none of this has executed end-to-end yet, and the
first real bad release is the rehearsal for this section.

### Windows Installer

The build workflow produces:
- **NSIS Installer** - Traditional `.exe` installer
- **APPX Package** - For Windows Store distribution

## Hub Mode (not yet enterable)

**Status, measured at this build:** the shell ships the full hub-mode *machinery* — persisted
config IPC, the boot-time mode resolver branch, hub navigation, and hub page routes — but there
is **no in-app way to enter hub mode**: the configuration writer `hub:set-config` has zero
callers, and every desktop screen (Settings included) is the pinned `@phlix/ui` bundle, which
ships no hub-connection form and never touches `window.electronAPI`. `tests/unit/hubModeStatus.test.ts`
pins all of this. Until an upstream connection seam lands, **every launch boots server mode**.

Typing a Hub URL into the first-run Connect screen does **not** enter hub mode — the value is
persisted as a direct `serverUrl` and the app then drives server-mode endpoints against a hub
API (404s on server-only routes). The hub pages (MyServers, Server Detail, Federation,
Federation-Shares, Manage-Shares, Shared-With-Me, Invite-Links, Accept-Invite, hub-admin) are
registered by `buildMenu('hub')` / `buildExtraRoutes('hub')` and stay unreachable with the mode —
as do the `phlix://accept-invite` and `phlix://server` deep-link arms documented in
`docs/deep-links.md`, which today parse, resolve to the same 404 view, and re-live with the rider.

What the machinery does once a hub config exists (unit-tested via `tests/unit/resolveConfig.test.ts`
and the status pins above):

- `hub:get-config` / `hub:set-config` (`src/main/index.ts`) read/write the persisted config:
  `hubUrl` under the M-WINDOWS-11 DPAPI custody, `activeServerId` and `connectionMode` as plain
  electron-store rows (defaults: no hub URL, mode `direct`).
- `resolveAppConfig` (`src/renderer/resolveConfig.ts`) picks the mode at boot: configured
  `hubUrl` + `connectionMode` not `direct` → hub mode against the hub URL; otherwise server
  mode (persisted server URL → build-time env fallback → empty → Connect screen).
- Hub mode swaps in the hub nav and page routes listed above, mirroring the hub's own web-ui.

**Rider:** entering hub mode needs an `@phlix/ui` connection seam (a hub/server entry form in
the shared Settings or Connect surface — this repo's thin-consumer law forbids a windows-owned
settings page). The other half of that same upstream v0.99.12 wave — the `tokenStore` seam behind
`src/renderer/safeStorageTokenStore.ts` — has since shipped and is wired (see *UI & State*); the
connection seam never landed, so hub mode stays withheld. When the tripwire pins redden because that seam shipped
or a caller landed, wire `boot()` to the existing `hubSetConfig` channel, restore the enterable
copy (Features + What Works bullets, how-to steps), and retire the pins together.

## Troubleshooting

### Common Issues

**App doesn't start:**
- Relaunch **Phlix** from the Start menu; if it only minimized, use the tray
  icon's Show entry (hover it — the tooltip reads "Phlix", and "Phlix — playing"
  while media is running).
- **Blank or black window on older GPU drivers:** some integrated/legacy drivers
  fail Chromium's GPU path. The recovery dialog ("Something went wrong…") that
  appears on a hard failure offers Reload; if the window stays blank instead,
  set the escape-hatch environment variable and relaunch:
  `setx PHLIX_DISABLE_GPU 1` in PowerShell (takes effect for apps started from
  the next sign-in onward), or launch once from a shell with
  `$env:PHLIX_DISABLE_GPU='1'` prepended. Hardware acceleration then stays off
  for that install. A persisted `disableHardwareAcceleration` preference exists
  in the app store and is applied at launch, but the bundled settings screen
  currently ships no toggle that writes it — the environment variable is the
  supported user entry path (a future renderer toggle is a `@phlix/ui`
  feature request).
- Read the newest file in `%APPDATA%\Phlix\logs\` — main-process failures are
  recorded there by electron-log. Since the network-diagnostics work the file
  also records TLS rejections and failed page loads as URL summaries.
- If the installation looks damaged, verify the installer against
  `SHA256SUMS.txt` (see *First run* above) and reinstall.

**App doesn't start when running from source:**
- Ensure Node.js 24+ is installed (the repo's `engines.node` requires `>=24.0.0` — see Prerequisites)
- Run `npm install` to install dependencies
- Check console for error messages

**Vite server port conflict (also from source):**
- Kill processes using port 5173
- Modify `vite.config.mts` to use a different port

**Build fails with native modules:**
- Run `npm rebuild` to rebuild native dependencies
- Ensure electron-builder is up to date

### Logs

Application logs are stored in (same packaged-vs-source naming as *Configuration*):
- **Windows (installed app)**: `%APPDATA%\Phlix\logs\`
- **Windows (running from source)**: `%APPDATA%\phlix-windows\logs\`

Use `electron-log` for runtime logging:
```typescript
import log from 'electron-log';
log.info('Application started');
```

## Uninstall & Stored Data

Remove it like any other app — Settings → Apps → **Phlix** → Uninstall (or the Start-menu
uninstall entry). The per-user install lives in `%LOCALAPPDATA%\Programs\Phlix` unless a
different folder was chosen at install time; no admin rights were used to install, none
are needed to remove it.

**Your settings, device id and logs deliberately survive uninstallation** — the installer
ships with electron-builder's `deleteAppDataOnUninstall` unset, so reinstalling restores
the server connection instead of wiping it. Everything the app persisted lives under
`%APPDATA%\Phlix` (see *Configuration* and *Logs*); delete that folder after uninstalling
to leave a clean machine, e.g. before handing it to someone else.

## License

MIT License - see project repository for details.

## Status

### What Works

- **Electron shell** — Main/preload/renderer architecture with secure `contextBridge` IPC
- **Thin renderer + local surfaces** — Boots `@phlix/ui` via `createPhlixApp()`; ships local player overlays (SleepTimer/PiP via `overlay.tsx`), a boot-failure screen with Retry, own i18n catalogs, and a DPAPI token-store adapter WIRED into the shell's `tokenStore` seam (auth tokens seal into `%APPDATA%` via safeStorage; plaintext rows fold on first launch)
- **System tray** — Minimize-to-tray, tray menu with media controls
- **Native menus** — Full File/Edit/Playback/View/Help menu bar; the registered accelerators (`F11`, `Ctrl+,`) plus native Edit roles — see *Keyboard shortcuts*
- **Media keys** — Thumbar buttons and tray/menu transport entries (Play/Pause, Stop, Rewind/Forward 10s) routed into the player; the player's own `Space`/`←`/`→` stay focus-scoped on purpose
- **Packaging** — NSIS x64 installer and APPX via `electron-builder`
- **CI pipeline** — ESLint, vue-tsc, tsc -p tsconfig.main.json, vitest, npm audit, smoke test gate on every PR/push
- **Coverage** — The authoritative coverage gate is vitest's enforced `lines: 54` threshold, enforced on the one CI leg that actually runs coverage — the ubuntu `npm test -- --coverage` job in `.github/workflows/test.yml` (the windows leg and the build-pipeline test run execute bare `npm test`, on which thresholds cannot fire); Codecov/Codacy uploads additionally run best-effort on that same ubuntu leg only (their tokens are not provisioned for this repo — uploads are known to 404; see `docs/ci-baseline.md`)

### Known Limitations

- App boots to Connect screen on first launch (no default server URL; user must configure a server URL)
- **Hub Mode** — the shipped machinery (config IPC, resolver branch, hub nav + routes) cannot be entered today: `hub:set-config` has zero callers and the pinned `@phlix/ui` bundle ships no hub-connection form — see [Hub Mode (not yet enterable)](#hub-mode-not-yet-enterable)
- Offline Downloads have no surface in this client — the shared `@phlix/ui` bundle carries no offline/download page
- Watching with friends (SyncPlay): LIVE in server mode (nav entry + boot-derived socket hint); hub mode still has no SyncPlay entry — see [Watching with friends (SyncPlay)](#watching-with-friends-syncplay)

## Watching with friends (SyncPlay)

**Watch with friends from the desktop app, in server mode.** The `SyncPlay` page
(`/app/syncplay`) is registered by the shared shell, the video player carries the
SyncPlay controls (create/join room), and the top-bar nav now shows the entry. Room
listing, create and join ride ordinary REST calls to your server; playback sync runs
over the WebSocket your server exposes on port 8097.

How the desktop reaches that socket, measured against the exact shared UI bundle it
ships (`@phlix/ui` v0.99.22, see `package.json`):

- **The host-configurable seam.** The shared room socket prefers a `wsUrl` socket
  hint (upstream `phlix-ui` `94579936`, R12-02) over its legacy same-origin
  derivation. This app's boot derives the hint — `ws(s)://<your-server-host>:8097` —
  from the connected server's URL and hands it to the shell before mount; changing
  the connection updates it live (the shell reads it at every dial). The legacy
  same-origin path survives only as the fail-soft fallback when nothing is
  connected yet.
- **Hub mode stays withheld.** No SyncPlay nav entry there on purpose: hub rooms
  run over the :8804 relay, and the same seam would override those relay dials —
  surfacing watch parties in hub mode needs relay-aware evidence first. This is
  rider leg 4 of `M-WINDOWS-04`; until it lands, hub users can still SyncPlay from
  the web player their server serves.
- **TLS and proxies are visible now.** The shell inherits the Windows system
  proxy for everything it dials itself (REST probes, the updater, and `wss://`
  :8097 sync sockets). Self-signed or corporate-intercepted certificates still
  fail closed — that is the security posture — but they no longer fail silent:
  every rejected certificate and main-frame load failure lands in
  `%APPDATA%\Phlix\logs\` as a scheme+host summary (never a path or token), a
  redacted toast names the failure class, and a boot that never loaded offers
  Reload instead of spinning forever. Fixing the certificate (or serving valid
  TLS) makes them stop; the page CSP already carries the `ws:`/`wss:` pair the
  sockets need.

The withheld-nav era this section used to document ended with the @phlix/ui
v0.99.12 re-pin (2026-11-02), which executed the **M-WINDOWS-04 rider**: seam
wired at boot, nav entry added in server mode, docs flipped in the same change.
The tripwire stands: `tests/unit/syncplayDesktopStatus.test.ts` (and the nav/reachability
pins in `main.test.ts` / `routeReachability.test.ts`) redden the moment the installed
bundle or this repo's wiring drifts from the story above, so these docs cannot silently
go stale.

## Support

For issues and feature requests, please use the GitHub issue tracker.
Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for gates,
fork-CI secret behavior, and scope boundaries.
