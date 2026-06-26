import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  wireElectronBridge,
  installElectronBridge,
  type BridgePlayer,
  type BridgeRouter
} from '@/electronBridge';
import type { App as VueApp } from 'vue';

// usePlayerStore is resolved off the active pinia inside installElectronBridge;
// mock it to hand back a controllable fake player so we can assert wiring.
const playerStub: BridgePlayer & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  closePlayer: ReturnType<typeof vi.fn>;
} = {
  playing: false,
  play: vi.fn(),
  pause: vi.fn(),
  closePlayer: vi.fn()
};
const usePlayerStoreMock = vi.fn(() => playerStub);
vi.mock('@phlix/ui', () => ({
  usePlayerStore: (...args: unknown[]) => usePlayerStoreMock(...args)
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
  onFileOpened: ReturnType<typeof vi.fn>;
  onOpenSettings: ReturnType<typeof vi.fn>;
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
    onFileOpened: register('file-opened'),
    onOpenSettings: register('open-settings')
  };
}

function makePlayer(playing = false): BridgePlayer & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  closePlayer: ReturnType<typeof vi.fn>;
} {
  return {
    playing,
    play: vi.fn(),
    pause: vi.fn(),
    closePlayer: vi.fn()
  };
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

  it('rewind/forward/file-opened are safe no-ops (no player mutation)', () => {
    const player = makePlayer(true);
    const router: BridgeRouter = { push: vi.fn() };
    wireElectronBridge(player, router);
    fakeApi.fire('media-rewind');
    fakeApi.fire('media-forward');
    fakeApi.fire('file-opened', 'C:/movie.mkv');
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
    expect(fakeApi.cleanups['file-opened']).toHaveBeenCalledTimes(1);
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

  beforeEach(() => {
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
