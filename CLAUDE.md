# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Electron + React 18 + TypeScript desktop client for Phlix Media Server. Packaged as NSIS + APPX via `electron-builder`. Repo: `git@github.com:detain/phlix-windows-client.git`.

## Commands

```bash
npm run dev              # concurrent vite + electron (waits on :5173)
npm run dev:vite         # vite dev server only (port 5173, strictPort)
npm run dev:electron     # electron only (expects vite running)
npm run build            # build:vite + build:electron
npm run build:vite       # vite build → dist/renderer/
npm run build:electron   # tsc -p tsconfig.main.json → dist/main/
npm run package          # NSIS x64 installer → release/
npm run package:store    # APPX for Windows Store
npm test                 # vitest run
npm run test:watch       # vitest watch
npm run lint             # eslint **/*.{ts,tsx} (--max-warnings 0)
npm run lint:fix         # auto-fix
```

Run a single test file: `npx vitest run tests/unit/api.test.ts`. Filter by name: `npx vitest run -t "loads token"`.

## Architecture

Three Electron processes wired by `contextBridge`:

- **Main** (`src/main/index.ts`): `BrowserWindow` creation, `Tray`, `Menu` (File/Playback/View/Help), IPC handlers (`get-app-path`, `get-version`, `set-always-on-top`, `minimize-to-tray`), `electron-log` init, `electron-store` for the `minimizeToTray` pref. Sends `media-play-pause`/`media-stop`/`media-rewind`/`media-forward`/`open-settings`/`file-opened` to renderer.
- **Preload** (`src/preload/index.ts`): exposes `window.electronAPI` via `contextBridge.exposeInMainWorld` with `ipcRenderer.invoke`/`.send`/`.on` wrappers. Listener helpers return cleanup functions.
- **Renderer** (`src/renderer/`): React 18 + `react-router-dom` v6 (`HashRouter`) + `zustand` stores + `axios` client.

### Renderer layout

| Path | Purpose |
|------|---------|
| `src/renderer/App.tsx` | Root: `useAuthStore().checkAuth()` → `<Login>` or `<HashRouter>` with `<Sidebar>` + `<Header>` + `<Routes>` |
| `src/renderer/main.tsx` | `ReactDOM.createRoot` mounts `<App>` into `#root` |
| `src/renderer/index.html` | CSP locked to self + `https: http: blob:` media + `ws:` connect |
| `src/renderer/pages/` | `Home.tsx` · `Library.tsx` · `ItemDetail.tsx` · `Player.tsx` · `Settings.tsx` · `Login.tsx` |
| `src/renderer/components/` | `Sidebar.tsx` · `Header.tsx` · `MediaGrid.tsx` · `VideoPlayer.tsx` (+ `VideoPlayer.css`) |
| `src/renderer/stores/` | `authStore.ts` · `playbackStore.ts` · `uiStore.ts` (Zustand) |
| `src/renderer/utils/api.ts` | `ApiClient` class + `api` singleton, axios against `${VITE_PHLIX_SERVER_URL}/api/v1` |
| `src/renderer/types/electron.d.ts` | `window.electronAPI` typings |
| `src/renderer/styles/global.css` | Global styles + CSS vars (`--color-text-secondary`) |
| `src/renderer/test-setup.ts` | `localStorage` mock for jsdom env |
| `src/renderer/vite-env.d.ts` | Vite client types |

### Routes (`src/renderer/App.tsx`)

- `/` → `Home` — lists `api.getLibraries()`
- `/library/:id` → `Library` — `api.getLibraryItems(id)` → `<MediaGrid>`
- `/item/:id` → `ItemDetail` — `api.getItem(id)` + play action
- `/player/:id` → `Player` — wraps `<VideoPlayer>`, uses `usePlaybackStore`
- `/settings` → `Settings`
- `*` → `<Navigate to="/" />`

## Conventions

