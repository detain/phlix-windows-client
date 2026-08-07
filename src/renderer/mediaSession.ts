/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

/**
 * Media metadata for SMTC display.
 */
export interface MediaSessionMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: { src: string }[];
}

/**
 * Updates navigator.mediaSession.metadata for Windows SMTC integration.
 * Allows hardware media keys and the Windows System Media Transport Controls to work.
 */
export function updateMeta(player: { playing: boolean; title?: string; artist?: string; album?: string; artwork?: { src: string }[] }): void {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return;
  }

  if (!player.playing) {
    navigator.mediaSession.metadata = null;
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: player.title || 'Phlix',
    artist: player.artist || '',
    album: player.album || '',
    artwork: player.artwork?.map(a => ({ src: a.src, sizes: '512x512', type: 'image/png' })) || [],
  });
}

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