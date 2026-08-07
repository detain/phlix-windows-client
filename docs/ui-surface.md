# @phlix/ui v0.98.34 — Page and Route Surface Inventory

**Purpose:** Track every page available in `@phlix/ui` v0.98.34, which ones are wired
in the reference web-ui (`phlix-server/web-ui`), and which are wired in this repo
(`phlix-windows-client`).

- **Page count:** 43 root pages + 23 admin pages = **66 total**
- **Reference web-ui:** `phlix-server/web-ui/src/main.ts:30-77` (menu + extraRoutes)
- **This repo:** `src/renderer/main.ts:56-90` (buildMenu) and `:102-120` (buildExtraRoutes)
- Shell renders **no default nav** once `menu` is supplied (documented at `src/renderer/main.ts:30-34`)

## Status Key

| Status | Meaning |
|--------|---------|
| `OK` | Registered and has a navigation link (in `menu` / `buildMenu`) |
| `UNREACHABLE` | Registered (in `createPhlixApp`/`buildRoutes` or `extraRoutes`) but has no nav link |
| `MISSING` | Not registered at all in this context |

---

## Root Pages (43)

| Page | Path (createPhlixApp) | web-ui | windows-client |
|------|-----------------------|--------|----------------|
| AcceptInvitePage | `/app/accept-invite` | MISSING | MISSING |
| AudiobookDetailPage | via AudiobooksPage | OK (extraRoutes) | MISSING |
| AudiobookPlayerPage | via AudiobooksPage | OK (extraRoutes) | MISSING |
| AudiobooksPage | `/app/audiobooks` | OK (extraRoutes) | OK (buildMenu) |
| AuditLogsPage | `/app/admin/audit-logs` | OK (buildAdminRoutes) | OK (buildAdminRoutes) |
| BookDetailPage | via BooksPage | OK (extraRoutes) | MISSING |
| BookReaderPage | via BooksPage | OK (extraRoutes) | MISSING |
| BooksPage | `/app/books` | OK (extraRoutes) | OK (buildMenu) |
| BrowsePage | `/app` | OK (menu) | OK (buildMenu) |
| ConnectPage | `/app/connect` | UNREACHABLE | UNREACHABLE |
| ExplorePage | `/app/explore` | UNREACHABLE | MISSING |
| FederationPage | `/app/federation` | UNREACHABLE | OK (buildMenu hub) |
| FederationSharesPage | `/app/federation/shares` | MISSING | MISSING |
| InviteLinksPage | `/app/invites` | MISSING | MISSING |
| LibraryPage | `/app/library/:id` | UNREACHABLE | MISSING |
| LibraryScanPage | `/app/library/scan` | OK (extraRoutes) | OK (buildExtraRoutes server) |
| LoginPage | `/app/login` | UNREACHABLE | UNREACHABLE |
| ManageSharesPage | `/app/shares` | UNREACHABLE | OK (buildMenu hub) |
| MediaDetailPage | `/app/media/:id` | UNREACHABLE | MISSING |
| MusicAlbumPage | `/app/music/album/:name` | OK (extraRoutes) | MISSING |
| MusicArtistPage | `/app/music/artist/:name` | OK (extraRoutes) | MISSING |
| MusicArtistsPage | `/app/music/artists` | OK (extraRoutes) | MISSING |
| MusicLibraryPage | `/app/music` | UNREACHABLE | OK (buildMenu) |
| MusicPlayerPage | `/app/music/player` | OK (extraRoutes) | MISSING |
| MusicTracksPage | `/app/music/tracks` | OK (extraRoutes) | MISSING |
| MyServersPage | `/app/servers` | UNREACHABLE | OK (buildMenu hub) |
| ParentalControlsPage | `/app/parental` | MISSING | UNREACHABLE |
| PhotoAlbumPage | `/app/photo/album/:id` | OK (extraRoutes) | MISSING |
| PhotoAlbumsPage | `/app/photo/albums` | OK (extraRoutes) | OK (buildMenu) |
| PhotoSlideshowPage | `/app/photo/slideshow` | OK (extraRoutes) | MISSING |
| PhotoViewPage | `/app/photo/photo/:id` | OK (extraRoutes) | MISSING |
| PlayerPage | `/app/player/:id` | UNREACHABLE | MISSING |
| RecommendationsPage | `/app/recommendations` | UNREACHABLE | MISSING |
| RequestsPage | `/app/admin/requests` | OK (buildAdminRoutes) | OK (buildAdminRoutes) |
| SearchPage | `/app/search` | OK (extraRoutes) | OK (buildMenu) |
| SeasonPage | `/app/media/:id/season/:season` | UNREACHABLE | MISSING |
| SecuritySettingsPage | `/app/admin/security` | OK (buildAdminRoutes) | OK (buildAdminRoutes) |
| ServerDetailPage | `/app/server/:id` | MISSING | MISSING |
| SettingsPage | `/app/settings` | OK (menu) | OK (buildMenu) |
| SharedWithMePage | `/app/shared` | MISSING | MISSING |
| SignupPage | `/app/signup` | UNREACHABLE | UNREACHABLE |
| SyncPlayPage | `/app/syncplay` | UNREACHABLE | MISSING |
| WatchHistoryPage | `/app/history` | UNREACHABLE | MISSING |

---

## Admin Pages (23 total)

All admin pages are registered at `/app/admin/{path}` via `buildAdminRoutes()` / `buildHubAdminRoutes()`.
**Source of truth:** the 23 distinct admin pages are confirmed directly from `@phlix/ui v0.98.34 dist/phlix-ui.js`
(`Object.fromEntries` of 23 admin page objects). Counts per route builder:

