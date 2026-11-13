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

/** WIN-51: pointer-idle delay before the overlay column fades out. */
export const OVERLAY_IDLE_MS = 3000;

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

    // WIN-51: the column sits above the player; during fullscreen / TV playback
    // it must not linger over the picture. The vendored player exposes no public
    // control-visibility seam, so fade after OVERLAY_IDLE_MS of pointer idle, reveal on
    // pointer/touch movement, and keyboard focus summons it. Timer is a one-shot
    // setTimeout (never setInterval).
    const visible = ref(true);
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let hasFocus = false;
    const clearIdle = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };
    const armIdle = () => {
      clearIdle();
      if (hasFocus) return;
      idleTimer = setTimeout(() => {
        idleTimer = null;
        visible.value = false;
      }, OVERLAY_IDLE_MS);
    };
    const summon = () => {
      visible.value = true;
      armIdle();
    };
    const onFocusIn = (e: Event) => {
      // WIN-S7: a clicked button keeps focus after the pointer leaves, which
      // pinned the column visible until blur. Only KEYBOARD focus (the
      // :focus-visible heuristic) holds the column up; pointer-originated
      // focus leaves the idle fade running. `matches` throwing (very old
      // engines) falls back to the old always-hold behaviour.
      let keyboardFocus = true;
      try {
        const target = e.target as Element | null;
        if (target && typeof target.matches === 'function') keyboardFocus = target.matches(':focus-visible');
      } catch {
        keyboardFocus = true;
      }
      if (!keyboardFocus) {
        summon();
        return;
      }
      hasFocus = true;
      visible.value = true;
      clearIdle();
    };
    const onFocusOut = () => {
      hasFocus = false;
      armIdle();
    };
    const onKeyDown = () => summon();
    const events: Array<[string, EventListener]> = [
      ['pointermove', summon],
      ['pointerdown', summon],
      ['keydown', onKeyDown],
    ];
    if (typeof window !== 'undefined') {
      for (const [n, h] of events) window.addEventListener(n, h, { passive: true });
      armIdle();
    }

    onUnmounted(() => {
      unregisterRouter();
      clearIdle();
      if (typeof window !== 'undefined') {
        for (const [n, h] of events) window.removeEventListener(n, h);
      }
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
              opacity: visible.value ? 1 : 0,
              pointerEvents: visible.value ? 'auto' : 'none',
              transition: 'opacity 250ms ease',
            }}
            onFocusin={onFocusIn}
            onFocusout={onFocusOut}
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
