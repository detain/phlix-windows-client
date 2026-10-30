# ADR-004: No Forking of `@phlix/ui` Screens/Stores

**Status: Amended 2026-10-29 (M-WINDOWS-22 r2) — the rule stands; its blanket premise was overtaken by later waves.** The no-forking rule for `@phlix/ui`-owned screens, components, and stores holds. The premise that the renderer kept every UI surface upstream did not survive: this renderer legitimately ships windows-local surfaces — player overlay components with their `overlay.tsx` app entry, a boot-failure screen, i18n catalogs, media-session handlers, a DPAPI token-store adapter, and the local `/app/*` route wiring (enumerated in README *UI & State*).

## Context

Local forks of UI components accumulated (14 components, 2 screens, 1 store) because there was no explicit rule against them.

## Decision

Page views and application stores stay vendored from `@phlix/ui` — never fork them into this repo. Local code owns the Electron shell, boot/bridge glue, IPC, and the windows-local surfaces listed in the Status line above. New shared UI belongs upstream: extend `@phlix/ui` and bump the pin.

## Consequences

Phase W2 deleted ~1,900 lines of duplicate UI. Bumping `@phlix/ui` is the correct path for adding/changing UI. Before adding any local component, check what `@phlix/ui` already exports: `node_modules/@phlix/ui/dist/index.d.ts` names every exported component (ui publishes `files: ['dist']`, so `node_modules/@phlix/ui/src/` never exists; readable source is the pinned tag at `github.com/detain/phlix-ui`). (2026-10 note: the P3-S4-era overlays and the other surfaces listed in the Status line are intentional additions under this amendment, not rule violations.)
