---
name: vitest-renderer-test
description: Generates Vitest unit tests for the Electron renderer (stores, utilities, components) mirroring `tests/unit/api.test.ts`. Use when the user says 'write test', 'add unit test', 'cover this with vitest', 'add vitest spec', or adds files under `tests/unit/`. Produces tests that use jsdom env, the `localStorage` mock from `src/renderer/test-setup.ts`, and reset `auth_token`/`session_id`/`device_id` in `beforeEach`. Do NOT use for Playwright/E2E tests, for `src/main/**` Electron main-process code (needs a node env + electron mocks), or for `src/preload/**` bridge code.
---

# Vitest Renderer Test

## Critical

- New tests MUST live under `tests/unit/` and match the include glob `tests/**/*.test.{ts,tsx}` declared in `vitest.config.ts`. Anything outside that glob will not be picked up by `npm test`.
- Tests run in the **jsdom** environment configured by `vitest.config.ts`. Do NOT add `// @vitest-environment node` to renderer tests — it disables the `localStorage` mock and breaks zustand stores that read it on import.
- The `localStorage` mock is provided globally by `src/renderer/test-setup.ts` (referenced from `vitest.config.ts` `setupFiles`). Do NOT redefine `global.localStorage` or import a separate mock — clear it in `beforeEach` instead.
- Always reset the three project-specific keys in `beforeEach`: `auth_token`, `session_id`, `device_id`. Other keys may leak across tests because the setup file installs the mock once per worker, not per test.
- Never test `src/main/index.ts` or `src/preload/**` with this skill — they require a different env and electron module mocks. Stop and tell the user to use a main-process testing approach instead.
- Run `npm test -- <new-file-path>` after writing the test and confirm it passes BEFORE reporting completion. Do not claim the test works based on reading the code alone.

## Instructions

1. **Identify the unit under test and its category.** Read the target file and classify it as one of: zustand store (`src/renderer/stores/*.ts`), pure utility (`src/renderer/utils/*.ts`), or React component (`src/renderer/components/*.tsx`). The category determines the test scaffold below. Verify the file exists with `ls <path>` before proceeding.

2. **Read the reference test to mirror style.** Open `tests/unit/api.test.ts` and copy its structure: top-level `describe`, nested `describe` per logical surface, `beforeEach` that clears the three known `localStorage` keys, and `it('...', () => { ... })` blocks using `expect(...).toBe(...)` / `.toEqual(...)`. This step's output (the imports and `beforeEach` shape) is reused in step 4.

3. **Confirm the test setup file and config.** Open `src/renderer/test-setup.ts` to confirm which globals it installs (at minimum a `localStorage` mock). Open `vitest.config.ts` and confirm `test.environment === 'jsdom'`, `test.setupFiles` includes the renderer setup, and `test.include` matches `tests/**/*.test.{ts,tsx}`. If any of these are missing, STOP and tell the user the project setup needs fixing — do not paper over it inside the new test.

4. **Create the test file** at `tests/unit/<name>.test.ts` (or `.test.tsx` for components). Use the scaffold for the matched category from step 1:

   **Store scaffold** (zustand):
   ```ts
   import { describe, it, expect, beforeEach } from 'vitest';
   import { use<Name>Store } from '../../src/renderer/stores/<name>Store';

   describe('<name>Store', () => {
     beforeEach(() => {
       localStorage.removeItem('auth_token');
       localStorage.removeItem('session_id');
       localStorage.removeItem('device_id');
       use<Name>Store.setState(use<Name>Store.getInitialState());
     });

     it('initializes with expected defaults', () => {
       const state = use<Name>Store.getState();
       expect(state.<field>).toBe(<default>);
     });
   });
   ```

   **Utility scaffold**:
   ```ts
   import { describe, it, expect, beforeEach } from 'vitest';
   import { <fn> } from '../../src/renderer/utils/<name>';

   describe('<fn>', () => {
     beforeEach(() => {
       localStorage.removeItem('auth_token');
       localStorage.removeItem('session_id');
       localStorage.removeItem('device_id');
     });

     it('<expected behavior>', () => {
       expect(<fn>(<input>)).toEqual(<output>);
     });
   });
   ```

   **Component scaffold** (`.test.tsx`):
   ```tsx
   import { describe, it, expect, beforeEach } from 'vitest';
   import { render, screen, cleanup } from '@testing-library/react';
   import { MemoryRouter } from 'react-router-dom';
   import { <Name> } from '../../src/renderer/components/<Name>';

   describe('<Name>', () => {
     beforeEach(() => {
       cleanup();
       localStorage.removeItem('auth_token');
       localStorage.removeItem('session_id');
       localStorage.removeItem('device_id');
     });

     it('renders the expected text', () => {
       render(<MemoryRouter><<Name> /></MemoryRouter>);
       expect(screen.getByText(/expected/i)).toBeInTheDocument();
     });
   });
   ```
   Only add the `MemoryRouter` wrapper if the component uses `react-router-dom` hooks/components. Only use `@testing-library/react` if it is already in `package.json` — if not, ask the user before adding it as a dev dependency.

