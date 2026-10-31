---
name: vitest-renderer-test
description: Generates Vitest unit tests for this repo's real test bed — tests/unit/*.test.ts / *.test.tsx (@vue/test-utils mounts for Vue JSX components) / *.test.mjs (plain-Node ESM helpers) — under the jsdom env configured by vitest.config.mts. Use when the user says 'write test', 'add unit test', 'cover this with vitest', 'add vitest spec', or adds files under `tests/unit/`. Do NOT use for the Playwright smoke suite (`npm run smoke`, tests/smoke) or for visual tests.
---

# Vitest Renderer Test

## Critical

- New tests MUST live under `tests/unit/` and match one of the include globs declared in `vitest.config.mts`: `tests/**/*.test.ts`, `tests/**/*.test.tsx`, `tests/**/*.test.mjs`. Anything outside those globs will not be picked up by `npm test`. The `.mjs` leg exists for tests of plain-Node ESM helpers in `scripts/lib/**` (e.g. `tests/unit/copyright.test.mjs`, `tests/unit/lockwalk.test.mjs`); those helpers live outside the renderer TypeScript project, so their tests are authored `.mjs`, not `.ts`.
- Tests run in the **jsdom** environment configured by `vitest.config.mts`. The setup file `src/renderer/test-setup.ts` installs a global `localStorage` mock; do NOT redefine `global.localStorage` or import a separate mock. There are no magic per-app key names — components that persist preferences use their own keys (e.g. `phlix-pip-enabled` in `src/renderer/components/PiPButton.tsx`). If a test writes `localStorage`, reset it in `beforeEach` (`localStorage.clear()`), because the mock is installed once per worker, not per test.
- `clearMocks: false` is deliberate in `vitest.config.mts` (vitest@5 flipped the default to true; `autoUpdater.test.ts` captures module-load-time handlers and other suites rely on persist-by-default semantics). Do not "fix" spy state by toggling the config — reset the specific spy in the test.
- Main-process and preload code IS covered by this same suite — via `vi.mock('electron', ...)` module mocks in jsdom (see `tests/unit/autoUpdater.test.ts`, `tests/unit/configWriteValidation.test.ts`, `tests/unit/preloadVault.test.ts`). Mock `app.getPath` to a scratch dir (`/tmp/opencode/...`), never the real user profile.
- Run `npx vitest run tests/unit/<new-file>` after writing a test and confirm it passes BEFORE reporting completion; then run the full `npm test`. Do not claim success from reading code alone.

## Instructions

1. **Identify the unit under test and its category.** Read the target file and classify it as one of: pure logic module (`src/renderer/*.ts`, e.g. `resolveConfig.ts` — test the exported function directly), Vue-JSX component (`src/renderer/components/*.tsx` — note these are **Vue JSX via @vitejs/plugin-vue-jsx, not React**), Electron-bridge module (`src/renderer/electronBridge.ts` or `src/main/**` — mock the peer boundary: `window.electronAPI` / the `electron` module), or `scripts/lib` helper (`.mjs` test). Application *state* is not testable here — the Pinia stores live upstream in `@phlix/ui`; windows tests mock the store seam (see `tests/unit/electronBridge.test.ts`).

2. **Read a reference test to mirror style.** Pick the nearest category: `tests/unit/resolveConfig.test.ts` (pure), `tests/unit/PlayerSupplement.test.tsx` (component mount), `tests/unit/main.test.ts` (boot wiring), `tests/unit/copyright.test.mjs` (Node helper). Copy their structure: top-level `describe`, nested `describe` per logical surface, `beforeEach` resets, `it('...', () => { ... })` with plain `expect(...)` assertions. Like every file in the repo, test files carry the copyright header block (`@copyright 2026 Joe Huss <detain@interserver.net>`).

3. **Confirm the test setup file and config.** Open `src/renderer/test-setup.ts` (installs the `localStorage` mock) and `vitest.config.mts` and confirm `test.environment === 'jsdom'`, `test.setupFiles` includes the renderer setup, and `test.include` holds the three globs above. The path alias `@` → `src/renderer/` resolves in tests via `vitest.config.mts`; prefer `@/...` imports like the existing suites. If any of this is missing, STOP and tell the user the project setup needs fixing — do not paper over it inside the new test.

