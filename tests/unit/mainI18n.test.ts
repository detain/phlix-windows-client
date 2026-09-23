/**
 * Main-process i18n guard tests.
 *
 * THE byte-identical-English contract: EVERY value below is copied verbatim from
 * the literals that were hardcoded in src/main/index.ts before the i18n
 * extraction (feat/i18n-wiring). If someone edits a catalog value, this test
 * goes red — which is exactly the point.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, afterEach } from 'vitest';
import { en } from '../../src/main/i18n/en';
import { getMainLocale, setMainLocale, t } from '../../src/main/i18n';
import type { MainMessageKey } from '../../src/main/i18n';

/** The exact strings as they appeared in src/main/index.ts before extraction. */
const ORIGINAL_MAIN_PROCESS_STRINGS: Record<MainMessageKey, string> = {
  'tray.show': 'Show Phlix',
  'tray.playPause': 'Play/Pause',
  'tray.stop': 'Stop',
  'tray.minimizeToTray': 'Minimize to Tray',
  'tray.quit': 'Quit',
  'tray.tooltip': 'Phlix Media Server',

  'menu.file': 'File',
  'menu.settings': 'Settings',
  'menu.playback': 'Playback',
  'menu.playPause': 'Play/Pause',
  'menu.stop': 'Stop',
  'menu.rewind': 'Rewind',
  'menu.fastForward': 'Fast Forward',
  'menu.fullscreen': 'Fullscreen',
  'menu.view': 'View',
  'menu.help': 'Help',
  'menu.about': 'About Phlix',
  'menu.checkForUpdates': 'Check for updates',

  'thumbar.previous': 'Previous / Rewind 10s',
  'thumbar.play': 'Play',
  'thumbar.pause': 'Pause',
  'thumbar.next': 'Next / Forward 10s',

  'updater.availableTitle': 'Update Available',
  'updater.availableBody': 'Phlix {version} is available. Click to download.',
  'updater.readyTitle': 'Update Ready',
  'updater.readyBody': 'Phlix {version} has been downloaded. Restart to apply.',

  'about.title': 'About Phlix',
  'about.message': 'Phlix Media Server',
  'about.detail': 'Version {version}\n\nA free media server for your home.'
};

function flattenedCatalogKeys(): MainMessageKey[] {
  return Object.entries(en).flatMap(([group, messages]) =>
    Object.keys(messages).map((id) => `${group}.${id}` as MainMessageKey)
  );
}

describe('main-process i18n catalog', () => {
  afterEach(() => {
    setMainLocale('en');
  });

  it('covers exactly the extracted keys — no drift in either direction', () => {
    const catalogKeys = flattenedCatalogKeys().sort();
    const pinnedKeys = Object.keys(ORIGINAL_MAIN_PROCESS_STRINGS).sort();
    expect(catalogKeys).toEqual(pinnedKeys);
  });

  it('t() resolves every catalog key byte-identically to the pre-extraction literal', () => {
    setMainLocale('en');
    for (const key of flattenedCatalogKeys()) {
      expect(t(key)).toBe(ORIGINAL_MAIN_PROCESS_STRINGS[key]);
    }
  });

  it('every catalog leaf is a non-empty string', () => {
    for (const group of Object.values(en)) {
      for (const value of Object.values(group)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('main-process i18n interpolation', () => {
  it('updater available body renders the original template literal exactly', () => {
    expect(t('updater.availableBody', { version: '1.2.3' }))
      .toBe('Phlix 1.2.3 is available. Click to download.');
  });

  it('updater ready body renders the original template literal exactly', () => {
    expect(t('updater.readyBody', { version: '2.0.0' }))
      .toBe('Phlix 2.0.0 has been downloaded. Restart to apply.');
  });

  it('about detail renders the original template literal exactly', () => {
    expect(t('about.detail', { version: '9.9.9' }))
      .toBe('Version 9.9.9\n\nA free media server for your home.');
  });

  it('leaves placeholders intact when the param is missing', () => {
    expect(t('updater.availableBody')).toBe('Phlix {version} is available. Click to download.');
    expect(t('updater.availableBody', { other: 'x' })).toBe('Phlix {version} is available. Click to download.');
  });
});

describe('main-process locale resolution', () => {
  it('falls back to English for an unregistered locale', () => {
    expect(setMainLocale('zz-ZZ')).toBe('en');
    expect(getMainLocale()).toBe('en');
    expect(t('tray.quit')).toBe('Quit');
  });

  it('matches region tags to their base-language catalog', () => {
    expect(setMainLocale('en-GB')).toBe('en-gb');
    // Only the English catalog ships, so an English-region tag still renders
    // the pinned English values.
    expect(t('menu.file')).toBe('File');
  });

  it('treats a blank locale as unresolvable and falls back to English', () => {
    expect(setMainLocale('   ')).toBe('en');
  });

  it('throws loudly on an unknown key (typed-away at compile time; runtime net)', () => {
    expect(() => t('tray.nope' as MainMessageKey)).toThrow(/Unknown main-process message key "tray\.nope"/);
    expect(() => t('nope.x' as MainMessageKey)).toThrow(/Unknown main-process message key/);
  });
});
