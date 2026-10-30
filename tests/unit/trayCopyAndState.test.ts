/**
 * @vitest-environment node
 *
 * M-WINDOWS-02 (casualgamer m2 / writer): the About dialog and the tray
 * tooltip called THIS client "Phlix Media Server" — it is not the server;
 * the server is another product this app connects to. Cure rotates the
 * in-app identity strings across all 7 main-process locales while keeping
 * the ONE legitimate reference: boot.tooOldDetail names the SERVER product
 * by its real name and must survive untouched (pinned below — anti-overerase).
 *
 * M-WINDOWS-37 (gameux): the tray was a static object — tooltip set once at
 * creation, zero playback awareness. power:update already carries the
 * renderer's playing truth into main (W4.6) and playback:progress {0,0}
 * marks a cleared session; both now drive a change-gated setToolTip. The
 * verdict logic is pure (trayTooltip.ts). The syncplay-party leg of the
 * review has NO main-visible state (room socket lives in the vendored ui
 * bundle) — honestly deferred, see report.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setMainLocale, t } from '../../src/main/i18n';
import { trayTooltipFor } from '../../src/main/trayTooltip';

const PROJECT_ROOT = resolve(__dirname, '../..');
const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8').replace(/\r\n/g, '\n');

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt_BR', 'ja'];

describe('client identity copy (M-WINDOWS-02)', () => {
  it('tray tooltip names the brand, not the server', () => {
    setMainLocale('en');
    expect(t('tray.tooltip')).toBe('Phlix');
  });

  it('About dialog names the Windows client', () => {
    setMainLocale('en');
    expect(t('about.message')).toBe('Phlix for Windows');
    expect(t('about.detail', { version: '9.9.9' }))
      .toBe('Version 9.9.9\n\nA free media client for your Phlix server.');
  });

  it('NO locale misnames the client as a media server (tooltip + about)', () => {
    for (const locale of LOCALES) {
      setMainLocale(locale);
      expect(t('tray.tooltip').toLowerCase(), locale).not.toMatch(/media server/);
      expect(t('tray.tooltip'), locale).toContain('Phlix');
      expect(t('about.message').toLowerCase(), locale).not.toMatch(/media server/);
      expect(t('about.detail').toLowerCase(), locale).not.toMatch(/media server|medienserver|serveur multimédia|servidor de medios|servidor de mídia|server multimedia|メディアサーバー/);
    }
  });

  it('the LEGITIMATE server-product reference in boot.tooOldDetail survives', () => {
    setMainLocale('en');
    expect(t('boot.tooOldDetail')).toContain('Phlix Media Server');
    setMainLocale('ja');
    expect(t('boot.tooOldDetail')).toContain('Phlix Media Server');
  });
});

describe('playback-aware tray tooltip (M-WINDOWS-37)', () => {
  it('pure verdict picks playing vs idle label', () => {
    const labels = { idle: 'Phlix', playing: 'Phlix — playing' } as const;
    expect(trayTooltipFor(true, labels)).toBe('Phlix — playing');
    expect(trayTooltipFor(false, labels)).toBe('Phlix');
  });

  it('every locale ships a distinct playing tooltip', () => {
    for (const locale of LOCALES) {
      setMainLocale(locale);
      const playing = t('tray.tooltipPlaying');
      expect(playing, locale).toContain('Phlix');
      expect(playing, locale).not.toBe(t('tray.tooltip'));
    }
  });

  it('createTray routes the initial tooltip through the sync (no direct setToolTip left)', () => {
    expect(mainSource).toMatch(/function createTray[\s\S]*?syncTrayTooltip\(\);/);
    const setToolTipCalls = mainSource.match(/\.setToolTip\(/g) ?? [];
    expect(setToolTipCalls.length).toBe(1); // only inside syncTrayTooltip
  });

  it('power:update arms the playing verdict; progress {0,0} clears it', () => {
    const power = mainSource.slice(
      mainSource.indexOf("ipcMain.on('power:update'"),
      mainSource.indexOf("ipcMain.on('power:update'") + 400);
    expect(power).toMatch(/trayTooltipPlaying = /);
    expect(power).toMatch(/syncTrayTooltip\(\);/);
    const progress = mainSource.slice(
      mainSource.indexOf("ipcMain.on('playback:progress'"),
      mainSource.indexOf("ipcMain.on('playback:progress'") + 700);
    expect(progress).toMatch(/trayTooltipPlaying = false;/);
    expect(progress).toMatch(/syncTrayTooltip\(\);/);
  });

  it('the sync is change-gated (no per-tick native churn)', () => {
    const fn = mainSource.slice(mainSource.indexOf('function syncTrayTooltip'), mainSource.indexOf('function syncTrayTooltip') + 600);
    expect(fn).toMatch(/===\s*lastTrayTooltip\s*\)\s*return/);
  });
});
