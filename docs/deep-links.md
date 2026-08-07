# Deep Links

Phlix Windows Client supports the `phlix://` URL protocol for deep linking into specific app sections.

## URL Grammar

```
phlix://<host>/<value>
```

### Supported Hosts

| Host | Internal Route | Example URL | Description |
|------|---------------|-------------|-------------|
| `media` | `/media/{id}` | `phlix://media/abc123` | Navigate to a media item |
| `play` | `/play/{id}` | `phlix://play/abc123` | Start playback of an item |
| `accept-invite` | `/accept-invite/{token}` | `phlix://accept-invite/abc_123` | Accept an invitation token |
| `server` | `/server/{id}` | `phlix://server/abc123` | Navigate to a server |

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
- **Payload**: Internal route path (e.g., `/media/abc123`)

The renderer queues deep links if the router is not yet ready, then flushes the queue once `router.isReady()` resolves.

## Examples

```bash
# Open media item
phlix://media/my-media-id

# Start playback
phlix://play/episode-123

# Accept an invitation
phlix://accept-invite/invite_token_here

# View server details
phlix://server/server-456
```

## Security Notes

- Deep links are validated against strict allowlists before routing
- Invalid URLs are logged but do not crash or expose internal state
- The app never navigates to arbitrary URLs, only to predefined internal routes