4. **Create the test file** at `tests/unit/<name>.test.ts` (or `.test.tsx` for component mounts, `.test.mjs` for Node helpers). **Component scaffold** (Vue, `@vue/test-utils`):
   ```tsx
   import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
   import { mount } from '@vue/test-utils';
   import { createRouter, createMemoryHistory } from 'vue-router';
   import { <Name> /* or default */ } from '@/components/<Name>';

   vi.mock('@/components/<Child>', () => ({ default: { template: '<div class="child-mock" />' } }));

   describe('<Name>', () => {
     const router = createRouter({ history: createMemoryHistory(), routes: [/* minimal routes */] });
     beforeEach(() => { localStorage.clear(); });
     afterEach(() => { vi.restoreAllMocks(); });

     it('renders the expected affordance', () => {
       const wrapper = mount(<Name>, { global: { plugins: [router] } });
       expect(wrapper.text()).toContain('expected');
     });
   });
   ```
   There is NO `@testing-library/react`, no `MemoryRouter` from `react-router-dom`, and no zustand `setState(getInitialState())` reset — that stack does not exist in this repo. Router test doubles use `createMemoryHistory` from `vue-router` (mirror `tests/unit/PlayerSupplement.test.tsx`); child components are stubbed with `vi.mock` returning plain `{ template }` objects.

5. **Cover behavior, not implementation.** One test per exported function/action/visible affordance. For pure modules, representative inputs plus boundary cases (empty string, zero, missing key). For components, assert on rendered text/structure/props via the `wrapper`, and invoke handlers via `wrapper.vm` or `wrapper.trigger(...)` — avoid full-DOM snapshots.

6. **For tests that touch the network boundary**, remember the renderer itself never calls HTTP — `@phlix/ui`'s ApiClient does (upstream). Windows-side seams are `window.electronAPI` (IPC) and the contracts header builder; stub them with `vi.fn()`/`vi.mock` the way `tests/unit/electronBridge.test.ts` and `tests/unit/main.test.ts` do. Never hit a real server.

7. **Run the test in isolation** with `npx vitest run tests/unit/<name>.test.ts` and verify all `it` blocks pass. If any fail, debug the unit under test or the test — do not delete failing assertions. Verify the file shows up in the run output (proves the include glob matched) before proceeding.

8. **Run the full suite** with `npm test` and confirm no other tests regressed. If a previously passing test fails, the new test is leaking state — most likely an uncleared `localStorage` key, an un-restored `vi.mock`/spy (config pins `clearMocks: false`), or a module-level singleton (the `overlay.tsx` app instance) touched across files. Add the missing reset to `beforeEach`/`afterEach`.

## Common Issues

- **`ReferenceError: localStorage is not defined`**: the test runs under node env. Confirm `vitest.config.mts` still sets `test.environment: 'jsdom'` and that you did NOT add a per-file `// @vitest-environment node` pragma; confirm `setupFiles` includes `src/renderer/test-setup.ts`.

- **Test file not picked up by `npm test`**: the path/filename misses the three include globs (`tests/**/*.test.ts|.tsx|.mjs`). Files in `src/` are excluded — tests live under `tests/`.

- **`.test.tsx` fails to compile / hooks "not defined outside of a render"**: you wrote React idioms. Components here are Vue JSX (`@vitejs/plugin-vue-jsx`) — import from `'vue'` (`defineComponent`, `ref`, `onMounted`), mount with `@vue/test-utils`, and see `AGENTS.md` *Renderer layout* (`components/` is explicitly "Vue JSX/TSX, not React").

- **`Cannot find module '../../src/renderer/stores/<x>Store'` or any zustand import**: phantom pre-migration coordinate. State stores are vendored from `@phlix/ui`; test the windows-side seam (bridge/wiring modules) with mocked store objects instead.

- **Test passes alone, fails in full suite**: state leak. The `localStorage` mock is worker-level (clear it in `beforeEach`), and `clearMocks` is pinned false (call `vi.restoreAllMocks()`/`vi.resetModules()` where a suite needs a clean module graph).

- **Axios call hits the real network**: no windows-side code imports axios (the vendored ui owns HTTP). If you are adding such a call, that is the wrong layer — read AGENTS.md *Conventions* ("Device identity … @phlix/ui's ApiClient owns Authorization/session") and route the change upstream instead.
