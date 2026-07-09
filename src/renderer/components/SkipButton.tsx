/**
 * SkipButton — skip intro/outro marker buttons overlaid on the player.
 *
 * Shows near intro/outro marker windows; clicking skips past the marker.
 * Driven by the @phlix/ui usePlayerStore (currentTime, currentItem) and
 * the markers data fetched from the playback-info endpoint.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, watch, computed } from 'vue';
import { usePlayerStore, useMediaStore } from '@phlix/ui';

interface Marker {
  type: 'intro' | 'outro';
  start: number;
  end: number;
}

interface MarkerWindow {
  marker: Marker;
  label: string;
  skipLabel: string;
}

/**
 * Detect which marker window (if any) the current playback position falls within.
 * Intro markers: skip-to-end (skip the intro)
 * Outro markers: rewind-to-start (rewatch the ending)
 */
function detectMarkerWindow(currentTime: number, markers: Marker[]): MarkerWindow | null {
  for (const marker of markers) {
    if (currentTime >= marker.start && currentTime <= marker.end) {
      return {
        marker,
        label: marker.type === 'intro' ? 'Intro' : 'Credits',
        skipLabel: marker.type === 'intro' ? 'Skip Intro' : 'Skip Credits',
      };
    }
  }
  return null;
}

/**
 * SkipButton displays skip intro/outro overlay on the player.
 * Only shows when playback is within a marker window.
 */
const SkipButton = defineComponent({
  name: 'SkipButton',
  setup() {
    // Cast to any since @phlix/ui store types don't expose currentTime/currentItem/preferences
    // These exist at runtime but aren't typed. Temporary implementation until proper seams.
    const player = usePlayerStore() as any;
    const media = useMediaStore() as any;
    const markers = ref<Marker[]>([]);
    const autoSkipped = ref<Set<number>>(new Set());

    // Fetch markers for the current item
    watch(
      () => media.currentItem,
      (item) => {
        if (!item?.id) {
          markers.value = [];
          return;
        }

        // Markers are embedded in playback-info; fetch if not already cached
        // The server surfaces markers at GET /api/v1/media/{id}/markers
        // For now, use the media item's embedded marker data if present
        const itemMarkers: Marker[] = (item as Record<string, unknown>).markers as Marker[] ?? [];
        markers.value = itemMarkers;
      },
      { immediate: true }
    );

    const activeWindow = computed(() => {
      return detectMarkerWindow(player.currentTime ?? 0, markers.value);
    });

    // Auto-skip: if user has auto-skip preference and we're at the marker end, seek past
    watch(
      [activeWindow, () => player.currentTime, () => player.preferences?.autoSkip],
      ([window, currentTime, autoSkip]) => {
        if (!window || !autoSkip) return;

        const { marker } = window;
        const timeUntilEnd = marker.end - (currentTime ?? 0);
        // Auto-skip when 1 second from the end
        if (timeUntilEnd <= 1 && timeUntilEnd > 0 && !autoSkipped.value.has(marker.start)) {
          player.seekTo(marker.end + 0.5);
          autoSkipped.value = new Set(autoSkipped.value).add(marker.start);
        }
      }
    );

    const handleSkip = () => {
      if (!activeWindow.value) return;
      const { marker } = activeWindow.value;
      // Skip to end of intro / start of outro (go back 10s for outro)
      if (marker.type === 'intro') {
        player.seekTo(marker.end + 0.5);
      } else {
        // Outro: rewind to start of credits marker
        player.seekTo(marker.start - 0.5);
      }
    };

    const isVisible = computed(() => {
      return !!activeWindow.value && !!player.playing;
    });

    return () => {
      if (!isVisible.value || !activeWindow.value) return null;

      return (
        <button
          class="player-skip-button"
          onClick={handleSkip}
          aria-label={activeWindow.value.skipLabel}
          style={{
            position: 'absolute',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            padding: '8px 20px',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'opacity 0.2s',
          }}
        >
          {activeWindow.value.skipLabel} &raquo;
        </button>
      );
    };
  }
});

export default SkipButton;