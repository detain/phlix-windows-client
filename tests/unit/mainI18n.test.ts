/**
 * Main-process i18n guard tests.
 *
 * THE byte-identical-English contract: EVERY value below is copied verbatim from
 * the literals that were hardcoded in src/main/index.ts before the i18n
 * extraction (feat/i18n-wiring), except the `boot.*` trio and the
 * `updater.notAvailable*` pair — those strings never existed as hardcoded
 * literals: they shipped with the too-old-server surface (M-WINDOWS-02) and the
 * update-not-available reply (M-WINDOWS-12) and are pinned here as
 * born-in-the-catalog additions. Either way, if someone edits a catalog value,
 * this test goes red — exactly the point.
 *
 * DELIBERATE ROTATIONS recorded in the table below (each a shipped copy fix,
 * not drift): the M-WINDOWS-49/50 single-label pass — the seek action is
 * 'Rewind 10s'/'Forward 10s' in menu + thumbar alike (the former
 * 'Previous / …'/'Next / …' tooltips mislabeled the 10-second SEEK as a track
 * change, and 'Fast Forward' was a third name for the same action), and
 * tray.minimizeToTray went to sentence case per Windows HIG; and the
 * W-min201 misname pass (review windows__casualgamer m2) — the About dialog
 * and the tray tooltip called THIS client 'Phlix Media Server', which is the
 * server product's name, not ours: tooltip is now the bare brand (it is
 * playback-aware via tray.tooltipPlaying), message 'Phlix for Windows', detail
 * speaks of a media CLIENT for your Phlix server. boot.tooOldDetail still
 * names 'Phlix Media Server' — there the sentence is ABOUT the server, and
 * trayCopyAndState.test.ts pins that distinction against well-meaning
 * over-erasure.
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
  'tray.minimizeToTray': 'Minimize to tray',
  'tray.quit': 'Quit',
  'tray.tooltip': 'Phlix',
  'tray.tooltipPlaying': 'Phlix — playing',

  'menu.file': 'File',
  'menu.settings': 'Settings',
  'menu.playback': 'Playback',
  'menu.playPause': 'Play/Pause',
  'menu.stop': 'Stop',
  'menu.rewind': 'Rewind 10s',
  'menu.fastForward': 'Forward 10s',
  'menu.fullscreen': 'Fullscreen',
  'menu.view': 'View',
  'menu.help': 'Help',
  'menu.about': 'About Phlix',
  'menu.checkForUpdates': 'Check for updates',

  'thumbar.previous': 'Rewind 10s',
  'thumbar.play': 'Play',
  'thumbar.pause': 'Pause',
  'thumbar.next': 'Forward 10s',

  'updater.availableTitle': 'Update Available',
  'updater.availableBody': 'Phlix {version} is available. Click to download.',
  // M-WINDOWS-12 additions (born in the catalog, not extracted — see header):
  // the "update-not-available" reply for a user-requested check.
  'updater.notAvailableTitle': "You're on the latest version",
  'updater.notAvailableBody': 'Phlix {version} is already the latest version.',
  // R-WINDOWS-09 addition (born in the catalog, same precedent): the visible
  // answer a manual check earns from a genuine (non-offline) failure.
  'updater.checkFailedTitle': 'Update Check Failed',
  'updater.checkFailedBody': 'Phlix could not check for updates right now. Try again later.',
  'updater.readyTitle': 'Update Ready',
  'updater.readyBody': 'Phlix {version} has been downloaded. Restart to apply.',

  'about.title': 'About Phlix',
  'about.message': 'Phlix for Windows',
  'about.detail': 'Version {version}\n\nA free media client for your Phlix server.',

  // M-WINDOWS-02 additions (born in the catalog, not extracted — see header):
  // the too-old-server dialog text. The renderer-side screen strings live in
  // the separate windows-own catalog (src/renderer/i18n/windows-own).
  'boot.tooOldTitle': 'Server Version Too Old',
  'boot.tooOldMessage': 'The Phlix server this app connected to is too old for this version of Phlix for Windows.',
  'boot.tooOldDetail': 'Server version: {serverVersion}\nMinimum required: {minimumVersion}\n\nAsk the server owner to update Phlix Media Server, then restart this app.',
  // M-WINDOWS-15 additions (born in the catalog, same precedent): the honest
  // failure surface for a deep link the app could not route.
  'deeplink.failedTitle': 'Could Not Open Link',
  'deeplink.failedMessage': 'Phlix received a link it could not open. Check where you got it and try again.',
  // M-WINDOWS-31 additions (born in the catalog): the confirm-before-consume
  // question for token-bearing (invite) links and its two buttons.
  'deeplink.confirmMessage': 'Follow this Phlix link?',
  'deeplink.confirmAccept': 'Follow link',
  'deeplink.confirmReject': 'Cancel',
  // M-WINDOWS-09 additions (born in the catalog): the renderer-crash
  // recovery question (title, message, Reload / Dismiss buttons).
  'crash.title': 'Something went wrong',
  'crash.message': 'The Phlix window stopped responding. Reload to recover your session.',
  'crash.reload': 'Reload window',
  'crash.dismiss': 'Dismiss'
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
      .toBe('Version 9.9.9\n\nA free media client for your Phlix server.');
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
