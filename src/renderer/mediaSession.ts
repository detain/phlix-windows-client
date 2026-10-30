/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// M-WINDOWS-35: this module used to be the shell's SECOND
// navigator.mediaSession installer, wired after the vendored @phlix/ui
// player store's own capability-gated handlers. Registering later WINS the
// single slot per action, so the shell silently replaced the store's
// transport handlers; worse, its prev/next arms re-dispatched into
// 'media-previous'/'media-next' pushes whose only renderer consumers were
// documented no-op log lines (playlist management lives in @phlix/ui) —
// phantom SMTC buttons acknowledging clicks into nothing. The whole leg
// went: the installer export, the 7 invoke channels it called, and the 3
// push subscriptions only those channels fed. SMTC transport, metadata,
// playbackState and positionState are owned SOLELY by the vendored store's
// installer now; this module keeps only the stop-clear below
// (M-WINDOWS-22). Historical note from M-WINDOWS-14: the old `updateMeta()`
// export fabricated stub metadata over the store's rich `setCurrent` feed
// and was deleted for the same ownership reason.

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
