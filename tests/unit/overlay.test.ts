/**
 * Tests for the overlay entry point.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import log from 'electron-log';

// Mock vue before importing overlay
vi.mock('vue', () => {
  const mockApp = {
    use: vi.fn().mockReturnThis(),
    mount: vi.fn()
  };
  return {
    createApp: vi.fn(() => mockApp),
    // Expose mockApp for assertions
    __mockApp: mockApp
  };
});

vi.mock('pinia', () => ({
  createPinia: vi.fn(() => ({ __pinia: true }))
}));

vi.mock('vue-router', () => ({
  createRouter: vi.fn(() => ({ __router: true })),
  createWebHashHistory: vi.fn(() => ({ __history: true }))
}));

vi.mock('@/components/PlayerSupplement', () => ({ default: { template: '<div>PlayerSupplement</div>' } }));

describe('overlay entry point', () => {
  let mockApp: any;
  let createApp: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-import to get fresh mocks
    const vue = await import('vue');
    createApp = vue.createApp as unknown as ReturnType<typeof vi.fn>;
    // createPinia and createRouter are called by overlay.tsx but tracked via mockApp.use calls
    mockApp = (vue as any).__mockApp;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts when #player-supplement-root appears', async () => {
    const root = document.createElement('div');
    root.id = 'player-supplement-root';
    document.body.appendChild(root);

    let getElementByIdCalls = 0;
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'player-supplement-root') {
        getElementByIdCalls++;
        // Root appears on call #2
        return getElementByIdCalls >= 2 ? root : null;
      }
      return null;
    });

    // Use fake timers to control setTimeout
    vi.useFakeTimers();

    // Import overlay - this triggers the mount logic
    await import('@/overlay');

    // Advance past the initial delay and first retry
    vi.advanceTimersByTime(1000);

    // Now mount should have been called
    expect(mockApp.mount).toHaveBeenCalledWith(root);

    // Cleanup
    document.body.removeChild(root);
    vi.useRealTimers();
  });

  it('gives up after MAX_ATTEMPTS and logs console.error', async () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    const consoleErrorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});

    vi.useFakeTimers();

    await import('@/overlay');

    // Advance past all 10 attempts (each 1 second apart)
    vi.advanceTimersByTime(10_000);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Overlay] #player-supplement-root never appeared after 10 attempts. Giving up.'
    );

    vi.useRealTimers();
  });

  it('calls createApp exactly once even with multiple mount attempts', async () => {
    const root = document.createElement('div');
    root.id = 'player-supplement-root';
    document.body.appendChild(root);

    let getElementByIdCalls = 0;
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'player-supplement-root') {
        getElementByIdCalls++;
        // Root only appears after several retries
        return getElementByIdCalls >= 3 ? root : null;
      }
      return null;
    });

    vi.useFakeTimers();
    await import('@/overlay');

    // Multiple retries happen
    vi.advanceTimersByTime(3000);

    // createApp should only be called ONCE at module load
    expect(createApp).toHaveBeenCalledTimes(1);

    // mount should have been called
    expect(mockApp.mount).toHaveBeenCalled();

    document.body.removeChild(root);
    vi.useRealTimers();
  });

  it('calls .use(pinia) and .use(router)', async () => {
    const root = document.createElement('div');
    root.id = 'player-supplement-root';
    document.body.appendChild(root);

    vi.useFakeTimers();
    await import('@/overlay');

    // Trigger immediate mount since root exists
    vi.advanceTimersByTime(0);

    // Verify pinia and router were registered
    expect(mockApp.use).toHaveBeenCalledWith({ __pinia: true });
    expect(mockApp.use).toHaveBeenCalledWith({ __router: true });

    document.body.removeChild(root);
    vi.useRealTimers();
  });
});
