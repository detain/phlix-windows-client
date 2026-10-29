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
    incompatibleAction: 'Aggiorna il server Phlix o connettiti a uno più recente, quindi riavvia l’app.',
    incompatibleRetry: 'Riprova'
  }
} satisfies WindowOwnCatalog;
