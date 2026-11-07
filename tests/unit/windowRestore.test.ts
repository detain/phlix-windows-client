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
import {
  boundsOnScreen,
  clampBoundsToDisplays,
  restoreWindow,
  type DisplayFrame,
  type RestorableWindow,
  type WindowBounds
} from '../../src/main/windowRestore';

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

// ---------------------------------------------------------------------------
// w10/L1 (windows__casualgamer #10): restore is a RE-ENTRY surface, and a
// window remembered on a since-unplugged display re-enters invisibly — the
// on-boot bounds validation in createWindow never runs again for the life of
// the process. The clamp law lives HERE, pure, beside the sequence law it
// rides: restoreWindow optionally takes a geometry probe (get/set bounds +
// display frames) and, after the raise+focus sequence completed normally,
// drags an off-screen rectangle back onto the primary display's work area —
// size-fitted, centered. No probe = the exact pre-existing behavior (every
// sequence pin above is a no-probe call).
// ---------------------------------------------------------------------------

function fakeDisplays(): { displays: DisplayFrame[]; primary: DisplayFrame } {
  const primary: DisplayFrame = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  return { displays: [primary, { workArea: { x: 1920, y: 0, width: 2560, height: 1440 } }], primary };
}

function fakeProbe(state: { bounds: WindowBounds } & ReturnType<typeof fakeDisplays>) {
  const sets: WindowBounds[] = [];
  return {
    sets,
    get: () => state.bounds,
    set: (next: WindowBounds) => {
      sets.push(next);
      state.bounds = next;
    },
    displays: () => state.displays,
    primary: () => state.primary
  };
}

describe('boundsOnScreen() (w10/L1 — the moved single source of the createWindow law)', () => {
  const geo = fakeDisplays();
  it('overlapping ANY display work area counts as on-screen, edge-touch included', () => {
    expect(boundsOnScreen({ x: 100, y: 100, width: 1280, height: 870 }, geo.displays)).toBe(true);
    // One pixel of overlap is overlap — the same generous rule createWindow used before.
    expect(boundsOnScreen({ x: 1919, y: 1079, width: 10, height: 10 }, geo.displays)).toBe(true);
    expect(boundsOnScreen({ x: 2000, y: 10, width: 100, height: 100 }, geo.displays)).toBe(true); // second monitor
  });
  it('fully outside every display — and the no-display venue — are off-screen', () => {
    expect(boundsOnScreen({ x: 5000, y: 5000, width: 1280, height: 870 }, geo.displays)).toBe(false);
    expect(boundsOnScreen({ x: 100, y: 100, width: 1280, height: 870 }, [])).toBe(false);
  });
});

describe('clampBoundsToDisplays() (w10/L1)', () => {
  const geo = fakeDisplays();
  it('on-screen bounds are returned unchanged', () => {
    const bounds = { x: 100, y: 100, width: 1280, height: 870 };
    expect(clampBoundsToDisplays(bounds, geo.displays, geo.primary)).toEqual(bounds);
  });
  it('an off-screen rectangle is centered on the primary work area', () => {
    expect(clampBoundsToDisplays({ x: 5000, y: 5000, width: 1280, height: 870 }, geo.displays, geo.primary))
      .toEqual({ x: 320, y: 105, width: 1280, height: 870 });
  });
  it('a window larger than the primary work area is fitted, then centered', () => {
    expect(clampBoundsToDisplays({ x: -9000, y: 400, width: 4000, height: 2000 }, geo.displays, geo.primary))
      .toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
  it('centering is relative to the PRIMARY WORK AREA, not the virtual desktop origin', () => {
    // Law-pin for the w10/L1 review mutation M6: every other fixture here
    // runs with primary workArea origin (0,0), where dropping the `wa.x +`
    // / `wa.y +` centering terms is invisible to the whole battery. A real
    // multi-monitor virtual desktop carries negative/offset origins (aux
    // left of primary, menu-bar-reserved rows), so the terms must be paid
    // for literally: x = -1920 + (1920-1280)/2 = -1600,
    // y = 240 + (1080-870)/2 = 345. Stripping either term reddens EXACTLY
    // this pin and no other.
    const primary: DisplayFrame = { workArea: { x: -1920, y: 240, width: 1920, height: 1080 } };
    const aux: DisplayFrame = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
    const stranded: WindowBounds = { x: 4000, y: 4000, width: 1280, height: 870 };

    expect(clampBoundsToDisplays(stranded, [primary, aux], primary))
      .toEqual({ x: -1600, y: 345, width: 1280, height: 870 });
  });
  it('with NO display data at all the clamp no-ops — never blind-move to NaN', () => {
    const bounds = { x: 5000, y: 5000, width: 1280, height: 870 };
    expect(clampBoundsToDisplays(bounds, [], { workArea: { x: 0, y: 0, width: 0, height: 0 } })).toEqual(bounds);
  });
});

describe('restoreWindow(window, probe) (w10/L1 stranded-window cure)', () => {
  it('stranded off-screen window: the raise sequence runs UNTOUCHED, then the bounds are clamped once', () => {
    const win = fakeWindow({ visible: false });
    const probe = fakeProbe({ bounds: { x: 5000, y: 5000, width: 1280, height: 870 }, ...fakeDisplays() });

    expect(restoreWindow(win, probe)).toBe(true);
    expect(win.calls).toEqual(['show', 'focus']);
    expect(probe.sets).toEqual([{ x: 320, y: 105, width: 1280, height: 870 }]);
  });
  it('on-screen window: probe is read, never written — no setBounds on every tray click', () => {
    const win = fakeWindow({ visible: true });
    const probe = fakeProbe({ bounds: { x: 100, y: 100, width: 1280, height: 870 }, ...fakeDisplays() });

    expect(restoreWindow(win, probe)).toBe(true);
    expect(win.calls).toEqual(['focus']);
    expect(probe.sets).toEqual([]);
  });
  it('a second restore after the clamp is quiet (idempotent geometry)', () => {
    const win = fakeWindow({ visible: false });
    const probe = fakeProbe({ bounds: { x: 5000, y: 5000, width: 1280, height: 870 }, ...fakeDisplays() });

    restoreWindow(win, probe);
    restoreWindow(win, probe);

    expect(probe.sets).toHaveLength(1);
  });
  it('destroyed window with a probe: still the deliberate no-op — probe untouched', () => {
    const win = fakeWindow({ destroyed: true });
    let touched = 0;
    expect(restoreWindow(win, {
      get: () => { touched++; return { x: 0, y: 0, width: 1, height: 1 }; },
      set: () => { touched++; },
      displays: () => { touched++; return []; },
      primary: () => { touched++; return { workArea: { x: 0, y: 0, width: 1, height: 1 } }; }
    })).toBe(false);
    expect(touched).toBe(0);
  });
});
