---
name: electron-ipc-handler
description: Adds a new Electron IPC channel coordinated across main, preload, and renderer type definitions. Wires ipcMain.handle/ipcMain.on in src/main/index.ts, exposes via contextBridge.exposeInMainWorld in src/preload/index.ts, and types window.electronAPI in src/renderer/types/electron.d.ts. Listener helpers must return cleanup functions per existing pattern. Use when user says 'add IPC handler', 'expose to renderer', 'new electronAPI method', 'tray menu action', or modifies src/main/index.ts / src/preload/index.ts / src/renderer/types/electron.d.ts. Do NOT use for renderer-only logic, for changing existing IPC signatures without coordinated updates across all three files, or for adding non-IPC Electron APIs (BrowserWindow config, app lifecycle).
---

# Electron IPC Handler

## Critical

- Every new IPC channel MUST be updated in ALL THREE files in a single change set:
  1. `src/main/index.ts` — register the handler/sender
  2. `src/preload/index.ts` — expose via `contextBridge.exposeInMainWorld('electronAPI', ...)`
  3. `src/renderer/types/electron.d.ts` — add the method to the `Window.electronAPI` interface
- Channel names use **kebab-case** (e.g. `get-app-path`, `media-play-pause`, `file-opened`). NEVER use camelCase or snake_case for channel strings.
- `electronAPI` methods use **camelCase** (e.g. `getAppPath`, `onMediaPlayPause`).
- Main-to-renderer event listeners MUST return a cleanup function. The renderer uses this for `useEffect` cleanup.
- `contextIsolation: true` and `nodeIntegration: false` are enforced in `src/main/index.ts:28-29`. NEVER bypass these. The preload is the only legitimate bridge.
- Do NOT import `ipcRenderer` directly in renderer code — only `window.electronAPI` is allowed.

## Instructions

### Step 1: Decide the IPC direction

Pick exactly one pattern based on data flow:

| Direction | Main API | Preload API | Use for |
|-----------|----------|-------------|---------|
| Renderer → Main (request/response) | `ipcMain.handle('channel', () => value)` | `() => ipcRenderer.invoke('channel')` | Returning data (versions, paths, async queries) |
| Renderer → Main (fire-and-forget) | `ipcMain.on('channel', (_, arg) => ...)` | `(arg) => ipcRenderer.send('channel', arg)` | Window controls, state mutations |
| Main → Renderer (event) | `mainWindow?.webContents.send('channel', arg)` from menu/tray click or callback | `onXxx: (callback) => { ipcRenderer.on(...); return () => ipcRenderer.removeListener(...) }` | Menu/tray actions, file dialog results |

Verify the direction matches an existing example in `src/main/index.ts:185-195` before proceeding.

### Step 2: Add the main-process side in `src/main/index.ts`

- For **request/response** handlers, add to the `// IPC Handlers` section (after line 184):
  ```ts
  ipcMain.handle('my-channel', () => /* return value or Promise */);
  ```
- For **fire-and-forget** handlers, add to the same section:
  ```ts
  ipcMain.on('my-channel', (_, arg: SomeType) => {
    mainWindow?.someMethod(arg);
  });
  ```
- For **menu/tray-triggered events**, add a `click` handler that sends to the renderer. Follow the pattern at `src/main/index.ts:77` and `:109`:
  ```ts
  { label: 'My Action', click: () => mainWindow?.webContents.send('my-channel', data) }
  ```
- For events that come from an async source (e.g. dialog result), follow `openFile()` at `src/main/index.ts:144-158` — use `mainWindow?.webContents.send('channel-name', payload)`.
- Use `log.info(...)` / `log.error(...)` from the already-imported `electron-log` for any non-trivial action. Do NOT use `console.log`.

Verify by running `npx tsc -p tsconfig.main.json --noEmit` before proceeding.

### Step 3: Expose via `src/preload/index.ts`

Add a new property inside the `exposeInMainWorld('electronAPI', { ... })` object. Group it under an existing comment section (`// App info`, `// Window controls`, `// Media controls from main process`, `// File handling`, `// Settings`) or add a new comment section.

- **invoke** (request/response):
  ```ts
  myMethod: () => ipcRenderer.invoke('my-channel'),
  ```
- **send** (fire-and-forget):
  ```ts
  myMethod: (arg: SomeType) => ipcRenderer.send('my-channel', arg),
  ```
- **on** (main → renderer event) — MUST return a cleanup function:
  ```ts
  onMyEvent: (callback: () => void) => {
    ipcRenderer.on('my-channel', callback);
    return () => ipcRenderer.removeListener('my-channel', callback);
  },
  ```