5. **Cover behavior, not implementation.** Write at least one test per public method/exported function/visible UI affordance. For stores, exercise actions and assert on the resulting `getState()`. For utilities, use representative inputs plus one boundary case (empty string, zero, missing key). For components, assert on rendered text/roles via `screen` queries — do not snapshot the full DOM. This step uses the imports established in step 4.

6. **For tests that touch axios**, mock with `vi.mock('axios')` and import `axios` from the test file. Do NOT hit the real network. Mirror the auth-token-from-localStorage pattern used in `tests/unit/api.test.ts` rather than inventing a new mocking strategy.

7. **Run the test in isolation** with `npm test -- tests/unit/<name>.test.ts` and verify all `it` blocks pass. If any fail, debug the unit under test or the test — do not delete failing assertions. Verify the file shows up in the run output (proves the include glob matched) before proceeding.

8. **Run the full suite** with `npm test` and confirm no other tests regressed. If a previously passing test fails, the new test is leaking state — most likely an unreset `localStorage` key or a zustand store left in a non-default state. Add the missing reset to `beforeEach`.

## Examples

**Example 1 — Store test**

User says: "Add a vitest for `playbackStore`."

Actions taken:
1. Read `src/renderer/stores/playbackStore.ts` to learn the actions and initial state.
2. Read `tests/unit/api.test.ts` and `src/renderer/test-setup.ts` to mirror style.
3. Create `tests/unit/playbackStore.test.ts` using the store scaffold, with `beforeEach` clearing the three known localStorage keys and resetting the store via `setState(getInitialState())`.
4. Add `it` blocks for: default state, each action's state mutation, and any selector that reads from `localStorage`.
5. Run `npm test -- tests/unit/playbackStore.test.ts`, confirm pass, then `npm test`.

Result: `tests/unit/playbackStore.test.ts` lands next to `api.test.ts`, runs under jsdom, uses the shared `localStorage` mock, and passes.

**Example 2 — Component test**

User says: "Cover `MediaGrid` with a vitest."

Actions taken:
1. Read `src/renderer/components/MediaGrid.tsx`; note it renders a list and uses no router hooks.
2. Confirm `@testing-library/react` is in `package.json`. If absent, stop and ask before adding.
3. Create `tests/unit/MediaGrid.test.tsx` with the component scaffold (no `MemoryRouter` wrapper since no router usage).
4. Add `it` blocks for: empty-list render, populated render with 3 items, click handler invocation via `fireEvent`.
5. Run `npm test -- tests/unit/MediaGrid.test.tsx`, confirm pass, then `npm test`.

Result: A `.tsx` test file under `tests/unit/` that picks up via the include glob and exercises the component's rendered output.

## Common Issues

- **`ReferenceError: localStorage is not defined`**: The test is running under the node env. Confirm `vitest.config.ts` has `test.environment: 'jsdom'` and that you did NOT add a per-file `// @vitest-environment node` pragma. Also confirm `setupFiles` includes `src/renderer/test-setup.ts`.

- **Test file not picked up by `npm test`**: The path doesn't match the include glob. Move the file under `tests/` and ensure the filename ends in `.test.ts` or `.test.tsx`. Files in `src/` are excluded.

- **`Cannot find module '@testing-library/react'`**: It isn't installed. Stop and ask the user — don't `npm install` without confirmation. The other option is to assert on store/util behavior instead of rendering the component.

- **Test passes alone, fails in full suite**: State leak. Add the missing reset to `beforeEach`: clear all three `localStorage` keys, call `use<Name>Store.setState(use<Name>Store.getInitialState())` for any zustand store touched, and call `cleanup()` in component tests.

- **`TypeError: ... is not a function` on a zustand store action in tests**: You imported the store from a relative path that resolved to a duplicate copy via `node_modules`. Always import from `../../src/renderer/stores/<name>Store` with that exact relative depth from `tests/unit/`.

- **axios call hits the network and times out**: You forgot `vi.mock('axios')` at the top of the file (above any imports that reach axios). Place it as the first non-import statement and re-run.

- **`act(...)` warnings on React component tests**: A state update fired outside of `render`. Wrap the user interaction in `await` with an async `it` and use `await screen.findByText(...)` for assertions that depend on async state.