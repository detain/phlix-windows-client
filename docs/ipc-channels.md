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
| `get-app-path` | invoke | none | `string` | `ipcMain.handle` (989) | `getAppPath` | Not directly called by renderer; preload-only |
| `get-version` | invoke | none | `string` | `ipcMain.handle` (991) | `getVersion` | Not directly called by renderer; preload-only |
| `set-always-on-top` | send | `boolean` | — | `ipcMain.on` (993) | `setAlwaysOnTop` | Not directly called by renderer; preload-only |
| `minimize-to-tray` | send | none | — | `ipcMain.on` (997) | `minimizeToTray` | Not directly called by renderer; preload-only |
| `tray:get-minimize-to-tray` | invoke | none | `boolean` | `ipcMain.handle` (1001) | `getMinimizeToTray` | Not directly called by renderer; preload-only |
| `tray:set-minimize-to-tray` | send | `boolean` | — | `ipcMain.on` (1003) | `setMinimizeToTray` | Not directly called by renderer; preload-only |
| `hub:get-config` | invoke | none | `HubConfig` | `ipcMain.handle` (1015) | `hubGetConfig` | `src/renderer/main.ts:296` & `src/renderer/resolveConfig.ts:17` |
| `hub:set-config` | invoke | `HubConfigPartial` | `boolean` | `ipcMain.handle` (1036) | `hubSetConfig` | Not directly called by renderer; preload-only |
| `app:get-server-url` | invoke | none | `string \| null` | `ipcMain.handle` (1069) | `getServerUrl` | `src/renderer/main.ts:298` & `src/renderer/resolveConfig.ts:19` |
| `app:set-server-url` | invoke | `string` | `boolean` | `ipcMain.handle` (1073) | `setServerUrl` | `src/renderer/main.ts:390` |
| `app:check-server-version` | invoke | `{ apiBase: string }` | `ServerVersionCheck` | `ipcMain.handle` (1089) | `checkServerVersion` | `src/renderer/main.ts:329` |
| `app:get-device-id` | invoke | none | `string` | `ipcMain.handle` (1106) | `getDeviceId` | `src/renderer/main.ts:297` |
| `notification:show` | invoke | `{ title: string; body: string; clickAction?: string }` | `boolean` | `ipcMain.handle` (1310) | `showNotification` | `src/renderer/main.ts:348` (M-WINDOWS-39: the incompatible-server boot reply is this channel's consumer; main-side gates per M-WINDOWS-33/40) |
| `gpu:get-disable-hardware-acceleration` | invoke | none | `boolean` | `ipcMain.handle` (1329) | `getDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:set-disable-hardware-acceleration` | invoke | `boolean` | `void` | `ipcMain.handle` (1333) | `setDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:get-feature-status` | invoke | none | `GPUFeatureStatus` | `ipcMain.handle` (1338) | `getGpuFeatureStatus` | Not directly called by renderer; preload-only |
| `update:check-for-updates` | invoke | none | `UpdateState` | `ipcMain.handle` (1352) | `checkForUpdates` | Not directly called by renderer; preload-only |
| `update:get-status` | invoke | none | `UpdateState` | `ipcMain.handle` (1373) | `getUpdateStatus` | Not directly called by renderer; preload-only |
| `thumbar:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1217) | `updateThumbar` | `src/renderer/electronBridge.ts:124, 299` |
| `playback:progress` | send | `{ current: number; total: number }` | — | `ipcMain.on` (1222) | `setPlaybackProgress` | `src/renderer/electronBridge.ts:139, 151, 300, 326, 335` |
| `power:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1240) | `updatePowerBlocker` | `src/renderer/electronBridge.ts:125, 302` |
| `deeplink:ready` | send | none | — | `ipcMain.on` (266) | `notifyDeeplinkReady` | `src/renderer/main.ts:466` (M-WINDOWS-06: fires only after `onDeeplink` subscribed; main drains its pending-deeplink queue on it) |
| `vault:get` | sendSync | `{ key: string }` | `string \| null` | `ipcMain.on` (1155) | `vaultGet` | `src/renderer/safeStorageTokenStore.ts:73` — M-WINDOWS-11 DPAPI token vault (sync by @phlix/ui TokenStore contract; sender-pinned to the current main window) |
| `vault:set` | sendSync | `{ key: string; value: string }` | `boolean` | `ipcMain.on` (1169) | `vaultSet` | `src/renderer/safeStorageTokenStore.ts:82` — M-WINDOWS-11 |
| `vault:delete` | sendSync | `{ key: string }` | `boolean` | `ipcMain.on` (1188) | `vaultDelete` | `src/renderer/safeStorageTokenStore.ts:108, 115, 116, 117` — M-WINDOWS-11 |
| `vault:is-available` | sendSync | none | `boolean` | `ipcMain.on` (1207) | `vaultIsAvailable` | `src/renderer/safeStorageTokenStore.ts:50` — M-WINDOWS-11 |
| `deeplink:open` | push | `string` | — | `webContents.send` (182) | `onDeeplink` | `src/renderer/main.ts:451` |
| `media-play-pause` | push | none | — | `webContents.send` (576, 813, 853) | `onMediaPlayPause` | `src/renderer/electronBridge.ts:289` |
| `media-stop` | push | none | — | `webContents.send` (814, 854) | `onMediaStop` | `src/renderer/electronBridge.ts:316` |
| `media-rewind` | push | none | — | `webContents.send` (571, 856) | `onMediaRewind` | `src/renderer/electronBridge.ts:322` |
| `media-forward` | push | none | — | `webContents.send` (581, 857) | `onMediaForward` | `src/renderer/electronBridge.ts:331` |
| `open-settings` | push | none | — | `webContents.send` (935) | `onOpenSettings` | `src/renderer/electronBridge.ts:340` |
| `update:available` | push | `{ version: string }` | — | `webContents.send` (635) | `onUpdateAvailable` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
| `update:progress` | push | `{ percent: number }` | — | `webContents.send` (679) | `onUpdateProgress` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
| `update:downloaded` | push | `{ version: string }` | — | `webContents.send` (688) | `onUpdateDownloaded` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |

## Behavioral Tests

The pairing test (`tests/unit/ipcChannels.test.ts`) enforces bidirectional contract
correctness for all 35 channels (22 invoke + 7 send + 4 sendSync + 12 push):
preload invoke → main handle, preload send → main on, preload sendSync → main on,
main webContents.send → preload on, plus the doc-currency pins above.

The `describe('behavioral round-trips')` block samples 3 invoke channels and 4 send
channels through the real preload surface, verifying correct channel + payload dispatch;
the remaining invoke/send channels are covered by the pairing and inventory pins. The
7 send channels are fire-and-forget (`ipcRenderer.send` / `ipcMain.on`) and cannot
produce a round-trip response — they are verified by the pairing test. The 4 sendSync
channels (M-WINDOWS-11 vault, `ipcRenderer.sendSync` / `ipcMain.on` + `event.returnValue`)
are round-trip by protocol; their behavior is pinned in
`tests/unit/mainSecretCustody.test.ts` against the real main-process handlers. The 12
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
- All 9 push channels have matching preload `ipcRenderer.on` listeners.
- No `any` payload types exist in any channel definitions.
