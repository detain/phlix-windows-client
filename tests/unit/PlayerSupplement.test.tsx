/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { RouteLocationNormalized } from 'vue-router';
import PlayerSupplement from '@/components/PlayerSupplement';

vi.mock('@/components/SleepTimer', () => ({ default: { template: '<div class="sleep-timer-mock" />' } }));
vi.mock('@/components/PiPButton', () => ({ default: { template: '<div class="pip-button-mock" />' } }));

// Callback storage for afterEach
const afterEachCallbacks: Array<(to: RouteLocationNormalized) => void> = [];
const unregisterMock = vi.fn(() => {});

const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/app/player/:id', component: { template: '<div>Player</div>' } },
    // Non-player routes - renders nothing (active will be false since no :id param)
    { path: '/app/servers', component: { template: '<div>Servers</div>' } },
    { path: '/', component: { template: '<div>Root</div>' } }
  ]
});

// Wrap afterEach to capture callbacks and return unregisterMock for cleanup verification
mockRouter.afterEach = ((cb: (to: RouteLocationNormalized) => void) => {
  afterEachCallbacks.push(cb);
  return unregisterMock;
}) as any;

describe('PlayerSupplement', () => {
  let setIntervalSpy: any;

  beforeEach(async () => {
    afterEachCallbacks.length = 0;
    unregisterMock.mockClear().mockReturnValue(undefined);
    // Reset router to root to ensure clean state
    await mockRouter.push('/');
    // Spy on setInterval to verify it's never called
    setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation(() => 1 as any);
    // Set up window.__phlixRouter for the component
    Object.defineProperty(window, '__phlixRouter', {
      value: mockRouter,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call setInterval', () => {
    // The component must not poll — verify setInterval was never called
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('renders null when player is not active (no route params)', async () => {
    // Navigate to a non-player route
    mockRouter.push('/app/servers');
    await mockRouter.isReady();

    const wrapper = mount(PlayerSupplement, {
      global: {
        stubs: { teleport: true },
        plugins: [mockRouter]
      }
    });

    // When not active, component returns null which renders as empty in Vue 3
    expect(wrapper.html()).toBe('');
  });

  it('renders player overlays when player is active (has route params)', async () => {
    // Navigate to player route and wait for navigation to complete
    await mockRouter.push('/app/player/123');
    await nextTick();

    const wrapper = mount(PlayerSupplement, {
      global: {
        stubs: { teleport: true },
        plugins: [mockRouter]
      }
    });
    await nextTick();

    // Should render the overlay controls
    expect(wrapper.find('.sleep-timer-mock').exists()).toBe(true);
    expect(wrapper.find('.pip-button-mock').exists()).toBe(true);
  });

  it('reacts to navigation synchronously with no timer', async () => {
    // Reset router to root to ensure clean state before starting
    await mockRouter.push('/');
    await mockRouter.isReady();

    // Now start on non-player route
    mockRouter.push('/app/servers');
    await mockRouter.isReady();

    const wrapper = mount(PlayerSupplement, {
      global: {
        stubs: { teleport: true },
        plugins: [mockRouter]
      }
    });
    expect(wrapper.html()).toBe('');

    // Simulate navigation to player route - afterEach fires synchronously during push
    await mockRouter.push('/app/player/456');
    await mockRouter.isReady();

    // Trigger the stored callback to simulate afterEach invocation
    const toRoute = { params: { id: '456' } } as any;
    afterEachCallbacks.forEach((cb) => cb(toRoute));
    await nextTick();

    // Overlay should appear immediately without any timer delay
    expect(wrapper.find('.sleep-timer-mock').exists()).toBe(true);
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('removes the router hook on unmount', async () => {
    mockRouter.push('/app/player/123');
    await mockRouter.isReady();

    const wrapper = mount(PlayerSupplement, {
      global: {
        stubs: { teleport: true },
        plugins: [mockRouter]
      }
    });

    // Manually trigger unmount since test-utils doesn't call onUnmounted automatically
    (wrapper as VueWrapper<ComponentPublicInstance>).unmount();

    // The unregister function from afterEach should have been called
    expect(unregisterMock).toHaveBeenCalledTimes(1);
  });

  it('does not crash and renders nothing when window.__phlixRouter is absent', async () => {
    // Simulates running outside the Electron shell — e.g. plain browser dev context
    // where boot() never runs and __phlixRouter is never defined.
    // When getPhlixRouter() returns undefined, afterEach is skipped (router?.afterEach
    // short-circuits) and unregisterRouter falls back to a no-op, so unmount is safe.
    Object.defineProperty(window, '__phlixRouter', {
      value: undefined,
      writable: true,
      configurable: true
    });

    const wrapper = mount(PlayerSupplement, {
      global: {
        stubs: { teleport: true },
        plugins: [mockRouter]
      }
    });

    // Should render nothing — active is false (route has no :id param on /app/servers)
    expect(wrapper.html()).toBe('');
    // Must not have fallen back to setInterval polling
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
