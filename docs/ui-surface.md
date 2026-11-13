# @phlix/ui v0.98.39 — Page and Route Surface Inventory

> **Era snapshot (M-WINDOWS-54, 2026-10-31):** every row below was measured against
> `@phlix/ui` **v0.98.39**. The runtime this repo pins today is
> `github:detain/phlix-ui#v1.0.0`; the v0.99.x wave (playlist management, theme
> sources, socket-hint seams, …) has NOT been re-inventoried here. Use this table
> as the historical baseline and the method to re-derive it — do not trust an
> individual row as live truth without re-running the headless dist analysis
> against the pinned bundle. Windows-side line coordinates have been replaced by
> symbol anchors (coordinates rot; symbols don't).

**Purpose:** Track every page available in `@phlix/ui` v0.98.39, which ones are wired
in the reference web-ui (`phlix-server/web-ui`), and which are wired in this repo
(`phlix-windows-client`).

- **Page count:** 43 root-table rows + 23 admin-table rows = **66 rows**. `AuditLogsPage` and
  `RequestsPage` appear in both tables (they are admin pages that the root inventory also
  lists), so the **distinct** page count is **64**; every tally below counts table rows.
- **Reference web-ui:** `phlix-server/web-ui/src/main.ts` (menu + extraRoutes — the
  `buildMenu`/`buildExtraRoutes` call sites, v0.98.39 era)
- **This repo:** `buildMenu(appMode)` / `buildExtraRoutes(appMode)` in `src/renderer/main.ts`
  (`buildMenu` ~:204-243, `buildExtraRoutes` ~:258-290). Every windows-client cell below carries
  **two verdicts, `server:` and `hub:`**, because the two modes ship different menus and routes.
  Verdicts were re-derived against the shipped `buildMenu`/`buildExtraRoutes` and the router that
  `createPhlixApp` builds from them at the pinned `@phlix/ui` v0.99.27 (route dump, both modes);
  the **web-ui column stays the v0.98.39-era measurement**.
- The shared @phlix/ui app renders **no default nav** once `menu` is supplied — behavior of
  `@phlix/ui`'s own `createPhlixApp` (no windows-side code involved)

## Status Key

| Status | Meaning |
|--------|---------|
| `OK` | Registered and has a navigation link (in `menu` / `buildMenu`) |
| `UNREACHABLE` | Registered (in `createPhlixApp`/`buildRoutes` or `extraRoutes`) but has no nav link |
| `MISSING` | Not registered at all in this context |

---

## Root Pages (43)

App routes (`browse`, `media`, `season`, `library`, `player`, `login`, `signup`, `connect`,
`settings`, `explore`, `recommendations`, `history`, `syncplay`, `music`, `parental`, plus
`playlists`, `playlists/:id`, `profiles`) are registered in **both** modes; a page with an app
route but no menu entry in a mode is UNREACHABLE there, not MISSING. `playlists`, `profiles`
and the hub `mcp-tokens` route are v0.99.x additions outside the 66-row inventory.

| Page | Path (createPhlixApp) | web-ui | windows-client (server / hub mode) |
|------|-----------------------|--------|----------------|
| AcceptInvitePage | `/app/accept-invite` | MISSING | server: MISSING / hub: UNREACHABLE (route `/app/accept-invite/:token`, deep-link only) |
| AudiobookDetailPage | via AudiobooksPage | OK (extraRoutes) | server: MISSING / hub: MISSING |
| AudiobookPlayerPage | via AudiobooksPage | OK (extraRoutes) | server: MISSING / hub: MISSING |
| AudiobooksPage | `/app/audiobooks` | OK (extraRoutes) | server: MISSING (dead nav link: `buildMenu` `audiobooks` has no registered route) / hub: MISSING |
| AuditLogsPage | `/app/admin/audit-logs` | OK (buildAdminRoutes) | server: MISSING / hub: OK (buildHubAdminRoutes) |
| BookDetailPage | via BooksPage | OK (extraRoutes) | server: MISSING / hub: MISSING |
| BookReaderPage | via BooksPage | OK (extraRoutes) | server: MISSING / hub: MISSING |
| BooksPage | `/app/books` | OK (extraRoutes) | server: MISSING (dead nav link: `buildMenu` `books` has no registered route) / hub: MISSING |
| BrowsePage | `/app` | OK (menu) | server: OK (buildMenu) / hub: UNREACHABLE (app route, not in hub menu) |
| ConnectPage | `/app/connect` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| ExplorePage | `/app/explore` | UNREACHABLE | server: OK (buildMenu) / hub: OK (buildMenu) |
| FederationPage | `/app/federation` | UNREACHABLE | server: MISSING / hub: OK (buildMenu) |
| FederationSharesPage | `/app/federation/shares` | MISSING | server: MISSING / hub: UNREACHABLE (route only, no menu entry) |
| InviteLinksPage | `/app/invites` | MISSING | server: MISSING / hub: OK (buildMenu) |
| LibraryPage | `/app/library/:id` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| LibraryScanPage | `/app/library/scan` | OK (extraRoutes) | server: UNREACHABLE (admin-gated `buildExtraRoutes` route, no menu entry) / hub: MISSING |
| LoginPage | `/app/login` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| ManageSharesPage | `/app/shares` | UNREACHABLE | server: MISSING / hub: OK (buildMenu) |
| MediaDetailPage | `/app/media/:id` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| MusicAlbumPage | `/app/music/album/:name` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| MusicArtistPage | `/app/music/artist/:name` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| MusicArtistsPage | `/app/music/artists` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| MusicLibraryPage | `/app/music` | UNREACHABLE | server: OK (buildMenu) / hub: UNREACHABLE (app route, not in hub menu) |
| MusicPlayerPage | `/app/music/player` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| MusicTracksPage | `/app/music/tracks` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| MyServersPage | `/app/servers` | UNREACHABLE | server: MISSING / hub: OK (buildMenu) |
| ParentalControlsPage | `/app/parental` | MISSING | server: UNREACHABLE / hub: UNREACHABLE |
| PhotoAlbumPage | `/app/photo/album/:id` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| PhotoAlbumsPage | `/app/photo/albums` | OK (extraRoutes) | server: MISSING (dead nav link: `buildMenu` `photos` has no registered route) / hub: MISSING |
| PhotoSlideshowPage | `/app/photo/slideshow` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| PhotoViewPage | `/app/photo/photo/:id` | OK (extraRoutes) | server: MISSING / hub: MISSING |
| PlayerPage | `/app/player/:id` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| RecommendationsPage | `/app/recommendations` | UNREACHABLE | server: OK (buildMenu) / hub: OK (buildMenu) |
| RequestsPage | `/app/admin/requests` | OK (buildAdminRoutes) | server: MISSING / hub: OK (buildHubAdminRoutes) |
| SearchPage | `/app/search` | OK (extraRoutes) | server: MISSING (dead nav link: `buildMenu` `search` has no registered route) / hub: MISSING |
| SeasonPage | `/app/media/:id/season/:season` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| SecuritySettingsPage | `/app/admin/security` | OK (buildAdminRoutes) | server: MISSING / hub: MISSING |
| ServerDetailPage | `/app/server/:id` | MISSING | server: MISSING / hub: UNREACHABLE (route only, deep-linked) |
| SettingsPage | `/app/settings` | OK (menu) | server: OK (buildMenu) / hub: UNREACHABLE (app route, not in hub menu) |
| SharedWithMePage | `/app/shared` | MISSING | server: MISSING / hub: OK (buildMenu) |
| SignupPage | `/app/signup` | UNREACHABLE | server: UNREACHABLE / hub: UNREACHABLE |
| SyncPlayPage | `/app/syncplay` | OK (menu) | server: OK (buildMenu) / hub: UNREACHABLE (nav deliberately withheld — relay rider leg 4; details below) |
| WatchHistoryPage | `/app/history` | UNREACHABLE | server: OK (buildMenu) / hub: OK (buildMenu) |

---

## Admin Pages (23 total)

All admin pages are registered at `/app/admin/{path}` via `buildAdminRoutes()` / `buildHubAdminRoutes()`.
**Source of truth:** the 23 distinct admin pages are confirmed directly from `@phlix/ui v0.98.39 dist/phlix-ui.js`
(`Object.fromEntries` of 23 admin page objects). The v0.99.27 runtime additionally registers
`/app/admin/tasks` in server mode (outside this inventory). Counts per route builder:

- `buildAdminRoutes()` (server mode, default): **20 pages** — 17 server-only + 3 common (Users, Logs, Settings)
- `buildHubAdminRoutes()` (hub mode): **7 pages** — HubDashboardPage + 3 hub-only (AuditLogsPage, RequestsPage, MetricsPage) + 3 common (Users, Logs, Settings)

> **Note on original estimate:** Step W1.7 stated "22 admin pages" based on a reading of the then-current
> `admin.d.ts` comment. That comment listed 14 server + 3 common + 2 hub = 19 and omitted 3 pages that
> were later added to `serverAdminPages` in the bundle (MetricsPage, RequestsPage, and HubDashboardPage).
> Live bundle analysis confirms 23 distinct pages and 20 via `buildAdminRoutes()`.

**Verified 2026-08-05 (W1.7 — headless analysis of @phlix/ui v0.98.39 dist):**
- SettingsPage is **schema-driven** (v0.90 behavior): `SettingsResponse` provides `types`
  (bool/int/float/string), `meta` (labels, helpText, enum, validation bounds), `overridden`
  keys. Not a hardcoded form.
- PluginsPage supports: list, enable/disable, catalog browse, detail view (with manifest
  `settings_schema`), schema-editor via `updateSettings`, plus
  install/uninstall/update/checkUpdates/testCredentials.
- **Plugin update was NOT exercised** — no throwaway server available in this environment.
- All 23 admin routes confirmed present in @phlix/ui v0.98.39 dist (`phlix-ui.js`).

| Page | Route name | web-ui | windows-client (server / hub mode) |
|------|------------|--------|----------------|
| AuditLogsPage | admin-audit-logs | OK | server: MISSING / hub: OK (buildHubAdminRoutes) |
| BackupPage | admin-backup | OK | server: OK / hub: MISSING |
| CastDevicesPage | admin-cast | OK | server: OK / hub: MISSING |
| CollectionsPage | admin-collections | OK | server: OK / hub: MISSING |
| DashboardPage | admin-dashboard | OK | server: OK / hub: MISSING (hub `/app/admin/dashboard` is HubDashboardPage) |
| DlnaServerPage | admin-dlna | OK | server: OK / hub: MISSING |
| DuplicatesPage | admin-duplicates | OK | server: OK / hub: MISSING |
| HistoryPage | admin-history | OK | server: OK / hub: MISSING |
| HubDashboardPage | admin-hub-dashboard | OK (hub) | server: MISSING / hub: OK (buildHubAdminRoutes) |
| IntegrationsPage | admin-integrations | OK | server: OK / hub: MISSING |
| LibrariesPage | admin-libraries | OK | server: OK / hub: MISSING |
| LiveTvPage | admin-livetv | OK | server: OK / hub: MISSING |
| LogsPage | admin-logs | OK | server: OK / hub: OK |
| MetricsPage | admin-metrics | OK | server: OK (buildAdminRoutes) / hub: OK (buildHubAdminRoutes) |
| PluginsPage | admin-plugins | OK | server: OK / hub: MISSING |
| RemoteAccessPage | admin-remote-access | OK | server: OK / hub: MISSING |
| RequestsPage | admin-requests | OK | server: MISSING / hub: OK (buildHubAdminRoutes) |
| ServicesPage | admin-services | OK | server: OK / hub: MISSING |
| SettingsPage | admin-settings | OK | server: OK / hub: OK |
| SyncPlayPage | admin-syncplay | OK | server: OK (REST-only AdminSyncPlayApi — works from the desktop; unaffected by the room-socket limitation) / hub: MISSING |
| TranscodingSettingsPage | admin-transcoding | OK | server: OK / hub: MISSING |
| UsersPage | admin-users | OK | server: OK / hub: OK |
| WebhooksPage | admin-webhooks | OK | server: OK / hub: MISSING |

---

## Hub Pages — 8 of 8 Routed (5 with a nav entry)

The eight hub pages from `@phlix/ui` (v0.98.39), against the shipped hub `buildMenu` and
`buildExtraRoutes('hub')`. Hub mode itself is not enterable in the shipped build (see
Summary), so these verdicts are mode-conditional:

| Hub Page | Hub-mode route (`buildExtraRoutes`) | Hub-mode nav (`buildMenu`) | Status |
|----------|-------------------------------------|----------------------------|--------|
| MyServersPage | `/app/servers` | `my-servers` | **OK** |
| FederationPage | `/app/federation` | `federation` | **OK** |
| ManageSharesPage | `/app/shares` | `manage-shares` | **OK** |
| SharedWithMePage | `/app/shared` | `shared-with-me` | **OK** |
| InviteLinksPage | `/app/invites` | `invite-links` | **OK** |
| AcceptInvitePage | `/app/accept-invite/:token` (deep-link, props: true) | none | **UNREACHABLE** |
| FederationSharesPage | `/app/federation/shares` | none | **UNREACHABLE** |
| ServerDetailPage | `/app/server/:id` | none | **UNREACHABLE** |

---

## Explicitly Unlinked Pages (Registered but No Nav Link)

The reference web-ui supplies a `menu`, which suppresses all default navigation, so
`WatchHistoryPage`, `ExplorePage`, `RecommendationsPage` (registered by `createPhlixApp`) and
`SyncPlayPage` carry UNREACHABLE in the web-ui column. **windows-client differs**: its shipped
`buildMenu` links `history`, `explore` and `recommendations` in BOTH modes (hub list and server
list), so those three rows were rotated out of this section. The page still unlinked in
windows-client is below. No navigation link exists for any of them **in hub mode**:

| Page | Path | web-ui | Note |
|------|------|--------|------|
| SyncPlayPage | `/app/syncplay` | UNREACHABLE | registered in hub mode too, but the nav entry is deliberately withheld **in hub mode only** (rider leg 4): hub rooms run over the :8804 relay and the wsUrl seam would override relay dials wholesale — needs relay-aware evidence; see `syncplayDesktopStatus.test.ts`. In SERVER mode this page is NOT unlinked: the boot menu registers its nav entry (the SyncPlayPage row in the *Root Pages* table, windows-client column) — the v0.99.12 rider leg 2, story in README "Watching with friends (SyncPlay)". |

---

## Summary

All counts are regenerated from the *Root Pages* and *Admin Pages* tables above (66 rows;
`AuditLogsPage`/`RequestsPage` counted once per table).

| Context | Rows | OK | UNREACHABLE | MISSING |
|---------|------|----|-------------|---------|
| web-ui (v0.98.39 era) | 66 | 46 | 14 | 6 |
| windows-client (server mode) | 66 | 27 | 9 | 30 |
| windows-client (hub mode) | 66 | 17 | 15 | 34 |

Per table (OK / UNREACHABLE / MISSING): Root (43) — web-ui 23/14/6, windows server 7/9/27,
windows hub 10/15/18. Admin (23) — web-ui 23/0/0, windows server 20/0/3, windows hub 7/0/16.

**windows-client server mode:** OK = browse, music, history, explore, recommendations,
syncplay, settings (7 menu-linked root pages) + 20 admin pages via `buildAdminRoutes()` =
27. Four further `buildMenu` entries — `books`, `audiobooks`, `photos`, `search` — point at
routes that are NOT registered in the shipped build (`buildExtraRoutes('server')` carries only
the admin section and `library/scan`), so they are counted MISSING (dead nav links, they land
on the app catch-all); the router dump at v0.99.27 confirms no `/app/books`,
`/app/audiobooks`, `/app/photo/albums` or `/app/search` route. `library/scan` is an
admin-gated route with no menu entry (UNREACHABLE). `SecuritySettingsPage` has no route at
v0.99.27 in either mode.

**windows-client hub mode:** OK = my-servers, federation, shares, shared, invites, history,
explore, recommendations (8 menu-linked root rows) + AuditLogs, Requests (root rows for the hub
admin pages) + the 7 hub admin routes (admin-table rows: AuditLogs, Requests, HubDashboard, Logs,
Metrics, Settings, Users) = 17 table rows.
Mode-conditional inventory: hub mode itself is not enterable in the shipped build
(`hub:set-config` has zero callers, no upstream connection form), see README *Hub Mode (not
yet enterable)* and `tests/unit/hubModeStatus.test.ts` [M-WINDOWS-17]
