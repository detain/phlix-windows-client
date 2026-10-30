# ADR-002: CSP Directives

## Context

The renderer loads media from arbitrary LAN servers (http://), runs hls.js workers (blob: workers), connects to WebSocket hubs (wss:, and cleartext ws: in direct mode), and uses Vue scoped styles (requires 'unsafe-inline' in style-src).

## Decision

CSP is:

```
default-src 'self' app:; img-src 'self' data: blob: http: https:; media-src 'self' blob: http: https:; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' http: https: ws: wss: app:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;
```

> **Revision 2026-10-31 (M-WINDOWS-42):** the directive above is now the
> SHIPPED policy, copied byte-for-byte from the renderer CSP meta tag
> (`src/renderer/index.html`, pinned by `tests/unit/csp.test.ts`). The
> original 2026-era text of this ADR recorded a DIFFERENT policy
> (`default-src 'none'`, no `app:`/`ws:`/`child-src`) that never matched
> what shipped — a code-is-law drift this revision closes. Nothing about
> the runtime policy changed here; the DOCUMENT changed to tell the truth.

- `http:` in `img-src`/`media-src`/`connect-src` is required for LAN servers
  without HTTPS — direct connection is the estate's default mode.
- `ws:` in `connect-src` is the same law's other half: the :8097 direct
  SyncPlay websocket on a user-configured `http://` LAN server is a cleartext
  `ws://` socket (estate wire law: `?token=` on the upgrade request), so the
  CSP must permit it for direct mode to function at all. The credential
  exposure that implies is a documented consequence of the user's own choice
  to run plain-HTTP servers; tightening it away would break the default
  connection mode (owner-class change, deliberately not taken here).
- `wss:` remains required for hub relay connections.
- `app:` in `default-src`/`connect-src` is the custom `app://` boot and
  asset origin the protocol handler serves — the packaged renderer boots via
  `app://-/…`; without it every cold boot is CSP-blocked.
- `blob:` in `media-src`/`worker-src`/`child-src` is required for hls.js
  `enableWorker` blob workers (child-src covers blob-backed nested documents
  some Chromium builds consult before worker-src).
- `style-src 'unsafe-inline'` is required for Vue's scoped style injection.

## Consequences

Dropping any of these breaks a specific feature. LAN servers, blob workers,
WebSocket hubs (encrypted relay and cleartext direct-mode alike), the
`app://` boot origin, and Vue scoped styles all require their respective CSP
relaxations. The CSP string is test-pinned; any future amendment must update
this ADR's rationale in the same commit.
