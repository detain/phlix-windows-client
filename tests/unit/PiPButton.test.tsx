/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import PiPButton, { peekPiPVideoCache } from '@/components/PiPButton';

// Mock usePlayerStore — reactive so the component's watchers (auto-PiP on play,
// per-item listener re-sync) observe state transitions the same way they do
// against the real Pinia store. Field names come from the REAL vendored surface
// at pin #v0.99.27 (chunk usePlayerStore-BpohCwDP.js byte-ident across the .26→.27 bump —
// name and coords re-verified 2026-11-11): the setup-store return in
// node_modules/@phlix/ui/dist/usePlayerStore-BpohCwDP.js (:213+, typed in
// dist/stores/usePlayerStore.d.ts — Pick list at :417) exposes `current`,
// `playing`, `position`, `duration`, … and `currentItem` appears ZERO times in
// any shipped .js/.cjs/.d.ts. `current` carries the .d.ts required keys
// (id: string, name: string, type: MediaType, poster_url: string | null);
// the mock models that honest shape for the fields these tests exercise.
type MockMediaItem = { id: string; name: string; type: 'movie'; poster_url: string | null };
const mockPlayer = reactive({
  current: null as MockMediaItem | null,
  playing: false,
  position: 0,
  duration: 0
});

vi.mock('@phlix/ui', () => ({
  usePlayerStore: vi.fn(() => mockPlayer)
}));

