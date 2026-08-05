# @phlix/ui v0.98.34 — Page and Route Surface Inventory

**Purpose:** Track every page available in `@phlix/ui` v0.98.34, which ones are wired
in the reference web-ui (`phlix-server/web-ui`), and which are wired in this repo
(`phlix-windows-client`).

- **Page count:** 44 root pages + 23 admin pages = **67 total**
- **Reference web-ui:** `phlix-server/web-ui/src/main.ts:30-77` (menu + extraRoutes)
- **This repo:** `src/renderer/main.ts:35-51` (buildMenu) and `:58-73` (buildExtraRoutes)
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
| AudiobooksPage | `/app/audiobooks` | OK (extraRoutes) | MISSING |
| AuditLogsPage | `/app/admin/audit-logs` | OK (buildAdminRoutes) | OK (buildAdminRoutes) |
| BookDetailPage | via BooksPage | OK (extraRoutes) | MISSING |
| BookReaderPage | via BooksPage | OK (extraRoutes) | MISSING |
| BooksPage | `/app/books` | OK (extraRoutes) | MISSING |
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
| MusicLibraryPage | `/app/music` | UNREACHABLE | MISSING |
| MusicPlayerPage | `/app/music/player` | OK (extraRoutes) | MISSING |
| MusicTracksPage | `/app/music/tracks` | OK (extraRoutes) | MISSING |
| MyServersPage | `/app/servers` | UNREACHABLE | OK (buildMenu hub) |
| ParentalControlsPage | `/app/parental` | MISSING | UNREACHABLE (both modes) |
| PhotoAlbumPage | `/app/photo/album/:id` | OK (extraRoutes) | MISSING |
| PhotoAlbumsPage | `/app/photo/albums` | OK (extraRoutes) | MISSING |
| PhotoSlideshowPage | `/app/photo/slideshow` | OK (extraRoutes) | MISSING |
| PhotoViewPage | `/app/photo/photo/:id` | OK (extraRoutes) | MISSING |
| PlayerPage | `/app/player/:id` | UNREACHABLE | MISSING |
| RecommendationsPage | `/app/recommendations` | UNREACHABLE | MISSING |
| RequestsPage | `/app/admin/requests` | OK (buildAdminRoutes) | OK (buildAdminRoutes) |
| SearchPage | `/app/search` | OK (extraRoutes) | MISSING |
| SeasonPage | `/app/media/:id/season/:season` | UNREACHABLE | MISSING |
| SecuritySettingsPage | `/app/admin/security` | OK (buildAdminRoutes) | OK (buildAdminRoutes) |
| ServerDetailPage | `/app/server/:id` | MISSING | MISSING |
| SettingsPage | `/app/settings` | OK (menu) | OK (buildMenu) |
| SharedWithMePage | `/app/shared` | MISSING | MISSING |
| SignupPage | `/app/signup` | UNREACHABLE | UNREACHABLE |
| SyncPlayPage | `/app/syncplay` | UNREACHABLE | MISSING |
| WatchHistoryPage | `/app/history` | UNREACHABLE | MISSING |

---

## Admin Pages (23)

All admin pages are registered at `/app/admin/{path}` via `buildAdminRoutes()` / `buildHubAdminRoutes()`.

| Page | web-ui | windows-client |
|------|--------|----------------|
| BackupPage | OK | OK |
| CastDevicesPage | OK | OK |
| CollectionsPage | OK | OK |
| DashboardPage | OK | OK |
| DlnaServerPage | OK | OK |
| DuplicatesPage | OK | OK |
| HistoryPage | OK | OK |
| HubDashboardPage | OK (hub) | OK (buildHubAdminRoutes) |
| IntegrationsPage | OK | OK |
| LibrariesPage | OK | OK |
| LiveTvPage | OK | OK |
| LogsPage | OK | OK |
| MetricsPage | OK | OK |
| PluginsPage | OK | OK |
| RemoteAccessPage | OK | OK |
| RequestsPage | OK | OK |
| ServicesPage | OK | OK |
| SettingsPage | OK | OK |
| SyncPlayPage | OK | OK |
| TranscodingSettingsPage | OK | OK |
| UsersPage | OK | OK |
| WebhookLogsPage | OK | OK |
| WebhooksPage | OK | OK |

---

## Hub Pages — 3 of 8 Wired

The eight hub pages from `@phlix/ui` (v0.98.34):

| Hub Page | windows-client buildMenu | Status |
|----------|-------------------------|--------|
| MyServersPage | ✅ `/app/servers` | **OK** |
| FederationPage | ✅ `/app/federation` | **OK** |
| ManageSharesPage | ✅ `/app/shares` | **OK** |
| SharedWithMePage | ❌ | **MISSING** |
| InviteLinksPage | ❌ | **MISSING** |
| AcceptInvitePage | ❌ | **MISSING** |
| FederationSharesPage | ❌ | **MISSING** |
| ServerDetailPage | ❌ | **MISSING** |

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
| windows-client (server mode) | 67 | 21 | 3 | 43 |
| windows-client (hub mode) | 67 | 11 | 1 | 55 |

**web-ui wired (menu + extraRoutes):** browse, music, books, audiobooks, photos,
search, settings, admin + 16 admin pages + library/scan + 15 media pages = 21 OK

**windows-client server mode:** browse, settings, admin + 17 admin pages + library/scan
+ parental = 21 OK; parental is UNREACHABLE (no menu link)

**windows-client hub mode:** my-servers, federation, shares, admin + 7 admin pages +
4 hub extraRoutes = 11 OK; parental is UNREACHABLE (no menu link)
