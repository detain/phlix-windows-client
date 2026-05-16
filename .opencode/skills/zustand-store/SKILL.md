---
name: zustand-store
description: Creates a new Zustand store in src/renderer/stores/ following the create<State>((set) => ({ ...initialState, action: () => set({...}) })) pattern from authStore.ts/playbackStore.ts/uiStore.ts. Defines the state interface with both data fields and action methods, prefixes unused setter args with _, calls api.* methods inside async actions with try/catch and electron-log/console.error logging, exposes a useNameStore hook. Use when user says 'add store', 'new zustand store', 'manage X state globally', or adds files to src/renderer/stores/. Do NOT use for component-local state (use useState), for trivial UI toggles already covered by uiStore, or for main-process state (Electron main uses electron-store, not Zustand).
---

# Zustand Store

## Critical

- All renderer global state lives in `src/renderer/stores/` — one file per store, kebab-free camelCase filename ending in `Store.ts` (e.g. `playbackStore.ts`).
- The exported hook is named `useNameStore` (e.g. `usePlaybackStore`), NOT `nameStore` or `useStore`.
- The state interface is named `NameState` and includes BOTH data fields AND action method signatures — actions are part of the state shape, not a separate object.
- Never call `set` outside an action — components must mutate via actions only.
- If you reference `get` in the closure, destructure as `(set, get) => ...`. If you do NOT use it, write `(set, _get) => ...` with the leading underscore — the ESLint config flags unused args without the underscore prefix (see `playbackStore.ts:26`).
- All `api.*` calls inside async actions MUST be wrapped in `try/catch`. Log failures with `console.error('Failed to X:', error); // eslint-disable-line no-console` matching `playbackStore.ts:51`.
- Do NOT add a store for state that is local to one component — use `useState`. Do NOT add a UI toggle store — extend `uiStore.ts` instead.
- Do NOT use Zustand middleware (`persist`, `devtools`, `immer`) unless extending an existing store that already uses it. None of the current three stores use middleware; introducing it requires explicit justification.

## Instructions

1. **Confirm the store does not already exist.** Run `ls src/renderer/stores/` and inspect `authStore.ts`, `playbackStore.ts`, `uiStore.ts`. If the desired state belongs in one of them (auth/session → `authStore`, playback/media → `playbackStore`, sidebar/theme → `uiStore`), extend that file instead of creating a new one. Verify: only create a new store if the slice has no overlap with existing ones.

2. **Identify the API surface.** Open `src/renderer/utils/api.ts` and list every method and exported type (e.g. `MediaItem`, `User`, `PlaybackInfoResponse`) the store will consume. The store imports types AND the default `api` instance from this single module — never call `axios` directly inside a store. Verify: every `api.foo()` call you plan to write exists in `src/renderer/utils/api.ts` before writing the store.

