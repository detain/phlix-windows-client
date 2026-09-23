/**
 * German windows-own nav catalog — labels the ui message seam cannot reach
 * (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Terminology mirrors the vendored de ui bundle where an equivalent exists:
 * shell.browse 'Stöbern', shell.explore 'Entdecken', shell.watchHistory
 * 'Wiedergabeverlauf', shell.settings 'Einstellungen', music.nav 'Musik';
 * search root follows common.searchPlaceholder 'Suchen…' → 'Suchen'.
 * 'Admin' is the accepted short de desktop form (Windows/de uses it too) — its
 * equality with English is pinned in the no-English-leak allow-list.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_DE = {
  nav: {
    myServers: 'Meine Server',
    federation: 'Föderation',
    shares: 'Freigaben',
    sharedWithMe: 'Mit mir geteilt',
    inviteLinks: 'Einladungslinks',
    history: 'Wiedergabeverlauf',
    explore: 'Entdecken',
    recommendations: 'Für dich',
    admin: 'Admin',
    browse: 'Stöbern',
    music: 'Musik',
    books: 'Bücher',
    audiobooks: 'Hörbücher',
    photos: 'Fotos',
    search: 'Suchen',
    settings: 'Einstellungen'
  }
} satisfies WindowOwnCatalog;
