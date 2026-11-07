/**
 * OS-permission default-deny guard (M-WINDOWS-29).
 *
 * Phlix for Windows is a media-player shell: it renders a server-hosted UI
 * and streams media. Nothing in that job needs camera, microphone, geolo-
 * cation, system notifications via the web API, MIDI, or external-window
 * escapes — yet with no handlers installed, Electron grants every permission
 * the renderer asks for, so a hostile or compromised server driving the view
 * could prompt (or silently obtain) OS-level capabilities.
 *
 * Law: deny everything except an explicit, measured allow-list.
 *
 *   clipboard-sanitized-write — the ONLY allow entry, and it is measured, not
 *   assumed: the pinned `@phlix/ui` bundle calls `navigator.clipboard.write-
 *   Text` at 9 sites (copy buttons across admin/token/share surfaces), and
 *   Electron routes that call through this permission. A blanket deny would
 *   break shipped functionality (the review's "deny-all is cost-free" claim
 *   was verified against the vendored bundle and corrected).
 *
 * The decision function is pure and the installer takes a structurally-typed
 * session — no `electron` import here — so the table is unit-testable without
 * an Electron runtime (repo pure-module extraction law, cf. notificationGuard).
 */

/** Minimal structural view of the parts of Electron's `Session` we touch. */
export interface PermissionGuardSession {
  setPermissionRequestHandler(
    handler: (
      webContents: unknown,
      permission: string,
      callback: (granted: boolean) => void
    ) => void
  ): void;
  setPermissionCheckHandler(
    handler: (webContents: unknown, permission: string) => boolean
  ): void;
}

const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set(['clipboard-sanitized-write']);

/**
 * Single source of truth for the verdict: a permission string (anything else
 * fails the type boundary) is granted only if explicitly allow-listed.
 */
export function allowPermission(permission: unknown): boolean {
  return typeof permission === 'string' && ALLOWED_PERMISSIONS.has(permission);
}

/**
 * I-w1 (review windows__iw1, 2026-11-04): WHATWG URL puts IPv6 hostnames in
 * brackets — `new URL('http://[::1]/').hostname === '[::1]'` — and the bare
 * form does not even parse, so an arm comparing `'::1'` is unmatchable dead
 * code (fail-CLOSED: the IPv6-loopback dev origin simply lost its carve-out).
 * The bracketed literal IS the canonical spelling: WHATWG normalization folds
 * every IPv6 loopback writing (e.g. `http://[0:0:0:0:0:0:0:1]/`) onto it, so
 * one arm catches them all. Deliberately NOT matched: any other address,
 * including the IPv4-mapped spelling `[::ffff:127.0.0.1]` (normalizes to
 * `[::ffff:7f00:1]`) — the trust carve-outs stay ::1-loopback-only.
 *
 * Single source of the loopback HOST law for both trust sites: this module's
 * `isTrustedRequesterUrl` (permission carve-out — where it is additionally
 * PORT-bound to the dev server, see w10/L1 below) and index.ts's
 * `downloadUrlTrusted` (will-download default-deny — deliberately host-broad:
 * a download from any loopback origin is the reviewed m14 posture).
 */
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * m15 (review windows__crossfe 3): the permission table was origin-blind —
 * once ANY page reached the top-level window (navigations stay permitted),
 * it inherited the silent clipboard-sanitized-write grant too. The grant now
 * additionally requires the requester to be OUR document: the local app://-
 * shell (or the dev server, which serves the same bundle). Anything
 * else — including the media server's own https origin once navigated to —
 * must ask the user like every other permission.
 *
 * w10/L1 (review windows__crossfe 3 / windows__secnet 6): the loopback
 * arm was HOST-only — every service listening anywhere on loopback silently
 * held it, including this app's own media server ports. The grant is now
 * PORT-BOUND exactly like the preload's TRUSTED_BOOT_TARGETS
 * (src/preload/index.ts): `http://` on the vite strictPort 5173 and nothing
 * else. The host law still rides the shared isLoopbackHostname helper (the
 * I-w1 bracket-form parse law); only the port pairing is new.
 */
export function isTrustedRequesterUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'app:') return url.host === '-';
    return url.protocol === 'http:' && url.port === '5173' && isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

/** Structural read of the requester's current URL; anything else = untrusted. */
function requesterUrl(webContents: unknown): string {
  const candidate = webContents as { getURL?: () => unknown } | null | undefined;
  if (!candidate || typeof candidate.getURL !== 'function') return '';
  const url = candidate.getURL();
  return typeof url === 'string' ? url : '';
}

/**
 * Install the guard on a session. Both hooks are required: the request
 * handler covers async `navigator.permissions`-style prompts, the check
 * handler covers synchronous feature probes that never surface a prompt.
 */
export function installPermissionGuard(targetSession: PermissionGuardSession): void {
  targetSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // m15: table verdict AND origin verdict — an attacker page that reached
    // the top-level window no longer inherits the clipboard carve-out.
    const granted = allowPermission(permission) && isTrustedRequesterUrl(requesterUrl(webContents));
    if (!granted) {
      // console is deliberate: src/main runs pre-window and this fires from
      // Electron callbacks; electron-log wiring is the caller's concern.
      console.warn(`[permissions] denied request: ${String(permission)}`);
    }
    callback(granted);
  });
  targetSession.setPermissionCheckHandler((webContents, permission) => {
    const granted = allowPermission(permission) && isTrustedRequesterUrl(requesterUrl(webContents));
    if (!granted) {
      console.warn(`[permissions] denied check: ${String(permission)}`);
    }
    return granted;
  });
}
