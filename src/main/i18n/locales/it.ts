/**
 * Italian catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - Informal "tu" register matching the it ui bundle's voice; Impostazioni is
 *   the SSOT settings term.
 * - Brand kept verbatim: 'Phlix', 'Phlix Media Server' (tray.tooltip,
 *   about.message); '{version}' placeholders untouched.
 * - 'File' (menu) and 'Stop' (tray/menu) are standard Italian loanwords and
 *   legitimately equal their English spellings — pinned in the no-English-leak
 *   allow-list.
 * - Thumbar seconds use it typography '10 s' (space before unit).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { MainCatalog } from '../index';

export const it = {
  tray: {
    show: 'Mostra Phlix',
    playPause: 'Riproduci/Pausa',
    stop: 'Stop',
    minimizeToTray: 'Riduci a icona nella barra delle applicazioni',
    quit: 'Esci',
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'File',
    settings: 'Impostazioni',
    playback: 'Riproduzione',
    playPause: 'Riproduci/Pausa',
    stop: 'Stop',
    rewind: 'Riavvolgi',
    fastForward: 'Avanzamento rapido',
    fullscreen: 'Schermo intero',
    view: 'Visualizza',
    help: 'Guida',
    about: 'Informazioni su Phlix',
    checkForUpdates: 'Controlla aggiornamenti'
  },
  thumbar: {
    previous: 'Precedente / Riavvolgi 10 s',
    play: 'Riproduci',
    pause: 'Pausa',
    next: 'Successivo / Avanza 10 s'
  },
  updater: {
    availableTitle: 'Aggiornamento disponibile',
    availableBody: 'Phlix {version} è disponibile. Fai clic per scaricare.',
    readyTitle: 'Aggiornamento pronto',
    readyBody: 'Phlix {version} è stato scaricato. Riavvia per applicare.'
  },
  about: {
    title: 'Informazioni su Phlix',
    message: 'Phlix Media Server',
    detail: 'Versione {version}\n\nUn server multimediale gratuito per la tua casa.'
  }
} satisfies MainCatalog;
