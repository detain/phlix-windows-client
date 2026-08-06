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

import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import SleepTimer from './SleepTimer';
import PiPButton from './PiPButton';

function isPlayerActive(): boolean {
  return typeof window !== 'undefined' && /^\/app\/player\//.test(window.location.pathname);
}

/**
 * PlayerSupplement is a Vue component that renders all P3-S4 player overlays.
 * It only renders when the player page is active.
 */
const PlayerSupplement = defineComponent({
  name: 'PlayerSupplement',
  setup() {
    const active = ref(isPlayerActive());

    onMounted(() => {
      if (typeof window === 'undefined') return;

      // Poll since route changes may not always trigger events
      const interval = setInterval(() => {
        active.value = isPlayerActive();
      }, 1000);

      onUnmounted(() => {
        clearInterval(interval);
      });
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