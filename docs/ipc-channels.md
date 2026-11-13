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
| `get-app-path` | invoke | none | `string` | `ipcMain.handle` (1489) | `getAppPath` | Not directly called by renderer; preload-only |
| `get-version` | invoke | none | `string` | `ipcMain.handle` (1497) | `getVersion` | Not directly called by renderer; preload-only |
| `set-always-on-top` | send | `boolean` | — | `ipcMain.on` (1505) | `setAlwaysOnTop` | Not directly called by renderer; preload-only |
| `minimize-to-tray` | send | none | — | `ipcMain.on` (1513) | `minimizeToTray` | Not directly called by renderer; preload-only |
| `tray:get-minimize-to-tray` | invoke | none | `boolean` | `ipcMain.handle` (1524) | `getMinimizeToTray` | Not directly called by renderer; preload-only |
| `tray:set-minimize-to-tray` | send | `boolean` | — | `ipcMain.on` (1534) | `setMinimizeToTray` | Not directly called by renderer; preload-only |
| `hub:get-config` | invoke | none | `HubConfig` | `ipcMain.handle` (1554) | `hubGetConfig` | `src/renderer/main.ts:508` & `src/renderer/resolveConfig.ts:17` |
| `hub:set-config` | invoke | `HubConfigPartial` | `boolean` | `ipcMain.handle` (1579) | `hubSetConfig` | Not directly called by renderer; preload-only |
| `app:get-server-url` | invoke | none | `string \| null` | `ipcMain.handle` (1616) | `getServerUrl` | `src/renderer/main.ts:510` & `src/renderer/resolveConfig.ts:19` |
| `app:set-server-url` | invoke | `string` | `boolean` | `ipcMain.handle` (1624) | `setServerUrl` | `src/renderer/main.ts:696` |
| `app:check-server-version` | invoke | `{ apiBase: string }` | `ServerVersionCheck` | `ipcMain.handle` (1644) | `checkServerVersion` | `src/renderer/main.ts:296, 657` |
| `app:get-device-id` | invoke | none | `string` | `ipcMain.handle` (1689) | `getDeviceId` | `src/renderer/main.ts:509` |
| `notification:show` | invoke | `{ title: string; body: string; clickAction?: string }` | `boolean` | `ipcMain.handle` (2028) | `showNotification` | `src/renderer/main.ts:553` (M-WINDOWS-39: the incompatible-server boot reply is this channel's consumer; main-side gates per M-WINDOWS-33/40) |
| `theme:set-launch-background` | invoke | `string` (validated `#rgb`/`#rrggbb`) | `boolean` | `ipcMain.handle` (2057) | `setLaunchBackground` | `src/renderer/launchThemeReporter.ts:22` (WIN-52: active theme `--bg` mirrored for the next launch's BrowserWindow backgroundColor) |
| `gpu:get-disable-hardware-acceleration` | invoke | none | `boolean` | `ipcMain.handle` (2069) | `getDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:set-disable-hardware-acceleration` | invoke | `boolean` | `void` | `ipcMain.handle` (2077) | `setDisableHardwareAcceleration` | Not directly called by renderer; preload-only |
| `gpu:get-feature-status` | invoke | none | `GPUFeatureStatus` | `ipcMain.handle` (2088) | `getGpuFeatureStatus` | Not directly called by renderer; preload-only |
| `update:check-for-updates` | invoke | none | `UpdateState` | `ipcMain.handle` (2109) | `checkForUpdates` | Not directly called by renderer; preload-only |
| `update:get-status` | invoke | none | `UpdateState` | `ipcMain.handle` (2139) | `getUpdateStatus` | Not directly called by renderer; preload-only |
| `thumbar:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1857) | `updateThumbar` | `src/renderer/electronBridge.ts:72, 313` |
| `playback:progress` | send | `{ current: number; total: number }` | — | `ipcMain.on` (1866) | `setPlaybackProgress` | `src/renderer/electronBridge.ts:73, 151, 314, 340, 349` |
| `power:update` | send | `{ playing: boolean }` | — | `ipcMain.on` (1903) | `updatePowerBlocker` | `src/renderer/electronBridge.ts:74, 316` |
| `deeplink:ready` | send | none | — | `ipcMain.on` (360) | `notifyDeeplinkReady` | `src/renderer/main.ts:824` (M-WINDOWS-06: fires only after `onDeeplink` subscribed; main drains its pending-deeplink queue on it) |
| `vault:get` | sendSync | `{ key: string }` | `string \| null` | `ipcMain.on` (1758) | `vaultGet` | `src/renderer/safeStorageTokenStore.ts:51` — M-WINDOWS-11 DPAPI token vault (sync by @phlix/ui TokenStore contract; sender-pinned to the current main window) |
| `vault:set` | sendSync | `{ key: string; value: string }` | `boolean` | `ipcMain.on` (1772) | `vaultSet` | `src/renderer/safeStorageTokenStore.ts:52` — M-WINDOWS-11 |
| `vault:delete` | sendSync | `{ key: string }` | `boolean` | `ipcMain.on` (1791) | `vaultDelete` | `src/renderer/safeStorageTokenStore.ts:53, 119, 120, 121` — M-WINDOWS-11 |
| `vault:is-available` | sendSync | none | `boolean` | `ipcMain.on` (1810) | `vaultIsAvailable` | `src/renderer/safeStorageTokenStore.ts:54` — M-WINDOWS-11 |
| `deeplink:open` | push | `string` | — | `webContents.send` (245) | `onDeeplink` | `src/renderer/main.ts:814` |
| `media-play-pause` | push | none | — | `webContents.send` (898, 1168, 1239) | `onMediaPlayPause` | `src/renderer/electronBridge.ts:303` |
| `media-stop` | push | none | — | `webContents.send` (1169, 1240) | `onMediaStop` | `src/renderer/electronBridge.ts:330` |
| `media-rewind` | push | none | — | `webContents.send` (892, 1242) | `onMediaRewind` | `src/renderer/electronBridge.ts:336` |
| `media-forward` | push | none | — | `webContents.send` (904, 1243) | `onMediaForward` | `src/renderer/electronBridge.ts:345` |
| `open-settings` | push | none | — | `webContents.send` (1431) | `onOpenSettings` | `src/renderer/electronBridge.ts:354` |
| `update:available` | push | `{ version: string }` | — | `webContents.send` (962) | `onUpdateAvailable` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
| `update:progress` | push | `{ percent: number }` | — | `webContents.send` (1019) | `onUpdateProgress` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |
| `power:suspend` | push | — | — | `webContents.send` (2429) | `onPowerSuspend` | No renderer subscriber yet — the vendored ui's wake consumer (force-reconnect + SyncPlay clock re-anchor) is an upstream seam; signal wire shipped (M8) |
| `power:resume` | push | — | — | `webContents.send` (2439) | `onPowerResume` | As `power:suspend` (M8); on resume main ALSO re-asserts the display-sleep blocker when media believed itself playing |
| `update:downloaded` | push | `{ version: string }` | — | `webContents.send` (1028) | `onUpdateDownloaded` | No renderer subscriber; the preload listener exists for API completeness (updater UX is main-driven) |

## Behavioral Tests

The pairing test (`tests/unit/ipcChannels.test.ts`) enforces bidirectional contract
correctness for all 38 channels (16 invoke + 7 send + 4 sendSync + 11 push):
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
- All 16 invoke channels have matching main-process `ipcMain.handle` handlers.
- All 7 send channels have matching main-process `ipcMain.on` handlers.
- All 4 sendSync channels (M-WINDOWS-11 vault) have matching main-process `ipcMain.on` handlers answering via `event.returnValue`.
- All 11 push channels have matching preload `ipcRenderer.on` listeners.
- No `any` payload types exist in any channel definitions.
