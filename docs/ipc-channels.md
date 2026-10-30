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
| `get-app-path` | invoke | none | `string` | `ipcMain.handle` (920) | `getAppPath` | Not directly called by renderer; preload-only |
| `get-version` | invoke | none | `string` | `ipcMain.handle` (922) | `getVersion` | Not directly called by renderer; preload-only |
| `set-always-on-top` | send | `boolean` | — | `ipcMain.on` (924) | `setAlwaysOnTop` | Not directly called by renderer; preload-only |
| `minimize-to-tray` | send | none | — | `ipcMain.on` (928) | `minimizeToTray` | Not directly called by renderer; preload-only |
| `tray:get-minimize-to-tray` | invoke | none | `boolean` | `ipcMain.handle` (932) | `getMinimizeToTray` | Not directly called by renderer; preload-only |
| `tray:set-minimize-to-tray` | send | `boolean` | — | `ipcMain.on` (934) | `setMinimizeToTray` | Not directly called by renderer; preload-only |
| `hub:get-config` | invoke | none | `HubConfig` | `ipcMain.handle` (946) | `hubGetConfig` | `src/renderer/main.ts:297` & `src/renderer/resolveConfig.ts:17` |
| `hub:set-config` | invoke | `HubConfigPartial` | `void` | `ipcMain.handle` (954) | `hubSetConfig` | Not directly called by renderer; preload-only |
| `app:get-server-url` | invoke | none | `string \| null` | `ipcMain.handle` (961) | `getServerUrl` | `src/renderer/main.ts:299` & `src/renderer/resolveConfig.ts:19` |
| `app:set-server-url` | invoke | `string` | `void` | `ipcMain.handle` (965) | `setServerUrl` | `src/renderer/main.ts:391` |
| `app:check-server-version` | invoke | `{ apiBase: string }` | `ServerVersionCheck` | `ipcMain.handle` (973) | `checkServerVersion` | `src/renderer/main.ts:330` |
| `app:get-device-id` | invoke | none | `string` | `ipcMain.handle` (990) | `getDeviceId` | `src/renderer/main.ts:298` |
| `notification:show` | invoke | `{ title: string; body: string; clickAction?: string }` | `boolean` | `ipcMain.handle` (1194) | `showNotification` | `src/renderer/main.ts:349` (M-WINDOWS-39: the incompatible-server boot reply is this channel's consumer; main-side gates per M-WINDOWS-33/40) |
| `gpu:get-disable-hardware-acceleration` | invoke | none | `boolean` | `ipcMain.handle` (1213) | `getDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:set-disable-hardware-acceleration` | invoke | `boolean` | `void` | `ipcMain.handle` (1217) | `setDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:get-feature-status` | invoke | none | `GPUFeatureStatus` | `ipcMain.handle` (1222) | `getGpuFeatureStatus` | Not directly called by renderer; preload-only |
| `media:play` | invoke | none | `boolean` | `ipcMain.handle` (1228) | `mediaPlay` | `src/renderer/mediaSession.ts:27` |
| `media:pause` | invoke | none | `boolean` | `ipcMain.handle` (1232) | `mediaPause` | `src/renderer/mediaSession.ts:31` |
| `media:previous` | invoke | none | `boolean` | `ipcMain.handle` (1236) | `mediaPrevious` | `src/renderer/mediaSession.ts:35` |
| `media:next` | invoke | none | `boolean` | `ipcMain.handle` (1240) | `mediaNext` | `src/renderer/mediaSession.ts:39` |
| `media:seek-backward` | invoke | none | `boolean` | `ipcMain.handle` (1244) | `mediaSeekBackward` | `src/renderer/mediaSession.ts:43` |
| `media:seek-forward` | invoke | none | `boolean` | `ipcMain.handle` (1248) | `mediaSeekForward` | `src/renderer/mediaSession.ts:47` |
| `media:seek-to` | invoke | `number` | `boolean` | `ipcMain.handle` (1252) | `mediaSeekTo` | `src/renderer/mediaSession.ts:52` |
| `update:check-for-updates` | invoke | none | `UpdateState` | `ipcMain.handle` (1257) | `checkForUpdates` | Not directly called by renderer; preload-only |
| `update:get-status` | invoke | none | `UpdateState` | `ipcMain.handle` (1278) | `getUpdateStatus` | Not directly called by renderer; preload-only |
| `thumbar:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1101) | `updateThumbar` | `src/renderer/electronBridge.ts:124, 299` |
| `playback:progress` | send | `{ current: number; total: number }` | — | `ipcMain.on` (1106) | `setPlaybackProgress` | `src/renderer/electronBridge.ts:139, 151, 300, 326, 335, 344` |
| `power:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1124) | `updatePowerBlocker` | `src/renderer/electronBridge.ts:125, 302` |
| `deeplink:ready` | send | none | — | `ipcMain.on` (264) | `notifyDeeplinkReady` | `src/renderer/main.ts:466` (M-WINDOWS-06: fires only after `onDeeplink` subscribed; main drains its pending-deeplink queue on it) |
| `vault:get` | sendSync | `{ key: string }` | `string \| null` | `ipcMain.on` (1039) | `vaultGet` | `src/renderer/safeStorageTokenStore.ts:73` — M-WINDOWS-11 DPAPI token vault (sync by @phlix/ui TokenStore contract; sender-pinned to the current main window) |
| `vault:set` | sendSync | `{ key: string; value: string }` | `boolean` | `ipcMain.on` (1053) | `vaultSet` | `src/renderer/safeStorageTokenStore.ts:82` — M-WINDOWS-11 |
| `vault:delete` | sendSync | `{ key: string }` | `boolean` | `ipcMain.on` (1072) | `vaultDelete` | `src/renderer/safeStorageTokenStore.ts:108, 115, 116, 117` — M-WINDOWS-11 |
| `vault:is-available` | sendSync | none | `boolean` | `ipcMain.on` (1091) | `vaultIsAvailable` | `src/renderer/safeStorageTokenStore.ts:50` — M-WINDOWS-11 |
| `deeplink:open` | push | `string` | — | `webContents.send` (182) | `onDeeplink` | `src/renderer/main.ts:451` |
| `media-play-pause` | push | none | — | `webContents.send` (556, 752, 792, 1229, 1233) | `onMediaPlayPause` | `src/renderer/electronBridge.ts:289` |
| `media-stop` | push | none | — | `webContents.send` (753, 793) | `onMediaStop` | `src/renderer/electronBridge.ts:316` |
| `media-rewind` | push | none | — | `webContents.send` (551, 795, 1245) | `onMediaRewind` | `src/renderer/electronBridge.ts:322` |
| `media-forward` | push | none | — | `webContents.send` (561, 796, 1249) | `onMediaForward` | `src/renderer/electronBridge.ts:331` |
| `media-seek-to` | push | `number` | — | `webContents.send` (1253) | `onMediaSeekTo` | `src/renderer/electronBridge.ts:340` |
| `media-previous` | push | none | — | `webContents.send` (1237) | `onMediaPrevious` | `src/renderer/electronBridge.ts:356` |
| `media-next` | push | none | — | `webContents.send` (1241) | `onMediaNext` | `src/renderer/electronBridge.ts:362` |
| `open-settings` | push | none | — | `webContents.send` (866) | `onOpenSettings` | `src/renderer/electronBridge.ts:349` |
| `update:available` | push | `{ version: string }` | — | `webContents.send` (615) | `onUpdateAvailable` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
| `update:progress` | push | `{ percent: number }` | — | `webContents.send` (659) | `onUpdateProgress` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
| `update:downloaded` | push | `{ version: string }` | — | `webContents.send` (668) | `onUpdateDownloaded` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |

## Behavioral Tests

The pairing test (`tests/unit/ipcChannels.test.ts`) enforces bidirectional contract
correctness for all 45 channels (22 invoke + 7 send + 4 sendSync + 12 push):
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
- All 22 invoke channels have matching main-process `ipcMain.handle` handlers.
- All 7 send channels have matching main-process `ipcMain.on` handlers.
- All 4 sendSync channels (M-WINDOWS-11 vault) have matching main-process `ipcMain.on` handlers answering via `event.returnValue`.
- All 12 push channels have matching preload `ipcRenderer.on` listeners.
- No `any` payload types exist in any channel definitions.
