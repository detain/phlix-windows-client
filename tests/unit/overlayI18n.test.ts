/**
 * M-WINDOWS-11 (casualgamer m11): the player overlays were hardcoded English
 * while every neighboring surface localizes — SleepTimer's aria-labels/title,
 * expired notice, menu heading, Cancel item, min/hr units, and PiPButton's
 * four enter/exit labels. docs/i18n.md's windows-own law ("English values
 * byte-identical to the pre-i18n hardcoded literals") is honored by the
 * WIN_EN pins below, and the overlay group joins the ×7-locale key-identity
 * contract.
 *
 * The overlay is a SEPARATE vite entry (its own module instances), so the
 * bundle must pin its own catalog locale — the setWindowLocale call in
 * overlay.tsx is pinned too, or every locale would silently render English.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { WindowOwnCatalog } from '../../src/renderer/i18n/windows-own';
import { WIN_EN } from '../../src/renderer/i18n/windows-own/en';
import { WIN_ES } from '../../src/renderer/i18n/windows-own/es';
import { WIN_FR } from '../../src/renderer/i18n/windows-own/fr';
import { WIN_DE } from '../../src/renderer/i18n/windows-own/de';
import { WIN_IT } from '../../src/renderer/i18n/windows-own/it';
import { WIN_PT_BR } from '../../src/renderer/i18n/windows-own/pt_BR';
import { WIN_JA } from '../../src/renderer/i18n/windows-own/ja';

const PROJECT_ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(PROJECT_ROOT, p), 'utf-8');
const sleepTimer = read('src/renderer/components/SleepTimer.tsx');
const pipButton = read('src/renderer/components/PiPButton.tsx');
const overlayEntry = read('src/renderer/overlay.tsx');

// WindowOwnCatalog (the structural shape), NOT typeof WIN_EN — the latter is
// `as const` literal-typed and the mirrors carry plain strings.
const catalogs: Record<string, WindowOwnCatalog> = { es: WIN_ES, fr: WIN_FR, de: WIN_DE, it: WIN_IT, pt_BR: WIN_PT_BR, ja: WIN_JA };

/** Blanket block + line comments so docblocks don't pollute literal scans. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const OVERLAY_KEYS = [
  'sleepTimer', 'cancelSleepTimer', 'expiredNotice', 'menuHeading', 'cancelMenuItem',
  'unitMin', 'unitHr', 'unitHrs', 'enterPip', 'exitPip', 'titlePip', 'titlePipExit'
] as const;

describe('windows-own overlay catalog (M-WINDOWS-11)', () => {
  it('WIN_EN carries the shipped labels byte-identical to the pre-i18n literals', () => {
    expect(WIN_EN.overlay.cancelSleepTimer).toBe('Cancel sleep timer');
    expect(WIN_EN.overlay.expiredNotice).toBe('Sleep timer expired — playback stopped');
    expect(WIN_EN.overlay.sleepTimer).toBe('Sleep timer');
    expect(WIN_EN.overlay.menuHeading).toBe('Sleep Timer');
    expect(WIN_EN.overlay.cancelMenuItem).toBe('Cancel timer');
    expect(WIN_EN.overlay.unitMin).toBe('min');
    expect(WIN_EN.overlay.unitHr).toBe('hr');
    expect(WIN_EN.overlay.unitHrs).toBe('hrs');
    expect(WIN_EN.overlay.enterPip).toBe('Enter picture-in-picture');
    expect(WIN_EN.overlay.exitPip).toBe('Exit picture-in-picture');
    expect(WIN_EN.overlay.titlePip).toBe('Picture-in-Picture');
    expect(WIN_EN.overlay.titlePipExit).toBe('Exit PiP');
  });

  it('all six mirror locales ship the SAME overlay key set, no empties, no EN leaks of sentence copy', () => {
    for (const [tag, cat] of Object.entries(catalogs)) {
      expect(Object.keys(cat.overlay).sort(), tag).toEqual([...OVERLAY_KEYS].sort());
      for (const key of OVERLAY_KEYS) {
        expect(cat.overlay[key as (typeof OVERLAY_KEYS[number])], `${tag}.${key}`).not.toBe('');
      }
    }
    // Non-English locales must not ship the English sentence-form copies.
    for (const tag of Object.keys(catalogs) as Array<keyof typeof catalogs>) {
      expect(catalogs[tag].overlay.expiredNotice, tag).not.toBe('Sleep timer expired — playback stopped');
    }
  });

  it('SleepTimer.tsx has ZERO hardcoded user-facing English left', () => {
    const code = stripComments(sleepTimer);
    for (const literal of ['Cancel sleep timer', 'Sleep timer expired', 'Sleep Timer', 'Cancel timer', '"Sleep timer"', 'title="Sleep timer"']) {
      expect(code, literal).not.toContain(literal);
    }
    expect(code).toMatch(/import \{ tWin \} from '\.\.\/i18n\/windows-own'/);
    expect((code.match(/tWin\('overlay\./g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('PiPButton.tsx has ZERO hardcoded labels left', () => {
    const code = stripComments(pipButton);
    for (const literal of ['Enter picture-in-picture', 'Exit picture-in-picture', 'Picture-in-Picture', 'Exit PiP']) {
      expect(code, literal).not.toContain(literal);
    }
    expect(code).toMatch(/tWin\('overlay\.(enterPip|exitPip|titlePip|titlePipExit)'/);
  });

  it('the shell pins the catalog locale BEFORE the overlay is imported (single-instance law)', () => {
    // The overlay is a dynamic import of main.ts — same realm, SAME module
    // instance of windows-own (verified in the built output: the catalog
    // strings live in the main chunk, not overlay-*.js). So exactly one pin
    // governs both surfaces and it must precede the import.
    const mainTs = read('src/renderer/main.ts');
    const pinAt = mainTs.search(/setWindowLocale\(/);
    const importAt = mainTs.indexOf(`import('./overlay')`);
    expect(pinAt, 'main.ts calls setWindowLocale').toBeGreaterThan(-1);
    expect(importAt, 'main.ts dynamically imports ./overlay').toBeGreaterThan(-1);
    expect(pinAt, 'locale pinned before the overlay import').toBeLessThan(importAt);
    // And the overlay's CODE must not grow a second, redundant pin
    // (comments may explain the single-pin law; code may not repeat it):
    expect(stripComments(overlayEntry)).not.toMatch(/setWindowLocale/);
  });
});
