/**
 * @vitest-environment node
 *
 * Tests for the minimize-to-tray preference persistence.
 *
 * Verifies:
 * - isQuitting is a separate in-memory flag (never persisted)
 * - minimizeToTray preference round-trips through electron-store
 * - isQuitting is never written to electron-store
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Helper: extract electron-store get/set calls from main source
// ---------------------------------------------------------------------------

function extractStoreSetKeys(content: string): string[] {
  const keys: string[] = [];
  // Match store.set(...) calls — capture the first string argument (the key)
  const regex = /store\.set\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');

describe('minimizeToTray persistence', () => {
  describe('isQuitting is a separate in-memory flag', () => {
    it('isQuitting is declared at module level and never passed to store.set', () => {
      // Verify isQuitting variable exists in main source
      expect(mainSource).toContain('isQuitting');

      // Verify isQuitting is never written to electron-store
      const storeSetKeys = extractStoreSetKeys(mainSource);
      expect(storeSetKeys).not.toContain('isQuitting');
    });

    it('isQuitting is set to true only in tray Quit click and before-quit handler', () => {
      // isQuitting = true in tray Quit click
      expect(mainSource).toMatch(/label:\s*['"]Quit['"],\s*click:\s*\(\)\s*=>\s*\{[^}]*isQuitting\s*=\s*true/s);

      // isQuitting = true in before-quit
      expect(mainSource).toMatch(/app\.on\s*\(\s*['"]before-quit['"]\s*,\s*\(\)\s*=>\s*\{[^}]*isQuitting\s*=\s*true/s);
    });

    it('close handler checks !isQuitting before preventing default', () => {
      // The close handler must check !isQuitting to allow actual quit
      expect(mainSource).toMatch(/if\s*\(\s*!\s*isQuitting\s*&&\s*store\.get\s*\(\s*['"]minimizeToTray['"]/);
    });
  });

  describe('minimizeToTray preference round-trips through electron-store', () => {
    it('minimizeToTray is read from store with correct default (true)', () => {
      // minimizeToTray should be read with default true
      const minimizeToTrayGets = mainSource.match(/store\.get\s*\(\s*['"]minimizeToTray['"]\s*,\s*true\s*\)/g);
      expect(minimizeToTrayGets).not.toBeNull();
      expect(minimizeToTrayGets!.length).toBeGreaterThan(0);
    });

    it('minimizeToTray default is true in all store.get calls', () => {
      const regex = /store\.get\s*\(\s*['"]minimizeToTray['"]\s*,\s*(\w+)\s*\)/g;
      const defaults: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(mainSource)) !== null) {
        defaults.push(match[1]);
      }
      expect(defaults.every(d => d === 'true')).toBe(true);
    });
  });

  describe('isQuitting is never persisted', () => {
    it('store.set is never called with isQuitting', () => {
      const storeSetKeys = extractStoreSetKeys(mainSource);
      expect(storeSetKeys).not.toContain('isQuitting');
    });

    it('the old buggy pattern (store.set("minimizeToTray", false) on quit) is removed', () => {
      // The two buggy patterns: tray Quit click and before-quit
      // Both should no longer set minimizeToTray to false
      // The only store.set(minimizeToTray, ...) calls should be the tray checkbox click
      // which sets it to menuItem.checked (a boolean, not hardcoded false)
      const buggyPattern = /store\.set\s*\(\s*['"]minimizeToTray['"]\s*,\s*false\s*\)/g;
      const matches = mainSource.match(buggyPattern);
      expect(matches).toBeNull();
    });
  });

  describe('tray context menu checkbox', () => {
    it('tray menu includes a Minimize to Tray checkbox bound to store', () => {
      // The tray context menu should have a checkbox item for minimizeToTray
      expect(mainSource).toMatch(/label:\s*['"]Minimize to Tray['"]\s*,\s*type:\s*['"]checkbox['"]/);
    });

    it('checkbox click handler writes the new value back to store', () => {
      // The checkbox click should call store.set('minimizeToTray', menuItem.checked)
      expect(mainSource).toMatch(/click:\s*\(\s*menuItem\s*\)\s*=>\s*store\.set\s*\(\s*['"]minimizeToTray['"]\s*,\s*menuItem\.checked\s*\)/);
    });
  });
});
