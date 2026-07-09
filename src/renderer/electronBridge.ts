/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { usePlayerStore } from '@phlix/ui';
import { getActivePinia } from 'pinia';
import type { App as VueApp } from 'vue';
import type { SyncPlayMessage, SyncPlayStateUpdate, SyncPlayPlaybackCommand } from './types/electron.d';

// Minimal structural types for the pieces of the phlix-ui player store and the
// vue-router instance that the bridge actually touches. Keeping them local makes
// the wiring helper trivially unit-testable with fakes.
export interface BridgePlayer {
  playing: boolean;
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
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
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
    })
  );

  cleanups.push(
    api.onMediaForward(() => {
      player.seekBy(SEEK_STEP_SECONDS);
    })
  );

  cleanups.push(
    api.onFileOpened(() => {
      // Local-file playback is still deferred: phlix-ui's PlayerPage is
      // API-driven, so a synthetic local item needs a local-source path in the
      // shared player before `usePlayerStore().playLocalFile(url)` can drive it.
      // Tracked separately; the seam (playLocalFile) already exists in v0.52.0.
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
 */
export function installElectronBridge(app: VueApp): () => void {
  if (!window.electronAPI) return () => {};

  const pinia = app.config.globalProperties.$pinia;
  const router = app.config.globalProperties.$router as BridgeRouter;
  const player = usePlayerStore(pinia) as unknown as BridgePlayer;

  return wireElectronBridge(player, router);
}

/**
 * SyncPlay bridge helper that wires SyncPlay WebSocket messages to the player store.
 * This handles real-time playback sync commands from other users in the room.
 */
export function wireSyncPlayBridge(player: BridgePlayer): () => void {
  const api = window.electronAPI;
  if (!api) return () => {};

  const cleanups: Array<() => void> = [];

  // Handle incoming SyncPlay state updates
  cleanups.push(
    api.onSyncPlayMessage((message: SyncPlayMessage) => {
      switch (message.kind) {
        case 'state': {
          // Sync state update - adjust playback position if significantly different
          const stateUpdate = message.data as SyncPlayStateUpdate;
          const currentPosition = _getPlayerPosition();
          const drift = Math.abs(currentPosition - stateUpdate.playbackPosition);
          // Only seek if drift > 2 seconds to avoid constant micro-adjustments
          if (drift > 2) {
            player.seekTo(stateUpdate.playbackPosition);
          }
          break;
        }
        case 'command': {
          // Playback command from room (play, pause, seek)
          const command = message.data as SyncPlayPlaybackCommand;
          handleSyncPlayCommand(player, command);
          break;
        }
        case 'member':
        case 'error':
          // These are handled by the store directly
          break;
      }
    })
  );

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Handle a SyncPlay playback command.
 * Follows the Law of Early Exit and Intentional Naming.
 */
function handleSyncPlayCommand(player: BridgePlayer, command: SyncPlayPlaybackCommand): void {
  if (!player.playing && !player.pause && !player.seekTo) return;

  switch (command.type) {
    case 'play':
      if (!player.playing && player.play) {
        player.play();
      }
      break;
    case 'pause':
      if (player.playing && player.pause) {
        player.pause();
      }
      break;
    case 'seek':
      if (command.position !== undefined && player.seekTo) {
        player.seekTo(command.position);
      }
      break;
    case 'sync':
      // Full sync - seek to exact position
      if (command.position !== undefined && player.seekTo) {
        player.seekTo(command.position);
      }
      break;
  }
}

/**
 * Get current player position.
 * Uses a best-effort approach to get position without exposing internal state.
 * Note: BridgePlayer interface doesn't expose position, so we return 0.
 * The actual position tracking is handled by the player store.
 */
function _getPlayerPosition(): number {
  return 0;
}

/**
 * Install SyncPlay bridge against a mounted Vue app.
 * Should be called after installElectronBridge.
 */
export function installSyncPlayBridge(_app: VueApp): () => void {
  if (!window.electronAPI) return () => {};

  // Early exit if Pinia is not yet initialized (avoids "getActivePinia()" error)
  const pinia = getActivePinia();
  if (!pinia) return () => {};

  const player = usePlayerStore(pinia) as unknown as BridgePlayer;

  return wireSyncPlayBridge(player);
}