describe('PiPButton', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when player is not playing', () => {
    mockPlayer.playing = false;
    const wrapper = mount(PiPButton, {
      global: { stubs: { teleport: true } }
    });
    expect(wrapper.html()).toBe('');
  });

  it('handles missing document.pictureInPictureEnabled gracefully', () => {
    mockPlayer.playing = true;

    // Remove the property temporarily
    const originalPiP = (document as any).pictureInPictureEnabled;
    delete (document as any).pictureInPictureEnabled;

    const wrapper = mount(PiPButton, {
      global: { stubs: { teleport: true } }
    });
    expect(wrapper.html()).toBe('');

    // Restore
    (document as any).pictureInPictureEnabled = originalPiP;
  });

  it('does not render when pictureInPictureEnabled is false', () => {
    mockPlayer.playing = true;

    // Mock document.pictureInPictureEnabled as false
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: false,
      configurable: true
    });

    const wrapper = mount(PiPButton, {
      global: { stubs: { teleport: true } }
    });
    expect(wrapper.html()).toBe('');
  });

  it('resolves video element once across multiple state changes without querySelectorAll', () => {
    mockPlayer.playing = true;

    // Create a mock video element
    const mockVideo = document.createElement('video');
    Object.defineProperty(mockVideo, 'readyState', {
      value: 4, // HAVE_ENOUGH_DATA
      writable: false,
      configurable: true
    });
    Object.defineProperty(mockVideo, 'style', {
      value: { display: '' },
      writable: true,
      configurable: true
    });

    // Spy on querySelectorAll to verify it's NOT called
    const querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll');
    // Spy on querySelector to verify it's called
    const querySelectorSpy = vi.spyOn(document, 'querySelector');

    // Mock querySelector to return our video
    querySelectorSpy.mockReturnValue(mockVideo);

    // Mount and trigger multiple state changes
    const wrapper = mount(PiPButton, {
      global: { stubs: { teleport: true } }
    });

    // Trigger state changes that would previously cause re-queries
    mockPlayer.playing = true;
    mockPlayer.current = { id: 'item-2', name: 'item-2', type: 'movie', poster_url: null };

    // Force update
    wrapper.vm.$forceUpdate?.();

    // Verify querySelectorAll was never called
    expect(querySelectorAllSpy).not.toHaveBeenCalled();

    querySelectorSpy.mockRestore();
    querySelectorAllSpy.mockRestore();
  });

  it('does not access offsetParent on the play/pause path', () => {
    mockPlayer.playing = true;

    // Create a mock video element
    const mockVideo = document.createElement('video');
    Object.defineProperty(mockVideo, 'readyState', {
      value: 4,
      writable: false,
      configurable: true
    });
    Object.defineProperty(mockVideo, 'style', {
      value: { display: '' },
      writable: true,
      configurable: true
    });

    // Spy on querySelector
    const querySelectorSpy = vi.spyOn(document, 'querySelector');
    querySelectorSpy.mockReturnValue(mockVideo);

    // Track any access to offsetParent by adding it to the mock
    let offsetParentAccessed = false;
    Object.defineProperty(mockVideo, 'offsetParent', {
      get: () => {
        offsetParentAccessed = true;
        return null;
      },
      configurable: true
    });

    const wrapper = mount(PiPButton, {
      global: { stubs: { teleport: true } }
    });

    // Trigger state changes
    mockPlayer.playing = false;
    mockPlayer.playing = true;
    wrapper.vm.$forceUpdate?.();

    // Verify offsetParent was never accessed
    expect(offsetParentAccessed).toBe(false);

    querySelectorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// w04/L5 (reviews 2026-11-04 casualgamer#3 / gameux#3): the leave law and the
// paused-affordance law. Red-first at 6c4d425c — closing the PiP window with
// its own X left the auto-PiP preference saved, so every later play re-popped
// the window (the auto-reentry trap); and pausing unmounted the button,
// leaving the paused viewer with no PiP affordance to pop the frozen frame out.
// ---------------------------------------------------------------------------
describe('PiPButton leave + pause law (MW-059/MW-060)', () => {
  const STORAGE_KEY = 'phlix-pip-enabled';
  let video: HTMLVideoElement;
  let querySpy: ReturnType<typeof vi.spyOn>;

  function supportPiP(): void {
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: true,
      configurable: true
    });
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: null,
      writable: true,
      configurable: true
    });
  }

  beforeEach(() => {
    localStorage.clear();
    mockPlayer.playing = false;
    mockPlayer.current = null;
    video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    // jsdom ships no PiP surface; stand in for the browser entry point.
    (video as HTMLVideoElement & { requestPictureInPicture: () => Promise<void> }).requestPictureInPicture = vi
      .fn()
      .mockResolvedValue(undefined);
    querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(video);
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  it('closing the PiP window clears the auto-PiP preference (MW-059)', async () => {
    supportPiP();
    localStorage.setItem(STORAGE_KEY, 'true');
    (document as unknown as { pictureInPictureElement: HTMLVideoElement | null }).pictureInPictureElement = video;
    mockPlayer.playing = true;
    mockPlayer.current = { id: 'mw-059', name: 'mw-059', type: 'movie', poster_url: null };
    const wrapper = mount(PiPButton, { global: { stubs: { teleport: true } } });

    // The user presses the PiP window's OWN close button: the browser fires
    // leavepictureinpicture on the video element with no overlay click.
    (document as unknown as { pictureInPictureElement: HTMLVideoElement | null }).pictureInPictureElement = null;
    video.dispatchEvent(new Event('leavepictureinpicture'));
    await nextTick();

    expect(localStorage.getItem(STORAGE_KEY), 'closing the PiP window is an opt-out — the saved preference must not survive it').toBeNull();

    // And the later play must not re-pop the window (the auto-reentry trap).
    mockPlayer.playing = false;
    await nextTick();
    mockPlayer.playing = true;
    await nextTick();

    expect(
      (video as HTMLVideoElement & { requestPictureInPicture: ReturnType<typeof vi.fn> }).requestPictureInPicture,
      'auto-reentry trap: a play after the window was closed must not re-open PiP'
    ).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('keeps the PiP affordance while the video is paused (MW-060)', async () => {
    supportPiP();
    mockPlayer.playing = true;
    mockPlayer.current = { id: 'mw-060', name: 'mw-060', type: 'movie', poster_url: null };
    const wrapper = mount(PiPButton, { global: { stubs: { teleport: true } } });
    await nextTick();

    expect(wrapper.find('button.pip-button').exists(), 'playing: affordance present').toBe(true);

    // Pause — native browser PiP semantics keep the button live for the frozen frame.
    mockPlayer.playing = false;
    await nextTick();
    expect(wrapper.find('button.pip-button').exists(), 'a paused viewer must keep the PiP affordance').toBe(true);

    // Session gone entirely — the affordance must not haunt the overlay.
    mockPlayer.current = null;
    await nextTick();
    expect(wrapper.find('button.pip-button').exists(), 'no media item: affordance hidden').toBe(false);

    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// WIN-11: listener capture + cache release. Cleanup used to re-resolve the
// video via getActiveVideo(), so when the DOM's <video> changed (item swap) or
// the old one went readyState 0 before teardown, the listeners were removed
// from the wrong element (or none) and stayed live on the old one; and the
// module-level cache pinned the detached <video> after unmount.
// ---------------------------------------------------------------------------
describe('PiPButton listener capture + cache release (WIN-11)', () => {
  let querySpy: ReturnType<typeof vi.spyOn>;

  function makeVideo(): HTMLVideoElement {
    const v = document.createElement('video');
    Object.defineProperty(v, 'readyState', { value: 4, configurable: true });
    return v;
  }

  beforeEach(() => {
    localStorage.clear();
    mockPlayer.playing = false;
    mockPlayer.current = null;
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'pictureInPictureElement', { value: null, writable: true, configurable: true });
  });

  afterEach(() => {
    querySpy?.mockRestore();
  });

  it('detaches from the element it attached to when the DOM video changes on item swap', async () => {
    const first = makeVideo();
    const second = makeVideo();
    const removeFirst = vi.spyOn(first, 'removeEventListener');
    const removeSecond = vi.spyOn(second, 'removeEventListener');
    querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(first);
    mockPlayer.current = { id: 'a', name: 'a', type: 'movie', poster_url: null };
    const wrapper = mount(PiPButton, { global: { stubs: { teleport: true } } });

    // The player swaps in a NEW <video> for the next item.
    querySpy.mockReturnValue(second);
    mockPlayer.current = { id: 'b', name: 'b', type: 'movie', poster_url: null };
    await nextTick();

    expect(removeFirst).toHaveBeenCalledWith('enterpictureinpicture', expect.any(Function));
    expect(removeFirst).toHaveBeenCalledWith('leavepictureinpicture', expect.any(Function));
    expect(removeSecond, 'nothing was attached to the new element yet — no stray remove').not.toHaveBeenCalled();

    // The OLD element's events must no longer drive state.
    localStorage.setItem('phlix-pip-enabled', 'true');
    first.dispatchEvent(new Event('leavepictureinpicture'));
    await nextTick();
    expect(localStorage.getItem('phlix-pip-enabled'), 'stale listener on the old video fired').toBe('true');

    // The NEW element's events do.
    second.dispatchEvent(new Event('leavepictureinpicture'));
    await nextTick();
    expect(localStorage.getItem('phlix-pip-enabled')).toBeNull();

    wrapper.unmount();
  });

  it('removes listeners on unmount even when the video is no longer resolvable', async () => {
    const video = makeVideo();
    const removeSpy = vi.spyOn(video, 'removeEventListener');
    querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(video);
    mockPlayer.current = { id: 'c', name: 'c', type: 'movie', poster_url: null };
    const wrapper = mount(PiPButton, { global: { stubs: { teleport: true } } });
    await nextTick();
    // Only the unmount below may count (earlier specs' still-mounted
    // instances re-sync on `current` changes and touch the same spy).
    removeSpy.mockClear();

    // Teardown order: the player emptied the <video> before the overlay unmounts.
    querySpy.mockReturnValue(null);
    wrapper.unmount();

    expect(removeSpy).toHaveBeenCalledWith('enterpictureinpicture', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('leavepictureinpicture', expect.any(Function));
  });

  it('releases the module-level video cache on unmount', async () => {
    const video = makeVideo();
    video.dataset.phlixVideoId = '7';
    querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(video);
    mockPlayer.current = { id: 'd', name: 'd', type: 'movie', poster_url: null };
    const wrapper = mount(PiPButton, { global: { stubs: { teleport: true } } });

    expect(peekPiPVideoCache()).toEqual({ element: video, id: 7 });

    wrapper.unmount();

    expect(peekPiPVideoCache(), 'a detached <video> must not stay pinned after unmount').toEqual({
      element: null,
      id: null
    });
  });
});
