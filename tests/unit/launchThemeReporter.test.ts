/**
 * @vitest-environment node
 * WIN-S30: reporter + preload argv parsing.
 */
import { describe, it, expect, vi } from 'vitest';
import { startLaunchThemeReporter } from '../../src/renderer/launchThemeReporter';

describe('startLaunchThemeReporter', () => {
  it('is a no-op without a bridge', () => {
    expect(() => startLaunchThemeReporter(undefined, {} as HTMLElement)()).not.toThrow();
  });
  it('reports a valid --bg once and ignores non-hex', () => {
    const calls: string[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    let bg = ' #0b0a08 ';
    g.getComputedStyle = () => ({ getPropertyValue: () => bg });
    let cb: () => void = () => undefined;
    g.MutationObserver = class {
      constructor(f: () => void) { cb = f; }
      observe(): void {}
      disconnect(): void {}
    };
    const bridge = { setLaunchBackground: vi.fn(async (c: string) => { calls.push(c); }) };
    startLaunchThemeReporter(bridge, {} as HTMLElement);
    cb();
    expect(calls).toEqual(['#0b0a08']);
    bg = 'url(x)';
    cb();
    expect(calls).toHaveLength(1);
    bg = '#fff';
    cb();
    expect(calls).toEqual(['#0b0a08', '#fff']);
  });
});
