/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { usePlayerStore } from '@phlix/ui';
import type { App as VueApp } from 'vue';
import { watch } from 'vue';
import log from 'electron-log';
import { clearMediaSessionTransport } from './mediaSession';

// Minimal structural types for the pieces of the phlix-ui player store and the
// vue-router instance that the bridge actually touches. Keeping them local makes
// the wiring helper trivially unit-testable with fakes.
//
// M-WINDOWS-14 note: the optional `title`/`artist`/`album`/`artwork` fields
// this interface once declared do NOT exist on the real store
// (node_modules/@phlix/ui/dist/usePlayerStore-D8A_gb_c.js setup-store return) —
// they were the type-level fiction that let the old updateMeta helper
// fabricate a `{ title: 'Phlix' }` SMTC stub. The store itself feeds rich
// metadata via `setCurrent`; removed, and no code path may re-read
// metadata off the store.
export interface BridgePlayer {
  playing: boolean;
  position: number;
  duration: number;
  /**
   * Loaded media (`current` in the vendored store — a media object or null).
   * The OS mirror only reads its null/non-null identity: `closePlayer()`
   * clears it while leaving position/duration stale, so "no media" is the
   * one fact that must come from `current` and never from the numbers.
   */
  current?: { id?: string; name?: string } | null;
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

/**
 * The three renderer→main send channels for the OS feedback surfaces this
 * shell owns (a subset of `window.electronAPI`). Every method is optional by
 * the bridge's long-standing `?.`-call law: the same wiring runs against
 * plain fakes in unit tests and against a missing bridge in a browser dev
 * context, and must stay inert (never throw) in both.
 */
interface OsSurfaceSenders {
  updateThumbar?: (state: { playing: boolean }) => void;
  setPlaybackProgress?: (current: number, total: number) => void;
  updatePowerBlocker?: (playing: boolean) => void;
}

/**
 * M-WINDOWS-14 (review windows__gameux MAJOR-3): mirrors the REACTIVE player
 * store onto every OS feedback surface this shell owns, so they arm on the
 * normal in-app playback path instead of only when the shell itself drove
 * the transport.
 *
 * The seam: all three playback drivers — the vendored `@phlix/ui` player
 * engine (in-app clicks; its play/pause ARE the store's own actions,
 * `usePlayerStore-D8A_gb_c.js` `U()`/`W()`), the tray/menu/SMTC IPC handlers
 * below, and the global keydown relay — mutate the SAME pinia store. Its
 * `playing` / `position` / `duration` / `current` fields are refs, so a
 * `watch` sees every transition from every path. The store is the single
 * source of truth; this mirror never reads intent, only post-mutation state.
 *
 * Surface law:
 * - transitions → `thumbar:update` (tooltip) + `power:update`
 *   (display-sleep blocker; main's `ensurePowerBlocker` is start-once/idempotent).
 * - ticks → `playback:progress` deduped to whole seconds — the ui feeds the
 *   store from `timeupdate` (~4 Hz) while the taskbar overlay is far coarser.
 *   `{0, 0}` is main's documented clear (setProgressBar(-1)); it is sent
 *   whenever `current` is null, which is what makes `closePlayer()` — it
 *   resets playing/current but NOT position/duration — release the blocker,
 *   repaint the thumbar and wipe the stale bar without any stop-specific
 *   calls in the handlers.
 *
 * Shell-driven toggles therefore land a second (identical-value) send from
 * the mirror after the handler's own synchronous send; main's handlers are
 * idempotent by law (button rebuild / isStarted guard / absolute set), and
 * the synchronous sends stay because they arm the surfaces in the same tick
 * as the user action (W4.5 pins in tests/unit/thumbar.test.ts +
 * tests/unit/powerSaveBlocker.test.ts keep that source law).
 *
 * SMTC metadata / playbackState / positionState are deliberately NOT mirrored:
 * the vendored store already feeds them itself on every transition (the very
 * `U()`/`W()`/`setCurrent` actions), for both paths. ONE exception holds the
 * other side (M-WINDOWS-22): the store's feed has no STOP arm — it never
 * clears the transport back to 'none' — so the no-media mirror below calls
 * `clearMediaSessionTransport()` for exactly that gap.
 *
 * Returns a cleanup stopping both watchers; `wireElectronBridge` folds it into
 * its single teardown, so navigation/unmount-style re-install can never leak
 * a duplicate mirror.
 */
function installOsPlaybackMirror(player: BridgePlayer, api: OsSurfaceSenders): () => void {
  const stopTransitions = watch(
    () => player.playing,
    (playing) => {
      api.updateThumbar?.({ playing });
      api.updatePowerBlocker?.(playing);
    }
  );

  let lastWholePosition = -1;
  let lastWholeDuration = -1;
  const stopProgress = watch(
    // `playing` participates so the very start of playback lands the
    // `{0, total}` indeterminate arm without waiting for the first tick.
    () => [player.current, player.playing, player.position, player.duration] as const,
    ([current, , position, duration]) => {
      if (!current) {
        lastWholePosition = -1;
        lastWholeDuration = -1;
        api.setPlaybackProgress?.(0, 0);
        // M-WINDOWS-22: the store's SMTC feed has no STOP arm — it writes
        // playing/paused/position but never clears to 'none'. The shell owns
        // that clear, exactly here, alongside the progress-bar zeroing.
        clearMediaSessionTransport();
        return;
      }
      const wholePosition = Math.floor(position);
      const wholeDuration = Math.floor(duration);
      if (wholePosition === lastWholePosition && wholeDuration === lastWholeDuration) return;
      lastWholePosition = wholePosition;
      lastWholeDuration = wholeDuration;
      api.setPlaybackProgress?.(wholePosition, wholeDuration);
    }
  );

  return () => {
    stopTransitions();
    stopProgress();
  };
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
 * path outside the player page. Only BARE (unmodified) presses are relayed:
 * any ctrl/meta/alt chord defers to the OS/browser, mirroring the engine's
 * own modifier gate (R-WINDOWS-11).
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

    // Engine parity (R-WINDOWS-11): the vendored installer `b()` ignores every
    // chord carrying a ctrl/meta/alt modifier (@phlix/ui v0.99.10
    // dist/shortcuts-Ck2yBFUB.js:318 — `e.ctrlKey || e.metaKey || e.altKey ||
    // v(e.target)`), so inside the player those chords are already free.
    // Off-route the relay was the sole interceptor and hijacked them:
    // Ctrl/Cmd+Arrow (word navigation), Alt+Arrow (history back/forward) and
    // Ctrl/Cmd+Space all became transport actions. The relay now refuses the
    // same modifier set — bare keys only, exactly like the engine. Shift is
    // NOT gated, mirroring the engine's set precisely (an over-gate would
    // diverge the two jurisdictions back apart).
    if (e.ctrlKey || e.metaKey || e.altKey) return;

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
 * and the reactive OS-surface mirror (M-WINDOWS-14,
 * `installOsPlaybackMirror`) against a player store + router and returns a
 * single cleanup function that unregisters every listener and watcher.
 * Accepts the dependencies as params so it can be exercised in tests without
 * a real Vue app or Electron preload bridge.
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
      // M-WINDOWS-14: the old SMTC `updateMeta` call here was removed —
      // the fields it read do not exist on the real store, so every shell
      // toggle overwrote the vendored store's rich SMTC metadata with a
      // fabricated `{ title: 'Phlix' }` stub. SMTC is the store's own feed.
    })
  );

  cleanups.push(
    // M-WINDOWS-14: no explicit surface teardown needed on stop — closePlayer()
    // flips playing→false and current→null, and the mirror below turns exactly
    // those into updateThumbar(pause) + updatePowerBlocker(false) + a
    // {0,0} progress clear. (Parent code armed nothing here: the blocker ran
    // until window close.)
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
    api.onOpenSettings(() => {
      router.push('/app/settings');
    })
  );

  // M-WINDOWS-35: the seek-to / previous / next subscription arms were
  // deleted with their channels — those pushes were produced only by the
  // shell's second SMTC installer (now removed) relaying its own invoke
  // calls, and the prev/next pair were documented no-op log sinks for
  // phantom SMTC buttons the vendored store's gating already prevents.

  // M-WINDOWS-14: the in-app transport never enters any handler above — the
  // vendored player drives the store directly. Mirror the store's reactive
  // state onto the thumbar / display-sleep blocker / taskbar progress so all
  // three arm on the normal playback path too. Teardown rides this function's
  // single cleanup, like every other registration here.
  cleanups.push(installOsPlaybackMirror(player, api));

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