- **on** with payload — when wrapping with `(_, arg) => callback(arg)`, use `removeAllListeners` (see `onFileOpened` at `src/preload/index.ts:32-35`):
  ```ts
  onMyEvent: (callback: (payload: string) => void) => {
    ipcRenderer.on('my-channel', (_, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners('my-channel');
  },
  ```

The channel string MUST match exactly what was registered in Step 2.

### Step 4: Type in `src/renderer/types/electron.d.ts`

Add a line to the `electronAPI` interface inside `declare global { interface Window { ... } }`. The signature MUST match the preload exactly:

- invoke: `myMethod: () => Promise<ReturnType>;`
- send: `myMethod: (arg: SomeType) => void;`
- on: `onMyEvent: (callback: () => void) => () => void;` (the trailing `() => void` is the cleanup function)
- on with payload: `onMyEvent: (callback: (payload: string) => void) => () => void;`

Verify by running `npm run build` (or the project's `tsc` target) — TypeScript errors here mean the three files are out of sync.

### Step 5: Verify cross-file consistency

Run this verification before claiming completion:

```sh
grep -n "'my-channel'" src/main/index.ts src/preload/index.ts
grep -n "myMethod\|onMyEvent" src/preload/index.ts src/renderer/types/electron.d.ts
npm run build
```

All three files must reference the channel/method. Build must pass with zero TS errors.

### Step 6: (Optional) Consume from renderer

In a React component, call via `window.electronAPI`. For event listeners, ALWAYS wire cleanup in `useEffect`:

```ts
useEffect(() => {
  const unsubscribe = window.electronAPI.onMyEvent((payload) => {
    // handle
  });
  return unsubscribe;
}, []);
```

For invoke/send, call directly:
```ts
const version = await window.electronAPI.getVersion();
window.electronAPI.setAlwaysOnTop(true);
```

## Examples

### Example 1: Add `get-platform` (request/response)

User says: "Add an IPC method so the renderer can get the OS platform."

Actions:
1. `src/main/index.ts` after line 187:
   ```ts
   ipcMain.handle('get-platform', () => process.platform);
   ```
2. `src/preload/index.ts` inside `// App info` group:
   ```ts
   getPlatform: () => ipcRenderer.invoke('get-platform'),
   ```
3. `src/renderer/types/electron.d.ts` inside the interface:
   ```ts
   getPlatform: () => Promise<NodeJS.Platform>;
   ```

Result: `await window.electronAPI.getPlatform()` returns `'win32' | 'darwin' | 'linux' | ...`.

### Example 2: Add tray menu "Next Track" action (main → renderer)

User says: "Add a 'Next Track' tray menu item that the player listens to."

Actions:
1. `src/main/index.ts` add to tray `contextMenu` template (around line 77):
   ```ts
   { label: 'Next Track', click: () => mainWindow?.webContents.send('media-next') },
   ```
2. `src/preload/index.ts` in `// Media controls from main process`:
   ```ts
   onMediaNext: (callback: () => void) => {
     ipcRenderer.on('media-next', callback);
     return () => ipcRenderer.removeListener('media-next', callback);
   },
   ```
3. `src/renderer/types/electron.d.ts`:
   ```ts
   onMediaNext: (callback: () => void) => () => void;
   ```
4. Player component:
   ```ts
   useEffect(() => window.electronAPI.onMediaNext(handleNext), [handleNext]);
   ```

## Common Issues

- **`Property 'myMethod' does not exist on type 'Window['electronAPI']'`**: You added the preload entry but skipped Step 4. Add the signature to `src/renderer/types/electron.d.ts`. Restart `vite` dev server after editing `.d.ts` files.
- **`window.electronAPI is undefined` in renderer**: The preload script failed to load. Check `src/main/index.ts:27` — `preload: path.join(__dirname, 'preload.js')`. Verify the build emitted `dist/main/preload.js`. Run `npm run build` and inspect the `dist/` output.
- **Listener fires multiple times after HMR or remount**: The cleanup function was not returned, or the renderer didn't return it from `useEffect`. Confirm both Step 3 (preload returns `() => ipcRenderer.removeListener(...)`) and Step 6 (`return unsubscribe;` inside `useEffect`).
- **`An object could not be cloned` when sending data**: IPC uses structured clone — you tried to send a function, class instance, or DOM node. Send plain JSON-serializable objects only.
- **`No handler registered for 'my-channel'`**: Channel name typo. Run `grep -n "'my-channel'" src/main/index.ts src/preload/index.ts` — both files must show a match with identical strings.
- **Used `ipcRenderer.invoke` but main uses `ipcMain.on`** (or vice versa): Mismatch. `invoke` ↔ `handle`, `send` ↔ `on`. Fix one side to match. See Step 1 table.
- **TypeScript build fails after editing `electron.d.ts`**: The file MUST start with `export {};` to be treated as a module (see line 1). Without it, `declare global` is ignored.