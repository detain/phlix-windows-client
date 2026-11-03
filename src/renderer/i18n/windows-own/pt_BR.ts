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
    syncPlay: 'SyncPlay',
    admin: 'Administração',
    browse: 'Navegar',
    music: 'Música',
    books: 'Livros',
    audiobooks: 'Audiolivros',
    photos: 'Fotos',
    search: 'Pesquisar',
    settings: 'Configurações'
  },
  boot: {
    incompatibleTitle: 'Servidor Phlix antigo demais',
    incompatibleIntro: 'Este servidor Phlix é antigo demais para esta versão do Phlix para Windows.',
    reportedVersion: 'O servidor informa a versão',
    requiredVersion: 'Phlix para Windows exige no mínimo',
    incompatibleAction: 'Peça ao proprietário do servidor para atualizar o Phlix Media Server e clique em "Tentar novamente" — a verificação é refeita na hora, sem reiniciar.',
    incompatibleRetry: 'Tentar novamente'
,
    failTitle: 'O Phlix não pôde iniciar',
    failMessage: 'O aplicativo não conseguiu carregar o que é necessário para abrir. O armazenamento seguro pode estar indisponível ou a instalação danificada. Tentar novamente geralmente resolve; caso contrário, reinstale o Phlix para Windows.',
    failRetry: 'Tentar novamente'
  },
  // M-WINDOWS-11: player-overlay labels (see en.ts law note; values are
  // this locale's translations of the shipped literals).
  overlay: {
    sleepTimer: 'Temporizador de sono',
    cancelSleepTimer: 'Cancelar temporizador de sono',
    expiredNotice: 'Temporizador de sono expirou — reprodução interrompida',
    menuHeading: 'Temporizador de sono',
    cancelMenuItem: 'Cancelar temporizador',
    unitMin: 'min',
    unitHr: 'h',
    unitHrs: 'h',
    enterPip: 'Ativar picture-in-picture',
    exitPip: 'Sair do picture-in-picture',
    titlePip: 'Picture-in-picture',
    titlePipExit: 'Sair do PiP'
  }
} satisfies WindowOwnCatalog;
