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
 * real `Electron.BrowserWindow` satisfies `RestorableWindow` structurally,
 * and the w10/L1 geometry law (`boundsOnScreen` / `clampBoundsToDisplays`,
 * reached through an injected `RestoreBoundsProbe`) keeps it that way — the
 * screen/display reads live in the caller.
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

/** A window rectangle — the subset of Electron's Rectangle the law reads. */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A display's usable frame (Electron `Display.workArea` structurally). */
export interface DisplayFrame {
  workArea: WindowBounds;
}

/**
 * Geometry access for the off-screen clamp, injected so this module stays
 * electron-free: index.ts wires it to `win.getBounds()/setBounds()` and
 * `screen.getAllDisplays()/getPrimaryDisplay()`; tests hand in plain objects.
 */
export interface RestoreBoundsProbe {
  get(): WindowBounds;
  set(next: WindowBounds): void;
  displays(): DisplayFrame[];
  primary(): DisplayFrame;
}

/**
 * Does `bounds` overlap at least one display work area?
 *
 * THE single source of the on-screen law (w10/L1): createWindow's boot
 * validation and the restore clamp below must never disagree about what
 * "on-screen" means. One pixel of overlap counts — the generous edge rule the
 * boot path has always used, moved verbatim.
 */
export function boundsOnScreen(bounds: WindowBounds, displays: ReadonlyArray<DisplayFrame>): boolean {
  return displays.some((display) => {
    const wa = display.workArea;
    return (
      bounds.x < wa.x + wa.width &&
      bounds.x + bounds.width > wa.x &&
      bounds.y < wa.y + wa.height &&
      bounds.y + bounds.height > wa.y
    );
  });
}

/**
 * Drag an off-screen rectangle back onto the primary display's work area:
 * fitted to it, centered. On-screen bounds (or no display data at all — a
 * blind move to degenerate frames is worse than a patient one) return
 * unchanged, so the caller's identity check makes "do nothing" the common
 * path's only cost.
 *
 * Why size-fit: a window remembered larger than the surviving screen (then
 * dragged off-plug) that gets only RE-CENTERED leaves its title bar — and
 * with it the drag handle every recovery gesture starts on — still outside
 * the work area for rects taller/wider than the primary frame.
 */
export function clampBoundsToDisplays(
  bounds: WindowBounds,
  displays: ReadonlyArray<DisplayFrame>,
  primary: DisplayFrame
): WindowBounds {
  if (displays.length === 0 || boundsOnScreen(bounds, displays)) {
    return bounds;
  }
  const wa = primary.workArea;
  const width = Math.min(bounds.width, wa.width);
  const height = Math.min(bounds.height, wa.height);
  return {
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
    width,
    height
  };
}

/**
 * Bring `window` back to the foreground from any gone-state, or no-op.
 *
 * Returns true when a live window was driven through the restore/show/focus
 * sequence, false when the reference was absent or destroyed — a deliberate
 * no-op for a window that is mid-teardown, never a crash.
 *
 * w10/L1 (windows__casualgamer 10): with a geometry probe, the raise ALSO
 * repairs the stranded-window class — a window remembered on a since-
 * unplugged display answers tray-Show/icon-click/notification-click by
 * focusing pixels nobody can see. The clamp runs AFTER the sequence (the
 * user-visible raise is untouched) and writes geometry only when the rect
 * actually left every display; without a probe the behavior is exactly the
 * original sequence law.
 */
export function restoreWindow(
  window: RestorableWindow | null | undefined,
  probe?: RestoreBoundsProbe
): boolean {
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
  if (probe) {
    const current = probe.get();
    const next = clampBoundsToDisplays(current, probe.displays(), probe.primary());
    if (
      next.x !== current.x ||
      next.y !== current.y ||
      next.width !== current.width ||
      next.height !== current.height
    ) {
      probe.set(next);
    }
  }
  return true;
}