3. **Create the file at `src/renderer/stores/<name>Store.ts`.** Use this exact template, mirroring `authStore.ts` for a store with async server actions or `uiStore.ts` for a pure-client store:

   ```ts
   import { create } from 'zustand';
   import api, { SomeType } from '../utils/api';

   interface XyzState {
     // data fields
     items: SomeType[];
     isLoading: boolean;
     error: string | null;

     // actions (signatures only — implementations live in the create() body)
     load: () => Promise<void>;
     reset: () => void;
   }

   export const useXyzStore = create<XyzState>((set) => ({
     items: [],
     isLoading: false,
     error: null,

     load: async () => {
       set({ isLoading: true, error: null });
       try {
         const items = await api.getItems();
         set({ items, isLoading: false });
       } catch (err) {
         set({ error: 'Failed to load items.', isLoading: false });
       }
     },

     reset: () => set({ items: [], error: null })
   }));
   ```

   Verify the file compiles with `npx tsc -p tsconfig.json --noEmit` (or the project's existing typecheck command) before proceeding.

4. **Match the `set` signature to actual usage.**
   - State-independent update → `set({ field: value })` (see `uiStore.ts:17`).
   - State-dependent update → `set((state) => ({ field: !state.field }))` (see `uiStore.ts:15`, `playbackStore.ts:66`).
   - Need to read state without setting → switch the second arg to `get` (no underscore) and call `get()`. Otherwise keep `_get` as in `playbackStore.ts:26`.
   Verify: every functional `set` updater is necessary — if it does not read `state`, switch back to the object form.

5. **Wire up error handling exactly like the existing stores.**
   - Async action with user-facing error → set `error: 'Human-readable sentence.'` in the catch block as in `authStore.ts:31-34`.
   - Async action with developer-only logging → `console.error('Failed to load X:', error); // eslint-disable-line no-console` as in `playbackStore.ts:51`. Do not introduce `electron-log` calls from the renderer — main-process logging stays in `src/main/`.
   - Return type of an async action that signals success/failure to the caller → return `boolean` (see `authStore.ts:9, 29, 35`). Otherwise return `Promise<void>`.

6. **Consume the store from a component.** In `src/renderer/components/` or `src/renderer/pages/`, import the hook and either select the whole state or destructure. Match the existing call sites — search for `usePlaybackStore(` or `useAuthStore(` to see the pattern. Do NOT call the hook outside React render.

7. **Add a unit test in `tests/unit/<name>Store.test.ts`** mirroring `tests/unit/api.test.ts` style with Vitest. Test the initial state and each action by calling `useXyzStore.getState()` directly (no React render needed for store-only tests). Mock the `api` module with `vi.mock('../../src/renderer/utils/api')`. Run `npx vitest run tests/unit/<name>Store.test.ts` and verify all assertions pass before reporting the task complete.

8. **Final verification.** Run, in order:
   - `npx tsc -p tsconfig.json --noEmit` — must exit 0.
   - `npx eslint src/renderer/stores/<name>Store.ts` — must exit 0 (this catches missing `_get` underscore, etc.).
   - `npx vitest run` — full suite green.
   Only after all three pass, report the store as done.

## Examples

### Example 1 — "Add a store for the user's library filters"

**User says:** "Add a Zustand store that holds the current library filter (genre, sort order) so Home and Library pages stay in sync."

**Actions taken:**
1. Confirm no existing store owns filter state (`authStore`, `playbackStore`, `uiStore` do not).
2. Confirm `api.ts` exposes no filter endpoint — this is pure client state, so model on `uiStore.ts`, not `authStore.ts`.
3. Create `src/renderer/stores/libraryFilterStore.ts`:

```ts
import { create } from 'zustand';

type SortOrder = 'name' | 'recent' | 'rating';

interface LibraryFilterState {
  genre: string | null;
  sortOrder: SortOrder;
  setGenre: (genre: string | null) => void;
  setSortOrder: (order: SortOrder) => void;
  reset: () => void;
}

export const useLibraryFilterStore = create<LibraryFilterState>((set) => ({
  genre: null,
  sortOrder: 'recent',

  setGenre: (genre) => set({ genre }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  reset: () => set({ genre: null, sortOrder: 'recent' })
}));
```

4. Add `tests/unit/libraryFilterStore.test.ts` covering initial state and each setter.
5. Run typecheck, ESLint, Vitest — all green.

**Result:** A store that compiles, lints, and tests cleanly, identical in shape to `uiStore.ts`.

### Example 2 — "Manage server-fetched library items globally"

**User says:** "I want a store that fetches and caches the library items from the server."

**Actions taken:**
1. Verify `api.getLibraryItems()` exists in `src/renderer/utils/api.ts`.
2. Create `src/renderer/stores/libraryStore.ts` modeled on `authStore.ts` (async server interaction):

```ts
import { create } from 'zustand';
import api, { MediaItem } from '../utils/api';

interface LibraryState {
  items: MediaItem[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await api.getLibraryItems();
      set({ items, isLoading: false });
    } catch (err) {
      console.error('Failed to load library:', err); // eslint-disable-line no-console
      set({ error: 'Could not load library.', isLoading: false });
    }
  },

  clear: () => set({ items: [], error: null })
}));
```

**Result:** Consumer pages call `const { items, load } = useLibraryStore()` and `useEffect(() => { load(); }, [load]);` — identical pattern to existing `useAuthStore` consumers.

## Common Issues

- **`'_get' is defined but never used` (ESLint `@typescript-eslint/no-unused-vars`).** You wrote `(set, _get) =>` and ESLint still complains — your ESLint config does not have the `argsIgnorePattern: '^_'` rule. Either: (a) drop the second arg entirely → `(set) => ({...})` like `authStore.ts:14` and `uiStore.ts:11`, or (b) actually use `get()` somewhere in the body.

- **`Property 'X' does not exist on type 'XyzState'` when calling `useXyzStore.getState().X`.** You forgot to add the action's signature to the `XyzState` interface. The interface MUST include both data fields and every action; the `create<XyzState>(...)` generic enforces this. Add the signature, save, re-run `npx tsc -p tsconfig.json --noEmit`.

- **Store updates fire but the component does not re-render.** You are selecting the whole store with `useXyzStore()` and mutating a nested object reference instead of replacing it. Zustand uses shallow equality. Either pass a selector — `useXyzStore((s) => s.items)` — or replace the whole field: `set({ items: [...state.items, newItem] })`, not `state.items.push(newItem)`.

- **`Cannot read properties of undefined (reading 'getItem')` during tests.** Your Vitest test did not mock `../utils/api`. Add `vi.mock('../../src/renderer/utils/api', () => ({ default: { getItem: vi.fn() } }))` at the top of the test file before importing the store.

- **Action returns `undefined` instead of `boolean` from `await login(...)`.** The async action body has a `try` that returns `true` but the `catch` falls through without a `return false`. Mirror `authStore.ts:35` — every code path in a `Promise<boolean>` action must `return` explicitly.

- **Hot reload loses store state on every save.** Expected — Zustand stores are module-scoped and Vite re-evaluates the module on HMR. If you need persistence across reloads (e.g., auth token), persist via `api.ts` / `electron-store` in the main process, not via `zustand/middleware/persist` (no existing store uses that middleware).