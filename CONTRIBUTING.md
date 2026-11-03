# Contributing to Phlix for Windows

Thanks for your interest. This is the Electron + Vue 3 desktop client of the Phlix
estate. Small, focused PRs that keep the repo's gates green land fastest.

## Before you open a PR

1. Install [Node.js](https://nodejs.org/) **24+** (see README Prerequisites; behind a
   restrictive network, set `ELECTRON_MIRROR` — the README install-from-source note
   explains how).
2. `npm ci` (lockfile-pinned; use `npm ci`, not `npm install`, so you don't churn
   `package-lock.json` — lock and dependency-pin changes are maintained by the
   project owner, not PRs).
3. Run the gates your change touches — CI enforces all of them:
   ```bash
   npm run typecheck    # vue-tsc (renderer) + tsc (main/preload)
   npm run lint         # eslint
   npx vitest run       # add --no-file-parallelism for a faithful serial count
   npm run build        # renderer + main compile; run for anything src/** touches
   ```
   The test suite carries *law pins* — tests that encode deliberate decisions
   (security posture, doc/code agreement, i18n catalog shapes). If one reddens,
   read its header comment before changing behavior; some pins also require
   coordinated updates (×7 locale catalogs, `docs/ipc-channels.md` coordinate
   tables) which are listed in those comments.

## Fork pull requests and CI secrets

CI runs on fork PRs, with two honest caveats:

- **Coverage uploads will fail.** `CODECOV_TOKEN` and `CODACY_API_TOKEN` are repo
  secrets unavailable to forks; both steps are configured best-effort
  (`fail_ci_if_error: false` / `continue-on-error: true`) and cannot redden your
  run. The authoritative coverage gate is the vitest `lines: 54` threshold, which
  runs for everyone.
- **Release paths never run.** `release-latest` and `release` are gated to
  push/dispatch and `v*` tags on the upstream repo; a PR from a fork executes only
  the lint/unit/audit legs. That is by design — do not try to exercise release
  automation from a fork.

## Scope notes

- This client targets **Windows 10/11 x64** only.
- UI shell behavior (pages, stores, syncplay protocol handling) lives upstream in
  **`@phlix/ui`**; this repo is the desktop shell (windowing, tray, IPC, security
  posture, packaging). Fixes that belong upstream should be filed against that
  package instead of patching `node_modules` or any vendored copy — vendored
  bundles are never hand-edited here.
- Auth tokens custody: renderer tokens are sealed via DPAPI/safeStorage
  (`src/renderer/safeStorageTokenStore.ts` ↔ main-process vault handlers); keep it
  that way in any auth-adjacent change.

Questions? Open an issue first for anything bigger than a typo or an obvious bug.
