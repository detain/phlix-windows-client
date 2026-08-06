/**
 * Route reachability guard test.
 *
 * Verifies that every route registered by createPhlixApp is reachable via
 * either:
 *   1. A navigation entry in the menu (buildMenu), OR
 *   2. An explicit deep-link allow-list entry with a documented reason
 *
 * This guard prevents regressions where a new @phlix/ui version registers a
 * route that has no way in — the trap this repo fell into (see W1.4).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { createPhlixApp } from '@phlix/ui';
import { buildMenu, buildExtraRoutes } from '@/main';

// Pages that are intentionally NOT reachable from the menu.
// Each entry is a route prefix (or full path pattern) + reason.
// Keep this list short and the reasons specific — it is a bug magnet.
const DEEP_LINK_ALLOW_LIST: Array<{ pattern: RegExp; reason: string }> = [
  // Auth pages: handled by the auth flow, not nav
  { pattern: /^\/app\/login$/, reason: 'auth flow redirects here, not a nav target' },
  { pattern: /^\/app\/signup$/, reason: 'auth flow redirects here, not a nav target' },
  { pattern: /^\/app\/connect$/, reason: 'connect gate for unconfigured clients, not a nav target' },

  // AcceptInvitePage: deep-link only from invitation emails
  { pattern: /^\/app\/accept-invite$/, reason: 'deep-link from invitation emails, never shown in nav' },

  // Player: terminal view, navigated to from media items
  { pattern: /^\/app\/player\//, reason: 'terminal player view, reached by clicking media' },

  // Media detail pages: reached by clicking items in browse/search/results
  { pattern: /^\/app\/media\//, reason: 'detail pages reached by clicking media items' },

  // Library detail page: reached by clicking a library in browse
  { pattern: /^\/app\/library\//, reason: 'detail page reached by clicking a library' },

  // Music detail pages: reached from the music page
  { pattern: /^\/app\/music\/album\//, reason: 'music album detail, reached from music page' },
  { pattern: /^\/app\/music\/artist\//, reason: 'music artist detail, reached from music page' },

  // Book detail pages: reached from books page
  { pattern: /^\/app\/books\//, reason: 'book detail/reader, reached from books page' },

  // Audiobook detail pages: reached from audiobooks page
  { pattern: /^\/app\/audiobooks\//, reason: 'audiobook detail/player, reached from audiobooks page' },

  // Photo detail pages: reached from photo albums
  { pattern: /^\/app\/photo\//, reason: 'photo album/view/slideshow, reached from photo albums' },

  // Hub-specific detail pages: only reachable when a server is selected
  { pattern: /^\/app\/server\//, reason: 'server detail page, reached by selecting a server in hub' },
  { pattern: /^\/app\/federation\/shares$/, reason: 'federation shares detail, reached from federation page' },

  // Hub-only pages that are deep links (InviteLinksPage, SharedWithMePage)
  // MyServersPage is in menu (buildMenu hub mode has it), so these are truly deep-only
  { pattern: /^\/app\/invites$/, reason: 'invite links page, hub admin feature reached via federation page' },
  { pattern: /^\/app\/shared$/, reason: 'shared with me page, hub feature reached via shares' },

  // Catch-all route for unmatched paths (404 handling)
  { pattern: /^\/app\/:pathMatch\(.*\)\*$/, reason: 'catch-all for unmatched routes, not a nav target' },

  // ParentalControlsPage: @phlix/ui registers /app/parental (own component).
  { pattern: /^\/app\/parental$/, reason: '@phlix/ui built-in parental controls route' },

  // Admin section: all sub-routes are gated to admin users, reached via admin dashboard
  { pattern: /^\/app\/admin$/, reason: 'admin section parent route, content rendered by active child' },
  { pattern: /^\/app\/admin\//, reason: 'admin sub-routes, gated to admin users, reached via admin dashboard' },

  // The router history base (/app) is a valid route entry — it resolves to the
  // first matching child; include it so the guard does not flag it as unreachable
  { pattern: /^\/app$/, reason: 'router history base, renders first matched child' },

  // Server-mode pages that appear in hub router but are not in hub menu.
  // These are registered by createPhlixApp but are not hub pages - they're
  // either irrelevant in hub context or would redirect to a selected server.
  { pattern: /^\/app\/settings$/, reason: 'server settings page, not a hub navigation target' },
  { pattern: /^\/app\/music$/, reason: 'music page is server-mode, hub has no music libraries' },
  { pattern: /^\/app\/books$/, reason: 'books page is server-mode, hub has no book libraries' },
  { pattern: /^\/app\/audiobooks$/, reason: 'audiobooks page is server-mode, hub has no audiobook libraries' },
  { pattern: /^\/app\/photo\/albums$/, reason: 'photo albums page is server-mode, hub has no photo libraries' },

  // The root /app path is the browse page - in hub mode home is /app/servers
  { pattern: /^\/app$/, reason: 'browse page root, hub uses /app/servers as home instead' },
];

/**
 * Extract all route paths (including nested children) from a route record.
 * Child routes use relative paths that must be resolved against their parent.
 * The router base path `/app` itself is excluded (it has no component).
 */