- `buildAdminRoutes()` (server mode, default): **20 pages** — 17 server-only + 3 common (Users, Logs, Settings)
- `buildHubAdminRoutes()` (hub mode): **7 pages** — HubDashboardPage + 3 hub-only (AuditLogsPage, RequestsPage, MetricsPage) + 3 common (Users, Logs, Settings)

> **Note on original estimate:** Step W1.7 stated "22 admin pages" based on a reading of the then-current
> `admin.d.ts` comment. That comment listed 14 server + 3 common + 2 hub = 19 and omitted 3 pages that
> were later added to `serverAdminPages` in the bundle (MetricsPage, RequestsPage, and HubDashboardPage).
> Live bundle analysis confirms 23 distinct pages and 20 via `buildAdminRoutes()`.

**Verified 2026-08-05 (W1.7 — headless analysis of @phlix/ui v0.98.34 dist):**
- SettingsPage is **schema-driven** (v0.90 behaviour): `SettingsResponse` provides `types`
  (bool/int/float/string), `meta` (labels, helpText, enum, validation bounds), `overridden`
  keys. Not a hardcoded form.
- PluginsPage supports: list, enable/disable, catalog browse, detail view (with manifest
  `settings_schema`), schema-editor via `updateSettings`, plus
  install/uninstall/update/checkUpdates/testCredentials.
- **Plugin update was NOT exercised** — no throwaway server available in this environment.
- All 23 admin routes confirmed present in @phlix/ui v0.98.34 dist (`phlix-ui.js`).

| Page | Route name | web-ui | windows-client |
|------|------------|--------|----------------|
| AuditLogsPage | admin-audit-logs | OK | OK |
| BackupPage | admin-backup | OK | OK |
| CastDevicesPage | admin-cast | OK | OK |
| CollectionsPage | admin-collections | OK | OK |
| DashboardPage | admin-dashboard | OK | OK |
| DlnaServerPage | admin-dlna | OK | OK |
| DuplicatesPage | admin-duplicates | OK | OK |
| HistoryPage | admin-history | OK | OK |
| HubDashboardPage | admin-hub-dashboard | OK (hub) | OK (buildHubAdminRoutes) |
| IntegrationsPage | admin-integrations | OK | OK |
| LibrariesPage | admin-libraries | OK | OK |
| LiveTvPage | admin-livetv | OK | OK |
| LogsPage | admin-logs | OK | OK |
| MetricsPage | admin-metrics | OK | OK (buildAdminRoutes & buildHubAdminRoutes) |
| PluginsPage | admin-plugins | OK | OK |
| RemoteAccessPage | admin-remote-access | OK | OK |
| RequestsPage | admin-requests | OK | OK (buildAdminRoutes & buildHubAdminRoutes) |
| ServicesPage | admin-services | OK | OK |
| SettingsPage | admin-settings | OK | OK |
| SyncPlayPage | admin-syncplay | OK | OK |
| TranscodingSettingsPage | admin-transcoding | OK | OK |
| UsersPage | admin-users | OK | OK |
| WebhooksPage | admin-webhooks | OK | OK |

---

## Hub Pages — 8 of 8 Wired

The eight hub pages from `@phlix/ui` (v0.98.34):

| Hub Page | windows-client buildMenu | Status |
|----------|-------------------------|--------|
| MyServersPage | ✅ `/app/servers` | **OK** |
| FederationPage | ✅ `/app/federation` | **OK** |
| ManageSharesPage | ✅ `/app/shares` | **OK** |
| SharedWithMePage | ✅ `/app/shared` | **OK** |
| InviteLinksPage | ✅ `/app/invites` | **OK** |
| AcceptInvitePage | ✅ `/app/accept-invite` (route, no nav) | **UNREACHABLE** |
| FederationSharesPage | ✅ `/app/federation/shares` | **OK** |
| ServerDetailPage | ✅ `/app/server/:id` | **OK** |

---

## Explicitly Unlinked Pages (Registered but No Nav Link)

These four pages are registered by `createPhlixApp` (`createPhlixApp.ts:280,286,292,298`)
but the reference web-ui supplies a `menu`, which suppresses all default navigation.
No navigation link exists for any of them:

| Page | Path | web-ui | Note |
|------|------|--------|------|
| WatchHistoryPage | `/app/history` | UNREACHABLE | `createPhlixApp.ts:280` |
| ExplorePage | `/app/explore` | UNREACHABLE | `createPhlixApp.ts:286` |
| RecommendationsPage | `/app/recommendations` | UNREACHABLE | `createPhlixApp.ts:292` |
| SyncPlayPage | `/app/syncplay` | UNREACHABLE | `createPhlixApp.ts:298` |

---

## Summary

| Context | Pages | OK | UNREACHABLE | MISSING |
|---------|-------|----|-------------|---------|
| web-ui (server mode) | 66 | 21 | 17 | 28 |
| windows-client (server mode) | 66 | 26 | 3 | 37 |
| windows-client (hub mode) | 66 | 11 | 1 | 54 |

**web-ui wired (menu + extraRoutes):** browse, music, books, audiobooks, photos,
search, settings, admin + 16 admin pages + library/scan + 15 media pages = 21 OK

**windows-client server mode (W1.3):** browse (libraryLinks), music, books,
audiobooks, photos, search, settings, admin + 17 admin pages + library/scan
+ parental = 26 OK; parental is UNREACHABLE (no menu link)

**windows-client hub mode:** my-servers, federation, shares, admin + 7 admin pages +
4 hub extraRoutes = 11 OK; parental is UNREACHABLE (no menu link)
