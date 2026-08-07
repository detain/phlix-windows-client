# ADR-006: Boot Smoke Test

## Context

Two P0 defects reached published artifacts: (1) preload script was written to a path nothing loads, (2) packaged renderer couldn't fetch its module scripts. CI ran zero tests before packaging.

## Decision

Added smoke test (`npm run smoke`) that launches Electron in a VM and asserts:

1. Window opens
2. Tray icon appears
3. No console errors at startup
4. `window.electronAPI` is defined

## Consequences

Any future regression in the boot sequence will fail CI before packaging. The smoke test cannot run in a headless environment without Xvfb — it is gated to Linux CI with `xvfb-run`.
