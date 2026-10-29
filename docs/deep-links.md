# Deep Links

Phlix Windows Client supports the `phlix://` URL protocol for deep linking into specific app sections.

## URL Grammar

```
phlix://<host>/<value>
```

### Supported Hosts

| Host | Internal Route | Example URL | Description |
|------|---------------|-------------|-------------|
| `media` | `/app/media/{id}` | `phlix://media/abc123` | Navigate to a media item |
| `play` | `/app/player/{id}` | `phlix://play/abc123` | Start playback of an item |
| `accept-invite` | `/app/accept-invite/{token}` | `phlix://accept-invite/abc_123` | Accept an invitation token |
| `server` | `/app/server/{id}` | `phlix://server/abc123` | Navigate to a server |

> Every target above is a route record that actually exists: `media`/`play`
> ship inside the vendored `@phlix/ui` router (there is no `/play/:id`
> record — playback is the player route), `accept-invite`/`server` are
> hub-mode routes registered by this repo — but they register only while
> hub mode runs, and hub mode is not enterable in the shipped build
> (`hub:set-config` has zero callers, no upstream connection form; see
> README *Hub Mode (not yet enterable)* and `tests/unit/hubModeStatus.test.ts`)
> [M-WINDOWS-17]. Every launch today boots server mode, so those two arms
> parse fine yet resolve to the `/app/:pathMatch(.*)*` 404 view for every
> real user; they become live user-facing targets with the v0.99.12
> connection-seam rider. All app routes live under the `/app` history
> base; an unprefixed path would only match the 404 catch-all. The
> parser ↔ route-record pin (built over the hub route set) lives in
> `tests/unit/deepLinkRouteContract.test.ts`.

> **Note:** The `'internal'` host is also accepted by the parser (for notification click-action routing) but is omitted from this table as it is an implementation detail, not a user-facing link type.

## Value Formats

| Host | Format | Allowed Characters |
|------|--------|-------------------|
| `media` | ID | Alphanumeric + dash (`[a-zA-Z0-9-]`) |
| `play` | ID | Alphanumeric + dash (`[a-zA-Z0-9-]`) |
| `accept-invite` | Token | Base64url-compatible (`[a-zA-Z0-9_-]`) |
| `server` | ID | Alphanumeric + dash (`[a-zA-Z0-9-]`) |

## Validation Rules

1. **Protocol**: Only `phlix:` is accepted
2. **Host**: Must be one of the known hosts listed above
3. **Value**: Must not be empty and must match the required format for that host
4. **Security**: Path traversal attempts (`../`), null byte injection, and other suspicious patterns are rejected and logged

All rejections are logged with `[deeplink]` prefix at warn level.

## Arrival Paths

### Windows Cold Start
When the app is launched via a `phlix://` URL (e.g., from a browser link or another app), the URL appears in `process.argv[1]` before `app.whenReady()` fires. The URL is parsed and queued for routing after the app initializes.

### Windows Warm Start
When a second instance is launched with a `phlix://` URL while the app is already running, the `second-instance` event fires with the URL in its argv. The app focuses the existing window and routes the deep link.

### macOS
On macOS, the `app.on('open-url', ...)` event carries the deep link URL.

## IPC Channel

- **Channel**: `deeplink:open` (main → renderer push)
- **Payload**: Internal route path (e.g., `/app/media/abc123`)

The renderer queues deep links if the router is not yet ready, then flushes the queue once `router.isReady()` resolves.

## Examples

```bash
# Open media item
phlix://media/my-media-id

# Start playback
phlix://play/episode-123

# Accept an invitation — hub-mode arm: 404-views today (see note above)
phlix://accept-invite/invite_token_here

# View server details — hub-mode arm: 404-views today (see note above)
phlix://server/server-456
```

## Security Notes

- Deep links are validated against strict allowlists before routing
- Invalid URLs are logged but do not crash or expose internal state
- The app never navigates to arbitrary URLs, only to predefined internal routes
