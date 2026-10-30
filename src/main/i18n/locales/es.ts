/**
 * Spanish catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - Neutral Latin-American Spanish with "tú" register, mirroring the es ui
 *   bundle's voice; nav terms match the SSOT bundle where an equivalent exists
 *   (Ajustes = settings).
 * - Brand kept verbatim: 'Phlix' (tray.tooltip — brand-only since
 *   M-WINDOWS-02 retired the client-as-server misname) and 'Phlix for
 *   Windows' (about.message); the server product name survives only where it
 *   actually names the server (boot.tooOldDetail).
 * - Thumbar seconds use es typography '10 s' (space before unit).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { MainCatalog } from '../index';

export const es = {
  tray: {
    show: 'Mostrar Phlix',
    playPause: 'Reproducir/Pausa',
    stop: 'Detener',
    minimizeToTray: 'Minimizar a la bandeja',
    quit: 'Salir',
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — reproduciendo'
  },
  menu: {
    file: 'Archivo',
    settings: 'Ajustes',
    playback: 'Reproducción',
    playPause: 'Reproducir/Pausa',
    stop: 'Detener',
    rewind: 'Retroceder 10 s',
    fastForward: 'Avanzar 10 s',
    fullscreen: 'Pantalla completa',
    view: 'Ver',
    help: 'Ayuda',
    about: 'Acerca de Phlix',
    checkForUpdates: 'Buscar actualizaciones'
  },
  thumbar: {
    previous: 'Retroceder 10 s',
    play: 'Reproducir',
    pause: 'Pausa',
    next: 'Avanzar 10 s'
  },
  updater: {
    availableTitle: 'Actualización disponible',
    availableBody: 'Phlix {version} está disponible. Haz clic para descargar.',
    notAvailableTitle: 'Ya tienes la última versión',
    notAvailableBody: 'Phlix {version} ya es la última versión.',
    readyTitle: 'Actualización lista',
    readyBody: 'Phlix {version} se ha descargado. Reinicia para aplicar.'
  },
  about: {
    title: 'Acerca de Phlix',
    message: 'Phlix for Windows',
    detail: 'Versión {version}\n\nUn cliente de medios gratuito para tu servidor Phlix.'
  },
  boot: {
    tooOldTitle: 'Versión del servidor demasiado antigua',
    tooOldMessage: 'El servidor Phlix al que se conectó esta aplicación es demasiado antiguo para esta versión de Phlix para Windows.',
    tooOldDetail: 'Versión del servidor: {serverVersion}\nMínimo requerido: {minimumVersion}\n\nPida al propietario del servidor que actualice Phlix Media Server y reinicie esta aplicación.'
  },
  deeplink: {
    failedTitle: 'No se pudo abrir el enlace',
    failedMessage: 'Phlix recibió un enlace que no pudo abrir. Comprueba su origen e inténtalo de nuevo.',
    confirmMessage: '¿Seguir este enlace de Phlix?',
    confirmAccept: 'Seguir enlace',
    confirmReject: 'Cancelar'
  },
  crash: {
    title: 'Algo ha ido mal',
    message: 'La ventana de Phlix ha dejado de responder. Recarga para recuperar tu sesión.',
    reload: 'Recargar ventana',
    dismiss: 'Descartar'
  }
} satisfies MainCatalog;
