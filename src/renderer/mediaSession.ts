/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// M-WINDOWS-14: this module used to also export `updateMeta()` (plus a
// MediaSessionMetadata interface) for the shell's play/pause path. It read
// `title`/`artist`/`album`/`artwork` fields that do not exist on the real
// `usePlayerStore`, so every call overwrote the vendored ui store's rich
// SMTC metadata (`setCurrent` feeds `navigator.mediaSession.metadata`
// itself) with a fabricated `{ title: 'Phlix' }` stub — and its
// "null metadata while paused" behavior never matched the store's. The call
// site in electronBridge.ts was removed; the zero-caller function went with
// it (estate dead-code law). SMTC metadata is the store's own feed.

/**
 * Sets up navigator.mediaSession for Windows SMTC integration.
 * Returns a cleanup function to remove action handlers.
 */
export function setupMediaSession(): () => void {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return () => {};
  }

  const handlePlay = () => {
    window.electronAPI?.mediaPlay();
  };

  const handlePause = () => {
    window.electronAPI?.mediaPause();
  };

  const handlePrev = () => {
    window.electronAPI?.mediaPrevious();
  };

  const handleNext = () => {
    window.electronAPI?.mediaNext();
  };

  const handleSeekBack = () => {
    window.electronAPI?.mediaSeekBackward();
  };

  const handleSeekForward = () => {
    window.electronAPI?.mediaSeekForward();
  };

  const handleSeekTo = (details?: MediaSessionActionDetails) => {
    if (details?.seekTime !== undefined) {
      window.electronAPI?.mediaSeekTo(details.seekTime);
    }
  };

  const actionHandlers: [MediaSessionAction, (details?: MediaSessionActionDetails) => void][] = [
    ['play', handlePlay],
    ['pause', handlePause],
    ['previoustrack', handlePrev],
    ['nexttrack', handleNext],
    ['seekbackward', handleSeekBack],
    ['seekforward', handleSeekForward],
    ['seekto', handleSeekTo],
  ];

  actionHandlers.forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Some handlers may not be supported
    }
  });

  // Return cleanup function
  return () => {
    actionHandlers.forEach(([action]) => {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // Ignore
      }
    });
  };
}
/**
 * M-WINDOWS-22 (review windows__gameux): SMTC STOP-CLEAR. The vendored store
 * feeds metadata, playbackState (playing/paused) and positionState itself —
 * bundle-verified at v0.99.10 — but it never returns the transport to
 * 'none' when playback ends, so the Windows taskbar kept a stale paused
 * thumbnail indefinitely after the player closed. Clearing is the shell's
 * own gap to fill: the bridge calls this from its no-media arm (the same
 * tick that zeroes the taskbar progress bar). positionState is cleared by
 * the no-argument call per spec; older surfaces without the API no-op.
 */
export function clearMediaSessionTransport(): void {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return;
  }
  try {
    const ms = navigator.mediaSession as MediaSession & {
      setPositionState?: (state?: MediaPositionState) => void;
    };
    ms.playbackState = 'none';
    ms.setPositionState?.();
  } catch {
    // SMTC surface unavailable (old Electron, exotic embedder) — nothing to clear.
  }
}
