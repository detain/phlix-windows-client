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
import PlayerSupplement from './components/PlayerSupplement';

// Wait for Pinia to be initialized (the Vue app sets it up on mount).
// Use a MutationObserver on document.body as a proxy for "Vue app has mounted".
const tryMount = (): void => {
  const root = document.getElementById('player-supplement-root');
  if (!root) return;

  const app = createApp(PlayerSupplement);

  try {
    app.mount(root);
  } catch (err) {
    // If mounting fails (e.g., Pinia not ready), retry after a delay
    console.warn('[Overlay] Mount failed, retrying:', err);
    setTimeout(tryMount, 200);
  }
};

// Small delay to allow the Vue app to finish mounting
setTimeout(tryMount, 400);