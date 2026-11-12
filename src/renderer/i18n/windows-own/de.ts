/**
 * German windows-own nav catalog — labels the ui message seam cannot reach
 * (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Terminology mirrors the vendored de ui bundle where an equivalent exists:
 * shell.browse 'Stöbern', shell.explore 'Entdecken', shell.watchHistory
 * 'Wiedergabeverlauf', shell.settings 'Einstellungen', music.nav 'Musik';
 * search root follows common.searchPlaceholder 'Suchen…' → 'Suchen'.
 * 'Admin' is the accepted short de desktop form (Windows/de uses it too) — its
 * equality with English is pinned in the no-English-leak allow-list.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_DE = {
  nav: {
    myServers: 'Meine Server',
    federation: 'Föderation',
    shares: 'Freigaben',
    sharedWithMe: 'Mit mir geteilt',
    inviteLinks: 'Einladungslinks',
    history: 'Wiedergabeverlauf',
    explore: 'Entdecken',
    recommendations: 'Für dich',
    syncPlay: 'SyncPlay',
    admin: 'Admin',
    browse: 'Stöbern',
    music: 'Musik',
    books: 'Bücher',
    audiobooks: 'Hörbücher',
    photos: 'Fotos',
    search: 'Suchen',
    settings: 'Einstellungen'
  },
  boot: {
    incompatibleTitle: 'Phlix-Server zu alt',
    incompatibleIntro: 'Dieser Phlix-Server ist für diese Version von Phlix für Windows zu alt.',
    reportedVersion: 'Der Server meldet die Version',
    requiredVersion: 'Phlix für Windows benötigt mindestens',
    incompatibleAction: 'Bitten Sie den Betreiber des Servers, Phlix Media Server zu aktualisieren, und klicken Sie auf "Erneut versuchen" – die Prüfung läuft sofort weiter; ein Neustart ist nicht nötig.',
    incompatibleRetry: 'Erneut versuchen'
,
    incompatibleChange: 'Anderen Server verwenden',
    failTitle: 'Phlix konnte nicht starten',
    failMessage: 'Die Anwendung konnte die zum Start benötigten Daten nicht laden. Möglicherweise ist der sichere Speicher nicht verfügbar oder die Installation beschädigt. Ein erneuter Versuch hilft oft; sonst Phlix für Windows neu installieren.',
    failRetry: 'Erneut versuchen'
  },
  // M-WINDOWS-11: player-overlay labels (see en.ts law note; values are
  // this locale's translations of the shipped literals).
  deeplink: {
    hubOnlyTitle: 'Dieser Link gehört zu einem Phlix-Hub',
    inviteBody: 'Einladungslinks stammen von einem Phlix-Hub. Dieses Fenster ist direkt mit deinem Server verbunden – öffne den Link im Browser, in dem du ihn erhalten hast.',
    serverBody: 'Server-Links gehören zu einem Phlix-Hub. Dieses Fenster ist direkt mit deinem Server verbunden, daher gibt es hier nichts zu öffnen.'
  },
  overlay: {
    sleepTimer: 'Sleep-Timer',
    cancelSleepTimer: 'Sleep-Timer abbrechen',
    expiredNotice: 'Sleep-Timer abgelaufen — Wiedergabe gestoppt',
    menuHeading: 'Sleep-Timer',
    cancelMenuItem: 'Timer abbrechen',
    unitMin: 'min',
    unitHr: 'Std',
    unitHrs: 'Std',
    enterPip: 'Bild-im-Bild aktivieren',
    exitPip: 'Bild-im-Bild beenden',
    titlePip: 'Bild-im-Bild',
    titlePipExit: 'PiP beenden'
  }
} satisfies WindowOwnCatalog;
