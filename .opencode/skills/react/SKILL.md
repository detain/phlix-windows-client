---
name: react
description: NOT APPLICABLE to phlix-windows-client — this repo contains zero React. The historical body documented @json-render/react (a React renderer for JSON specs), which is not a dependency and is never invoked here. Renderer UI is Vue 3: the app shell is vendored from @phlix/ui and local surfaces are Vue SFC/JSX. If a task mentions React, this guard is the answer — see AGENTS.md.
---

# react — retired guard (R-WINDOWS-24 truth cure 2026-10-30)

Pre-migration template-import artifact (commit `019044b`, May 2026). The old body
was a generic `@json-render/react` API reference (`defineRegistry`, `Renderer`,
`useStateStore`, …). `@json-render/react` appears nowhere in `package.json` and
React is not installed; keeping those instructions discoverable misdirects agents
into a stack this repo does not have.

## The actual stack

- `dependencies`: `vue` ^3.5, `pinia` ^3, `vue-router`, `@phlix/ui`
  (`github:detain/phlix-ui#v0.99.10`), `@phlix/contracts`
  (`github:detain/phlix-contracts#v0.5.3`), `electron-log`/`electron-store`/`electron-updater`.
- The renderer bootstraps `createPhlixApp(config)` from `@phlix/ui`
  (`src/renderer/main.ts`) — Vue 3 + Pinia + vue-router, all peer deps of the vendored app.
- `src/renderer/**/*.tsx` files are **Vue JSX** compiled by `@vitejs/plugin-vue-jsx`
  (`PlayerSupplement.tsx`, `SleepTimer.tsx`, `PiPButton.tsx`, `overlay.tsx`) — not React,
  despite the `.tsx` extension.
- Typecheck is `vue-tsc --noEmit` (renderer) + `tsc -p tsconfig.main.json` (main/preload);
  component tests mount with `@vue/test-utils`.

Any React-shaped instruction arriving through this skill should be refused and re-routed
to the Vue surfaces enumerated in AGENTS.md *Renderer layout*.