function extractRoutePaths(
  routes: import('vue-router').RouteRecordRaw[],
  parentPath = ''
): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    // Resolve the full path: relative children are挂 under their parent
    const fullPath = parentPath
      ? `${parentPath}/${route.path.replace(/^\//, '')}`
      : route.path;
    // Skip the bare router base; it has no component and no navigation entry
    if (fullPath !== '/app') {
      paths.push(fullPath);
    }
    if (route.children) {
      paths.push(...extractRoutePaths(route.children, fullPath));
    }
  }
  return paths;
}

/**
 * Check if a route path is covered by the menu.
 * Menu items can have `to` (internal route) or `href` (external URL).
 * We only check `to` paths.
 */
function isRouteInMenu(path: string, menuItems: import('@phlix/ui').MenuItem[]): boolean {
  for (const item of menuItems) {
    if (item.to === path) return true;
    if (item.children) {
      if (isRouteInMenu(path, item.children)) return true;
    }
  }
  return false;
}

/**
 * Check if a route path matches any allow-list pattern.
 */
function isAllowListed(path: string): boolean {
  return DEEP_LINK_ALLOW_LIST.some(({ pattern }) => pattern.test(path));
}

describe('route reachability guard', () => {
  it('server mode: every registered route is in the menu or allow-listed', () => {
    // Create a minimal app instance to get access to the router
    const app = createPhlixApp({
      app: 'server',
      apiBase: 'http://localhost:8096',
      menu: [],
      extraRoutes: buildExtraRoutes('server'),
      requireConnection: true,
    });

    const router = app.config.globalProperties.$router as import('vue-router').Router;
    const allRoutes = router.getRoutes();
    const allPaths = extractRoutePaths(allRoutes);

    const menu = buildMenu('server');

    const unreachable = allPaths.filter(
      (path) => !isRouteInMenu(path, menu) && !isAllowListed(path)
    );

    expect(unreachable, `Unreachable routes found:\n${unreachable.join('\n')}`).toHaveLength(0);
  });

  it('hub mode: every registered route is in the menu or allow-listed', () => {
    const app = createPhlixApp({
      app: 'hub',
      apiBase: 'http://localhost:8096',
      menu: [],
      extraRoutes: buildExtraRoutes('hub'),
      requireConnection: true,
    });

    const router = app.config.globalProperties.$router as import('vue-router').Router;
    const allRoutes = router.getRoutes();
    const allPaths = extractRoutePaths(allRoutes);

    const menu = buildMenu('hub');

    const unreachable = allPaths.filter(
      (path) => !isRouteInMenu(path, menu) && !isAllowListed(path)
    );

    expect(unreachable, `Unreachable routes found:\n${unreachable.join('\n')}`).toHaveLength(0);
  });
});
