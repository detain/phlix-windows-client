/**
 * Italian catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - Informal "tu" register matching the it ui bundle's voice; Impostazioni is
 *   the SSOT settings term.
 * - Brand kept verbatim: 'Phlix' (tray.tooltip — brand-only since
 *   M-WINDOWS-02 retired the client-as-server misname) and 'Phlix for
 *   Windows' (about.message); the server product name survives only where it
 *   actually names the server (boot.tooOldDetail).
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
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — riproduzione in corso'
  },
  menu: {
    file: 'File',
    settings: 'Impostazioni',
    playback: 'Riproduzione',
    playPause: 'Riproduci/Pausa',
    stop: 'Stop',
    rewind: 'Riavvolgi 10 s',
    fastForward: 'Avanza 10 s',
    fullscreen: 'Schermo intero',
    view: 'Visualizza',
    help: 'Guida',
    about: 'Informazioni su Phlix',
    checkForUpdates: 'Controlla aggiornamenti'
  },
  thumbar: {
    previous: 'Riavvolgi 10 s',
    play: 'Riproduci',
    pause: 'Pausa',
    next: 'Avanza 10 s'
  },
  updater: {
    availableTitle: 'Aggiornamento disponibile',
    availableBody: 'Phlix {version} è disponibile. Fai clic per scaricare.',
    notAvailableTitle: 'Stai usando la versione più recente',
    notAvailableBody: 'Phlix {version} è già la versione più recente.',
    checkFailedTitle: 'Controllo aggiornamenti non riuscito',
    checkFailedBody: 'Phlix non ha potuto verificare gli aggiornamenti al momento. Riprova più tardi.',
    readyTitle: 'Aggiornamento pronto',
    readyBody: 'Phlix {version} è stato scaricato. Riavvia per applicare.'
  },
  about: {
    title: 'Informazioni su Phlix',
    message: 'Phlix for Windows',
    detail: 'Versione {version}\n\nUn client multimedia gratuito per il tuo server Phlix.'
  },
  boot: {
    tooOldTitle: 'Versione del server troppo vecchia',
    tooOldMessage: 'Il server Phlix a cui questa app si è connessa è troppo vecchio per questa versione di Phlix per Windows.',
    tooOldDetail: 'Versione del server: {serverVersion}\nMinimo richiesto: {minimumVersion}\n\nChiedi al proprietario del server di aggiornare Phlix Media Server, quindi riavvia questa app.'
  },
  deeplink: {
    failedTitle: 'Impossibile aprire il collegamento',
    failedMessage: 'Phlix ha ricevuto un collegamento che non è stato possibile aprire. Verifica la provenienza e riprova.',
    confirmMessage: 'Seguire questo link Phlix?',
    confirmAccept: 'Segui link',
    confirmReject: 'Annulla'
  },
  crash: {
    title: 'Si è verificato un problema',
    message: 'La finestra di Phlix ha smesso di rispondere. Ricarica per riprendere la sessione.',
    reload: 'Ricarica finestra',
    dismiss: 'Chiudi'
  }
} satisfies MainCatalog;
