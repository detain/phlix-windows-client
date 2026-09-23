/**
 * French windows-own nav catalog — labels the ui message seam cannot reach
 * (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Terminology mirrors the vendored fr ui bundle where an equivalent exists:
 * shell.browse 'Parcourir', shell.explore 'Explorer', shell.watchHistory
 * 'Historique de lecture', shell.settings 'Paramètres', music.nav 'Musique';
 * search root follows common.searchPlaceholder 'Rechercher…' → 'Rechercher'.
 * 'Photos' is the standard French word too — its equality with English is
 * pinned in the no-English-leak allow-list.
 * Typography: elisions use the typographic apostrophe ’ (U+2019), matching
 * the vendored fr SSOT policy — pinned by the fr typography law in
 * tests/unit/i18nLocales.test.ts.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_FR = {
  nav: {
    myServers: 'Mes serveurs',
    federation: 'Fédération',
    shares: 'Partages',
    sharedWithMe: 'Partagé avec moi',
    inviteLinks: 'Liens d’invitation',
    history: 'Historique de lecture',
    explore: 'Explorer',
    recommendations: 'Pour vous',
    admin: 'Administration',
    browse: 'Parcourir',
    music: 'Musique',
    books: 'Livres',
    audiobooks: 'Livres audio',
    photos: 'Photos',
    search: 'Rechercher',
    settings: 'Paramètres'
  }
} satisfies WindowOwnCatalog;
