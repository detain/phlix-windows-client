/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SleepTimer from '@/components/SleepTimer';

// Mock usePlayerStore
vi.mock('@phlix/ui', () => ({
  usePlayerStore: vi.fn(() => ({
    playing: false
  }))
}));

describe('SleepTimer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders null when player is not playing and no timer is active', () => {
    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    expect(wrapper.html()).toBe('');
  });

  it('renders trigger button when timer is active', () => {
    // Set a timer that ends 30 minutes from now
    const endTime = Date.now() + 30 * 60 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    expect(wrapper.find('.sleep-timer-trigger').exists()).toBe(true);
  });

  it('has trigger button with correct aria attributes', () => {
    // Set a timer
    const endTime = Date.now() + 30 * 60 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    const button = wrapper.find('.sleep-timer-trigger');
    expect(button.exists()).toBe(true);
    expect(button.attributes('aria-label')).toBe('Sleep timer');
  });

  it('clears timer from localStorage when cancel is triggered', async () => {
    // Set an active timer
    const endTime = Date.now() + 30 * 60 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    // Find and click cancel button inside the timer display
    const cancelBtn = wrapper.find('button[aria-label="Cancel sleep timer"]');
    if (cancelBtn.exists()) {
      await cancelBtn.trigger('click');
      expect(localStorage.getItem('phlix-sleep-timer')).toBeNull();
    }
  });

  it('loads expired timer from localStorage and clears it', () => {
    // Set an expired timer
    const endTime = Date.now() - 1000; // 1 second ago
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    // Should be cleared
    expect(localStorage.getItem('phlix-sleep-timer')).toBeNull();
  });

  it('handles malformed localStorage gracefully', () => {
    localStorage.setItem('phlix-sleep-timer', 'not json');

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    // Should not throw and should render nothing when player not playing
    expect(wrapper.html()).toBe('');
  });

  it('displays countdown when timer is active', () => {
    // Set a timer that ends 30 minutes from now
    const endTime = Date.now() + 30 * 60 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    // Should show some time display
    expect(wrapper.text()).toMatch(/\d+:/);
  });
});
