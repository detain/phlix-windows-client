# ADR-002: CSP Directives

## Context

The renderer loads media from arbitrary LAN servers (http://), runs hls.js workers (blob: workers), connects to WebSocket hubs (wss:), and uses Vue scoped styles (requires 'unsafe-inline' in style-src).

## Decision

CSP is:

```
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http: https: data: blob:; media-src 'self' http: https: blob:; connect-src 'self' https: wss: http:; worker-src blob:
```

- `http:` in `img-src` is required for LAN servers without HTTPS.
- `worker-src blob:` is required for hls.js `enableWorker`.
- `wss:` is required for hub relay connections.
- `style-src 'unsafe-inline'` is required for Vue's scoped style injection.

## Consequences

Dropping any of these breaks a specific feature. LAN servers, blob workers, WebSocket hubs, and Vue scoped styles all require their respective CSP relaxations.
