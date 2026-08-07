/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { usePlayerStore } from '@phlix/ui';
import type { App as VueApp } from 'vue';

// Minimal structural types for the pieces of the phlix-ui player store and the
// vue-router instance that the bridge actually touches. Keeping them local makes
// the wiring helper trivially unit-testable with fakes.
export interface BridgePlayer {
  playing: boolean;
  position: number;
  duration: number;
  play: () => void;
  pause: () => void;
  closePlayer: () => void;
  /** Relative seek in seconds (phlix-ui v0.52.0 player command bus). */
  seekBy: (delta: number) => void;
  /** Absolute seek to position in seconds. */
  seekTo: (position: number) => void;
}

export interface BridgeRouter {
  push: (to: string) => unknown;
}

/** Seconds the tray/menu Rewind & Fast-Forward controls jump. */
const SEEK_STEP_SECONDS = 10;

/** Module-level cleanup references for idempotency. */
let _cleanupBridge: (() => void) | null = null;
let _cleanupFocusGuard: (() => void) | null = null;

/**
 * Returns true when the given element is a text-entry control that should
 * consume keydown events without relaying them to the media-bridge.
 */
function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  // contentEditable is 'true' when explicitly set; 'inherit' means the
  // element inherits from its parent (and is not in edit mode by default).
  const ce = (el as HTMLElement).contentEditable;
  return ce === 'true' || ce === 'plaintext-only';
}

/**
 * Installs a document-wide keydown listener that bridges Space / Left / Right
 * to the player only when no text-entry element has focus. This restores the
 * media controls that were removed from the Electron menu (registerAccelerator: false)
 * while ensuring typing a space in a URL field no longer triggers Play/Pause.
 *
 * Idempotent: calling again before cleaning up removes the previous registration first.
 * Returns a cleanup function that removes the listener.
 */
export function installFocusGuard(player: BridgePlayer): () => void {
  // Remove any previous registration before installing a new one
  if (_cleanupFocusGuard) {
    _cleanupFocusGuard();
    _cleanupFocusGuard = null;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (isTextInput(document.activeElement)) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        player.seekBy(-SEEK_STEP_SECONDS);
        break;
      case 'ArrowRight':
        e.preventDefault();
        player.seekBy(SEEK_STEP_SECONDS);
        break;
    }
  }

  document.addEventListener('keydown', handleKeyDown);
  _cleanupFocusGuard = () => document.removeEventListener('keydown', handleKeyDown);
  return _cleanupFocusGuard;
}

/**
 * Pure wiring helper: registers the Electron main-process media/window events
 * against a player store + router and returns a single cleanup function that
 * unregisters every listener. Accepts the dependencies as params so it can be
 * exercised in tests without a real Vue app or Electron preload bridge.
 */
export function wireElectronBridge(player: BridgePlayer, router: BridgeRouter): () => void {
  const api = window.electronAPI;
  if (!api) return () => {};

  const cleanups: Array<() => void> = [];

  cleanups.push(
    api.onMediaPlayPause(() => {
      // W4.5: capture the target state BEFORE async play/pause to avoid stale read
      const willBePlaying = !player.playing;
      if (willBePlaying) {
        player.play();
      } else {
        player.pause();
      }
      // Update thumbar with the known target state (not the potentially-stale player.playing)
      api.updateThumbar?.({ playing: willBePlaying });
      api.setPlaybackProgress?.(player.position, player.duration);
    })
  );

  cleanups.push(
    api.onMediaStop(() => {
      player.closePlayer();
    })
  );

  cleanups.push(
    api.onMediaRewind(() => {
      player.seekBy(-SEEK_STEP_SECONDS);
      // W4.5: position changed — update progress bar
      api.setPlaybackProgress?.(player.position, player.duration);
    })
  );

  cleanups.push(
    api.onMediaForward(() => {
      player.seekBy(SEEK_STEP_SECONDS);
      // W4.5: position changed — update progress bar
      api.setPlaybackProgress?.(player.position, player.duration);
    })
  );

  cleanups.push(
    api.onOpenSettings(() => {
      router.push('/app/settings');
    })
  );

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Installs the Electron bridge against a mounted phlix-ui Vue app. Pulls the
 * active pinia + router off the app's global properties and resolves the player
 * store, then delegates to the pure wiring helper. No-op outside Electron.
 *
 * Idempotent: calling again before cleaning up removes the previous registrations first.
 */
export function installElectronBridge(app: VueApp): () => void {
  // Remove existing listeners before adding new ones (idempotency)
  if (_cleanupBridge) {
    _cleanupBridge();
    _cleanupBridge = null;
  }

  if (!window.electronAPI) return () => {};

  const pinia = app.config.globalProperties.$pinia;
  const router = app.config.globalProperties.$router as BridgeRouter;
  const player = usePlayerStore(pinia) as unknown as BridgePlayer;

  const cleanupBridge = wireElectronBridge(player, router);
  const cleanupFocusGuard = installFocusGuard(player);

  _cleanupBridge = () => {
    cleanupBridge();
    cleanupFocusGuard();
  };
  return () => {
    _cleanupBridge?.();
    _cleanupBridge = null;
  };
}
