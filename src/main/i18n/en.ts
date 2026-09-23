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
    minimizeToTray: 'Minimize to Tray',
    quit: 'Quit',
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'File',
    settings: 'Settings',
    playback: 'Playback',
    playPause: 'Play/Pause',
    stop: 'Stop',
    rewind: 'Rewind',
    fastForward: 'Fast Forward',
    fullscreen: 'Fullscreen',
    view: 'View',
    help: 'Help',
    about: 'About Phlix',
    checkForUpdates: 'Check for updates'
  },
  thumbar: {
    previous: 'Previous / Rewind 10s',
    play: 'Play',
    pause: 'Pause',
    next: 'Next / Forward 10s'
  },
  updater: {
    availableTitle: 'Update Available',
    availableBody: 'Phlix {version} is available. Click to download.',
    readyTitle: 'Update Ready',
    readyBody: 'Phlix {version} has been downloaded. Restart to apply.'
  },
  about: {
    title: 'About Phlix',
    message: 'Phlix Media Server',
    detail: 'Version {version}\n\nA free media server for your home.'
  }
} as const;
