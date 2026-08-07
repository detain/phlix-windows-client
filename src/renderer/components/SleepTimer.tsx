/**
 * SleepTimer — sleep timer overlay with presets + countdown.
 *
 * Shows in the player gear surface; on expiry fades audio and pauses playback.
 * Countdown state is persisted to localStorage so it survives page reloads.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, watch, onUnmounted, computed } from 'vue';
import { usePlayerStore } from '@phlix/ui';

const PRESETS_MINUTES = [15, 30, 45, 60, 90, 120];

const STORAGE_KEY = 'phlix-sleep-timer';
const FADE_DURATION_MS = 3000;

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
    const displayRemaining = ref(0);

    // Persist whenever state changes
    watch(state, (newState) => {
      saveState(newState);
    });

    const clearTimer = () => {
      if (timeoutRef.value) {
        clearTimeout(timeoutRef.value);
        timeoutRef.value = null;
      }
      if (rafRef.value !== null) {
        cancelAnimationFrame(rafRef.value);
        rafRef.value = null;
      }
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

    const handleExpire = () => {
      isExpired.value = true;
      state.value = { endTime: null, totalMinutes: 0 };
      clearTimer();
      // Trigger fade-out via CSS transition, then pause
      const videoEl = document.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        const startVol = videoEl.volume;
        // Use CSS transition to fade volume over FADE_DURATION_MS
        videoEl.style.transition = `volume ${FADE_DURATION_MS}ms ease-out`;
        videoEl.volume = 0;
        setTimeout(() => {
          videoEl.style.transition = '';
          videoEl.volume = startVol; // restore for next play
          player.pause();
        }, FADE_DURATION_MS);
      } else {
        player.pause();
      }
    };

    // Schedule a single timeout for when the timer expires (no 1Hz polling)
    watch(
      () => state.value.endTime,
      (endTime) => {
        if (!endTime) {
          isExpired.value = false;
          clearTimer();
          return;
        }

        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          // Timer already expired while page was closed — fire immediately
          handleExpire();
          return;
        }

        clearTimer();
        timeoutRef.value = setTimeout(handleExpire, remaining);
      },
      { immediate: true }
    );

    // Update countdown display via RAF only when the timer panel is visible
    const updateCountdown = () => {
      if (!state.value.endTime || (!showMenu.value && !isExpired.value)) {
        rafRef.value = null;
        return;
      }
      displayRemaining.value = Math.max(0, state.value.endTime - Date.now());
      rafRef.value = requestAnimationFrame(updateCountdown);
    };

    // Start/stop RAF loop based on visibility
    watch(
      [() => state.value.endTime, showMenu, isExpired],
      ([endTime, menuVisible, expired]) => {
        if (endTime && (menuVisible || expired)) {
          if (rafRef.value === null) {
            displayRemaining.value = Math.max(0, endTime - Date.now());
            rafRef.value = requestAnimationFrame(updateCountdown);
          }
        } else {
          clearTimer(); // This also clears rafRef via clearTimer
        }
      }
    );

    onUnmounted(() => {
      clearTimer();
    });

    const isActive = computed((): boolean => {
      return player.playing || !!state.value.endTime;
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
        <div style={{ position: 'relative' }}>
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
              <span style={{ fontSize: '16px' }}>🌙</span>
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {formatCountdown(displayRemaining.value)}
              </span>
              <button
                onClick={cancelTimer}
                aria-label="Cancel sleep timer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Expired notice */}
          {isExpired.value && (
            <div
              style={{
                padding: '4px 12px',
                background: 'rgba(180,60,60,0.85)',
                borderRadius: '16px',
                color: '#fff',
                fontSize: '13px',
              }}
            >
              Sleep timer expired — playback stopped
            </div>
          )}

          {/* Preset button / gear menu trigger */}
          <button
            class="sleep-timer-trigger"
            onClick={() => (showMenu.value = !showMenu.value)}
            aria-label="Sleep timer"
            aria-expanded={showMenu.value}
            title="Sleep timer"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🌙
          </button>

          {/* Preset menu */}
          {showMenu.value && (
            <div
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
                Sleep Timer
              </div>
              {PRESETS_MINUTES.map((min) => (
                <button
                  key={min}
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
                  {min < 60 ? `${min} min` : `${min / 60} hr${min > 60 ? 's' : ''}`}
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
                  Cancel timer
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