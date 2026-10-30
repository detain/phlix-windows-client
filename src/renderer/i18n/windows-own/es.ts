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
  },
  boot: {
    incompatibleTitle: 'Servidor Phlix demasiado antiguo',
    incompatibleIntro: 'Este servidor Phlix es demasiado antiguo para esta versión de Phlix para Windows.',
    reportedVersion: 'El servidor informa de la versión',
    requiredVersion: 'Phlix para Windows requiere como mínimo',
    incompatibleAction: 'Actualiza el servidor Phlix o conéctate a uno más nuevo, y reinicia la app.',
    incompatibleRetry: 'Volver a intentarlo'
  },
  // M-WINDOWS-11: player-overlay labels (see en.ts law note; values are
  // this locale's translations of the shipped literals).
  overlay: {
    sleepTimer: 'Temporizador de sueño',
    cancelSleepTimer: 'Cancelar temporizador de sueño',
    expiredNotice: 'Temporizador de sueño expirado: reproducción detenida',
    menuHeading: 'Temporizador de sueño',
    cancelMenuItem: 'Cancelar temporizador',
    unitMin: 'min',
    unitHr: 'h',
    unitHrs: 'h',
    enterPip: 'Activar imagen en imagen',
    exitPip: 'Salir de imagen en imagen',
    titlePip: 'Imagen en imagen',
    titlePipExit: 'Salir de PiP'
  }
} satisfies WindowOwnCatalog;
