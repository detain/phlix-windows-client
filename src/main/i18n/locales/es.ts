/**
 * Spanish catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - Neutral Latin-American Spanish with "tú" register, mirroring the es ui
 *   bundle's voice; nav terms match the SSOT bundle where an equivalent exists
 *   (Ajustes = settings).
 * - Brand kept verbatim: 'Phlix', 'Phlix Media Server' (tray.tooltip,
 *   about.message); '{version}' placeholders untouched.
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
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'Archivo',
    settings: 'Ajustes',
    playback: 'Reproducción',
    playPause: 'Reproducir/Pausa',
    stop: 'Detener',
    rewind: 'Retroceder',
    fastForward: 'Avance rápido',
    fullscreen: 'Pantalla completa',
    view: 'Ver',
    help: 'Ayuda',
    about: 'Acerca de Phlix',
    checkForUpdates: 'Buscar actualizaciones'
  },
  thumbar: {
    previous: 'Anterior / Retroceder 10 s',
    play: 'Reproducir',
    pause: 'Pausa',
    next: 'Siguiente / Avanzar 10 s'
  },
  updater: {
    availableTitle: 'Actualización disponible',
    availableBody: 'Phlix {version} está disponible. Haz clic para descargar.',
    readyTitle: 'Actualización lista',
    readyBody: 'Phlix {version} se ha descargado. Reinicia para aplicar.'
  },
  about: {
    title: 'Acerca de Phlix',
    message: 'Phlix Media Server',
    detail: 'Versión {version}\n\nUn servidor de medios gratuito para tu hogar.'
  }
} satisfies MainCatalog;
