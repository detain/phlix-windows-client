/**
 * SleepTimer — sleep timer overlay with presets + countdown.
 *
 * Shows in the player gear surface; on expiry fades audio and pauses playback.
 * Countdown state is persisted to localStorage so it survives page reloads.
 *
 * Timer-law redesign (review windows__casualgamer M2/m1/m2, windows__gameux m8):
 * - The expiry timeout is owned SOLELY by the endTime watcher. The countdown
 *   loop watcher never clears it — an interactively-set timer used to cancel
 *   itself when the preset menu closed in the same flush.
 * - `isExpired` is set only by handleExpire and cleared only by startTimer /
 *   cancelTimer — the endTime watcher's null-arm used to wipe the expiry
 *   notice before it could ever render.
 * - The countdown RAF loop runs exactly while the pill is visible, and the
 *   pill seeds displayRemaining on arm so it never shows a stale 0:00.
 * - The fade-out is JS-stepped (volume is not a CSS property; assigning a
 *   "volume" transition made audio slam to mute).
 * - The preset menu dismisses on Escape and on mousedown outside the root
 *   (desktop popover expectation), and its icons are SVG (emoji glyphs render
 *   inconsistently under Segoe UI Emoji theming); every interactive target
 *   is >= 24px.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, watch, onUnmounted, computed } from 'vue';
import { usePlayerStore } from '@phlix/ui';
import { tWin } from '../i18n/windows-own';

const PRESETS_MINUTES = [15, 30, 45, 60, 90, 120];

const STORAGE_KEY = 'phlix-sleep-timer';
const FADE_DURATION_MS = 3000;
const FADE_STEP_MS = 100;

interface TimerState {
  endTime: number | null; // Unix ms when timer expires
  totalMinutes: number;
}

function loadState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { endTime: null, totalMinutes: 0 };
    const state: TimerState = JSON.parse(raw);
    // If timer has already expired, clear it
    if (state.endTime && state.endTime < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return { endTime: null, totalMinutes: 0 };
    }
    return state;
  } catch {
    return { endTime: null, totalMinutes: 0 };
  }
}

function saveState(state: TimerState): void {
  try {
    if (state.endTime === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Feather-style moon, stroke follows currentColor. aria-hidden: the button carries the label. */
const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/** Cancel ✕ as SVG (14px glyph inside a 24px button — the old 12px ✕ text was a sub-24px target). */
const CrossIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/**
 * SleepTimer displays a sleep timer overlay on the player.
 * Shows countdown when active, preset buttons in a menu, and an expired notice.
 */
