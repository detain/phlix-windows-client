/**
 * Overlay entry point for P3-S4 player UX features (skip/sleep/PiP).
 *
 * Rendered as a second Vue app (separate createApp root) inside the SAME
 * realm as the @phlix/ui app — and it MUST share the main app's Pinia
 * instance (handed over via ./overlayShared by boot() before this module is
 * dynamically imported; WIN-48 retired the window.__phlixPinia global). M1 (2026-11 review): the fresh createPinia() this
 * file used to build meant SleepTimer/PiPButton resolved PRIVATE store
 * copies whose `playing`/`current` never changed — the flagship overlays
 * never rendered in production even though the README advertised them.
 * The fallback createPinia() below stays only for isolated test mounts and
 * browser-dev contexts where boot() exposed no pinia.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import PlayerSupplement from './components/PlayerSupplement';
import { getOverlayPinia } from './overlayShared';
import log from 'electron-log';

// M-WINDOWS-11 note: the overlay components read the windows-own catalog via
// tWin(). This module is loaded by main.ts as a dynamic import (same realm,
// same module instance), so the shell's boot-time setWindowLocale() already
// governs it — see docs/i18n.md §2; overlayI18n.test.ts pins that ordering.

// M1 law (pinned in overlay.test.ts): register the MAIN app's pinia when boot()
// handed one over. Built at module load, and rebuilt by remount() on a re-boot
// (WIN-7: the module is cached across boots, so the first-boot app would
// otherwise keep a dead pinia/router and never mount again).
let app = buildApp();
let mounted = false;

function buildApp() {
  const next = createApp(PlayerSupplement);
  const sharedPinia = getOverlayPinia();
  if (!sharedPinia) {
    log.warn('[Overlay] shared pinia absent — falling back to a private pinia; ' +
      'player-driven overlay state will NOT reflect playback (expected only in isolated ' +
      'test mounts / browser-dev, a boot-order regression otherwise).');
  }
  next.use(sharedPinia ?? createPinia());
  return next;
}

// Router is created lazily inside tryMount() to avoid jsdom teardown issues
// where createWebHashHistory() references location which becomes undefined
let routerReady = false;

// Bounded retry with setTimeout — max 10 attempts
const MAX_ATTEMPTS = 10;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function tryMount(): void {
  retryTimer = undefined;
  const root = document.getElementById('player-supplement-root');
  if (!root) {
    if (attempts >= MAX_ATTEMPTS) {
      log.error('[Overlay] #player-supplement-root never appeared after 10 attempts. Giving up.');
      return;
    }
    attempts++;
    log.warn(`[Overlay] #player-supplement-root not found, retrying (${attempts}/${MAX_ATTEMPTS})...`);
    retryTimer = setTimeout(tryMount, 1000);
    return;
  }

  // Lazily create router only once per app when root element is confirmed
  // (deferring createWebHashHistory avoids location error on jsdom teardown)
  if (!routerReady) {
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [] // Overlay doesn't need any routes
    });
    app.use(router);
    routerReady = true;
  }

  try {
    app.mount(root);
    mounted = true;
  } catch (err) {
    if (attempts >= MAX_ATTEMPTS) {
      log.error('[Overlay] Mount failed after 10 attempts. Giving up:', err);
      return;
    }
    attempts++;
    log.warn(`[Overlay] Mount failed (${attempts}/${MAX_ATTEMPTS}), retrying...`);
    retryTimer = setTimeout(tryMount, 1000);
  }
}

/**
 * Re-mount the overlay against the CURRENT shared pinia/router. boot() calls
 * this on every boot after the first (the module stays cached, so its
 * import-time mount never runs again). Unmounts any live instance, rebuilds
 * the app with the fresh pinia, and mounts again with a fresh retry budget.
 */
export function remount(): void {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  if (mounted) {
    try {
      app.unmount();
    } catch (err) {
      log.warn('[Overlay] unmount before remount failed:', err);
    }
    mounted = false;
  }
  app = buildApp();
  routerReady = false;
  attempts = 0;
  tryMount();
}

// Wait for DOM to be ready, then start trying
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryMount);
} else {
  tryMount();
}
