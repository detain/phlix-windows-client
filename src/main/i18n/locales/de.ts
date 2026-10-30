/**
 * German catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - "Sie" register, matching Windows de desktop conventions; Einstellungen /
 *   Nach Updates suchen mirror the de ui bundle + Windows shell wording.
 * - Brand kept verbatim: 'Phlix' (tray.tooltip — brand-only since
 *   M-WINDOWS-02 retired the client-as-server misname) and 'Phlix for
 *   Windows' (about.message); the server product name survives only where it
 *   actually names the server (boot.tooOldDetail).
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
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — Wiedergabe läuft'
  },
  menu: {
    file: 'Datei',
    settings: 'Einstellungen',
    playback: 'Wiedergabe',
    playPause: 'Wiedergabe/Pause',
    stop: 'Stopp',
    rewind: '10 s zurückspulen',
    fastForward: '10 s vorspulen',
    fullscreen: 'Vollbild',
    view: 'Ansicht',
    help: 'Hilfe',
    about: 'Über Phlix',
    checkForUpdates: 'Nach Updates suchen'
  },
  thumbar: {
    previous: '10 s zurückspulen',
    play: 'Wiedergabe',
    pause: 'Pause',
    next: '10 s vorspulen'
  },
  updater: {
    availableTitle: 'Update verfügbar',
    availableBody: 'Phlix {version} ist verfügbar. Klicken Sie zum Herunterladen.',
    notAvailableTitle: 'Sie nutzen die neueste Version',
    notAvailableBody: 'Phlix {version} ist bereits die neueste Version.',
    readyTitle: 'Update bereit',
    readyBody: 'Phlix {version} wurde heruntergeladen. Starten Sie neu, um es anzuwenden.'
  },
  about: {
    title: 'Über Phlix',
    message: 'Phlix for Windows',
    detail: 'Version {version}\n\nEin kostenloser Media-Client für Ihren Phlix-Server.'
  },
  boot: {
    tooOldTitle: 'Server-Version zu alt',
    tooOldMessage: 'Der Phlix-Server, mit dem sich diese App verbunden hat, ist für diese Version von Phlix für Windows zu alt.',
    tooOldDetail: 'Server-Version: {serverVersion}\nMindestens erforderlich: {minimumVersion}\n\nBitten Sie den Betreiber des Servers, Phlix Media Server zu aktualisieren, und starten Sie diese App neu.'
  },
  deeplink: {
    failedTitle: 'Link konnte nicht geöffnet werden',
    failedMessage: 'Phlix hat einen Link erhalten, der nicht geöffnet werden konnte. Prüfen Sie die Quelle und versuchen Sie es erneut.',
    confirmMessage: 'Diesem Phlix-Link folgen?',
    confirmAccept: 'Link folgen',
    confirmReject: 'Abbrechen'
  },
  crash: {
    title: 'Etwas ist schiefgelaufen',
    message: 'Das Phlix-Fenster reagiert nicht mehr. Laden Sie neu, um die Sitzung wiederherzustellen.',
    reload: 'Fenster neu laden',
    dismiss: 'Verwerfen'
  }
} satisfies MainCatalog;
