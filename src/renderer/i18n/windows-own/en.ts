/**
 * English catalog for user-facing chrome the `@phlix/ui` message seam cannot
 * reach from this client: the top-bar nav labels Windows supplies to
 * `createPhlixApp({ menu })` (`buildMenu()` in src/renderer/main.ts).
 *
 * Every value is BYTE-IDENTICAL to the literal hardcoded in buildMenu() before
 * this catalog existed (R-review fix F2, feat/i18n-locales);
 * tests/unit/i18nLocales.test.ts pins that contract via buildMenu() itself.
 *
 * Shape mirrors the estate two-level `group.key` catalog (ui seam + main
 * process read the same way). No `{placeholders}` today — nav labels are
 * static — so the accessor deliberately has no interpolation seam (YAGNI).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
export const WIN_EN = {
  nav: {
    myServers: 'My Servers',
    federation: 'Federation',
    shares: 'Shares',
    sharedWithMe: 'Shared with Me',
    inviteLinks: 'Invite Links',
    history: 'Watch History',
    explore: 'Explore',
    recommendations: 'Recommendations',
    syncPlay: 'SyncPlay',
    admin: 'Admin',
    browse: 'Browse',
    music: 'Music',
    books: 'Books',
    audiobooks: 'Audiobooks',
    photos: 'Photos',
    search: 'Search',
    settings: 'Settings'
  },
  // M-WINDOWS-02: the too-old-server failure screen (renderIncompatibleServerScreen
  // in src/renderer/main.ts). Static labels on purpose — this catalog has no
  // interpolation seam (YAGNI, see en.ts header): the version numbers the gate
  // carries are rendered as separate label + value elements, never injected.
  boot: {
    incompatibleTitle: 'Phlix server too old',
    incompatibleIntro: 'This Phlix server is too old to use with this version of Phlix for Windows.',
    reportedVersion: 'Server reports version',
    requiredVersion: 'Phlix for Windows requires at least',
    incompatibleAction: 'Ask the server owner to update Phlix Media Server, then press "Try again" — the check re-runs in place, no restart needed.',
    incompatibleRetry: 'Try again',
    // MW-119: escape hatch on the too-old screen — clears the stored server URL
    // so the next boot lands on the Connect screen instead of the locked server.
    incompatibleChange: 'Use a different server',
    failTitle: 'Phlix could not start',
    failMessage: 'The application failed to load what it needs to open. Secure storage may be unavailable, or the installation damaged. Trying again often helps; otherwise reinstall Phlix for Windows.',
    failRetry: 'Try again'
  },
  // M-WINDOWS-11 (review windows__casualgamer m11): the player-overlay surface
  // (SleepTimer + PiPButton) shipped hardcoded English while everything else
  // localized. EN values are byte-identical to the pre-extraction literals —
  // same law as every other catalog here. The overlay is a DYNAMIC import of
  // main.ts (same module instance), so the shell's boot-time locale pin
  // governs its tWin() reads. Unit strings stay concatenation pieces (the
  // catalog has no interpolation seam) — component code owns `${value} ${unit}`.
  deeplink: {
    hubOnlyTitle: 'This link belongs to a Phlix Hub',
    inviteBody: 'Invite links come from a Phlix Hub. This window is connected directly to your server — open the link in the browser where you received it.',
    serverBody: 'Server-card links belong to a Phlix Hub. This window is connected directly to your server, so there is nothing to open here.'
  },
  overlay: {
    sleepTimer: 'Sleep timer',
    cancelSleepTimer: 'Cancel sleep timer',
    expiredNotice: 'Sleep timer expired — playback stopped',
    menuHeading: 'Sleep Timer',
    cancelMenuItem: 'Cancel timer',
    unitMin: 'min',
    unitHr: 'hr',
    unitHrs: 'hrs',
    enterPip: 'Enter picture-in-picture',
    exitPip: 'Exit picture-in-picture',
    titlePip: 'Picture-in-Picture',
    titlePipExit: 'Exit PiP'
  }
} as const;
