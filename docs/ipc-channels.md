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
| `deeplink:open` | push | `string` | — | `mainWindow.webContents.send` (line 121) | `onDeeplink` | `src/renderer/main.ts:179` — `api.onDeeplink()` |
| `media:play` | invoke | none | `boolean` | `media:play` (line 636-638) | `mediaPlay` | `src/renderer/mediaSession.ts:49` — `window.electronAPI?.mediaPlay()` |
| `media:pause` | invoke | none | `boolean` | `media:pause` (line 640-642) | `mediaPause` | `src/renderer/mediaSession.ts:53` — `window.electronAPI?.mediaPause()` |
| `media:previous` | invoke | none | `boolean` | `media:previous` (line 644-646) | `mediaPrevious` | `src/renderer/mediaSession.ts:57` — `window.electronAPI?.mediaPrevious()` |
| `media:next` | invoke | none | `boolean` | `media:next` (line 648-650) | `mediaNext` | `src/renderer/mediaSession.ts:61` — `window.electronAPI?.mediaNext()` |
| `media:seek-backward` | invoke | none | `boolean` | `media:seek-backward` (line 652-654) | `mediaSeekBackward` | `src/renderer/mediaSession.ts:65` — `window.electronAPI?.mediaSeekBackward()` |
| `media:seek-forward` | invoke | none | `boolean` | `media:seek-forward` (line 656-658) | `mediaSeekForward` | `src/renderer/mediaSession.ts:69` — `window.electronAPI?.mediaSeekForward()` |
| `media:seek-to` | invoke | `number` | `boolean` | `media:seek-to` (line 660-662) | `mediaSeekTo` | `src/renderer/mediaSession.ts:74` — `window.electronAPI?.mediaSeekTo(details.seekTime)` |
| `gpu:get-disable-hardware-acceleration` | invoke | none | `boolean` | `gpu:get-disable-hardware-acceleration` (line 621) | `getDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:set-disable-hardware-acceleration` | invoke | `boolean` | `void` | `gpu:set-disable-hardware-acceleration` (line 625) | `setDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:get-feature-status` | invoke | none | `GPUFeatureStatus` | `gpu:get-feature-status` (line 630) | `getGpuFeatureStatus` | Not directly called by renderer; preload-only |
| `notification:show` | invoke | `{ title: string; body: string; clickAction?: string }` | `boolean` | `notification:show` (line 599) | `showNotification` | Not directly called by renderer; preload-only |
| `thumbar:update` | send | `{ playing: boolean }` | — | `thumbar:update` (line 574) | `updateThumbar` | `src/renderer/electronBridge.ts:116` — `api.updateThumbar?.({ playing: willBePlaying })` |
| `playback:progress` | send | `{ current: number; total: number }` | — | `playback:progress` (line 579) | `setPlaybackProgress` | `src/renderer/electronBridge.ts:117,133,141` — `api.setPlaybackProgress?.(player.position, player.duration)` |
| `power:update` | send | `{ playing: boolean }` | — | `power:update` (line 594) | `updatePowerBlocker` | `src/renderer/electronBridge.ts:119` — `api.updatePowerBlocker?.(willBePlaying)` |

## Behavioral Tests

The pairing test (`tests/unit/ipcChannels.test.ts`) enforces bidirectional contract
correctness for all 31 channels (preload invoke → main handle, preload send → main on,
main webContents.send → preload on).

The `describe('behavioral round-trips')` block covers actual round-trip IPC behavior for
the 9 invoke channels (Promise-based `ipcRenderer.invoke` / `ipcMain.handle`), verifying
correct channel + payload dispatch. The 6 send channels are fire-and-forget
(`ipcRenderer.send` / `ipcMain.on`) and cannot produce a round-trip response — they are
verified by the pairing test. The 6 push channels (main→renderer via `webContents.send`)
are verified by the pairing test; listener registration is tested for 3 of them in the
`push channels` block. The `deeplink:open` channel is verified by the pairing test only.

## Notes

- `HubConfig` type: `{ hubUrl: string | null; activeServerId: string | null; connectionMode: string | null }`
- `HubConfigPartial` type: `{ hubUrl?: string; activeServerId?: string; connectionMode?: string }`
- Invoke channels return `Promise<T>` via `ipcRenderer.invoke`; send channels are fire-and-forget via `ipcRenderer.send`.
- Push channels (main→renderer) use `webContents.send` in main and `ipcRenderer.on` in preload.
- Preload bridge methods return cleanup functions for `on*` listeners (returns `() => void`).
- All 19 invoke channels have matching main-process `ipcMain.handle` handlers.
- All 6 send channels have matching main-process `ipcMain.on` handlers.
- All 6 push channels have matching preload `ipcRenderer.on` listeners.
- No `any` payload types exist in any channel definitions.
