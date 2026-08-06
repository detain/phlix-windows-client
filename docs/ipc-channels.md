# IPC Channel Reference

Every channel is documented with its direction, payload/return types, handler location,
preload bridge method, and renderer call sites. This document is load-bearing — the
pairing test (§ipcChannels.test.ts) asserts against it.

## Channel Table

| Channel | Direction | Payload | Return | Main Handler | Preload Method | Renderer Call Sites |
|---|---|---|---|---|---|---|
| `get-app-path` | invoke | none | `string` | `getAppPath` (line 206) | `getAppPath` | Not directly called by renderer; preload-only |
| `get-version` | invoke | none | `string` | `getVersion` (line 208) | `getVersion` | Not directly called by renderer; preload-only |
| `set-always-on-top` | send | `boolean` | — | `setAlwaysOnTop` (line 210-212) | `setAlwaysOnTop` | Not directly called by renderer; preload-only |
| `minimize-to-tray` | send | none | — | `minimizeToTray` (line 214-216) | `minimizeToTray` | Not directly called by renderer; preload-only |
| `tray:get-minimize-to-tray` | invoke | none | `boolean` | `getMinimizeToTray` (line 218) | `getMinimizeToTray` | Not directly called by renderer; preload-only |
| `tray:set-minimize-to-tray` | send | `boolean` | — | `setMinimizeToTray` (line 220) | `setMinimizeToTray` | Not directly called by renderer; preload-only |
| `hub:get-config` | invoke | none | `HubConfig` | `hubGetConfig` (line 223-229) | `hubGetConfig` | `src/renderer/main.ts:108` — `api.hubGetConfig()` |
| `hub:set-config` | invoke | `HubConfigPartial` | `void` | `hubSetConfig` (line 231-235) | `hubSetConfig` | Not directly called by renderer; preload-only |
| `app:get-server-url` | invoke | none | `string \| null` | `getServerUrl` (line 238-240) | `getServerUrl` | `src/renderer/main.ts:116` — `api.getServerUrl()` |
| `app:set-server-url` | invoke | `string` | `void` | `setServerUrl` (line 242-244) | `setServerUrl` | `src/renderer/main.ts:139` — `api.setServerUrl(url)` |
| `app:get-device-id` | invoke | none | `string` | `getDeviceId` (line 253-260) | `getDeviceId` | `src/renderer/main.ts:110` — `api.getDeviceId()` |
| `media-play-pause` | push | none | — | `mainWindow.webContents.send` (line 107,133) | `onMediaPlayPause` | `src/renderer/electronBridge.ts:105` — `api.onMediaPlayPause()` |
| `media-stop` | push | none | — | `mainWindow.webContents.send` (line 108,134) | `onMediaStop` | `src/renderer/electronBridge.ts:115` — `api.onMediaStop()` |
| `media-rewind` | push | none | — | `mainWindow.webContents.send` (line 136) | `onMediaRewind` | `src/renderer/electronBridge.ts:121` — `api.onMediaRewind()` |
| `media-forward` | push | none | — | `mainWindow.webContents.send` (line 137) | `onMediaForward` | `src/renderer/electronBridge.ts:127` — `api.onMediaForward()` |
| `open-settings` | push | none | — | `mainWindow.webContents.send` (line 183) | `onOpenSettings` | `src/renderer/electronBridge.ts:133` — `api.onOpenSettings()` |

## Behavioral Tests

All 16 channels have round-trip behavioral tests in `tests/unit/ipcChannels.test.ts`
under `describe('behavioral round-trips')`.

## Notes

- `HubConfig` type: `{ hubUrl: string | null; activeServerId: string | null; connectionMode: string | null }`
- `HubConfigPartial` type: `{ hubUrl?: string; activeServerId?: string; connectionMode?: string }`
- Invoke channels return `Promise<T>` via `ipcRenderer.invoke`; send channels are fire-and-forget via `ipcRenderer.send`.
- Push channels (main→renderer) use `webContents.send` in main and `ipcRenderer.on` in preload.
- Preload bridge methods return cleanup functions for `on*` listeners (returns `() => void`).
- All 8 invoke channels have matching main-process `ipcMain.handle` handlers.
- All 3 send channels have matching main-process `ipcMain.on` handlers.
- All 5 push channels have matching preload `ipcRenderer.on` listeners.
- No `any` payload types exist in any channel definitions.
