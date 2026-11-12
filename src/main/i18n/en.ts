/**
 * English catalog for every user-facing string the Electron MAIN process renders.
 *
 * These strings (tray menu, app menu, taskbar thumbar tooltips, updater
 * notifications, About dialog) live in the main process and can therefore never
 * flow through `@phlix/ui`'s renderer-side `PhlixAppConfig.messages` seam — they
 * are extracted here instead. Every value is byte-identical to the literal that
 * was previously hardcoded in `src/main/index.ts`; `tests/unit/mainI18n.test.ts`
 * pins that contract.
 *
 * Shape mirrors `@phlix/ui`'s two-level `group.key` catalog so both halves of the
 * client read the same way. `{name}` placeholders are interpolated by `t()`:
 * `t('updater.availableBody', { version: '1.2.3' })`.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
export const en = {
  tray: {
    show: 'Show Phlix',
    playPause: 'Play/Pause',
    stop: 'Stop',
    minimizeToTray: 'Minimize to tray',
    quit: 'Quit',
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — playing'
  },
  menu: {
    file: 'File',
    settings: 'Settings',
    playback: 'Playback',
    playPause: 'Play/Pause',
    stop: 'Stop',
    rewind: 'Rewind 10s',
    fastForward: 'Forward 10s',
    fullscreen: 'Fullscreen',
    view: 'View',
    help: 'Help',
    about: 'About Phlix',
    checkForUpdates: 'Check for updates',
    notifications: 'Notifications',
    keyboardShortcutsHint: 'Shortcuts: Space, ←, → (outside the player)'
  },
  thumbar: {
    previous: 'Rewind 10s',
    play: 'Play',
    pause: 'Pause',
    next: 'Forward 10s'
  },
  updater: {
    availableTitle: 'Update Available',
    availableBody: 'Phlix {version} is available. Click to download.',
    availableDialogBody: 'Phlix {version} is available.',
    downloadButton: 'Download',
    laterButton: 'Later',
    notAvailableTitle: "You're on the latest version",
    notAvailableBody: 'Phlix {version} is already the latest version.',
    // R-WINDOWS-09 additions (born in the catalog, M-WINDOWS-12 precedent):
    // the visible answer a manual check earns from a non-offline failure.
    checkFailedTitle: 'Update Check Failed',
    checkFailedBody: 'Phlix could not check for updates right now. Try again later.',
    readyTitle: 'Update Ready',
    readyBody: 'Phlix {version} has been downloaded. Restart to apply.'
  },
  about: {
    title: 'About Phlix',
    message: 'Phlix for Windows',
    detail: 'Version {version}\n\nA free media client for your Phlix server.'
  },
  boot: {
    tooOldTitle: 'Server Version Too Old',
    tooOldMessage: 'The Phlix server this app connected to is too old for this version of Phlix for Windows.',
    tooOldDetail: 'Server version: {serverVersion}\nMinimum required: {minimumVersion}\n\nAsk the server owner to update Phlix Media Server. After the update, this app detects it on its next check — no restart needed.'
  },
  deeplink: {
    failedTitle: 'Could Not Open Link',
    failedMessage: 'Phlix received a link it could not open. Check where you got it and try again.',
    // windows__gameux 1[m] (MW-086): the confirm-before-consume question must
    // not wear the failure title — a parsed-but-not-yet-approved link is a
    // consent question, not a "Could Not Open Link" error. failedTitle stays
    // exclusive to showDeepLinkRejectedDialog.
    confirmTitle: 'Open this link?',
    confirmMessage: 'Follow this Phlix link?',
    confirmAccept: 'Follow link',
    confirmReject: 'Cancel'
  },
  crash: {
    title: 'Something went wrong',
    message: 'The Phlix window stopped responding. Reload to recover your session.',
    reload: 'Reload window',
    dismiss: 'Dismiss'
  },
  net: {
    tlsTitle: 'Connection not trusted',
    tlsBody: 'A secure connection to {url} was rejected because its certificate could not be verified.',
    loadTitle: 'Page failed to load',
    loadBody: 'Phlix could not load {url}.',
    hubTitle: 'This address is a Phlix Hub',
    hubBody: 'Desktop hub mode is not available yet — enter the address of your Phlix server instead.'
  }
} as const;
