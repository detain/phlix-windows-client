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
  currentItem: null
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
});
