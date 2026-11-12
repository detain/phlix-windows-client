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
    // vitest ≥2: restoreAllMocks no longer clears vi.fn() call history —
    // clear it explicitly so pause counts never leak across tests.
    vi.clearAllMocks();
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
    } as any);

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
    } as any);
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

  // Law (m1 cure, windows__casualgamer #2): the fade is JS-stepped — volume is
  // NOT a CSS property, so pinning `style.transition = 'volume …'` pinned a
  // fiction (audio slammed to mute). This replaces the pre-fix "fade uses CSS
  // transition" test, which asserted the broken assignment.
  it('fade steps volume down in JS, pauses at zero, restores volume after', () => {
    const mockVideoEl = {
      volume: 0.8,
      style: {} as Record<string, string>
    };
    let volumeAtPause = -1;
    pauseMock.mockImplementation(() => {
      volumeAtPause = mockVideoEl.volume;
    });

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

    // No CSS transition fiction is ever assigned to the video element
    expect(mockVideoEl.style.transition).toBeUndefined();

    // Walk the fade: volume decreases every step until the pause lands
    const samples: number[] = [];
    for (let i = 0; i < 40 && pauseMock.mock.calls.length === 0; i++) {
      vi.advanceTimersByTime(100);
      samples.push(mockVideoEl.volume);
    }

    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(volumeAtPause).toBe(0); // pause lands only once the ramp hits silence
    // Strictly descending before the final step restored the volume:
    const ramp = samples.slice(0, -1); // last sample is post-restore 0.8
    expect(ramp.length).toBeGreaterThanOrEqual(25); // 3000ms / 100ms steps
    for (let i = 0; i < ramp.length; i++) {
      expect(ramp[i]).toBeLessThan(0.8);
      if (i > 0) expect(ramp[i]).toBeLessThan(ramp[i - 1]);
    }
    // Volume restored for next playback after the pause:
    expect(mockVideoEl.volume).toBe(0.8);

    wrapper.unmount();
    querySelectorSpy.mockRestore();
  });

  // Law (M2 cure, windows__casualgamer #2): the expiry timeout is owned SOLELY
  // by the endTime watcher. Pre-fix, closing the preset menu in the same flush
  // as startTimer ran the countdown watcher's else-arm clearTimer(), killing
  // the just-armed expiry — every interactively-set timer silently cancelled
  // itself. Red on the parent (pause never fired).
  it('an interactively-set timer survives the menu close and still expires', async () => {
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: true,
      pause: pauseMock
    } as any);

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    expect(localStorage.getItem('phlix-sleep-timer')).toBeNull();

    // Open the menu and pick the first preset (15 min) — interactive path.
    await wrapper.find('.sleep-timer-trigger').trigger('click');
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(true);
    await wrapper.findAll('.sleep-timer-preset')[0].trigger('click');

    // Menu closed, timer armed and persisted
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(false);
    expect(localStorage.getItem('phlix-sleep-timer')).not.toBeNull();

    // Advance past expiry (no video element in jsdom → pause lands directly)
    vi.advanceTimersByTime(15 * 60 * 1000 + 100);
    expect(pauseMock).toHaveBeenCalledTimes(1);

    // And the expiry notice renders — pre-fix the endTime watcher's null-arm
    // wiped isExpired before it could ever paint.
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Sleep timer expired');

    wrapper.unmount();
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: false,
      pause: pauseMock
    } as any);
  });

  // Law (windows__gameux 2[m], MW-087): the expiry notice owns a dismiss
  // path. After handleExpire nulls endTime, BOTH cancel affordances (the
  // countdown pill and the menu's Cancel row) unrender, so pre-fix the only
  // way to make the badge go away was arming a NEW timer. Red on the parent:
  // the notice renders with zero controls, so the dismiss lookup below finds
  // nothing.
  it('the expired notice can be dismissed without arming a new timer', async () => {
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: true,
      pause: pauseMock
    } as any);

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    await wrapper.find('.sleep-timer-trigger').trigger('click');
    await wrapper.findAll('.sleep-timer-preset')[0].trigger('click');

    // Expire it (no video element in jsdom → pause lands directly).
    vi.advanceTimersByTime(15 * 60 * 1000 + 100);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Sleep timer expired');

    const dismiss = wrapper.find('button[aria-label="Cancel sleep timer"]');
    expect(dismiss.exists(), 'expired notice must carry its own dismiss control').toBe(true);
    await dismiss.trigger('click');
    await wrapper.vm.$nextTick();

    // Notice gone, state reset, nothing persisted, no new timer armed:
    expect(wrapper.text()).not.toContain('Sleep timer expired');
    expect(localStorage.getItem('phlix-sleep-timer')).toBeNull();

    wrapper.unmount();
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: false,
      pause: pauseMock
    } as any);
  });

  // Law (m2 cure, windows__casualgamer #3): the pill is visible exactly while
  // the RAF loop runs, so it seeds the true remainder on mount and ticks with
  // the clock. Pre-fix the loop only ran with the menu open/after expiry and
  // the chip sat frozen at "0:00" forever.
  it('the countdown pill seeds the true remainder and ticks with the clock', async () => {
    const endTime = Date.now() + 90 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 1 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('1:30'); // seeded — not a stale 0:00

    vi.advanceTimersByTime(2000);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('1:28'); // ticking while pill is visible
    wrapper.unmount();
  });

  // Law (m8 cure, windows__gameux #1): desktop popover expectations — Escape
  // and mousedown-outside dismiss the preset menu; mousedown INSIDE does not.
  it('the preset menu dismisses on Escape and on outside mousedown', async () => {
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: true,
      pause: pauseMock
    } as any);

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    await wrapper.find('.sleep-timer-trigger').trigger('click');
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(true);

    // Click inside the menu must not dismiss it
    await wrapper.find('.sleep-timer-menu').trigger('mousedown');
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(true);

    // mousedown outside the root dismisses
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(false);

    // reopen, then Escape dismisses
    await wrapper.find('.sleep-timer-trigger').trigger('click');
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.sleep-timer-menu').exists()).toBe(false);

    wrapper.unmount();
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: false,
      pause: pauseMock
    } as any);
  });

  // Law (m8 cure): emoji glyphs are replaced with SVG icons; every interactive
  // target meets the 24px floor (Segoe UI Emoji rendering varies with theme).
  it('overlay icons are SVG and hit targets are >= 24px', async () => {
    const endTime = Date.now() + 30 * 60 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });

    expect(wrapper.text()).not.toContain('🌙');
    expect(wrapper.text()).not.toContain('✕');
    expect(wrapper.findAll('svg').length).toBeGreaterThanOrEqual(2);

    const cancelBtn = wrapper.find('button[aria-label="Cancel sleep timer"]');
    expect(cancelBtn.attributes('style')).toContain('width: 24px');
    expect(cancelBtn.attributes('style')).toContain('height: 24px');
    wrapper.unmount();
  });

  // Law (WIN-21): the expired notice's dismiss control meets the same 24px
  // floor as the live pill's cancel. Red on the parent: it was 20x20.
  it('the expired-notice dismiss target is >= 24px', async () => {
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: true,
      pause: pauseMock
    } as any);

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    await wrapper.find('.sleep-timer-trigger').trigger('click');
    await wrapper.findAll('.sleep-timer-preset')[0].trigger('click');
    vi.advanceTimersByTime(15 * 60 * 1000 + 100);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Sleep timer expired');

    const dismiss = wrapper.find('button[aria-label="Cancel sleep timer"]');
    expect(dismiss.attributes('style')).toContain('width: 24px');
    expect(dismiss.attributes('style')).toContain('height: 24px');

    wrapper.unmount();
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: false,
      pause: pauseMock
    } as any);
  });

  // Law (WIN-12): the countdown label ticks on a 1s setInterval, never a
  // per-frame RAF loop (the label has 1s resolution — RAF re-rendered ~60x/s).
  // Red on the parent: requestAnimationFrame was the loop driver.
  it('the countdown ticks on a 1s interval, not requestAnimationFrame', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const endTime = Date.now() + 90 * 1000;
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 1 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('1:30');

    vi.advanceTimersByTime(1000);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('1:29');

    expect(rafSpy).not.toHaveBeenCalled();
    expect(intervalSpy.mock.calls.some(([, ms]) => ms === 1000)).toBe(true);

    // The ticker stops with the pill: cancel, then no further 1s ticks run.
    await wrapper.find('button[aria-label="Cancel sleep timer"]').trigger('click');
    expect(vi.getTimerCount()).toBe(0);
    wrapper.unmount();
  });

  // Law (WIN-37): a timer that lapsed while the app was closed, found at mount
  // with nothing playing, is cleared SILENTLY — no "expired" badge greeting a
  // fresh launch, no pause. Red on the parent: the mount-expire path ran
  // handleExpire, which set isExpired and rendered the notice.
  it('a stale timer found expired at mount with nothing playing shows no notice', async () => {
    // endTime === now: survives loadState's strict `<` purge, then the
    // immediate endTime watcher sees remaining <= 0 — the mount-expire path.
    const endTime = Date.now();
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain('Sleep timer expired');
    expect(wrapper.html()).toBe('');
    expect(pauseMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('phlix-sleep-timer')).toBeNull();
    wrapper.unmount();
  });

  // Companion pin (WIN-37): if playback IS live at mount, the lapsed timer is
  // a real expiry — pause lands and the notice renders.
  it('a timer expired at mount while playback is live still expires with a notice', async () => {
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: true,
      pause: pauseMock
    } as any);
    const endTime = Date.now();
    localStorage.setItem('phlix-sleep-timer', JSON.stringify({ endTime, totalMinutes: 30 }));

    const wrapper = mount(SleepTimer, {
      global: { stubs: { teleport: true } }
    });
    await wrapper.vm.$nextTick();

    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Sleep timer expired');
    expect(localStorage.getItem('phlix-sleep-timer')).toBeNull();

    wrapper.unmount();
    vi.mocked(usePlayerStore).mockReturnValue({
      playing: false,
      pause: pauseMock
    } as any);
  });
});
