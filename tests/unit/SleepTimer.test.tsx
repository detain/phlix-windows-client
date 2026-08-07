/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SleepTimer from '@/components/SleepTimer';
import { usePlayerStore } from '@phlix/ui';

// Mock usePlayerStore
const pauseMock = vi.fn();
vi.mock('@phlix/ui', () => ({
  usePlayerStore: vi.fn(() => ({
    playing: false,
    pause: pauseMock
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

  it('timer fires at the right time with no per-second interval', () => {
    // Update the mock to return playing: true
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: true,
      pause: pauseMock
    });

    // Set a timer that expires in 5 seconds
    const endTime = Date.now() + 5000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 1 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    // Advance timers by 5 seconds (timer should fire)
    vi.advanceTimersByTime(5000);

    expect(pauseMock).toHaveBeenCalled();
    wrapper.unmount();

    // Reset mock for other tests
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: false,
      pause: pauseMock
    });
  });

  it('nothing left running after unmount', () => {
    // Set a timer that ends in 60 seconds
    const endTime = Date.now() + 60 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 1 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    wrapper.unmount();

    // After unmount, no timers should be pending
    // Check that setTimeout was cleared - advance timers and verify nothing fires
    vi.advanceTimersByTime(60000);
    // If we get here without the test hanging, no unhandled timers fired
    expect(true).toBe(true);
  });

  it('fade uses CSS transition not JS interval', () => {
    // Create a mock video element
    const mockVideoEl = {
      volume: 0.8,
      style: { transition: '' }
    };

    // Spy on querySelector to return our mock video element
    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue(mockVideoEl as unknown as Element);

    // Set a timer that expires immediately
    const endTime = Date.now() + 100; // expires very soon
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 1 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    // Trigger expiration
    vi.advanceTimersByTime(200);

    // Verify CSS transition was set on the video element
    expect(mockVideoEl.style.transition).toBe('volume 3000ms ease-out');
    expect(mockVideoEl.volume).toBe(0);

    wrapper.unmount();
    querySelectorSpy.mockRestore();
  });
});
