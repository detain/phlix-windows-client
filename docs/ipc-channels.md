# IPC Channel Reference

Every channel is documented with its direction, payload/return types, handler location,
preload bridge method, and renderer call sites. This document is load-bearing —
`tests/unit/ipcChannels.test.ts` pins it four ways (R-WINDOWS-03): the table enumerates
every live channel with its true direction, each row's Main Handler coordinates equal the
live registration-site set exactly, every cited renderer line really calls the row's
preload method, and the prose counts match the measured inventories. Coordinates are
`src/main/index.ts` lines in the parentheses; renderer sites are `file:line`.

A fifth leg (M-WINDOWS-39) covers the third question the pairing pins never asked:
which preload wrappers have NO renderer consumer. That set is not hidden in "preload-only"
prose — it is an explicit named inventory with per-method retention rationale in
`tests/unit/ipcChannels.test.ts` (`PRELOAD_SHELL_ONLY`), so a new silent orphan or a
retired wrapper left behind both redden the suite.

## Channel Table

| Channel | Direction | Payload | Return | Main Handler | Preload Method | Renderer Call Sites |
|---|---|---|---|---|---|---|
|`get-app-path` | invoke | none | `string` | `ipcMain.handle` (1475) | `getAppPath` | Not directly called by renderer; preload-only |
|`get-version` | invoke | none | `string` | `ipcMain.handle` (1483) | `getVersion` | Not directly called by renderer; preload-only |
|`set-always-on-top` | send | `boolean` | — | `ipcMain.on` (1491) | `setAlwaysOnTop` | Not directly called by renderer; preload-only |
|`minimize-to-tray` | send | none | — | `ipcMain.on` (1499) | `minimizeToTray` | Not directly called by renderer; preload-only |
|`tray:get-minimize-to-tray` | invoke | none | `boolean` | `ipcMain.handle` (1510) | `getMinimizeToTray` | Not directly called by renderer; preload-only |
|`tray:set-minimize-to-tray` | send | `boolean` | — | `ipcMain.on` (1520) | `setMinimizeToTray` | Not directly called by renderer; preload-only |
|`hub:get-config` | invoke | none | `HubConfig` | `ipcMain.handle` (1540) | `hubGetConfig` | `src/renderer/main.ts:497` & `src/renderer/resolveConfig.ts:17` |
|`hub:set-config` | invoke | `HubConfigPartial` | `boolean` | `ipcMain.handle` (1565) | `hubSetConfig` | Not directly called by renderer; preload-only |
|`app:get-server-url` | invoke | none | `string \| null` | `ipcMain.handle` (1602) | `getServerUrl` | `src/renderer/main.ts:499` & `src/renderer/resolveConfig.ts:19` |
|`app:set-server-url` | invoke | `string` | `boolean` | `ipcMain.handle` (1610) | `setServerUrl` | `src/renderer/main.ts:685` |
|`app:check-server-version` | invoke | `{ apiBase: string }` | `ServerVersionCheck` | `ipcMain.handle` (1630) | `checkServerVersion` | `src/renderer/main.ts:275, 646` |
|`app:get-device-id` | invoke | none | `string` | `ipcMain.handle` (1675) | `getDeviceId` | `src/renderer/main.ts:498` |
|`notification:show` | invoke | `{ title: string; body: string; clickAction?: string }` | `boolean` | `ipcMain.handle` (2014) | `showNotification` | `src/renderer/main.ts:542` (M-WINDOWS-39: the incompatible-server boot reply is this channel's consumer; main-side gates per M-WINDOWS-33/40) |
|`gpu:get-disable-hardware-acceleration` | invoke | none | `boolean` | `ipcMain.handle` (2043) | `getDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
|`gpu:set-disable-hardware-acceleration` | invoke | `boolean` | `void` | `ipcMain.handle` (2051) | `setDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
|`gpu:get-feature-status` | invoke | none | `GPUFeatureStatus` | `ipcMain.handle` (2062) | `getGpuFeatureStatus` | Not directly called by renderer; preload-only |
|`update:check-for-updates` | invoke | none | `UpdateState` | `ipcMain.handle` (2083) | `checkForUpdates` | Not directly called by renderer; preload-only |
|`update:get-status` | invoke | none | `UpdateState` | `ipcMain.handle` (2113) | `getUpdateStatus` | Not directly called by renderer; preload-only |
|`thumbar:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1843) | `updateThumbar` | `src/renderer/electronBridge.ts:72, 313` |
|`playback:progress` | send | `{ current: number; total: number }` | — | `ipcMain.on` (1852) | `setPlaybackProgress` | `src/renderer/electronBridge.ts:73, 151, 314, 340, 349` |
|`power:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1889) | `updatePowerBlocker` | `src/renderer/electronBridge.ts:74, 316` |
|`deeplink:ready` | send | none | — | `ipcMain.on` (359) | `notifyDeeplinkReady` | `src/renderer/main.ts:814` (M-WINDOWS-06: fires only after `onDeeplink` subscribed; main drains its pending-deeplink queue on it) |
|`vault:get` | sendSync | `{ key: string }` | `string \| null` | `ipcMain.on` (1744) | `vaultGet` | `src/renderer/safeStorageTokenStore.ts:51` — M-WINDOWS-11 DPAPI token vault (sync by @phlix/ui TokenStore contract; sender-pinned to the current main window) |
|`vault:set` | sendSync | `{ key: string; value: string }` | `boolean` | `ipcMain.on` (1758) | `vaultSet` | `src/renderer/safeStorageTokenStore.ts:52` — M-WINDOWS-11 |
|`vault:delete` | sendSync | `{ key: string }` | `boolean` | `ipcMain.on` (1777) | `vaultDelete` | `src/renderer/safeStorageTokenStore.ts:53, 119, 120, 121` — M-WINDOWS-11 |
|`vault:is-available` | sendSync | none | `boolean` | `ipcMain.on` (1796) | `vaultIsAvailable` | `src/renderer/safeStorageTokenStore.ts:54` — M-WINDOWS-11 |
| `deeplink:open` | push | `string` | — | `webContents.send` (244) | `onDeeplink` | `src/renderer/main.ts:804` |
|`media-play-pause` | push | none | — | `webContents.send` (884, 1154, 1225) | `onMediaPlayPause` | `src/renderer/electronBridge.ts:303` |
|`media-stop` | push | none | — | `webContents.send` (1155, 1226) | `onMediaStop` | `src/renderer/electronBridge.ts:330` |
|`media-rewind` | push | none | — | `webContents.send` (878, 1228) | `onMediaRewind` | `src/renderer/electronBridge.ts:336` |
|`media-forward` | push | none | — | `webContents.send` (890, 1229) | `onMediaForward` | `src/renderer/electronBridge.ts:345` |
|`open-settings` | push | none | — | `webContents.send` (1417) | `onOpenSettings` | `src/renderer/electronBridge.ts:354` |
|`update:available` | push | `{ version: string }` | — | `webContents.send` (948) | `onUpdateAvailable` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
|`update:progress` | push | `{ percent: number }` | — | `webContents.send` (1005) | `onUpdateProgress` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
|`power:suspend` | push | — | — | `webContents.send` (2404) | `onPowerSuspend` | No renderer subscriber yet — the vendored shell's wake consumer (force-reconnect + SyncPlay clock re-anchor) is an upstream seam; signal wire shipped (M8) |
|`power:resume` | push | — | — | `webContents.send` (2414) | `onPowerResume` | As `power:suspend` (M8); on resume main ALSO re-asserts the display-sleep blocker when media believed itself playing |
|`update:downloaded` | push | `{ version: string }` | — | `webContents.send` (1014) | `onUpdateDownloaded` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |

