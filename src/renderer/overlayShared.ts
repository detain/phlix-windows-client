/**
 * Module-local hand-off between boot() (main.ts) and the player-supplement
 * overlay second app (overlay.tsx / PlayerSupplement.tsx).
 *
 * WIN-48: this replaces the former `window.__phlixRouter` / `window.__phlixPinia`
 * globals — any script in the realm could redefine those; a module-local
 * singleton cannot be reached from outside the bundle. main.ts and the
 * dynamically imported overlay share ONE module instance (same realm, same
 * chunk graph), so a plain setter/getter pair is sufficient.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import type { Pinia } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';

/** The slice of the main app's vue-router the overlay needs. */
export interface OverlayRouter {
  afterEach: (cb: (to: RouteLocationNormalized) => void) => () => void;
  currentRoute?: { value: { name?: unknown } };
}

let sharedRouter: OverlayRouter | undefined;
let sharedPinia: Pinia | undefined;

/** Called by boot() on every (re-)boot with the live app's router + pinia. */
export function setOverlayShared(shared: { router?: OverlayRouter; pinia?: Pinia }): void {
  sharedRouter = shared.router;
  sharedPinia = shared.pinia;
}

/** Resolved lazily at call time so a re-boot's fresh router is always seen. */
export function getOverlayRouter(): OverlayRouter | undefined {
  return sharedRouter;
}

export function getOverlayPinia(): Pinia | undefined {
  return sharedPinia;
}
