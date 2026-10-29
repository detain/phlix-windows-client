/**
 * @vitest-environment node
 *
 * Behavior tests for the canonical restore sequence (M-WINDOWS-03).
 * src/main/windowRestore.ts is pure (no electron import), so this suite
 * needs no module mocks — the fakes below ARE the "windows".
 *
 * Mutation teeth planted by design:
 * - the exact call-ORDER arrays pin show()/focus() for hidden windows and
 *   restore-before-show for minimized ones (swapping or dropping either
 *   reddens a test);
 * - the hidden-window case pins that restore() is NOT called (a blanket
 *   restore() before show() — the trap this module exists to avoid — is
 *   itself a red);
 * - the destroyed case pins zero method calls (an unguarded show/focus on a
 *   destroyed window would throw, failing the not.toThrow pin too).
 */

import { describe, it, expect } from 'vitest';
import { restoreWindow, type RestorableWindow } from '../../src/main/windowRestore';

interface FakeWindow extends RestorableWindow {
  calls: string[];
}

function fakeWindow(state: {
  destroyed?: boolean;
  minimized?: boolean;
  visible?: boolean;
}): FakeWindow {
  const calls: string[] = [];
  return {
    calls,
    isDestroyed: () => state.destroyed ?? false,
    isMinimized: () => state.minimized ?? false,
    isVisible: () => state.visible ?? false,
    restore: () => void calls.push('restore'),
    show: () => void calls.push('show'),
    focus: () => void calls.push('focus')
  };
}

describe('restoreWindow() (M-WINDOWS-03)', () => {
  it('hidden window (the close-to-tray state): show() then focus(), never restore()', () => {
    const win = fakeWindow({ minimized: false, visible: false });

    expect(restoreWindow(win)).toBe(true);
    // 'show' first is the documented cure ("Shows and gives focus"); the
    // absence of 'restore' pins the isMinimized() gate — close-to-tray is
    // hide(), not minimize().
    expect(win.calls).toEqual(['show', 'focus']);
  });

  it('minimized window: restore() before show(), then focus()', () => {
    const win = fakeWindow({ minimized: true, visible: false });

    expect(restoreWindow(win)).toBe(true);
    // Order matters on Windows: focus()/show() on a still-minimized window
    // is the broken foregrounding path; restore() must lead.
    expect(win.calls).toEqual(['restore', 'show', 'focus']);
  });

  it('already-visible window: focus() only, never disturb show()/restore()', () => {
    const win = fakeWindow({ minimized: false, visible: true });

    expect(restoreWindow(win)).toBe(true);
    expect(win.calls).toEqual(['focus']);
  });

  it('destroyed window: deliberate no-op — returns false, calls nothing, never throws', () => {
    const win = fakeWindow({ destroyed: true });
    // A destroyed Electron window throws on any method touch; emulate the
    // worst case so the isDestroyed() guard's position is what is tested.
    win.restore = () => {
      throw new Error('Object has been destroyed');
    };
    win.show = win.restore;
    win.focus = win.restore;

    expect(() => restoreWindow(win)).not.toThrow();
    expect(restoreWindow(win)).toBe(false);
  });

  it('null or undefined reference: returns false without touching anything', () => {
    expect(restoreWindow(null)).toBe(false);
    expect(restoreWindow(undefined)).toBe(false);
  });

  it('is idempotent on the double-click burst (click+click+double-click)', () => {
    // Windows fires click, click, double-click for one real double-click.
    // First call raises the hidden window; later calls must only re-focus.
    const state = { minimized: false, visible: false };
    const win = fakeWindow(state);
    win.isVisible = () => state.visible;
    win.show = () => {
      win.calls.push('show');
      state.visible = true;
    };

    restoreWindow(win);
    restoreWindow(win);

    expect(win.calls).toEqual(['show', 'focus', 'focus']);
  });
});