## Behavioral Tests

The pairing test (`tests/unit/ipcChannels.test.ts`) enforces bidirectional contract
correctness for all 37 channels (15 invoke + 7 send + 4 sendSync + 11 push):
preload invoke → main handle, preload send → main on, preload sendSync → main on,
main webContents.send → preload on, plus the doc-currency pins above.

The `describe('behavioral round-trips')` block samples 3 invoke channels and 4 send
channels through the real preload surface, verifying correct channel + payload dispatch;
the remaining invoke/send channels are covered by the pairing and inventory pins. The
7 send channels are fire-and-forget (`ipcRenderer.send` / `ipcMain.on`) and cannot
produce a round-trip response — they are verified by the pairing test. The 4 sendSync
channels (M-WINDOWS-11 vault, `ipcRenderer.sendSync` / `ipcMain.on` + `event.returnValue`)
are round-trip by protocol; their behavior is pinned in
`tests/unit/mainSecretCustody.test.ts` against the real main-process handlers. The 11
push channels (main→renderer via `webContents.send`) are verified by the pairing test;
listener registration is tested for 3 of them in the `push channels` block. The
`deeplink:open` channel is verified by the pairing test and the doc-currency pins only.

## Notes

- `HubConfig` type: `{ hubUrl: string | null; activeServerId: string | null; connectionMode: string | null }`
- `HubConfigPartial` type: `{ hubUrl?: string; activeServerId?: string; connectionMode?: string }`
- `UpdateState` type: the shared updater state object (`status`, `version`, progress fields) — declared at `src/main/index.ts` (the updater section).
- Invoke channels return `Promise<T>` via `ipcRenderer.invoke`; send channels are fire-and-forget via `ipcRenderer.send`.
- Push channels (main→renderer) use `webContents.send` in main and `ipcRenderer.on` in preload.
- Preload bridge methods return cleanup functions for `on*` listeners (returns `() => void`).
- All 15 invoke channels have matching main-process `ipcMain.handle` handlers.
- All 7 send channels have matching main-process `ipcMain.on` handlers.
- All 4 sendSync channels (M-WINDOWS-11 vault) have matching main-process `ipcMain.on` handlers answering via `event.returnValue`.
- All 11 push channels have matching preload `ipcRenderer.on` listeners.
- No `any` payload types exist in any channel definitions.
