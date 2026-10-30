/**
 * French catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - "vous" register, matching the fr ui bundle's voice; Paramètres = settings
 *   term from the SSOT bundle.
 * - Brand kept verbatim: 'Phlix' (tray.tooltip — brand-only since
 *   M-WINDOWS-02 retired the client-as-server misname) and 'Phlix for
 *   Windows' (about.message); the server product name survives only where it
 *   actually names the server (boot.tooOldDetail).
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
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — lecture en cours'
  },
  menu: {
    file: 'Fichier',
    settings: 'Paramètres',
    playback: 'Lecture',
    playPause: 'Lecture/Pause',
    stop: 'Arrêter',
    rewind: 'Retour 10 s',
    fastForward: 'Avance 10 s',
    fullscreen: 'Plein écran',
    view: 'Affichage',
    help: 'Aide',
    about: 'À propos de Phlix',
    checkForUpdates: 'Rechercher des mises à jour'
  },
  thumbar: {
    previous: 'Retour 10 s',
    play: 'Lecture',
    pause: 'Pause',
    next: 'Avance 10 s'
  },
  updater: {
    availableTitle: 'Mise à jour disponible',
    availableBody: 'Phlix {version} est disponible. Cliquez pour télécharger.',
    notAvailableTitle: 'Vous utilisez la dernière version',
    notAvailableBody: 'Phlix {version} est déjà la dernière version.',
    readyTitle: 'Mise à jour prête',
    readyBody: 'Phlix {version} a été téléchargée. Redémarrez pour appliquer.'
  },
  about: {
    title: 'À propos de Phlix',
    message: 'Phlix for Windows',
    detail: 'Version {version}\n\nUn client multimédia gratuit pour votre serveur Phlix.'
  },
  boot: {
    tooOldTitle: 'Version du serveur trop ancienne',
    tooOldMessage: 'Le serveur Phlix auquel cette application s’est connectée est trop ancien pour cette version de Phlix pour Windows.',
    tooOldDetail: 'Version du serveur : {serverVersion}\nMinimum requis : {minimumVersion}\n\nDemandez au propriétaire du serveur de mettre à jour Phlix Media Server, puis relancez cette application.'
  },
  deeplink: {
    failedTitle: 'Impossible d’ouvrir le lien',
    failedMessage: 'Phlix a reçu un lien qu’il n’a pas pu ouvrir. Vérifiez son origine et réessayez.',
    confirmMessage: 'Suivre ce lien Phlix ?',
    confirmAccept: 'Suivre le lien',
    confirmReject: 'Annuler'
  },
  crash: {
    title: 'Un problème est survenu',
    message: 'La fenêtre Phlix a cessé de répondre. Rechargez pour reprendre votre session.',
    reload: 'Recharger la fenêtre',
    dismiss: 'Ignorer'
  }
} satisfies MainCatalog;
