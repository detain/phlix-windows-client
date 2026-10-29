/**
 * The single canonical way to bring the existing main window back from every
 * "gone" state Electron can park it in (M-WINDOWS-03).
 *
 * Close-to-tray hides the window (`win.hide()`), which is NOT the minimized
 * state — the two gone-states are independent and have different documented
 * cures (Electron BrowserWindow API docs, docs/api/browser-window.md):
 *
 * - minimized: `win.restore()` — "Restores the window from minimized state to
 *   its previous state." The contract is scoped to the minimized state, so
 *   the call is gated on `isMinimized()`. Using restore() as a blanket
 *   "come back" on a merely hidden window operates outside that contract:
 *   the window is not minimized, and the call is not what makes it visible.
 * - hidden: `win.show()` — "Shows and gives focus to the window." Gated on
 *   `!isVisible()` so an already-visible window is left untouched.
 *
 * `focus()` runs last, ungated: the app docs describe the standard second-
 * instance response as "making their primary window focused and
 * non-minimized" (docs/api/app.md, Event: 'second-instance'), and Windows
 * foreground rules make the explicit call the reliable belt to show()'s
 * suspenders.
 *
 * Destroyed-window law: once a BrowserWindow is destroyed, calling its
 * methods — and even reading `win.webContents` — throws
 * "Object has been destroyed" (see the `win.webContents` note in the
 * BrowserWindow docs). Every caller hands in a module-scoped reference that
 * a concurrent 'closed' event can invalidate between user gesture and
 * handler, so the guard runs before any state query.
 *
 * This module is pure (no `electron` import) so it unit-tests without mocks;
 * real `Electron.BrowserWindow` satisfies `RestorableWindow` structurally.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

/** Structural view of exactly the window states restore logic touches. */
export interface RestorableWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  isVisible(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

/**
 * Bring `window` back to the foreground from any gone-state, or no-op.
 *
 * Returns true when a live window was driven through the restore/show/focus
 * sequence, false when the reference was absent or destroyed — a deliberate
 * no-op for a window that is mid-teardown, never a crash.
 */
export function restoreWindow(window: RestorableWindow | null | undefined): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  if (!window.isVisible()) {
    window.show();
  }
  window.focus();
  return true;
}
