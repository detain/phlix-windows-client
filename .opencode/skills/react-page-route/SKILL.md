---
name: react-page-route
description: NOT APPLICABLE to phlix-windows-client — this repo has zero React. The historical body instructed creating src/renderer/pages/*.tsx and registering routes in a src/renderer/App.tsx; neither path exists and doing so would violate the thin-consumer no-forking law (AGENTS.md Conventions, docs/decisions/004). If you were about to invoke this skill for "add a page / new route / new screen", stop and follow the Vue routing law below instead.
---

# React Page Route — retired (this repo is Vue; R-WINDOWS-24 truth cure 2026-10-30)

This skill is pre-migration scaffolding from the May 2026 template import
(commit `019044b`). It documented a React Router flow — page files under
`src/renderer/pages/`, route registration in `src/renderer/App.tsx`,
`react-router-dom` `<Link>`/`useNavigate()`. None of those files exist. There is no
React, no react-router-dom, and no zustand in `package.json`. Following its old
instructions would fork UI that lawfully belongs upstream.

## The actual law here (thin consumer)

- Page VIEWS and base routing come from `@phlix/ui`'s `createPhlixApp(config)`
  (`src/renderer/main.ts` boots it; pinned `github:detain/phlix-ui#v0.99.10`).
- The windows-side route table is authored in `buildExtraRoutes(appMode)`
  (`src/renderer/main.ts`) — it registers the `/app/*` entries and admin gating
  around the vendored views. The nav catalog is `buildMenu(appMode)` (same file).
  Do not conflate the two: routes+gating → `buildExtraRoutes`, nav entries → `buildMenu`.
- The router base is `/app`; navigation uses vue-router paths such as
  `router.push('/app/settings')` (see `src/renderer/electronBridge.ts`).
- A new shared screen belongs upstream: extend `@phlix/ui` and bump the pin
  (ADR-004, `docs/decisions/004-no-local-ui.md`). Never create a local pages
  directory. The enumerated local surfaces in AGENTS.md *Renderer layout*
  (player overlays via `overlay.tsx`, boot-failure screen, i18n catalogs,
  media-session handlers, DPAPI token-store adapter, route wiring) are the
  complete set of intentional local code.
