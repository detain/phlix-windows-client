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
    admin: 'Admin',
    browse: 'Browse',
    music: 'Music',
    books: 'Books',
    audiobooks: 'Audiobooks',
    photos: 'Photos',
    search: 'Search',
    settings: 'Settings'
  }
} as const;
