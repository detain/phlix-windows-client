---
name: react-page-route
description: Adds a new React Router page in src/renderer/pages/, registers the route in App.tsx, and wires up navigation. Use when user says 'add page', 'new route', 'new screen', 'create page', or wants a top-level navigable view. Follows the project's useEffect + useState<T> + api.* + try/catch/finally setLoading(false) data-fetch pattern, with `<div className="loading-spinner" />` loading state. Do NOT use for modal/dialog flows, sub-views rendered inside an existing page, settings panels, or any non-routable UI.
---

# React Page Route

## Critical

- Page files MUST live in `src/renderer/pages/` with PascalCase filenames (e.g. `Settings.tsx`, not `settings.tsx`).
- Every new page MUST be registered in `src/renderer/App.tsx` as a `<Route>` child of the existing `<Routes>` block. A page that isn't routed is dead code — do not commit one without the route.
- Use functional components with the `export default function PageName()` form — match `Home.tsx`, `Library.tsx`, `ItemDetail.tsx`, `Player.tsx`.
- Data fetching MUST follow the `useEffect` + `useState<T>` + `api.*` + `try/catch/finally setLoading(false)` pattern. Do NOT introduce React Query, SWR, or a new zustand store unless the data must be shared across routes.
- Loading UI MUST render exactly `<div className="loading-spinner" />` — do not invent a new spinner class.
- Never use `window.location` or `history.pushState` for navigation. Use `<Link>` / `<NavLink>` from `react-router-dom` or the `useNavigate()` hook.

## Instructions

1. **Confirm the page is route-worthy.** Re-read the user request. If it describes a modal, drawer, dialog, tab inside an existing page, or a settings sub-panel, STOP — this skill does not apply. Otherwise note the route path (e.g. `/settings`) and the PascalCase component name (e.g. `Settings`). Verify the path is not already declared in `src/renderer/App.tsx` before proceeding.

2. **Read the reference pages** to lock in the exact patterns used in this codebase. Open `src/renderer/pages/Home.tsx` and `src/renderer/pages/Library.tsx` and note:
   - The import order: React hooks first, then `react-router-dom`, then `../utils/api` (or wherever the api wrapper lives), then components, then types, then styles if any.
   - The state shape (`useState<Item[]>([])`, `useState(true)` for loading, `useState<string | null>(null)` for error).
   - The async `load()` declared inside `useEffect` (NOT `useEffect(async () => ...)`).
   Verify both files use the same pattern before treating it as the convention.

3. **Create the page file** at `src/renderer/pages/{Name}.tsx`. Use this exact skeleton, adapting only the type, api call, and rendered markup:
   ```tsx
   import { useEffect, useState } from 'react'
   import { api } from '../utils/api'
   import type { Whatever } from '../types'

   export default function {Name}() {
     const [items, setItems] = useState<Whatever[]>([])
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState<string | null>(null)

     useEffect(() => {
       const load = async () => {
         try {
           const data = await api.getWhatever()
           setItems(data)
         } catch (err) {
           setError(err instanceof Error ? err.message : 'Failed to load')
         } finally {
           setLoading(false)
         }
       }
       load()
     }, [])

     if (loading) return <div className="loading-spinner" />
     if (error) return <div className="error">{error}</div>

     return (
       <div className="{name}-page">
         {/* page content */}
       </div>
     )
   }
   ```
   If the actual api function does not yet exist on `../utils/api`, add it there following the existing axios wrapper style — do not call axios inline in the page. Verify the file compiles (`npx tsc --noEmit`) before continuing.

