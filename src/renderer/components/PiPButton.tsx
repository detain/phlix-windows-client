/**
 * PiPButton — Picture-in-Picture toggle for the player.
 *
 * Uses the browser Picture-in-Picture API (document.pictureInPictureEnabled)
 * to enter/exit PiP on the active video element. State is saved to
 * localStorage so the preference persists across sessions.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { usePlayerStore } from '@phlix/ui';

const STORAGE_KEY = 'phlix-pip-enabled';

function isPiPSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    (document as Document & { pictureInPictureEnabled: boolean }).pictureInPictureEnabled
  );
}

function getActiveVideo(): HTMLVideoElement | null {
  // Try the PiP document first (if we're already in PiP)
  const pipDoc = document.pictureInPictureElement as HTMLVideoElement | null;
  if (pipDoc?.tagName === 'VIDEO') return pipDoc;

  // Fall back to the first visible <video> element
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (video.readyState > 0 && video.style.display !== 'none' && video.offsetParent !== null) {
      return video;
    }
  }
  return null;
}

/**
 * PiPButton displays a Picture-in-Picture toggle button on the player.
 * Shows only when PiP is supported and playback is active.
 */
const PiPButton = defineComponent({
  name: 'PiPButton',
  setup() {
    // Cast to any since @phlix/ui store types don't expose currentItem
    // This exists at runtime but isn't typed. Temporary implementation until proper seams.
    const player = usePlayerStore() as any;
    const isInPiP = ref(false);
    const pipSupported = ref(false);
    const savedPref = ref(false);

    const updatePiPSupported = () => {
      pipSupported.value = isPiPSupported();
    };

    // Synced with actual PiP state on visibility change / video events

    const handleEnter = () => {
      isInPiP.value = true;
    };

    const handleLeave = () => {
      isInPiP.value = false;
    };

    const setupVideoListeners = () => {
      if (!pipSupported.value) return;
      const video = getActiveVideo();
      if (!video) return;

      video.addEventListener('enterpictureinpicture', handleEnter);
      video.addEventListener('leavepictureinpicture', handleLeave);

      // Check current state
      isInPiP.value = document.pictureInPictureElement === video;
    };

    const cleanupVideoListeners = () => {
      if (!pipSupported.value) return;
      const video = getActiveVideo();
      if (!video) return;

      video.removeEventListener('enterpictureinpicture', handleEnter);
      video.removeEventListener('leavepictureinpicture', handleLeave);
    };

    onMounted(() => {
      // Load saved preference
      try {
        savedPref.value = localStorage.getItem(STORAGE_KEY) === 'true';
      } catch {
        savedPref.value = false;
      }

      updatePiPSupported();
      setupVideoListeners();
    });

    onUnmounted(() => {
      cleanupVideoListeners();
    });

    // Re-sync when player item changes
    watch(
      () => player.currentItem,
      () => {
        cleanupVideoListeners();
        setupVideoListeners();
      }
    );

    // Auto-enter PiP on play if user has the preference saved
    watch(
      () => player.playing,
      (playing) => {
        if (!savedPref.value || !pipSupported.value || !playing) return;
        const video = getActiveVideo();
        if (video && !document.pictureInPictureElement) {
          video.requestPictureInPicture().catch(() => {
            // PiP rejected (e.g., not the active tab) — clear pref
            savedPref.value = false;
            localStorage.removeItem(STORAGE_KEY);
          });
        }
      }
    );

    const togglePiP = async () => {
      if (!pipSupported.value) return;

      const video = getActiveVideo();
      if (!video) return;

      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          isInPiP.value = false;
          savedPref.value = false;
          localStorage.removeItem(STORAGE_KEY);
        } else {
          await video.requestPictureInPicture();
          isInPiP.value = true;
          savedPref.value = true;
          localStorage.setItem(STORAGE_KEY, 'true');
        }
      } catch (err) {
        // PiP may fail if called from non-user-gesture or if video has no src
        console.warn('[PiPButton] Toggle failed:', err);
      }
    };

    const isActive = computed((): boolean => {
      return pipSupported.value && !!player.playing;
    });

    return () => {
      if (!isActive.value) return null;

      return (
        <button
          class="pip-button"
          onClick={togglePiP}
          aria-label={isInPiP.value ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
          aria-pressed={isInPiP.value}
          title={isInPiP.value ? 'Exit PiP' : 'Picture-in-Picture'}
          style={{
            background: isInPiP.value ? 'rgba(80,160,255,0.25)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${isInPiP.value ? 'rgba(80,160,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            color: isInPiP.value ? '#6cf' : '#fff',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          {isInPiP.value ? (
            // Exit PiP icon — two overlapping rectangles
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="3" width="10" height="8" rx="1" opacity="0.4" />
              <rect x="5" y="5" width="10" height="8" rx="1" />
            </svg>
          ) : (
            // Enter PiP icon — single rectangle
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="4" width="12" height="9" rx="1.5" />
            </svg>
          )}
        </button>
      );
    };
  }
});

export default PiPButton;