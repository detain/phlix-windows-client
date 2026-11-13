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
    syncPlay: 'SyncPlay',
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
    incompatibleAction: 'Pide al propietario del servidor que actualice Phlix Media Server y pulsa "Volver a intentarlo": la comprobación se repite en el sitio, sin reiniciar.',
    incompatibleRetry: 'Volver a intentarlo'
,
    incompatibleChange: 'Usar un servidor diferente',
    failTitle: 'Phlix no pudo iniciarse',
    failMessage: 'La aplicación no pudo cargar lo necesario para abrirse. Puede que el almacenamiento seguro no esté disponible o que la instalación esté dañada. Reintentar suele ayudar; si no, reinstala Phlix para Windows.',
    failRetry: 'Reintentar',
    checking: 'Comprobando…'
  },
  // M-WINDOWS-11: player-overlay labels (see en.ts law note; values are
  // this locale's translations of the shipped literals).
  deeplink: {
    hubOnlyTitle: 'Este enlace pertenece a un Phlix Hub',
    inviteBody: 'Los enlaces de invitación proceden de un Phlix Hub. Esta ventana está conectada directamente a tu servidor: abre el enlace en el navegador donde lo recibiste.',
    serverBody: 'Los enlaces de servidor pertenecen a un Phlix Hub. Esta ventana está conectada directamente a tu servidor, así que aquí no hay nada que abrir.'
  },
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
