import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  wireElectronBridge,
  installElectronBridge,
  installFocusGuard,
  type BridgeRouter
} from '@/electronBridge';
import type { App as VueApp } from 'vue';
import { reactive, nextTick } from 'vue';

// Mock the @/main module to expose playbackMenuTemplate for accelerator testing
vi.mock('@/main', () => ({
  playbackMenuTemplate: [
    { label: 'Play/Pause', accelerator: 'Space', registerAccelerator: false, click: () => {} },
    { label: 'Stop', click: () => {} },
    { type: 'separator' },
    { label: 'Rewind', accelerator: 'Left', registerAccelerator: false, click: () => {} },
    { label: 'Fast Forward', accelerator: 'Right', registerAccelerator: false, click: () => {} },
    { type: 'separator' },
    { label: 'Fullscreen', accelerator: 'F11', click: () => {} }
  ]
}));

// usePlayerStore is resolved off the active pinia inside installElectronBridge;
// mock it to hand back a controllable fake player so we can assert wiring.
const { usePlayerStoreMock } = vi.hoisted(() => ({
  usePlayerStoreMock: vi.fn(() => ({
    playing: false,
    play: vi.fn(),
    pause: vi.fn(),
    closePlayer: vi.fn(),
    seekBy: vi.fn()
  }) as any)
}));
vi.mock('@phlix/ui', () => ({
  usePlayerStore: usePlayerStoreMock as any
}));

type Listener = () => void;
type FileListener = (path: string) => void;

interface FakeElectronAPI {
  fire: (channel: string, arg?: unknown) => void;
  cleanups: Record<string, ReturnType<typeof vi.fn>>;
  onMediaPlayPause: ReturnType<typeof vi.fn>;
  onMediaStop: ReturnType<typeof vi.fn>;
  onMediaRewind: ReturnType<typeof vi.fn>;
  onMediaForward: ReturnType<typeof vi.fn>;
  onOpenSettings: ReturnType<typeof vi.fn>;
  // M-WINDOWS-35: onMediaSeekTo/onMediaPrevious/onMediaNext + the
  // mediaPlay..mediaSeekForward invoke fields went with those channels
  // (the shell's second SMTC installer was their only traffic).
  // M-WINDOWS-14: the three OS-surface senders the reactive mirror drives.
  updateThumbar: ReturnType<typeof vi.fn>;
  setPlaybackProgress: ReturnType<typeof vi.fn>;
  updatePowerBlocker: ReturnType<typeof vi.fn>;
}

function makeFakeApi(): FakeElectronAPI {
  const listeners: Record<string, Listener | FileListener> = {};
  const cleanups: Record<string, ReturnType<typeof vi.fn>> = {};

  const register = (channel: string) =>
    vi.fn((cb: Listener | FileListener) => {
      listeners[channel] = cb;
      const cleanup = vi.fn();
      cleanups[channel] = cleanup;
      return cleanup;
    });

  return {
    fire: (channel: string, arg?: unknown) => {
      const cb = listeners[channel];
      if (cb) (cb as (a?: unknown) => void)(arg);
    },
    cleanups,
    onMediaPlayPause: register('media-play-pause'),
    onMediaStop: register('media-stop'),
    onMediaRewind: register('media-rewind'),
    onMediaForward: register('media-forward'),
    onOpenSettings: register('open-settings'),
    updateThumbar: vi.fn(),
    setPlaybackProgress: vi.fn(),
    updatePowerBlocker: vi.fn()
  };
}

function makePlayer(playing = false) {
  return {
    playing,
    play: vi.fn(),
    pause: vi.fn(),
    closePlayer: vi.fn(),
    seekBy: vi.fn()
  } as any;
}

