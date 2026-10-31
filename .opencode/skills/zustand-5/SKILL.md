---
name: zustand-5
description: NOT APPLICABLE to phlix-windows-client — zustand is not a dependency of this repo (state is vendored Pinia from @phlix/ui). The historical body was a generic third-party Zustand 5 pattern reference (persist middleware, slices, devtools) imported from a template. Treat it as a scope guard only.
license: Apache-2.0
metadata:
  author: prowler-cloud
  version: "1.0"
  scope: [root, ui]
  auto_invoke: "Using Zustand stores"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, WebFetch, WebSearch, Task
---

# Zustand 5 — retired guard (R-WINDOWS-24 truth cure 2026-10-30)

Generic upstream pattern doc kept in the tree by the May 2026 template import
(commit `019044b`). Every scaffold it taught (`create<T>()(persist(...))`,
`slices`, `devtools`, `getState()`/`subscribe()` outside components) targets a
library this repo never adopted: `grep -i zustand package.json` finds nothing,
and no file under `src/` imports zustand. Its `scope: [root, ui]` metadata was
also false here — nothing under this repo's root or UI layer uses Zustand.

Renderer state law lives in the sibling guards: see `zustand-store/SKILL.md`
(vendored `@phlix/ui` Pinia stores, upstream-first, no local stores) and
AGENTS.md *Conventions*. Do not introduce zustand, `zustand/middleware`, or
Redux DevTools wiring from this doc. If generic Zustand reference is genuinely
needed, read it from its upstream source — not from this Vue thin-consumer repo.
