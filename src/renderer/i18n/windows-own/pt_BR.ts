/**
 * Brazilian Portuguese windows-own nav catalog — labels the ui message seam
 * cannot reach (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Reached by every 'pt*' tag (region rule in normalizeLocaleTag) — the estate's
 * single Portuguese catalog.
 *
 * Terminology mirrors the vendored pt_BR ui bundle where an equivalent exists:
 * shell.browse 'Navegar', shell.explore 'Explorar', shell.watchHistory
 * 'Histórico de reprodução', shell.settings 'Configurações', music.nav
 * 'Música'; search root follows common.searchPlaceholder 'Pesquisar…'.
 * Note es 'Explorar' ≠ pt_BR 'Explorar' collide only on the verb root — both
 * differ from their English counterparts, so no allow-list entry is needed.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_PT_BR = {
  nav: {
    myServers: 'Meus servidores',
    federation: 'Federação',
    shares: 'Compartilhados',
    sharedWithMe: 'Compartilhados comigo',
    inviteLinks: 'Links de convite',
    history: 'Histórico de reprodução',
    explore: 'Explorar',
    recommendations: 'Para você',
    admin: 'Administração',
    browse: 'Navegar',
    music: 'Música',
    books: 'Livros',
    audiobooks: 'Audiolivros',
    photos: 'Fotos',
    search: 'Pesquisar',
    settings: 'Configurações'
  }
} satisfies WindowOwnCatalog;
