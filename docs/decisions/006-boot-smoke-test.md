# ADR-006: Boot Smoke Test

## Context

Two P0 defects reached published artifacts: (1) preload script was written to a path nothing loads, (2) packaged renderer couldn't fetch its module scripts. CI ran zero tests before packaging.

## Decision

Added smoke test (`npm run smoke`) that launches Electron on CI runners (ubuntu + windows) and asserts:

1. Window opens
2. Tray icon appears
3. No console errors at startup
4. `window.electronAPI` is defined

## Consequences

Any future regression in the boot sequence will fail CI before packaging. The smoke test cannot run in a headless environment without Xvfb — it runs on the ubuntu-26.04 + windows-2025 smoke matrix (`.github/workflows/test.yml`, `build.yml`): Linux under `xvfb-run`, Windows natively.
