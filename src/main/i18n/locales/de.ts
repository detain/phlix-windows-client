/**
 * German catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - "Sie" register, matching Windows de desktop conventions; Einstellungen /
 *   Nach Updates suchen mirror the de ui bundle + Windows shell wording.
 * - Brand kept verbatim: 'Phlix', 'Phlix Media Server' (tray.tooltip,
 *   about.message); '{version}' placeholders untouched.
 * - 'Pause' is the standard German media label (thumbar.pause equals the English
 *   word legitimately — pinned in the no-English-leak allow-list).
 * - Tray uses the Windows de term 'Infobereich' (system tray).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { MainCatalog } from '../index';

export const de = {
  tray: {
    show: 'Phlix anzeigen',
    playPause: 'Wiedergabe/Pause',
    stop: 'Stopp',
    minimizeToTray: 'In den Infobereich minimieren',
    quit: 'Beenden',
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'Datei',
    settings: 'Einstellungen',
    playback: 'Wiedergabe',
    playPause: 'Wiedergabe/Pause',
    stop: 'Stopp',
    rewind: 'Zurückspulen',
    fastForward: 'Vorspulen',
    fullscreen: 'Vollbild',
    view: 'Ansicht',
    help: 'Hilfe',
    about: 'Über Phlix',
    checkForUpdates: 'Nach Updates suchen'
  },
  thumbar: {
    previous: 'Zurück / 10 s zurückspulen',
    play: 'Wiedergabe',
    pause: 'Pause',
    next: 'Weiter / 10 s vorspulen'
  },
  updater: {
    availableTitle: 'Update verfügbar',
    availableBody: 'Phlix {version} ist verfügbar. Klicken Sie zum Herunterladen.',
    readyTitle: 'Update bereit',
    readyBody: 'Phlix {version} wurde heruntergeladen. Starten Sie neu, um es anzuwenden.'
  },
  about: {
    title: 'Über Phlix',
    message: 'Phlix Media Server',
    detail: 'Version {version}\n\nEin kostenloser Medienserver für Ihr Zuhause.'
  }
} satisfies MainCatalog;
