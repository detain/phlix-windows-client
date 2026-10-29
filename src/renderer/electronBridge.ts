/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { usePlayerStore } from '@phlix/ui';
import type { App as VueApp } from 'vue';
import { updateMeta } from './mediaSession';
import log from 'electron-log';

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
  /** Track title for SMTC metadata. */
  title?: string;
  /** Track artist for SMTC metadata. */
  artist?: string;
  /** Album name for SMTC metadata. */
  album?: string;
  /** Album artwork for SMTC metadata. */
  artwork?: { src: string }[];
}

export interface BridgeRouter {
  push: (to: string) => unknown;
}

/** Seconds the tray/menu Rewind & Fast-Forward controls jump. */
const SEEK_STEP_SECONDS = 10;

/**
 * Returns true when the player has media loaded and is ready to accept
 * play/pause/seek commands (duration > 0 means a track is loaded).
 * Guards against sending commands to a closed player.
 */
function playerCanControl(player: BridgePlayer): boolean {
  if (!player || player.duration <= 0) {
    log.warn('[electronBridge] Player not ready — ignoring media command');
    return false;
  }
  return true;
}

/** Module-level cleanup references for idempotency. */
let _cleanupBridge: (() => void) | null = null;
let _cleanupFocusGuard: (() => void) | null = null;

/**
 * Path prefix of the vendored ui player route. The @phlix/ui router table
 * builds it as `${routerBase || "/app"}/player/:id` (v0.99.10
 * dist/phlix-ui.js route "player"); this app never overrides routerBase and
 * its history base is '/', so the live pathname mirrors the route path.
 */
const PLAYER_ROUTE_PREFIX = '/app/player/';

/**
 * Returns true when the given element is a text-entry control that should
 * consume keydown events without relaying them to the media-bridge. Mirrors
 * the vendored engine's text guard (`v()`, @phlix/ui v0.99.10
 * dist/shortcuts-Ck2yBFUB.js:269-276): INPUT/TEXTAREA/SELECT, contentEditable,
 * and ARIA textbox/searchbox roles all keep their own arrow/space typing.
 */
function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  const role = el.getAttribute('role');
  if (role === 'textbox' || role === 'searchbox') return true;
  // contentEditable is 'true' when explicitly set; 'inherit' means the
  // element inherits from its parent (and is not in edit mode by default).
  const ce = (el as HTMLElement).contentEditable;
  return ce === 'true' || ce === 'plaintext-only';
}

/**
 * Returns true when Space on the focused element must keep its NATIVE
 * activation behavior instead of becoming a transport toggle. Mirrors the
 * vendored engine's button guard (`_()`, dist/shortcuts-Ck2yBFUB.js:263-267:
 * `button`, `a`, or `role="button"` skip the Space arm) — without it, a
 * focused "Login"/"Connect" button would be preventDefault()-ed into playing
 * media instead of activating. Applied to Space only, exactly like the engine.
 */
function isButtonActivation(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button';
}

/**
 * Installs a document-wide keydown listener that bridges Space / Left / Right
 * to the player for GLOBAL shortcuts — the Playback menu ships those keys with
 * `registerAccelerator: false` by design, so this relay is the only keyboard
 * path outside the player page.
 *
 * Trust boundary (M-WINDOWS-13): the vendored @phlix/ui bundle owns these keys
 * on its own player page. Its engine installs a second document-level keydown
 * listener while PlayerPage is mounted (v0.99.10 dist/PlayerPage-BAxWiTto.js
 * :2740-2767 → installer `b()`, dist/shortcuts-Ck2yBFUB.js:316-324; dispatch
 * `y()` :277-311 — Space → playPause :279, ArrowLeft/Right → seekBy(∓5)
 * :282-283). Both listeners fire on the same event (document-level bubble
 * listeners cannot see each other), so inside the player route one physical
 * keypress would actuate both: Space toggles play→pause→play (stuttered
 * no-op) and Arrows seek a net ∓15s (relay ∓10 + engine ∓5) against a help
 * table that advertises ±5. Inside `/app/player/*` the vendored engine is
 * therefore the SOLE keyboard authority and this relay defers entirely —
 * including while the engine deliberately disarms its own keys (shortcut-help
 * overlay / modals gate its `enabled()`); outside that route the engine is
 * unmounted and the relay acts.
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
    // Inside the ui player route its vendored keyboard engine acts on these
    // exact keys; relaying too is the M2 double-dispatch defect. Defer first.
    // (Bare `location`, not `window.location`: the route is a global-level
    // fact and must not depend on the `window` binding, which unit tests and
    // dev/browser contexts reshape freely.)
    if (location.pathname.startsWith(PLAYER_ROUTE_PREFIX)) return;

    if (isTextInput(document.activeElement)) return;

    switch (e.code) {
      case 'Space':
        // Focused button/link keeps native Space activation (engine parity).
        if (isButtonActivation(document.activeElement)) return;
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
      if (!playerCanControl(player)) return;
      if (willBePlaying) {
        player.play();
      } else {
        player.pause();
      }
      // Update thumbar with the known target state (not the potentially-stale player.playing)
      api.updateThumbar?.({ playing: willBePlaying });
      api.setPlaybackProgress?.(player.position, player.duration);
      // W4.6: block display sleep when playing
      api.updatePowerBlocker?.(willBePlaying);
      // W4.5: update SMTC metadata
      updateMeta(player);
    })
  );

  cleanups.push(
    api.onMediaStop(() => {
      player.closePlayer();
    })
  );

  cleanups.push(
    api.onMediaRewind(() => {
      if (!playerCanControl(player)) return;
      player.seekBy(-SEEK_STEP_SECONDS);
      // W4.5: position changed — update progress bar
      api.setPlaybackProgress?.(player.position, player.duration);
    })
  );

  cleanups.push(
    api.onMediaForward(() => {
      if (!playerCanControl(player)) return;
      player.seekBy(SEEK_STEP_SECONDS);
      // W4.5: position changed — update progress bar
      api.setPlaybackProgress?.(player.position, player.duration);
    })
  );

  cleanups.push(
    api.onMediaSeekTo((time: number) => {
      if (!playerCanControl(player)) return;
      player.seekTo(time);
      // W4.5: position changed — update progress bar
      api.setPlaybackProgress?.(player.position, player.duration);
    })
  );

  cleanups.push(
    api.onOpenSettings(() => {
      router.push('/app/settings');
    })
  );

  // W4.5: SMTC previous/next track handlers (no-op — playlist management is in @phlix/ui)
  cleanups.push(
    api.onMediaPrevious(() => {
      log.info('[electronBridge] media-previous received (no-op: playlist in @phlix/ui)');
    })
  );

  cleanups.push(
    api.onMediaNext(() => {
      log.info('[electronBridge] media-next received (no-op: playlist in @phlix/ui)');
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
