/**
 * Italian windows-own nav catalog — labels the ui message seam cannot reach
 * (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Terminology mirrors the vendored it ui bundle where an equivalent exists:
 * shell.browse 'Sfoglia', shell.explore 'Esplora', shell.watchHistory
 * 'Cronologia', shell.settings 'Impostazioni', music.nav 'Musica';
 * search root follows common.searchPlaceholder 'Cerca…' → 'Cerca'.
 * No value here equals its English counterpart.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_IT = {
  nav: {
    myServers: 'I miei server',
    federation: 'Federazione',
    shares: 'Condivisioni',
    sharedWithMe: 'Condivisi con me',
    inviteLinks: 'Link di invito',
    history: 'Cronologia',
    explore: 'Esplora',
    recommendations: 'Per te',
    syncPlay: 'SyncPlay',
    admin: 'Amministrazione',
    browse: 'Sfoglia',
    music: 'Musica',
    books: 'Libri',
    audiobooks: 'Audiolibri',
    photos: 'Foto',
    search: 'Cerca',
    settings: 'Impostazioni'
  },
  boot: {
    incompatibleTitle: 'Server Phlix troppo vecchio',
    incompatibleIntro: 'Questo server Phlix è troppo vecchio per questa versione di Phlix per Windows.',
    reportedVersion: 'Il server riporta la versione',
    requiredVersion: 'Phlix per Windows richiede almeno',
    incompatibleAction: 'Chiedi al proprietario del server di aggiornare Phlix Media Server e premi "Riprova": il controllo viene ripetuto subito, senza riavvio.',
    incompatibleRetry: 'Riprova'
,
    failTitle: 'Impossibile avviare Phlix',
    failMessage: "L’applicazione non è riuscita a caricare i dati necessari all’avvio. L’archivio sicuro potrebbe non essere disponibile o l’installazione danneggiata. Riprovare spesso risolve; in caso contrario reinstalla Phlix per Windows.",
    failRetry: 'Riprova'
  },
  // M-WINDOWS-11: player-overlay labels (see en.ts law note; values are
  // this locale's translations of the shipped literals).
  overlay: {
    sleepTimer: 'Sleep timer',
    cancelSleepTimer: 'Annulla sleep timer',
    expiredNotice: 'Sleep timer scaduto — riproduzione interrotta',
    menuHeading: 'Timer per dormire',
    cancelMenuItem: 'Annulla timer',
    unitMin: 'min',
    unitHr: 'h',
    unitHrs: 'h',
    enterPip: 'Attiva picture-in-picture',
    exitPip: 'Esci dal picture-in-picture',
    titlePip: 'Picture-in-picture',
    titlePipExit: 'Esci dal PiP'
  }
} satisfies WindowOwnCatalog;
