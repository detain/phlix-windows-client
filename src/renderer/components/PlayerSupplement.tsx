/**
 * PlayerSupplement — unified overlay panel for player UX features.
 *
 * Renders SleepTimer and PiPButton as overlays on top of the @phlix/ui
 * player when the player is active. Detects active playback via the player
 * URL route and usePlayerStore state. Skip-intro is handled by @phlix/ui's
 * own PlayerPage SkipButton which sources markers from /media/{id}/markers.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, onUnmounted } from 'vue';
import { useRoute, type RouteLocationNormalized } from 'vue-router';
import SleepTimer from './SleepTimer';
import PiPButton from './PiPButton';

/**
 * Retrieves the phlix-ui router that was exposed on the window object
 * by the main app during boot. This router carries the actual route definitions
 * including /app/player/:id, allowing this overlay to subscribe to navigation
 * events from the shared app.
 *
 * The router's afterEach callback receives vue-router's RouteLocationNormalized.
 * We only read the `params.id` field needed to detect player activation;
 * other route fields are intentionally ignored.
 */
function getPhlixRouter() {
  return (window as unknown as { __phlixRouter?: { afterEach: (cb: (to: RouteLocationNormalized) => void) => () => void } }).__phlixRouter;
}

/**
 * PlayerSupplement is a Vue component that renders all P3-S4 player overlays.
 * It only renders when the player page is active.
 */
const PlayerSupplement = defineComponent({
  name: 'PlayerSupplement',
  setup() {
    const route = useRoute();
    const active = ref(Boolean(route.params.id));

    // Subscribe to router navigation events to detect player route changes
    // without polling window.location.pathname.
    const router = getPhlixRouter();
    const unregisterRouter = router?.afterEach((to) => {
      active.value = Boolean(to.params.id);
    }) ?? (() => {});

    onUnmounted(() => {
      unregisterRouter();
    });

    return () => {
      if (!active.value) return null;

      return (
        <>
          {/* Bottom-right controls: Sleep Timer + PiP */}
          <div
            style={{
              position: 'fixed',
              bottom: '80px',
              right: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 100,
            }}
          >
            <SleepTimer />
            <PiPButton />
          </div>
        </>
      );
    };
  }
});

export default PlayerSupplement;