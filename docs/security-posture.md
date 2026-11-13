# Security posture record

Dated: 2026-11-12. A recorded-and-accepted posture ledger for the Windows
client. Zero behavior change: nothing here alters code. Each row names the
finding id, the posture, and where the real fix (if any) lives.

| ID | Posture | Owner of the real fix |
|---|---|---|
| WIN-20 | The client minimum-server-version gate (`src/main/versionCheck.ts`, fail-open at the no-apiBase / non-fetchable / non-OK branches) is a **UX-only label**, not a security control. A hostile or old server can simply report any version. Real enforcement needs a server-side capability handshake. | Estate (server capability handshake) |
| WIN-35 | Suspend/resume wake-reconnect is an `@phlix/ui` vendored-seam duty; the Electron shell does not re-implement it. | `@phlix/ui` |
| WIN-46 | `X-Phlix-Device-ID` is an **unauthenticated hint**. The server must bind device registration to server-issued keys; the client cannot make the header trustworthy. | Server-side row |
| WIN-49 | CSP `connect-src 'self' http: https: ws: wss: app:` is deliberately broad because the user points the client at an arbitrary self-hosted server. Accepted and documented as the exfiltration-line posture. | Accepted |
| WIN-54 | Auto-updater trust is **feed integrity** (TLS + `latest.yml` sha512), not authenticity. Flipping certificate enforcement is owner-gated via `package.json` `flipGate`; see `docs/signing.md` 'Auto-Update Verification'. | Owner (WIN-08 cert provisioning) |
| WIN-55 | Plain `http://` / `ws://` to LAN servers is supported by design (home-lab servers without TLS). | Accepted |
| WIN-57 | When DPAPI is unavailable, credential storage falls back to plaintext. Disclosed as an availability choice; a confirm-gate before falling back is a deferred idea. | Deferred |
| WIN-58 | The `scripts/audit-gate.mjs` advisory allowlist entries (GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249) carry a re-verify date of **2027-02-04**; this date is on the owner calendar. | Owner calendar |

Existing `signingPosturePolicy` and `audit-gate` tests must stay green.
