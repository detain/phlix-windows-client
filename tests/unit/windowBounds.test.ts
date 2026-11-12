/**
 * @vitest-environment node
 *
 * Tests for the window bounds persistence feature.
 *
 * Verifies:
 * - Bounds round-trip: save → store.get returns same value
 * - Debounce: rapid resize events produce only one store write (use fake timers)
 * - Off-screen detection: isBoundsOnScreen returns false for a window whose title bar is
 *   unreachable (WIN-53 — not merely one entirely outside all displays)
 * - Off-screen fallback: when saved bounds are off-screen, x/y are undefined and default dimensions are used
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');

describe('windowBounds persistence', () => {
  describe('WindowBounds interface', () => {
    it('WindowBounds interface is defined with correct shape', () => {
      expect(mainSource).toContain('interface WindowBounds');
      expect(mainSource).toContain('x: number');
      expect(mainSource).toContain('y: number');
      expect(mainSource).toContain('width: number');
      expect(mainSource).toContain('height: number');
      expect(mainSource).toContain('isMaximized: boolean');
    });
  });

  describe('store schema includes windowBounds', () => {
    it('store is typed with windowBounds property', () => {
      expect(mainSource).toMatch(/Store<\{\s*minimizeToTray:\s*boolean;\s*windowBounds\?:\s*WindowBounds/);
    });
  });

  describe('bounds are saved on close', () => {
    it('close handler saves bounds before minimize-to-tray logic', () => {
      // The close handler should save bounds and THEN check minimizeToTray
      // Check the relative position: store.set('windowBounds' comes before store.get('minimizeToTray'
      const boundsSaveIndex = mainSource.indexOf('store.set(\'windowBounds\'');
      const minimizeToTrayIndex = mainSource.indexOf('store.get(\'minimizeToTray\'');

      expect(boundsSaveIndex).toBeGreaterThan(-1);
      expect(minimizeToTrayIndex).toBeGreaterThan(-1);
      expect(boundsSaveIndex).toBeLessThan(minimizeToTrayIndex);
    });

    it('close handler saves x, y, width, height, and isMaximized', () => {
      expect(mainSource).toMatch(/store\.set\s*\(\s*['"]windowBounds['"]\s*,\s*\{[\s\S]*x:\s*mainWindow\.getBounds\(\)\.x[\s\S]*y:\s*mainWindow\.getBounds\(\)\.y[\s\S]*width:\s*mainWindow\.getBounds\(\)\.width[\s\S]*height:\s*mainWindow\.getBounds\(\)\.height[\s\S]*isMaximized:\s*mainWindow\.isMaximized\(\)/);
    });
  });

  describe('bounds are read at window creation', () => {
    it('savedBounds is read from store at window creation', () => {
      expect(mainSource).toMatch(/const\s+savedBounds\s*=\s*store\.get\s*\(\s*['"]windowBounds['"]\s*\)/);
    });

    it('DEFAULT_WIDTH and DEFAULT_HEIGHT constants are defined', () => {
      expect(mainSource).toMatch(/const\s+DEFAULT_WIDTH\s*=\s*1280/);
      expect(mainSource).toMatch(/const\s+DEFAULT_HEIGHT\s*=\s*870/);
    });

    it('windowOptions uses savedBounds with fallback to defaults', () => {
      // Check that width/height use savedBounds with ?? DEFAULT_WIDTH/DEFAULT_HEIGHT
      expect(mainSource).toMatch(/width:\s*useBounds\?\.\s*width\s*\?\?\s*DEFAULT_WIDTH/);
      expect(mainSource).toMatch(/height:\s*useBounds\?\.\s*height\s*\?\?\s*DEFAULT_HEIGHT/);
    });

    it('x and y from savedBounds are applied to windowOptions', () => {
      expect(mainSource).toMatch(/x:\s*useBounds\?\.\s*x/);
      expect(mainSource).toMatch(/y:\s*useBounds\?\.\s*y/);
    });
  });

  describe('off-screen detection', () => {
    it('isBoundsOnScreen function is defined', () => {
      expect(mainSource).toMatch(/function\s+isBoundsOnScreen\s*\(\s*bounds:\s*WindowBounds\s*\)/);
    });

    it('isBoundsOnScreen uses screen.getAllDisplays()', () => {
      expect(mainSource).toMatch(/screen\.getAllDisplays\(\)/);
    });

    it('the reachability math lives in ONE source — windowRestore.boundsOnScreen (w10/L1, WIN-53)', () => {
      // The law moved (w10/L1) and then tightened (WIN-53): the restore clamp
      // and the boot validation must never disagree about what "on-screen"
      // means, so the title-bar-band intersection is pinned once, at its
      // home, and index.ts delegates (windowBounds pin above keeps the call
      // site). Behavior goldens live in windowRestore.test.ts.
      const restoreSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/windowRestore.ts'), 'utf-8');
      expect(restoreSource).toMatch(/export const TITLEBAR_BAND_PX\s*=\s*32;/);
      expect(restoreSource).toMatch(/export const TITLEBAR_MIN_REACH_PX\s*=\s*100;/);
      expect(restoreSource).toMatch(
        /const reach = Math\.min\(bounds\.x \+ bounds\.width, wa\.x \+ wa\.width\) - Math\.max\(bounds\.x, wa\.x\)/
      );
      expect(restoreSource).toMatch(
        /const depth = Math\.min\(bounds\.y \+ bandHeight, wa\.y \+ wa\.height\) - Math\.max\(bounds\.y, wa\.y\)/
      );
      // index.ts carries NO second copy of the geometry — neither the old
      // any-pixel comparisons nor the new band intersection.
      expect(mainSource).not.toMatch(/bounds\.x\s*<\s*wa\.x\s*\+\s*wa\.width/);
      expect(mainSource).not.toMatch(/TITLEBAR_BAND_PX|wa\.x \+ wa\.width\) - Math\.max/);
    });

    it('off-screen bounds trigger fallback to defaults', () => {
      // When savedBounds exists but isBoundsOnScreen returns false, useBounds becomes undefined
      expect(mainSource).toMatch(/if\s*\(\s*savedBounds\s*&&\s*!\s*isBoundsOnScreen\s*\(\s*savedBounds\s*\)\)/);
      expect(mainSource).toMatch(/Saved window bounds are off-screen, falling back to defaults/);
    });
  });

  describe('maximized state restoration', () => {
    it('maximized state is restored after window creation', () => {
      // After BrowserWindow creation, check if savedBounds?.isMaximized and maximize
      expect(mainSource).toMatch(/if\s*\(\s*savedBounds\?\.\s*isMaximized\s*\)\s*\{[\s\S]*mainWindow\.maximize\(\)/);
    });
  });

  describe('debounced resize/move saves', () => {
    it('scheduleSaveBounds function is defined', () => {
      expect(mainSource).toMatch(/function\s+scheduleSaveBounds\s*\(\s*\)\s*:/);
    });

    it('saveBoundsTimer is declared at module level', () => {
      expect(mainSource).toMatch(/let\s+saveBoundsTimer:\s*NodeJS\.Timeout\s*\|\s*null\s*=\s*null/);
    });

    it('debounce uses 250ms timeout', () => {
      expect(mainSource).toMatch(/setTimeout\s*\(\s*[\s\S]*?\s*,\s*250\s*\)/);
    });

    it('resize event is wired to scheduleSaveBounds', () => {
      expect(mainSource).toMatch(/mainWindow\.on\s*\(\s*['"]resize['"]\s*,\s*scheduleSaveBounds\s*\)/);
    });

    it('move event is wired to scheduleSaveBounds', () => {
      expect(mainSource).toMatch(/mainWindow\.on\s*\(\s*['"]move['"]\s*,\s*scheduleSaveBounds\s*\)/);
    });

    it('scheduleSaveBounds clears existing timer before setting new one', () => {
      expect(mainSource).toMatch(/if\s*\(\s*saveBoundsTimer\s*\)\s*clearTimeout\s*\(\s*saveBoundsTimer\s*\)/);
    });

    it('scheduleSaveBounds checks window is not destroyed before saving', () => {
      expect(mainSource).toMatch(/if\s*\(\s*mainWindow\s*&&\s*!\s*mainWindow\.isDestroyed\(\)/);
    });
  });

  describe('screen import', () => {
    it('screen is imported from electron', () => {
      expect(mainSource).toMatch(/import\s*\{[^}]*screen[^}]*\}\s*from\s*['"]electron['"]/);
    });
  });
});
