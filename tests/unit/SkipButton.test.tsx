/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SkipButton from '@/components/SkipButton';

// Mock the @phlix/ui stores
const mockPlayer = {
  playing: true,
  currentTime: 30,
  seekBy: vi.fn(),
  seekTo: vi.fn()
};

const mockMedia = {
  currentItem: {
    id: 'item-1',
    markers: [
      { type: 'intro', start: 0, end: 90 },
      { type: 'outro', start: 3540, end: 3600 }
    ]
  }
};

vi.mock('@phlix/ui', () => ({
  usePlayerStore: vi.fn(() => mockPlayer),
  useMediaStore: vi.fn(() => mockMedia)
}));

describe('SkipButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when not playing', () => {
    mockPlayer.playing = false;
    const wrapper = mount(SkipButton);
    expect(wrapper.html()).toBe('');
  });

  it('renders null when not in a marker window', () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 500; // Not in intro (0-90) or outro (3540-3600)
    mockMedia.currentItem = {
      id: 'item-1',
      markers: [
        { type: 'intro', start: 0, end: 90 },
        { type: 'outro', start: 3540, end: 3600 }
      ]
    };

    const wrapper = mount(SkipButton);
    expect(wrapper.html()).toBe('');
  });

  it('renders skip intro button during intro marker', () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 30; // Within intro (0-90)
    mockMedia.currentItem = {
      id: 'item-1',
      markers: [
        { type: 'intro', start: 0, end: 90 }
      ]
    };

    const wrapper = mount(SkipButton);
    expect(wrapper.find('.player-skip-button').exists()).toBe(true);
    expect(wrapper.text()).toContain('Skip Intro');
  });

  it('renders skip credits button during outro marker', () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 3550; // Within outro (3540-3600)
    mockMedia.currentItem = {
      id: 'item-1',
      markers: [
        { type: 'outro', start: 3540, end: 3600 }
      ]
    };

    const wrapper = mount(SkipButton);
    expect(wrapper.find('.player-skip-button').exists()).toBe(true);
    expect(wrapper.text()).toContain('Skip Credits');
  });

  it('seeks to end of intro when skip is clicked', async () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 30;
    mockMedia.currentItem = {
      id: 'item-1',
      markers: [
        { type: 'intro', start: 0, end: 90 }
      ]
    };

    const wrapper = mount(SkipButton);
    await wrapper.find('.player-skip-button').trigger('click');

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(90.5);
  });

  it('seeks to start of outro when skip is clicked', async () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 3550;
    mockMedia.currentItem = {
      id: 'item-1',
      markers: [
        { type: 'outro', start: 3540, end: 3600 }
      ]
    };

    const wrapper = mount(SkipButton);
    await wrapper.find('.player-skip-button').trigger('click');

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(3539.5);
  });

  it('renders null when currentItem has no markers', () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 30;
    mockMedia.currentItem = {
      id: 'item-1',
      markers: []
    };

    const wrapper = mount(SkipButton);
    expect(wrapper.html()).toBe('');
  });

  it('renders null when currentItem is null', () => {
    mockPlayer.playing = true;
    mockMedia.currentItem = null;

    const wrapper = mount(SkipButton);
    expect(wrapper.html()).toBe('');
  });

  it('returns null when not in any marker', () => {
    mockPlayer.playing = true;
    mockPlayer.currentTime = 500;
    mockMedia.currentItem = {
      id: 'item-1',
      markers: [
        { type: 'intro', start: 0, end: 90 },
        { type: 'outro', start: 3540, end: 3600 }
      ]
    };

    const wrapper = mount(SkipButton);
    expect(wrapper.html()).toBe('');
  });
});
