# Phlix Windows Desktop App

[![Build](https://github.com/detain/phlix-windows-client/actions/workflows/build.yml/badge.svg)](https://github.com/detain/phlix-windows-client/actions/workflows/build.yml)
[![Test](https://github.com/detain/phlix-windows-client/actions/workflows/test.yml/badge.svg)](https://github.com/detain/phlix-windows-client/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/detain/phlix-windows-client/branch/master/graph/badge.svg)](https://codecov.io/gh/detain/phlix-windows-client)
[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](.github/workflows/test.yml)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows&logoColor=white)

A native Windows desktop application for the Phlix Media Server, built with Electron, Vue 3, and TypeScript. The user interface is provided by the shared **`@phlix/ui`** Vue app; this repo is a thin Electron shell + consumer.

## Project Overview

Phlix Windows provides a full-featured media server client for Windows, enabling users to browse, stream, and manage their media library with native desktop integration including system tray, media keys, and native menus. The entire renderer UI is the shared `@phlix/ui` app booted via `createPhlixApp(config)`, so screens and theming stay in sync with the other Phlix clients.

## Features

- **Media Library Browser** - Browse and search your media collection (provided by `@phlix/ui`)
- **Video Player** - Full-featured video playback with controls
- **System Tray Integration** - Minimize to tray with media controls
- **Native Menus** - Full application menu with keyboard shortcuts
- **Media Key Support** - Media key support via thumbar buttons and tray/menu keyboard accelerators (Play/Pause, Stop, Rewind/Fast-Forward ±10s bridged into the player)
- **Authentication** - Secure login with session persistence (handled by `@phlix/ui`)
- **Shared UI** - Modern Vue 3 interface from `@phlix/ui` with the Nocturne theme
- **Settings Management** - Configurable preferences including minimize-to-tray behavior
- **Hub Mode** - Connect to a Phlix Hub to manage multiple servers, with support for direct-LAN and relay connection modes

## Minimum Server Version

Phlix Windows requires Phlix Media Server **1.1.0** or later — the first server release
where the capabilities this client drives are stable: skip-intro markers, media facets,
and schema-driven settings. (Servers ≥ 1.1.0 also expose SyncPlay group endpoints; those
power the **web player your server hosts**, not this desktop app — see
[Watching with friends (SyncPlay)](#watching-with-friends-syncplay) for why.)

## Install (end users)

Phlix for Windows is a standalone app — you do **not** need Node.js, a terminal, or any of
the build steps below. Download an installer from the releases page and run it:

**Releases:** <https://github.com/detain/phlix-windows-client/releases>

### What is published today

As of 2026-10-29 the releases page carries one rolling build: **“Latest (master)”**, rebuilt
and replaced on every push to `master`. It wears a *Pre-release* label because no stable
`v*` release has been cut yet — the label does not mean “broken”; it is the current official
download. (Publishing the first stable, versioned release is a maintainer release-process
decision — see *Release Process* below.)

Pick the asset that fits:

| Asset | What it is | Use it if |
|-------|-----------|-----------|
| **`Phlix-Setup-1.0.0.exe`** ([direct download](https://github.com/detain/phlix-windows-client/releases/download/latest/Phlix-Setup-1.0.0.exe)) | NSIS desktop installer — per-user, no admin rights needed, lets you choose the install folder | you are almost everyone else |
| **`Phlix.1.0.0.appx`** | APPX package for Store/sideload distribution | you know why you want this — installing an unsigned `.appx` requires a trusted certificate or Developer Mode; prefer the `.exe` otherwise |
| **`SHA256SUMS.txt`** | SHA-256 hashes of both installers | you want to verify the download (optional) |

Filenames carry the `package.json` version (currently `1.0.0`) and are re-uploaded on each
master push, so always take them from the release page rather than bookmarking an old link.

On first launch the app asks for your Phlix server (or Hub) URL — the server must be
Phlix Media Server **1.1.0 or later** (see *Minimum Server Version* above).

### First run: “Windows protected your PC”

The installers are **not code-signed** — no Authenticode certificate is provisioned for this
project yet — so SmartScreen shows a blue **“Windows protected your PC”** dialog and reports
the publisher as **Unknown**. That is the expected behavior of unsigned software, not a sign
the file is malicious, and there is no “verified publisher” here. To proceed safely:

1. Optional but recommended — verify the download. Also save `SHA256SUMS.txt` from the
   release page into the same folder, then run both lines in PowerShell:

   ```powershell
   $expected = (Select-String -Path .\SHA256SUMS.txt -Pattern 'Phlix-Setup').Line.Split(' ')[0]
   (Get-FileHash .\Phlix-Setup-1.0.0.exe -Algorithm SHA256).Hash.ToLower() -eq $expected
   ```

   `True` means the bytes match. Comparing by eye instead, mind the two format quirks the
   snippet above absorbs: `Get-FileHash` prints UPPERCASE hex while `SHA256SUMS.txt` is
   lowercase — the digits must agree, not the case (that is what `.ToLower()` normalizes);
   and the installer's line in `SHA256SUMS.txt` is keyed by its staging path,
   `nsis/Phlix-Setup-1.0.0.exe` — the file name itself is identical to the asset you
   downloaded (the `nsis/` prefix is the only addition).
2. In the SmartScreen dialog, click the small **“More info”** link.
3. Click **“Run anyway”**.

Once a signing certificate is provisioned this dialog will no longer appear
(see [`docs/signing.md`](docs/signing.md) for the developer-side story).

### Getting updates

The app includes an update check (Help → *Check for Updates*, plus a background check about
every 6 hours), but **today it will silently find nothing**: it deliberately ignores
pre-releases, and only the rolling “Latest (master)” pre-release exists. Until stable
versioned releases are published, getting a new build means re-downloading the current
installer from the [releases page](https://github.com/detain/phlix-windows-client/releases)
and installing over the old one. Release notes for versioned releases appear on that same
page; the rolling build’s notes name the `master` commit it was built from.

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
   cd phlix-windows
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment** (optional)

   Create a `.env` file in the root directory if you need a custom default server URL (used as the
   build-time fallback when no server URL is persisted and Hub mode is not configured):
   ```
   VITE_PHLIX_SERVER_URL=http://localhost:8096
   ```

## Configuration

The application stores configuration in the user's app data directory:
- **Windows**: `%APPDATA%\phlix-windows`

### Configuration Options

| Setting (electron-store key) | Default | Description |
|---------|---------|-------------|
| `minimizeToTray` | `true` | Closing the window hides it to the tray instead of quitting. To bring it back: click or double-click the tray icon, use the tray menu's **Show** entry, or launch the app again — the single-instance lock routes the launch to the running window and restores it |
| `serverUrl` | (none) | Persisted direct media server URL (`app:get/set-server-url`) |
| `deviceId` | Auto-generated | Stable per-install device id `windows-<uuid>` (`app:get-device-id`) |

While hidden there is no taskbar button, and Windows (unlike macOS) emits no
restore event for a hidden app — the tray icon and the relaunch handoff are the
restore surfaces, and both fully restore hidden, minimized, and combined states.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_PHLIX_SERVER_URL` | (none) | Build-time fallback is empty (user must configure a server or Hub URL at first boot) |
| `NODE_ENV` | `development` | Runtime environment |

Hub mode is configured at runtime (persisted via `hub:set-config` in electron-store), not via an environment variable — see the Hub Mode section below.

## Building the App

### Development Mode

Run the application in development mode with hot reload:

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron app with automatic reload on changes

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
phlix-windows/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts    # Main entry point, window management, IPC, tray
│   ├── preload/        # Preload script (context bridge)
│   │   └── index.ts    # Secure IPC exposure to renderer
│   └── renderer/       # Thin @phlix/ui consumer (no local pages/components/stores)
│       ├── main.ts            # Entry: boot() → createPhlixApp() → mount → installElectronBridge
│       ├── resolveConfig.ts   # Pure app-mode + apiBase resolution (hub vs direct server)
│       ├── electronBridge.ts  # Maps Electron media/window IPC → @phlix/ui player store + router
│       ├── index.html         # Mounts #phlix-app
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
   - A thin consumer of the shared `@phlix/ui` Vue app, booted via `createPhlixApp(config)`
   - Vue 3 + Pinia + vue-router (peer deps of `@phlix/ui`)
     - Pinned to `@phlix/ui` `github:detain/phlix-ui#v0.99.10` and `@phlix/contracts` `github:detain/phlix-contracts#v0.5.3`
   - Vite (`@vitejs/plugin-vue`) for development and bundling

### UI & State

All screens, navigation, theming, and state live in the shared **`@phlix/ui`** app (Pinia stores + vue-router). This repo does not define its own pages, components, or stores. Configuration passed to `createPhlixApp` (app-mode, `apiBase`, `deviceHeaders`, theme, branding) is resolved at boot from Electron config; device headers are built with `@phlix/contracts` `buildPhlixHeaders`. Electron tray/menu events are bridged into `@phlix/ui`'s player store and router by `src/renderer/electronBridge.ts`.

## Deployment

### GitHub Actions CI/CD

The project uses GitHub Actions for continuous integration:

- **test.yml** - Runs on every push/PR to validate code
- **build.yml** - Builds NSIS + APPX installers on every master push (publishing them to the rolling `latest` prerelease) and, on `v*.*.*` tags, creates the versioned GitHub Release with checksum and updater-feed files attached

> **Note:** For local development use `npm install`. For automated CI pipelines (including the GitHub Actions workflows above), use `npm ci` — it performs a clean, reproducible install from the lockfile, which is faster and safer than `npm install` in CI environments.

### Release Process

1. Update version in `package.json`
2. Create git tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. GitHub Actions will automatically:
   - Run ESLint, vue-tsc, tsc -p tsconfig.main.json, vitest, smoke tests (Linux + Windows), and the dependency audit allow-list gate (`scripts/audit-gate.mjs`) before packaging
   - Build the NSIS and APPX packages
   - Verify the tag version matches `package.json` (drift fails the release)
   - Create the GitHub Release with the NSIS + APPX installers, `SHA256SUMS.txt`, and — attached verbatim, never hand-written — electron-builder's own `latest.yml` updater feed plus the installer's `.blockmap` (differential downloads)

> **Note:** The tag-triggered chain was repaired on 2026-10-29 (see CHANGELOG — the
> release job had two deterministically-failing steps and had never executed, as no
> `v*` tag exists yet). The first tag push is its end-to-end proving run.

### Windows Installer

The build workflow produces:
- **NSIS Installer** - Traditional `.exe` installer
- **APPX Package** - For Windows Store distribution

## Hub Mode

Hub Mode allows you to connect to a Phlix Hub to manage and access multiple Phlix servers through a single interface. This is useful for users with servers in different locations or network environments.

### Features

- **Hub Authentication** - Sign in to your Phlix Hub account
- **Server Switcher** - Quickly switch between your claimed servers
- **Connection Modes**:
  - **Direct** - Connect directly to servers via LAN for lowest latency
  - **Relay** - Route traffic through the hub for remote access
- **Session Persistence** - Hub session persists across app restarts

### Configuration

Hub configuration is persisted at runtime in electron-store (via the `hub:set-config` IPC) — there is
no environment variable for it. At boot, `resolveAppConfig` runs the app in **hub mode** (against
`hub.hubUrl`) whenever a Hub URL is configured and the connection mode is not explicitly `direct`;
otherwise it runs in **server mode** against the persisted direct server URL.

#### In-App Configuration
1. Open Settings
2. Navigate to Hub Mode section
3. Enter your Hub URL
4. Sign in with your Hub credentials
5. Select a server from your claimed servers list
6. Choose connection mode (Direct or Relay)

### Connection Flow

1. User configures Hub URL and signs in; the choice is persisted via `hub:set-config`
2. On next boot, `resolveAppConfig` selects hub vs direct server mode and the `apiBase`
3. App fetches the list of claimed servers from the Hub (via `@phlix/ui`)
4. API calls route through direct-LAN or hub-relay based on the chosen mode
5. Active server and connection mode persist across sessions

## Troubleshooting

### Common Issues

**App doesn't start:**
- Ensure Node.js 18+ is installed
- Run `npm install` to install dependencies
- Check console for error messages

**Vite server port conflict:**
- Kill processes using port 5173
- Modify `vite.config.mts` to use a different port

**Build fails with native modules:**
- Run `npm rebuild` to rebuild native dependencies
- Ensure electron-builder is up to date

### Logs

Application logs are stored in:
- **Windows**: `%APPDATA%\phlix-windows\logs\`

Use `electron-log` for runtime logging:
```typescript
import log from 'electron-log';
log.info('Application started');
```

## License

MIT License - see project repository for details.

## Status

### What Works

- **Electron shell** — Main/preload/renderer architecture with secure `contextBridge` IPC
- **Thin renderer** — Boots `@phlix/ui` via `createPhlixApp()`; no local UI ownship
- **System tray** — Minimize-to-tray, tray menu with media controls
- **Native menus** — Full File/Playback/View/Help menu bar with keyboard accelerators
- **Media keys** — Thumbar buttons and tray/menu keyboard accelerators (Play/Pause, Stop, Rewind/Forward ±10s)
- **Hub Mode** — Connect to a Phlix Hub; direct-LAN and relay connection modes
- **Packaging** — NSIS x64 installer and APPX via `electron-builder`
- **CI pipeline** — ESLint, vue-tsc, tsc -p tsconfig.main.json, vitest, npm audit, smoke test gate on every PR/push
- **Coverage** — Reports generated and uploaded to Codecov and Codacy on each CI run

### Known Limitations

- App boots to Connect screen on first launch (no default server URL; user must configure a server or Hub)
- Offline Downloads have no surface in this client — the shared `@phlix/ui` bundle carries no offline/download page
- Watching with friends (SyncPlay): the shared UI ships the room page and the in-player SyncPlay controls, but the room's live-sync socket dials the *page's own host*, which the desktop app can never satisfy — see [Watching with friends (SyncPlay)](#watching-with-friends-syncplay)

## Watching with friends (SyncPlay)

**Today, watch with friends from the web player your server serves** — open your Phlix
server's URL in a browser and use its player; SyncPlay rooms are fully live there. The
Phlix Windows app is not yet a usable SyncPlay client.

What is true about SyncPlay inside this desktop app, measured against the exact shared
UI bundle it ships (`@phlix/ui`, see `package.json`):

- **The surface exists.** The `SyncPlay` page (`/app/syncplay`) is registered by the
  shared shell, and the video player carries SyncPlay controls (create/join room).
  Room listing, create and join ride ordinary REST calls to your server, which work.
- **The party never goes live.** Playback sync runs over a WebSocket whose address is
  derived from the page's *own* host and port `8097` — an assumption made for the web
  player your server hosts itself. This app is served from an internal desktop origin,
  so from a packaged build that socket can only ever dial a machine named `-`: rooms
  still list, create and join over REST, but the connection that makes a party watch
  together never comes up.
- **That is why there is no SyncPlay entry in the navigation bar.** The page and the
  player's SyncPlay button do render — but surfacing a destination whose core promise
  fails from this origin would just be the next broken promise, so the nav omits it and
  the limitations above say so plainly.

The cure has a known shape: the shared UI has gained a host-configurable socket
endpoint (upstream `phlix-ui` commit `94579936`), so a future release of this app can
point the room socket at your configured server and add the nav entry for real. That
re-pin is tracked as the **M-WINDOWS-04 rider**; this repo's test suite
(`tests/unit/syncplayDesktopStatus.test.ts`) reddens on purpose the moment the
installed bundle gains the capability, so the docs above cannot silently go stale.

## Support

For issues and feature requests, please use the GitHub issue tracker.