- **TypeScript strict** with `noUnusedLocals` + `noUnusedParameters` (`tsconfig.json`). Avoid `any` — ESLint warns via `.eslintrc.cjs`.
- **No `console.*`** — `no-console` is warn. When unavoidable, suffix `// eslint-disable-line no-console` (see `src/renderer/pages/Home.tsx`).
- **Unused args**: prefix `_` (e.g. `_get` in `src/renderer/stores/playbackStore.ts`); rule `argsIgnorePattern: '^_'`.
- **Zustand pattern**: `create<State>((set) => ({ ...initialState, action: () => set({...}) }))` — see `src/renderer/stores/authStore.ts`.
- **API calls** go through the `api` singleton from `src/renderer/utils/api.ts`. Methods use `this.request<T>(method, path, data)`; axios interceptors attach `Authorization: Bearer ${token}` and `X-Phlix-Session-ID`. Static device headers: `X-Phlix-Device-ID` / `X-Phlix-Device-Name` / `X-Phlix-Device-Type: windows`.
- **Page data fetching**: `useEffect` + `useState<T>` + `try/catch/finally` setting `loading=false`. See `src/renderer/pages/Library.tsx`.
- **Components**: named exports + default export, `React.FC` typing. See `src/renderer/components/MediaGrid.tsx`.
- **IPC**: never use `ipcRenderer` directly in renderer — extend `window.electronAPI` via `src/preload/index.ts` and type in `src/renderer/types/electron.d.ts`.
- **CSP** in `src/renderer/index.html` allows `https: http: blob:` for media and `ws:` for connect — preserve when adding sources.
- **Auth/session persistence** lives in `localStorage` keys `auth_token` / `session_id` / `device_id` (set via `api.setToken` / `api.setSession`).

## Testing

- Vitest with `jsdom` env (`vitest.config.ts`), setup file `src/renderer/test-setup.ts` mocks `localStorage`.
- Includes glob: `tests/**/*.test.ts` and `tests/**/*.test.tsx`.
- Coverage via `v8` provider, reporters `text`/`json`/`html`.
- Reference test: `tests/unit/api.test.ts` (resets `localStorage` in `beforeEach`).
- Path aliases: `@` → `src/renderer/` (both `vite.config.ts` and `vitest.config.ts`).

## TypeScript configs

- `tsconfig.json` — renderer; `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true`, `lib: [ES2020, DOM, DOM.Iterable]`.
- `tsconfig.main.json` — main + preload; `module: CommonJS`, `target: ES2020`, `outDir: dist`, `composite: true`. Referenced from `tsconfig.json`.

## Build & packaging

- `electron-builder` config lives in `package.json` under `"build"`: `appId: app.phlix.windows`, NSIS (`oneClick: false`, `perMachine: true`) + APPX (`publisher: CN=Phlix`), icon at `build/icon.ico`.
- Main entry shipped is `dist/main/index.js`; preload referenced as `preload.js` next to it (output by `tsc -p tsconfig.main.json`).
- Logs go to `%APPDATA%\phlix-windows\logs\` via `electron-log`.

## CI

- `.github/workflows/test.yml` — runs `npm test` and lint on every push/PR.
- `.github/workflows/build.yml` — builds release artifacts on tag push.

## Detailed developer guide

Full architecture diagrams, IPC handler walkthroughs, and packaging notes live in `DEVELOPER.md`. End-user setup is in `README.md`.

## Working preferences

- Keep `.github/workflows/*.yml` credentials hardcoded until secrets are explicitly provisioned — do not refactor to `${{ secrets.X }}` proactively.
- When invoking external CLIs, pass all flags every time (use empty strings instead of omitting flags).
- For multi-PR/multi-slice work, sequence steps one at a time — do not fan out parallel sub-agents.

<!-- caliber:managed:pre-commit -->
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure Caliber syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "Caliber will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run Caliber manually before committing:
  1. Tell the user: "Caliber: Syncing agent configs with your latest changes..."
  2. Run: `caliber refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md CALIBER_LEARNINGS.md .agents/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, read `.agents/skills/setup-caliber/SKILL.md` and follow its instructions to install Caliber.
<!-- /caliber:managed:pre-commit -->

<!-- caliber:managed:learnings -->
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /caliber:managed:learnings -->
