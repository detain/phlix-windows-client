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
 * Install the guard on a session. Both hooks are required: the request
 * handler covers async `navigator.permissions`-style prompts, the check
 * handler covers synchronous feature probes that never surface a prompt.
 */
export function installPermissionGuard(targetSession: PermissionGuardSession): void {
  targetSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const granted = allowPermission(permission);
    if (!granted) {
      // console is deliberate: src/main runs pre-window and this fires from
      // Electron callbacks; electron-log wiring is the caller's concern.
      console.warn(`[permissions] denied request: ${String(permission)}`);
    }
    callback(granted);
  });
  targetSession.setPermissionCheckHandler((_webContents, permission) => {
    const granted = allowPermission(permission);
    if (!granted) {
      console.warn(`[permissions] denied check: ${String(permission)}`);
    }
    return granted;
  });
}
