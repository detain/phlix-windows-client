import { usePlayerStore } from '@phlix/ui';
import type { App as VueApp } from 'vue';

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
