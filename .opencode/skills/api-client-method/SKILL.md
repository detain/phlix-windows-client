---
name: api-client-method
description: NOT APPLICABLE as written to phlix-windows-client — this repo has no `src/renderer/utils/api.ts` and no local `ApiClient` class; that was the pre-migration React-era layout (nonexistent since the Vue thin-consumer rework). All server HTTP goes through the vendored `@phlix/ui` ApiClient upstream. If asked to "add an API call / new endpoint method", follow this guard: the work belongs upstream in @phlix/ui, not here.
---

# API Client Method — retired guard (R-WINDOWS-24 truth cure 2026-10-30)

The May 2026 template import (commit `019044b`) shipped this skill describing a
local `ApiClient` singleton in `src/renderer/utils/api.ts` with
`this.request<T>()`, a 401 response interceptor clearing `phlix_auth_token`
from `localStorage`, and consumers in `src/renderer/stores/` zustand stores.
Every one of those coordinates is a phantom: `src/renderer/utils/api.ts`,
`src/renderer/stores/`, and `tests/unit/api.test.ts` do not exist, and
`phlix_auth_token` is not a key any file in the tree reads or writes.

## The actual API law (thin consumer)

- **Server HTTP is owned upstream.** `@phlix/ui`'s `ApiClient` attaches
  `Authorization`/session headers and unwraps responses; the windows renderer
  never talks to `/api/v1` directly. New endpoint coverage = extend `@phlix/ui`
  and bump the pin (`github:detain/phlix-ui#v0.99.10` in `package.json`), per
  the upstream-first convention (AGENTS.md Conventions; `docs/decisions/004-no-local-ui.md`).
- **Device identity** is injected once at boot: `buildPhlixHeaders({ deviceId,
  deviceName: 'Phlix for Windows', deviceType: 'windows' })` from
  `@phlix/contracts` → passed as `deviceHeaders` into `createPhlixApp(config)`
  in `src/renderer/main.ts`. No token/sessionId is passed through it.
- **apiBase** is resolved by the pure `resolveAppConfig({ hub, serverUrl, envUrl })`
  in `src/renderer/resolveConfig.ts` (hub vs direct server; empty base is the law —
  with `requireConnection: true` it routes to the shared Connect screen instead of
  guessing localhost, retired in M-WINDOWS-07; never revive that fallback in docs).
- **Persisted quasi-secrets** (`deviceId`, `serverUrl`, `hubUrl`, the renderer token
  vault) flow through the DPAPI secret custody in `src/main/secretStore.ts` and
  `src/renderer/safeStorageTokenStore.ts` — not raw `localStorage` tokens.
- **Windows-local "API calls" are IPC**, never HTTP: extend `src/preload/index.ts`
  (`window.electronAPI`), type it in `src/renderer/types/electron.d.ts`, and handle
  it in `src/main` — see `docs/ipc-channels.md` and the `electron-ipc-handler` skill.

Do not create `src/renderer/utils/api.ts`, a second axios instance, or any local
route table to the server from this repo.
