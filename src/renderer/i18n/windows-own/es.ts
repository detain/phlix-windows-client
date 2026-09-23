/**
 * Spanish windows-own nav catalog — labels the ui message seam cannot reach
 * (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Terminology mirrors the vendored es ui bundle where an equivalent exists:
 * shell.browse 'Explorar', shell.explore 'Descubrir', shell.watchHistory
 * 'Historial de reproducción', shell.settings 'Ajustes', music.nav 'Música';
 * search root follows common.searchPlaceholder 'Buscar…'.
 * Hub terms (My Servers/Federation/Shares/…) have no ui-bundle counterpart —
 * standard es software wording, "tú"-register neutral.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_ES = {
  nav: {
    myServers: 'Mis servidores',
    federation: 'Federación',
    shares: 'Compartidos',
    sharedWithMe: 'Compartido conmigo',
    inviteLinks: 'Enlaces de invitación',
    history: 'Historial de reproducción',
    explore: 'Descubrir',
    recommendations: 'Para ti',
    admin: 'Administración',
    browse: 'Explorar',
    music: 'Música',
    books: 'Libros',
    audiobooks: 'Audiolibros',
    photos: 'Fotos',
    search: 'Buscar',
    settings: 'Ajustes'
  }
} satisfies WindowOwnCatalog;
