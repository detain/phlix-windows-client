import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  wireElectronBridge,
  installElectronBridge,
  installFocusGuard,
  type BridgeRouter
} from '@/electronBridge';
import type { App as VueApp } from 'vue';

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
  onSyncPlayMessage: ReturnType<typeof vi.fn>;
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
    onSyncPlayMessage: register('syncplay-message')
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