const SleepTimer = defineComponent({
  name: 'SleepTimer',
  setup() {
    const player = usePlayerStore();
    const state = ref<TimerState>(loadState());
    const showMenu = ref(false);
    const isExpired = ref(false);
    const timeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);
    const rafRef = ref<number | null>(null);
    const fadeRef = ref<ReturnType<typeof setInterval> | null>(null);
    const displayRemaining = ref(0);
    const rootRef = ref<HTMLElement | null>(null);

    // Persist whenever state changes
    watch(state, (newState) => {
      saveState(newState);
    });

    const clearExpiryTimeout = () => {
      if (timeoutRef.value) {
        clearTimeout(timeoutRef.value);
        timeoutRef.value = null;
      }
    };

    const stopCountdownLoop = () => {
      if (rafRef.value !== null) {
        cancelAnimationFrame(rafRef.value);
        rafRef.value = null;
      }
    };

    const clearTimer = () => {
      clearExpiryTimeout();
      stopCountdownLoop();
    };

    const startTimer = (minutes: number) => {
      const endTime = Date.now() + minutes * 60 * 1000;
      state.value = { endTime, totalMinutes: minutes };
      showMenu.value = false;
      isExpired.value = false;
    };

    const cancelTimer = () => {
      clearTimer();
      state.value = { endTime: null, totalMinutes: 0 };
      isExpired.value = false;
    };

    /**
     * m1 cure: ramp the video element's volume down in FADE_STEP_MS ticks over
     * FADE_DURATION_MS, pause at zero, then restore the pre-fade volume so the
     * next playback starts as loud as the user left it. (Volume is not a CSS
     * property — the old `style.transition = 'volume …'` was a fiction that cut
     * audio to zero instantly.)
     */
    const fadeVolumeAndPause = (videoEl: HTMLVideoElement) => {
      const startVol = videoEl.volume;
      const steps = Math.max(1, Math.round(FADE_DURATION_MS / FADE_STEP_MS));
      const stepSize = startVol / steps;
      let step = 0;
      fadeRef.value = setInterval(() => {
        step += 1;
        if (step >= steps) {
          if (fadeRef.value !== null) {
            clearInterval(fadeRef.value);
            fadeRef.value = null;
          }
          videoEl.volume = 0;
          player.pause();
          videoEl.volume = startVol; // restore for next play
        } else {
          videoEl.volume = Math.max(0, startVol - stepSize * step);
        }
      }, FADE_STEP_MS);
    };

    const handleExpire = () => {
      isExpired.value = true;
      state.value = { endTime: null, totalMinutes: 0 };
      clearTimer();
      const videoEl = document.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        fadeVolumeAndPause(videoEl);
      } else {
        player.pause();
      }
    };

    // Schedule a single timeout for when the timer expires (no 1Hz polling).
    // SOLE owner of the expiry timeout (M2): the countdown watcher below must
    // never clear it. This null-arm deliberately does NOT touch isExpired —
    // handleExpire clears endTime itself, and wiping the flag here erased the
    // expiry notice before it could render. Only startTimer/cancelTimer clear it.
    watch(
      () => state.value.endTime,
      (endTime) => {
        clearExpiryTimeout();
        if (!endTime) {
          return;
        }

        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          // Timer already expired while page was closed — fire immediately
          handleExpire();
          return;
        }

        timeoutRef.value = setTimeout(handleExpire, remaining);
      },
      { immediate: true }
    );

    // Update countdown display via RAF while the pill is visible (endTime set,
    // not expired) — the same condition the pill renders under, so the chip
    // never sits on a stale value (m2).
    const updateCountdown = () => {
      if (!state.value.endTime || isExpired.value) {
        rafRef.value = null;
        return;
      }
      displayRemaining.value = Math.max(0, state.value.endTime - Date.now());
      rafRef.value = requestAnimationFrame(updateCountdown);
    };

    watch(
      [() => state.value.endTime, isExpired],
      ([endTime, expired]) => {
        if (endTime && !expired) {
          if (rafRef.value === null) {
            // Seed immediately so the first paint is the true remainder, not 0:00.
            displayRemaining.value = Math.max(0, endTime - Date.now());
            rafRef.value = requestAnimationFrame(updateCountdown);
          }
        } else {
          stopCountdownLoop();
        }
      },
      { immediate: true }
    );

    // m8: popover dismissal — Escape key or mousedown outside the component root,
    // attached only while the menu is open.
    const removeMenuDismissers = () => {
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('mousedown', onMousedown);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        showMenu.value = false;
      }
    };
    const onMousedown = (e: MouseEvent) => {
      const root = rootRef.value;
      if (root && !root.contains(e.target as Node | null)) {
        showMenu.value = false;
      }
    };
    watch(showMenu, (open) => {
      if (open) {
        document.addEventListener('keydown', onKeydown);
        document.addEventListener('mousedown', onMousedown);
      } else {
        removeMenuDismissers();
      }
    });

    onUnmounted(() => {
      clearTimer();
      removeMenuDismissers();
      if (fadeRef.value !== null) {
        clearInterval(fadeRef.value);
        fadeRef.value = null;
      }
    });

    const isActive = computed((): boolean => {
      // isExpired included (M2): the expiry notice must render even after the
      // timer state cleared and pause() dropped `playing` — otherwise the
      // notice is wiped from the DOM by its own expiry.
      return player.playing || !!state.value.endTime || isExpired.value;
    });

    const handleMouseOver = (e: Event) => {
      const target = e.target as HTMLElement;
      target.style.background = 'rgba(255,255,255,0.08)';
    };

    const handleMouseOut = (e: Event) => {
      const target = e.target as HTMLElement;
      target.style.background = 'none';
    };

    return () => {
      if (!isActive.value) return null;

      return (
        <div ref={rootRef} style={{ position: 'relative' }}>
          {/* Timer display when active */}
          {state.value.endTime && !isExpired.value && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: '16px',
                color: '#fff',
                fontSize: '13px',
              }}
            >
              <MoonIcon />
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {formatCountdown(displayRemaining.value)}
              </span>
              <button
                onClick={cancelTimer}
                aria-label={tWin('overlay.cancelSleepTimer')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  padding: 0,
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                }}
              >
                <CrossIcon />
              </button>
            </div>
          )}

          {/* Expired notice — windows__gameux 2[m] (MW-087): the notice owns
              its own dismiss control. After handleExpire nulls endTime, the
              countdown pill (which carries its own cancel) and the menu's
              Cancel row both unrender, so without this button the badge
              could only be cleared by arming a NEW timer — the dismiss path
              now runs the SAME cancelTimer the live pill uses (clears
              isExpired, resets state, drops the notice), and the aria-label
              reuses the established 'Cancel sleep timer' string (no new
              catalog key). */}
          {isExpired.value && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: 'rgba(180,60,60,0.85)',
                borderRadius: '16px',
                color: '#fff',
                fontSize: '13px',
              }}
            >
              <span>{tWin('overlay.expiredNotice')}</span>
              <button
                onClick={cancelTimer}
                aria-label={tWin('overlay.cancelSleepTimer')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  padding: 0,
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                }}
              >
                <CrossIcon />
              </button>
            </div>
          )}

          {/* Preset button / gear menu trigger */}
          <button
            class="sleep-timer-trigger"
            onClick={() => (showMenu.value = !showMenu.value)}
            aria-label={tWin('overlay.sleepTimer')}
            aria-expanded={showMenu.value}
            title={tWin('overlay.sleepTimer')}
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MoonIcon />
          </button>

          {/* Preset menu */}
          {showMenu.value && (
            <div
              class="sleep-timer-menu"
              style={{
                position: 'absolute',
                bottom: '44px',
                right: '0',
                background: 'rgba(20,20,20,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '160px',
                zIndex: 200,
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  color: '#888',
                  fontSize: '11px',
                  padding: '4px 8px 8px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {tWin('overlay.menuHeading')}
              </div>
              {PRESETS_MINUTES.map((min) => (
                <button
                  key={min}
                  class="sleep-timer-preset"
                  onClick={() => startTimer(min)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '6px',
                  }}
                  onMouseover={handleMouseOver}
                  onMouseout={handleMouseOut}
                >
                  {min < 60 ? `${min} ${tWin('overlay.unitMin')}` : `${min / 60} ${min > 60 ? tWin('overlay.unitHrs') : tWin('overlay.unitHr')}`}
                </button>
              ))}
              {state.value.endTime && (
                <button
                  onClick={cancelTimer}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    color: '#e05050',
                    fontSize: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    marginTop: '4px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {tWin('overlay.cancelMenuItem')}
                </button>
              )}
            </div>
          )}
        </div>
      );
    };
  }
});

export default SleepTimer;