4. **Register the route in `src/renderer/App.tsx`.** Add the import alongside the other page imports (alphabetical or grouped by feature — match the file's existing convention). Add a `<Route path="/{kebab-name}" element={<{Name} />} />` inside the existing `<Routes>` block, placed in the same order the navigation lists them. Do NOT wrap it in a new `<BrowserRouter>` / `<HashRouter>` — the app already provides one. Verify with `grep -n '<Route' src/renderer/App.tsx` that your new route appears exactly once.

5. **Wire up navigation when navigable.** If the page is reachable from the sidebar, open `src/renderer/components/Sidebar.tsx` (or whatever sibling of `App.tsx` renders the top-level nav — check `src/renderer/components/` if `Sidebar.tsx` does not exist). Add a `<NavLink to="/{kebab-name}">{Label}</NavLink>` following the exact JSX shape of the existing entries (same className, same active handling). If the page is only reachable programmatically (e.g. detail page reached from a card click), skip the sidebar and use `useNavigate()` from the linking page instead.

6. **Type the api response.** Add or extend the relevant type in `src/renderer/types/` so `useState<T[]>` is fully typed. Do not use `any`. Do not duplicate types across files — import from the existing types module.

7. **Run validation gates before declaring done:**
   - `npx tsc --noEmit` — must report 0 errors.
   - `npm run lint` — must pass (ESLint is configured).
   - `npm test` — Vitest suite must still pass. If you added a new api function, add a matching test in `tests/unit/api.test.ts` mirroring the existing test shape.
   - Start the dev app (`npm run dev`) and manually navigate to the new route. Confirm the loading spinner appears, then either data or the error branch renders. If you cannot exercise the UI, say so explicitly — do not claim the page works.

## Examples

### Example 1: Add a Settings page

**User says:** "Add a Settings page where users can toggle dark mode."

**Actions taken:**
1. Create `src/renderer/pages/Settings.tsx` using the skeleton from Step 3, but with no `api.*` call (settings come from a local zustand store, not the server) — so the `loading`/`error` state is dropped and the page renders form controls directly.
2. Import the existing settings store from `src/renderer/stores/` (check what's there alongside `playbackStore.ts`); create a new one only if no suitable store exists.
3. In `src/renderer/App.tsx`, add `import Settings from './pages/Settings'` and `<Route path="/settings" element={<Settings />} />`.
4. In `src/renderer/components/Sidebar.tsx`, add `<NavLink to="/settings">Settings</NavLink>` matching the existing link markup.

**Result:** `/settings` is reachable from the sidebar, dark-mode toggle persists via the store, no server call needed. The data-fetch pattern is intentionally omitted here because there is no remote data — do not add a fake fetch to satisfy the template.

### Example 2: Add a Search results page

**User says:** "Add a /search page that takes a `q` query param and lists matching media items."

**Actions taken:**
1. Create `src/renderer/pages/Search.tsx` using the full Step 3 skeleton.
2. Inside `Search.tsx`, read the query with `const [params] = useSearchParams()` from `react-router-dom` and pass `params.get('q')` to `api.search(...)`. Add `params.get('q')` to the `useEffect` dependency array so navigating to a new query re-fetches.
3. Add `api.search(query: string): Promise<MediaItem[]>` to `src/renderer/utils/api.ts` mirroring the existing axios calls.
4. Register `<Route path="/search" element={<Search />} />` in `App.tsx`.
5. The sidebar already has a search input that navigates via `useNavigate()` — no new `NavLink` needed.
6. Add a unit test in `tests/unit/api.test.ts` for `api.search` that mocks axios and asserts the URL contains the encoded query.

**Result:** `/search?q=foo` renders the loading spinner, then a `MediaGrid` of results, then an empty-state if no results. Re-typing in the sidebar search box re-runs the fetch because `q` is in the effect deps.

## Common Issues

- **"No routes matched location '/foo'" in the console** — the `<Route>` was not added to `App.tsx`, or the path has a typo. Run `grep -n 'path=' src/renderer/App.tsx` and confirm the new path is present and exactly matches what `<NavLink to=...>` links to.
- **TypeScript error `Property 'getX' does not exist on type ...`** — you called `api.getX()` before adding it to `src/renderer/utils/api.ts`. Add the function there with a proper return type; do not cast to `any` in the page.
- **Page renders blank with no spinner** — you forgot `setLoading(false)` in the `finally` block, or you put the api call outside `try`. Re-check Step 3's skeleton: the `finally` clause is mandatory.
- **Spinner shows forever after a thrown error** — `setLoading(false)` is missing from `finally`, or you returned early from `catch` before `finally` ran. The `finally` form in Step 3 handles both branches correctly; do not refactor it into separate `then`/`catch` blocks.
- **"useNavigate() may be used only in the context of a <Router> component"** — you imported and rendered the page from outside `App.tsx`'s `<Routes>` tree (e.g. inside `main.tsx`). Page components must be reached via a `<Route element>`, not rendered directly.
- **HashRouter vs BrowserRouter mismatch breaking Electron** — this app loads from `file://` in production; check which router `App.tsx` already uses and do NOT swap it. Adding a new page never requires changing the router type.
- **`<NavLink>` active class not applying** — you used `<Link>` instead of `<NavLink>`, or set `className` as a string. Match the existing sidebar entries: they use the `({ isActive }) => ...` callback form for `className`.
- **Vitest fails with `ReferenceError: window is not defined`** — the new test imports a page component. Page-level tests need `// @vitest-environment jsdom` at the top, or move the assertion down to the pure api function in `tests/unit/api.test.ts`.