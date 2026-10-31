---
name: zustand-store
description: NOT APPLICABLE to phlix-windows-client — this repo has no zustand dependency and no src/renderer/stores/ directory. The historical body instructed creating zustand stores mirroring nonexistent authStore.ts/playbackStore.ts/uiStore.ts files. Application state lives in the vendored @phlix/ui Pinia stores (upstream-first law). If asked to "add a store / manage X state globally", follow this guard instead.
---

# Zustand Store — retired guard (R-WINDOWS-24 truth cure 2026-10-30)

Pre-migration template-import artifact (commit `019044b`, May 2026). The old body
defined a `src/renderer/stores/` convention (`NameState` interfaces, `useNameStore`
hooks, `(set, _get)` signatures, an eslint-disable workaround at "playbackStore.ts:26")
for files that do not exist. Zustand is not in `package.json`.

## The actual state law (thin consumer)

- All application state lives in the **vendored `@phlix/ui` Pinia stores** —
  never fork them locally; extend upstream and bump the pin
  (AGENTS.md Conventions "Thin consumer, upstream first"; `docs/decisions/004-no-local-ui.md`).
- Windows-side code *consumes* the vendored stores instead of owning state:
  `src/renderer/electronBridge.ts` resolves `usePlayerStore(pinia)` off the booted
  app and maps Electron media IPC onto its actions (`play()`/`pause()`,
  `closePlayer()`, `seekBy(∓10)` via the v0.52.0 player command bus).
- The local overlay app (`src/renderer/overlay.tsx`) creates its own `createPinia()`
  instance for the second Vue app; the player-overlay components keep only component
  local state (e.g. `PiPButton.tsx` persists one preference under the
  `phlix-pip-enabled` localStorage key).
- Do NOT add zustand, `@types/zustand`, or any `renderer/stores/` directory to this repo.
