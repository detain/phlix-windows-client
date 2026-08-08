/**
 * Overlay entry point for P3-S4 player UX features (skip/sleep/PiP).
 *
 * Rendered as a separate Vue app on top of the @phlix/ui Vue app.
 * Must be initialized AFTER the Vue app mounts (Pinia must be active) so
 * that @phlix/ui store hooks (usePlayerStore, useMediaStore) are safe.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import PlayerSupplement from './components/PlayerSupplement';
import log from 'electron-log';

// Create the Vue app ONCE at module level
const app = createApp(PlayerSupplement);
const pinia = createPinia();
app.use(pinia);

// Router is created lazily inside tryMount() to avoid jsdom teardown issues
// where createWebHashHistory() references location which becomes undefined
let routerReady = false;

// Bounded retry with setTimeout — max 10 attempts
const MAX_ATTEMPTS = 10;
let attempts = 0;

function tryMount(): void {
  const root = document.getElementById('player-supplement-root');
  if (!root) {
    if (attempts >= MAX_ATTEMPTS) {
      log.error('[Overlay] #player-supplement-root never appeared after 10 attempts. Giving up.');
      return;
    }
    attempts++;
    log.warn(`[Overlay] #player-supplement-root not found, retrying (${attempts}/${MAX_ATTEMPTS})...`);
    setTimeout(tryMount, 1000);
    return;
  }

  // Lazily create router only once when root element is confirmed
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
  } catch (err) {
    if (attempts >= MAX_ATTEMPTS) {
      log.error('[Overlay] Mount failed after 10 attempts. Giving up:', err);
      return;
    }
    attempts++;
    log.warn(`[Overlay] Mount failed (${attempts}/${MAX_ATTEMPTS}), retrying...`);
    setTimeout(tryMount, 1000);
  }
}

// Wait for DOM to be ready, then start trying
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryMount);
} else {
  tryMount();
}
