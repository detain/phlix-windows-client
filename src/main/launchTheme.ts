/**
 * WIN-52 / WIN-S30: launch-chrome theme mirror.
 *
 * The renderer reports the active theme's `--bg` once the ui has applied it;
 * main persists that one validated colour in its own store (a mirror, never a
 * second source of truth — the server/ui theme store stays authoritative) and
 * reads it synchronously at the NEXT window creation so BrowserWindow
 * backgroundColor matches the persisted theme instead of always Nocturne.
 *
 * Pure and dependency-free so it is unit-testable and shared by the IPC
 * handler and the window factory. Only #rgb / #rrggbb survive: the value is
 * renderer-supplied, so anything else (url(), var(), named colours, huge
 * strings) is rejected and the Nocturne default stands.
 */

/** Nocturne boot ground — identical to the index.html splash literal. */
export const DEFAULT_LAUNCH_BACKGROUND = '#1a1a2e';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns a normalised lower-case hex colour, or null when not acceptable. */
export function sanitizeLaunchBackground(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length > 7 || !HEX.test(v)) return null;
  return v.toLowerCase();
}

/** Persisted mirror value -> window backgroundColor (default on absent/invalid). */
export function resolveLaunchBackground(stored: unknown): string {
  return sanitizeLaunchBackground(stored) ?? DEFAULT_LAUNCH_BACKGROUND;
}
