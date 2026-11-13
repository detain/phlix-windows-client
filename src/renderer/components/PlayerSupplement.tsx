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
import { useRoute } from 'vue-router';
import { getOverlayRouter } from '../overlayShared';
import SleepTimer from './SleepTimer';
import PiPButton from './PiPButton';

/**
 * WIN-36: the player route is identified by its route NAME ('player', the
 * @phlix/ui route for /app/player/:id), never by the presence of params.id —
 * any other route carrying an :id param (media detail, etc.) used to flip the
 * overlay on.
 */
const PLAYER_ROUTE_NAME = 'player';

/**
 * PlayerSupplement is a Vue component that renders all P3-S4 player overlays.
 * It only renders when the player page is active.
 */
const PlayerSupplement = defineComponent({
  name: 'PlayerSupplement',
  setup() {
    const route = useRoute();
    // The main app's router is resolved lazily here (per mount), so a re-boot's
    // fresh router is always the one seen. Seed `active` SYNCHRONOUSLY from its
    // currentRoute (WIN-6: boot parked on /player/:id fires no afterEach), then
    // follow navigation. Falls back to the local route outside the shell.
    const router = getOverlayRouter();
    const seedName = router?.currentRoute?.value?.name ?? route?.name;
    const active = ref(seedName === PLAYER_ROUTE_NAME);

    const unregisterRouter = router?.afterEach((to) => {
      active.value = to.name === PLAYER_ROUTE_NAME;
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
              bottom: '120px',
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