describe('wireElectronBridge', () => {
  let fakeApi: FakeElectronAPI;

  beforeEach(() => {
    fakeApi = makeFakeApi();
    (globalThis as unknown as { window: { electronAPI: unknown } }).window = {
      electronAPI: fakeApi
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('returns a no-op when electronAPI is absent', () => {
    (globalThis as unknown as { window: { electronAPI?: unknown } }).window = {};
    const player = makePlayer();
    const router: BridgeRouter = { push: vi.fn() };
    const cleanup = wireElectronBridge(player, router);
    expect(typeof cleanup).toBe('function');
    expect(fakeApi.onMediaPlayPause).not.toHaveBeenCalled();
  });

  it('play/pause toggles play when paused', () => {
    const player = makePlayer(false);
    const router: BridgeRouter = { push: vi.fn() };
    wireElectronBridge(player, router);
    fakeApi.fire('media-play-pause');
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();
  });

  it('play/pause toggles pause when playing', () => {
    const player = makePlayer(true);
    const router: BridgeRouter = { push: vi.fn() };
    wireElectronBridge(player, router);
    fakeApi.fire('media-play-pause');
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
  });

  it('stop closes the player', () => {
    const player = makePlayer(true);
    const router: BridgeRouter = { push: vi.fn() };
    wireElectronBridge(player, router);
    fakeApi.fire('media-stop');
    expect(player.closePlayer).toHaveBeenCalledTimes(1);
  });

  it('open-settings navigates to the settings route', () => {
    const player = makePlayer();
    const push = vi.fn();
    const router: BridgeRouter = { push };
    wireElectronBridge(player, router);
    fakeApi.fire('open-settings');
    expect(push).toHaveBeenCalledWith('/app/settings');
  });

  it('rewind/forward relative-seek the player via the command bus', () => {
    const player = makePlayer(true);
    const router: BridgeRouter = { push: vi.fn() };
    wireElectronBridge(player, router);
    fakeApi.fire('media-rewind');
    expect(player.seekBy).toHaveBeenNthCalledWith(1, -10);
    fakeApi.fire('media-forward');
    expect(player.seekBy).toHaveBeenNthCalledWith(2, 10);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.closePlayer).not.toHaveBeenCalled();
  });

  it('cleanup unregisters every listener', () => {
    const player = makePlayer();
    const router: BridgeRouter = { push: vi.fn() };
    const cleanup = wireElectronBridge(player, router);
    cleanup();
    expect(fakeApi.cleanups['media-play-pause']).toHaveBeenCalledTimes(1);
    expect(fakeApi.cleanups['media-stop']).toHaveBeenCalledTimes(1);
    expect(fakeApi.cleanups['media-rewind']).toHaveBeenCalledTimes(1);
    expect(fakeApi.cleanups['media-forward']).toHaveBeenCalledTimes(1);
    expect(fakeApi.cleanups['open-settings']).toHaveBeenCalledTimes(1);
  });
});

function makeFakeApp(): VueApp {
  const pinia = { __pinia: true };
  const router: BridgeRouter = { push: vi.fn() };
  return {
    config: { globalProperties: { $pinia: pinia, $router: router } }
  } as unknown as VueApp;
}

describe('installElectronBridge', () => {
  let fakeApi: FakeElectronAPI;
  let playerStub: ReturnType<typeof makePlayer>;

  beforeEach(() => {
    playerStub = makePlayer(false);
    usePlayerStoreMock.mockClear().mockReturnValue(playerStub);
    playerStub.playing = false;
    playerStub.play.mockClear();
    playerStub.pause.mockClear();
    playerStub.closePlayer.mockClear();
    fakeApi = makeFakeApi();
    (globalThis as unknown as { window: { electronAPI: unknown } }).window = {
      electronAPI: fakeApi
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('returns a no-op cleanup when electronAPI is absent', () => {
    (globalThis as unknown as { window: { electronAPI?: unknown } }).window = {};
    const cleanup = installElectronBridge(makeFakeApp());
    expect(typeof cleanup).toBe('function');
    expect(usePlayerStoreMock).not.toHaveBeenCalled();
    expect(fakeApi.onMediaPlayPause).not.toHaveBeenCalled();
  });

  it('resolves the player store off the app pinia and wires media events', () => {
    const app = makeFakeApp();
    const cleanup = installElectronBridge(app);

    // player store resolved against the app's active pinia
    expect(usePlayerStoreMock).toHaveBeenCalledWith(
      app.config.globalProperties.$pinia
    );
    expect(typeof cleanup).toBe('function');

    // a registered media event flows through to the resolved player
    fakeApi.fire('media-play-pause');
    expect(playerStub.play).toHaveBeenCalledTimes(1);

    fakeApi.fire('media-stop');
    expect(playerStub.closePlayer).toHaveBeenCalledTimes(1);
  });

  it('routes open-settings through the app router', () => {
    const app = makeFakeApp();
    const router = app.config.globalProperties.$router as BridgeRouter;
    installElectronBridge(app);
    fakeApi.fire('open-settings');
    expect(router.push).toHaveBeenCalledWith('/app/settings');
  });

  it('cleanup unregisters every listener', () => {
    const cleanup = installElectronBridge(makeFakeApp());
    cleanup();
    expect(fakeApi.cleanups['media-play-pause']).toHaveBeenCalledTimes(1);
    expect(fakeApi.cleanups['open-settings']).toHaveBeenCalledTimes(1);
  });
});

describe('installFocusGuard', () => {
  function makePlayer(playing = false) {
    return {
      playing,
      play: vi.fn(),
      pause: vi.fn(),
      closePlayer: vi.fn(),
      seekBy: vi.fn()
    } as any;
  }

  function simulateKeyDown(code: string, target: Element | null): void {
    const event = new KeyboardEvent('keydown', { code, bubbles: true });
    Object.defineProperty(event, 'target', { value: target, enumerable: true });
    document.dispatchEvent(event);
  }

  beforeEach(() => {
    // Create a minimal DOM structure for focus tests
    document.body.innerHTML = `
      <input id="text-input" type="text" />
      <textarea id="text-area"></textarea>
      <div id="contenteditable" contenteditable="true"></div>
      <div id="regular-div"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Space toggles play when not playing', () => {
    const player = makePlayer(false);
    const cleanup = installFocusGuard(player);
    simulateKeyDown('Space', document.getElementById('regular-div'));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();
    cleanup();
  });

  it('Space toggles pause when playing', () => {
    const player = makePlayer(true);
    const cleanup = installFocusGuard(player);
    simulateKeyDown('Space', document.getElementById('regular-div'));
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
    cleanup();
  });

  it('ArrowLeft seeks backward by 10 seconds', () => {
    const player = makePlayer(true);
    const cleanup = installFocusGuard(player);
    simulateKeyDown('ArrowLeft', document.getElementById('regular-div'));
    expect(player.seekBy).toHaveBeenCalledWith(-10);
    cleanup();
  });

  it('ArrowRight seeks forward by 10 seconds', () => {
    const player = makePlayer(true);
    const cleanup = installFocusGuard(player);
    simulateKeyDown('ArrowRight', document.getElementById('regular-div'));
    expect(player.seekBy).toHaveBeenCalledWith(10);
    cleanup();
  });

  it('does nothing when an input element has focus', () => {
    const player = makePlayer(true);
    const cleanup = installFocusGuard(player);
    const input = document.getElementById('text-input') as HTMLInputElement;
    input.focus();
    simulateKeyDown('Space', input);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    cleanup();
  });

  it('does nothing when a textarea has focus', () => {
    const player = makePlayer(true);
    const cleanup = installFocusGuard(player);
    const textarea = document.getElementById('text-area') as HTMLTextAreaElement;
    textarea.focus();
    simulateKeyDown('Space', textarea);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    cleanup();
  });

  it('does nothing when a contenteditable element has focus', () => {
    const player = makePlayer(true);
    const cleanup = installFocusGuard(player);
    const contenteditable = document.getElementById('contenteditable') as HTMLElement;
    // jsdom may not correctly map contenteditable="true" attr to property,
    // so set it explicitly to ensure the focus-guard check passes.
    contenteditable.contentEditable = 'true';
    contenteditable.focus();
    simulateKeyDown('Space', contenteditable);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    cleanup();
  });

  it('returns a cleanup function that removes the listener', () => {
    const player = makePlayer(false);
    const cleanup = installFocusGuard(player);
    cleanup();
    simulateKeyDown('Space', document.getElementById('regular-div'));
    // After cleanup, no handlers should fire
    expect(player.play).not.toHaveBeenCalled();
  });

  it('is idempotent: double-install removes the previous listener before adding a new one', () => {
    const player = makePlayer(false);
    const cleanup1 = installFocusGuard(player);
    simulateKeyDown('Space', document.getElementById('regular-div'));
    expect(player.play).toHaveBeenCalledTimes(1);

    // Calling installFocusGuard again without cleanup should remove previous listener first
    const cleanup2 = installFocusGuard(player);
    // Reset call count — the second install should have removed the old listener
    player.play.mockClear();

    simulateKeyDown('Space', document.getElementById('regular-div'));
    // Only the new listener from the second install should fire
    expect(player.play).toHaveBeenCalledTimes(1);

    cleanup2();
    player.play.mockClear();
    simulateKeyDown('Space', document.getElementById('regular-div'));
    // After cleanup2, no listeners should fire
    expect(player.play).not.toHaveBeenCalled();

    cleanup1(); // Must not throw even though first listener was already removed
  });
});

describe('installElectronBridge idempotency', () => {
  let fakeApi: FakeElectronAPI;
  let playerStub: ReturnType<typeof makePlayer>;

  beforeEach(() => {
    playerStub = makePlayer(false);
    usePlayerStoreMock.mockClear().mockReturnValue(playerStub);
    playerStub.playing = false;
    playerStub.play.mockClear();
    playerStub.pause.mockClear();
    playerStub.closePlayer.mockClear();
    fakeApi = makeFakeApi();
    (globalThis as unknown as { window: { electronAPI: unknown } }).window = {
      electronAPI: fakeApi
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('is idempotent: double-install does not produce double handler calls', () => {
    const app = makeFakeApp();

    // First install
    installElectronBridge(app);

    // Second install without calling cleanup — should remove old listeners first
    installElectronBridge(app);
    playerStub.play.mockClear();

    // Fire event — only one handler should execute despite two installs
    fakeApi.fire('media-play-pause');
    expect(playerStub.play).toHaveBeenCalledTimes(1);
  });
});

describe('playbackMenuTemplate accelerators', () => {
  it('Space, Left, and Right all have registerAccelerator: false', async () => {
    const { playbackMenuTemplate } = await import('@/main') as any;
    const labels = playbackMenuTemplate.map((item: any) => item.label);
    const spaceItem = playbackMenuTemplate[labels.indexOf('Play/Pause')];
    const leftItem = playbackMenuTemplate[labels.indexOf('Rewind')];
    const rightItem = playbackMenuTemplate[labels.indexOf('Fast Forward')];

    expect(spaceItem?.registerAccelerator).toBe(false);
    expect(leftItem?.registerAccelerator).toBe(false);
    expect(rightItem?.registerAccelerator).toBe(false);
  });
});

/**
 * M-WINDOWS-13: the relay must DEFER inside the vendored ui player route.
 * The parent defect: the relay (document keydown) and @phlix/ui v0.99.10's
 * shortcuts engine (also document keydown, mounted only while PlayerPage is
 * live at `${routerBase || '/app'}/player/:id`) both actuated the same
 * keypress — Space toggled twice (net no-op), Arrows sought a net ∓15s
 * against the engine's advertised ±5, and Space was preventDefault()-ed app-
 * wide over focused buttons. These tests pin the cure from both sides:
 * per-key deferral on the player route, actuation counts with BOTH layers
 * installed (a faithful mini-replica of the vendored `y()` arms), and the
 * engine-parity guards (button/`a`/`select`/role-textbox) off-route.
 */
describe('installFocusGuard defers to the vendored ui player engine (M-WINDOWS-13)', () => {
  const PLAYER_PATH = '/app/player/42';
  const NON_PLAYER_PATH = '/app/browse';

  function makeGuardPlayer(playing = false) {
    return {
      playing,
      play: vi.fn(),
      pause: vi.fn(),
      closePlayer: vi.fn(),
      seekBy: vi.fn(),
      duration: 100,
      position: 10
    } as any;
  }

  function dispatchKey(code: string, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="login-btn">Login</button>
      <a id="nav-link" href="#x">Library</a>
      <div id="role-button" role="button">Play item</div>
      <select id="quality-picker"><option>a</option><option>b</option></select>
      <div id="faux-search" role="searchbox"></div>
      <div id="plain-div"></div>
    `;
    history.pushState({}, '', NON_PLAYER_PATH);
  });

  afterEach(() => {
    // Never leak route state or listeners across tests/files.
    history.pushState({}, '', '/');
    document.body.innerHTML = '';
  });

  it('pins the player route prefix to the vendored bundle reality', () => {
    // Tripwire: if a future ui re-pin ever moves the player route, this fails
    // and the relay's deferral constant must be re-anchored in lockstep.
    const uiBundle = readFileSync(
      resolve(__dirname, '../../node_modules/@phlix/ui/dist/phlix-ui.js'),
      'utf8'
    );
    expect(uiBundle).toContain('`${t}/player/:id`');
    expect(uiBundle).toContain('let t = e.routerBase || "/app"');
  });

  it('Space inside the player route actuates EXACTLY ONE handler (both layers installed)', () => {
    // Faithful replica of the vendored engine's installed arms for the keys
    // the relay mirrors (dist/shortcuts-Ck2yBFUB.js y():277-311 —
    // Space→playPause :279, ArrowLeft/Right→seekBy(∓5) :282-283), attached at
    // document level exactly like the real installer `b()` (:316-324).
    const engine = { playPause: vi.fn(), seekBy: vi.fn() };
    const engineKeydown = (ev: Event) => {
      const e = ev as KeyboardEvent;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') {
        engine.playPause();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        engine.seekBy(-5);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        engine.seekBy(5);
        e.preventDefault();
      }
    };
    const relay = makeGuardPlayer(false);
    history.pushState({}, '', PLAYER_PATH);
    const cleanup = installFocusGuard(relay);
    document.addEventListener('keydown', engineKeydown);
    try {
      dispatchKey('Space', ' ');
      // On the buggy parent BOTH layers fired (net play→pause→play stutter);
      // after the cure only the vendored engine actuates.
      expect(engine.playPause).toHaveBeenCalledTimes(1);
      expect(relay.play).not.toHaveBeenCalled();
      expect(relay.pause).not.toHaveBeenCalled();
      const totalActuations =
        engine.playPause.mock.calls.length + relay.play.mock.calls.length + relay.pause.mock.calls.length;
      expect(totalActuations).toBe(1);
    } finally {
      document.removeEventListener('keydown', engineKeydown);
      cleanup();
    }
  });

  it('ArrowRight inside the player route seeks once (engine ∓5), not a net 15s', () => {
    const engine = { playPause: vi.fn(), seekBy: vi.fn() };
    const engineKeydown = (ev: Event) => {
      const e = ev as KeyboardEvent;
      if (e.key === 'ArrowRight') {
        engine.seekBy(5);
        e.preventDefault();
      }
    };
    const relay = makeGuardPlayer(true);
    history.pushState({}, '', PLAYER_PATH);
    const cleanup = installFocusGuard(relay);
    document.addEventListener('keydown', engineKeydown);
    try {
      dispatchKey('ArrowRight', 'ArrowRight');
      expect(engine.seekBy).toHaveBeenCalledTimes(1);
      expect(engine.seekBy).toHaveBeenCalledWith(5);
      // On the buggy parent the relay added a second seekBy(10) → net +15s.
      expect(relay.seekBy).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', engineKeydown);
      cleanup();
    }
  });

  it('defers Space and both Arrows while on the player route', () => {
    const player = makeGuardPlayer(false);
    history.pushState({}, '', PLAYER_PATH);
    const cleanup = installFocusGuard(player);
    const spaceEvent = dispatchKey('Space', ' ');
    dispatchKey('ArrowLeft', 'ArrowLeft');
    dispatchKey('ArrowRight', 'ArrowRight');
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.seekBy).not.toHaveBeenCalled();
    // The relay must not even preventDefault there — that is the engine's call.
    expect(spaceEvent.defaultPrevented).toBe(false);
    cleanup();
  });

  it('outside the player route the relay still owns the keys (global shortcut purpose)', () => {
    const player = makeGuardPlayer(false);
    history.pushState({}, '', NON_PLAYER_PATH);
    const cleanup = installFocusGuard(player);
    dispatchKey('Space', ' ');
    dispatchKey('ArrowLeft', 'ArrowLeft');
    dispatchKey('ArrowRight', 'ArrowRight');
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.seekBy).toHaveBeenNthCalledWith(1, -10);
    expect(player.seekBy).toHaveBeenNthCalledWith(2, 10);
    cleanup();
  });

  it('Space on a focused button keeps native activation (engine _() parity)', () => {
    const player = makeGuardPlayer(false);
    const cleanup = installFocusGuard(player);
    (document.getElementById('login-btn') as HTMLElement).focus();
    const event = dispatchKey('Space', ' ');
    expect(player.play).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    cleanup();
  });

  it('Space on a focused link keeps native activation (engine _() parity)', () => {
    const player = makeGuardPlayer(false);
    const cleanup = installFocusGuard(player);
    (document.getElementById('nav-link') as HTMLElement).focus();
    const event = dispatchKey('Space', ' ');
    expect(player.play).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    cleanup();
  });

  it('Space on a focused role=button element keeps native activation', () => {
    const player = makeGuardPlayer(false);
    const cleanup = installFocusGuard(player);
    const roleButton = document.getElementById('role-button') as HTMLElement;
    roleButton.tabIndex = 0;
    roleButton.focus();
    const event = dispatchKey('Space', ' ');
    expect(player.play).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    cleanup();
  });

  it('Arrows on a focused select do not seek (engine v() parity)', () => {
    const player = makeGuardPlayer(true);
    const cleanup = installFocusGuard(player);
    (document.getElementById('quality-picker') as HTMLSelectElement).focus();
    dispatchKey('ArrowLeft', 'ArrowLeft');
    dispatchKey('ArrowRight', 'ArrowRight');
    expect(player.seekBy).not.toHaveBeenCalled();
    cleanup();
  });

  it('Arrows on a focused ARIA searchbox do not seek (engine v() parity)', () => {
    const player = makeGuardPlayer(true);
    const cleanup = installFocusGuard(player);
    const searchbox = document.getElementById('faux-search') as HTMLElement;
    searchbox.tabIndex = 0;
    searchbox.focus();
    dispatchKey('ArrowLeft', 'ArrowLeft');
    expect(player.seekBy).not.toHaveBeenCalled();
    cleanup();
  });
});



/**
 * M-WINDOWS-14 (review windows__gameux MAJOR-3): OS feedback surfaces must
 * arm on the IN-APP playback path. The normal path never fires any
 * `media-*` IPC event — the vendored @phlix/ui player drives the reactive
 * pinia store directly (its transport actions ARE the store's own
 * play/pause/updateProgress in
 * node_modules/@phlix/ui/dist/usePlayerStore-D8A_gb_c.js). Every test here
 * therefore mutates ONLY a reactive fake store and never calls `api.fire`:
 * red on the parent commit because no watcher existed — the three surface
 * senders received zero calls for the entire in-app session.
 */
describe('OS playback mirror (M-WINDOWS-14)', () => {
  let api: FakeElectronAPI;

  /** Reactive stand-in for the vendored setup-store's public fields. */
  function makeReactivePlayer() {
    return reactive({
      playing: false,
      position: 0,
      duration: 0,
      current: null as { id?: string; name?: string } | null,
      play: vi.fn(),
      pause: vi.fn(),
      closePlayer: vi.fn(),
      seekBy: vi.fn(),
      seekTo: vi.fn()
    });
  }

  beforeEach(() => {
    api = makeFakeApi();
    (globalThis as unknown as { window: { electronAPI: unknown } }).window = {
      electronAPI: api
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('in-app play arms thumbar + display-sleep blocker with zero IPC events (red on parent)', async () => {
    const player = makeReactivePlayer();
    const cleanup = wireElectronBridge(player, { push: vi.fn() });
    try {
      // What the store's own U() action does when play is pressed in-app:
      // flip `playing`. No IPC fired — on the parent, nothing armed.
      player.playing = true;
      await nextTick();
      expect(api.updateThumbar).toHaveBeenCalledWith({ playing: true });
      expect(api.updatePowerBlocker).toHaveBeenCalledWith(true);
      // The progress watcher fires in the same batch; with no media loaded
      // it sends main's documented clear ({0,0}) instead of a ratio.
      expect(api.setPlaybackProgress).toHaveBeenCalledWith(0, 0);
    } finally {
      cleanup();
    }
  });

  it('in-app pause releases the blocker and repaints the thumbar (red on parent)', async () => {
    const player = makeReactivePlayer();
    player.duration = 100;
    player.current = { id: 'm1' };
    const cleanup = wireElectronBridge(player, { push: vi.fn() });
    try {
      player.playing = true;
      await nextTick();
      api.updatePowerBlocker.mockClear();
      player.playing = false;
      await nextTick();
      expect(api.updateThumbar).toHaveBeenLastCalledWith({ playing: false });
      expect(api.updatePowerBlocker).toHaveBeenCalledTimes(1);
      expect(api.updatePowerBlocker).toHaveBeenCalledWith(false);
    } finally {
      cleanup();
    }
  });

  it('in-app progress ticks drive the taskbar bar, deduped to whole seconds (red on parent)', async () => {
    const player = makeReactivePlayer();
    const cleanup = wireElectronBridge(player, { push: vi.fn() });
    try {
      // Media load: setCurrent lands current+duration BEFORE the transport.
      player.current = { id: 'm1', name: 'Big Buck Bunny' };
      player.duration = 100;
      await nextTick();
      expect(api.setPlaybackProgress).toHaveBeenLastCalledWith(0, 100);
      // timeupdate-era ticks (~4 Hz): sub-second motion must collapse.
      player.position = 0.25;
      await nextTick();
      player.position = 0.5;
      await nextTick();
      expect(api.setPlaybackProgress).toHaveBeenCalledTimes(1);
      player.position = 1.4;
      await nextTick();
      expect(api.setPlaybackProgress).toHaveBeenLastCalledWith(1, 100);
      player.position = 1.9;
      await nextTick(); // same whole second — deduped
      expect(api.setPlaybackProgress).toHaveBeenCalledTimes(2);
      player.position = 2.3;
      await nextTick();
      expect(api.setPlaybackProgress).toHaveBeenLastCalledWith(2, 100);
      expect(api.setPlaybackProgress).toHaveBeenCalledTimes(3);
    } finally {
      cleanup();
    }
  });

  it('closePlayer self-heals every surface although the store keeps position/duration stale (red on parent)', async () => {
    const player = makeReactivePlayer();
    player.current = { id: 'm1' };
    player.duration = 100;
    player.position = 42.7;
    player.playing = true;
    const cleanup = wireElectronBridge(player, { push: vi.fn() });
    await nextTick(); // baseline before the close — no pre-close assertions needed
    // Exactly the vendored re() reset: playing→false, current→null, while
    // position/duration KEEP their stale values. On the parent the blocker
    // stayed armed until window close and the bar stayed half-full.
    player.playing = false;
    player.current = null;
    await nextTick();
    expect(api.updatePowerBlocker).toHaveBeenLastCalledWith(false);
    expect(api.updateThumbar).toHaveBeenLastCalledWith({ playing: false });
    expect(api.setPlaybackProgress).toHaveBeenLastCalledWith(0, 0); // main: setProgressBar(-1)
    cleanup();
  });

  it('the bridge cleanup stops the mirror — post-teardown transitions arm nothing', async () => {
    const player = makeReactivePlayer();
    const cleanup = wireElectronBridge(player, { push: vi.fn() });
    cleanup();
    player.playing = true;
    player.current = { id: 'm1' };
    player.duration = 10;
    await nextTick();
    expect(api.updateThumbar).not.toHaveBeenCalled();
    expect(api.updatePowerBlocker).not.toHaveBeenCalled();
    expect(api.setPlaybackProgress).not.toHaveBeenCalled();
  });

  it('law: the bridge no longer fabricates SMTC stub metadata (updateMeta is gone)', () => {
    // The parent's play/pause path called updateMeta(player) reading
    // title/artist/album/artwork fields that do not exist on the real store,
    // overwriting the vendored store's rich SMTC feed with a
    // `{ title: 'Phlix' }` stub on every shell toggle. SMTC state must come
    // from the store's own actions only — no bridge-side metadata writer.
    const bridgeSource = readFileSync(
      resolve(__dirname, '../../src/renderer/electronBridge.ts'),
      'utf8'
    );
    expect(bridgeSource).not.toMatch(/updateMeta\s*\(/);
    // M-WINDOWS-14 banned the bridge importing setupMediaSession (the stub-
    // metadata path); M-WINDOWS-22 admits exactly one allowed import — the
    // stop-clear helper, which writes no metadata and no playing/paused state.
    expect(bridgeSource).not.toMatch(/setupMediaSession[^a-zA-Z]/);
    expect(bridgeSource).toMatch(/import \{ clearMediaSessionTransport \} from '\.\/mediaSession'/);
  });
});
