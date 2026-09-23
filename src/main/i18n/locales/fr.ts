/**
 * French catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - "vous" register, matching the fr ui bundle's voice; Paramètres = settings
 *   term from the SSOT bundle.
 * - Brand kept verbatim: 'Phlix', 'Phlix Media Server' (tray.tooltip,
 *   about.message); '{version}' placeholders untouched.
 * - 'Pause' is the standard French media label (thumbar.pause equals the English
 *   word legitimately — pinned in the no-English-leak allow-list).
 * - Thumbar seconds use fr typography '10 s' (space before unit).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { MainCatalog } from '../index';

export const fr = {
  tray: {
    show: 'Afficher Phlix',
    playPause: 'Lecture/Pause',
    stop: 'Arrêter',
    minimizeToTray: 'Réduire dans la zone de notification',
    quit: 'Quitter',
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'Fichier',
    settings: 'Paramètres',
    playback: 'Lecture',
    playPause: 'Lecture/Pause',
    stop: 'Arrêter',
    rewind: 'Retour arrière',
    fastForward: 'Avance rapide',
    fullscreen: 'Plein écran',
    view: 'Affichage',
    help: 'Aide',
    about: 'À propos de Phlix',
    checkForUpdates: 'Rechercher des mises à jour'
  },
  thumbar: {
    previous: 'Précédent / Retour 10 s',
    play: 'Lecture',
    pause: 'Pause',
    next: 'Suivant / Avance 10 s'
  },
  updater: {
    availableTitle: 'Mise à jour disponible',
    availableBody: 'Phlix {version} est disponible. Cliquez pour télécharger.',
    readyTitle: 'Mise à jour prête',
    readyBody: 'Phlix {version} a été téléchargée. Redémarrez pour appliquer.'
  },
  about: {
    title: 'À propos de Phlix',
    message: 'Phlix Media Server',
    detail: 'Version {version}\n\nUn serveur multimédia gratuit pour votre maison.'
  }
} satisfies MainCatalog;
