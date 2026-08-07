/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PiPButton from '@/components/PiPButton';

// Mock usePlayerStore
const mockPlayer = {
  playing: false,
  currentItem: null as any
};

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
    mockPlayer.currentItem = 'item-2';

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
