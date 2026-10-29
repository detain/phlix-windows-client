/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';

/**
 * Single canonical parser for `phlix://` deep links (W3 unification).
 *
 * History: this file used to be an unused parallel validator while
 * `src/main/index.ts` re-implemented the same grammar inline. The inline
 * parser is now promoted HERE as the only source of truth; index.ts imports
 * it. Two behaviors from the legacy validator are deliberately ported:
 *  - the ≤256-char invite-token cap, and
 *  - closing the old file's silent omission of an `internal` arm: production
 *    previously gave `internal` an ungated bypass; it now runs through the
 *    same traversal/null-byte/length gates as every other host (W-low b).
 *
 * Log discipline (W3): deep links can carry one-time invite tokens, so no
 * function in this module may ever log a raw URL or a raw token segment.
 */

const KNOWN_HOSTS = new Set(['media', 'play', 'accept-invite', 'server', 'internal']);

const ID_PATTERN = /^[a-zA-Z0-9-]+$/;
const TOKEN_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Base64url invite tokens are bounded; reject absurd lengths (legacy validator law). */
const MAX_TOKEN_LENGTH = 256;

/** Upper bound for internal router paths (notification clickActions). */
const MAX_INTERNAL_PATH_LENGTH = 1024;

/**
 * Canonical deep-link host → renderer route table. Every target is an EXISTING
 * route record: `/app/media/:id` and `/app/player/:id` ship inside the vendored
 * @phlix/ui router (there is NO `/play/:id` record anywhere), while
 * `/app/accept-invite/:token` and `/app/server/:id` are this repo's hub-mode
 * extraRoutes (src/renderer/main.ts). The router base is `/app`, so the old
 * unprefixed `/${host}` construction matched nothing but the 404 catch-all
 * (review windows__casualgamer C1 / windows__crossfe C1). Pinned against a
 * real router by tests/unit/deepLinkRouteContract.test.ts.
 */
const ROUTE_BY_HOST: Record<string, string> = {
  media: '/app/media',
  play: '/app/player',
  'accept-invite': '/app/accept-invite',
  server: '/app/server'
};

/**
 * Redacts a deep link for logging: keeps scheme + host + path structure but
 * replaces the final path segment with `[redacted]` when the host is
 * `accept-invite` (its segment is a one-time secret). Query strings and
 * fragments are always dropped — they may carry further secrets.
 */
export function redactDeepLinkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    if (parsed.hostname === 'accept-invite' && segments.length > 0) {
      segments[segments.length - 1] = '[redacted]';
    }
    const redactedPath = segments.length > 0 ? `/${segments.join('/')}` : '';
    return `${parsed.protocol}//${parsed.host}${redactedPath}`;
  } catch {
    // Unparseable: we cannot tell which part carries a secret — log nothing raw.
    return '[deeplink:unparseable]';
  }
}

/**
 * Parses and validates a `phlix://` URL into an internal router path, or null
 * when it must be rejected.
 *
 * Grammar (every external target is an existing router record — see
 * ROUTE_BY_HOST; routes all live under the '/app' history base):
 *   phlix://media/{id}             → /app/media/{id}            (ui route /app/media/:id)
 *   phlix://play/{id}              → /app/player/{id}           (ui route /app/player/:id)
 *   phlix://accept-invite/{token}  → /app/accept-invite/{token} (base64url, ≤256 chars; hub-mode route, token fed as prop)
 *   phlix://server/{id}            → /app/server/{id}           (hub-mode route)
 *   phlix://internal/{route...}    → /{route...}  (gated: MUST be '/app' or under '/app/' — every router
 *                                                  record lives under that base (M-WINDOWS-15) — plus no
 *                                                  traversal, no null bytes, ≤1024 chars)
 *
 * Every accepted output is routable by the renderer router in EVERY app mode:
 * concrete record or the '/app/:pathMatch(.*)*' 404 view — never zero records.
 * Rejections return null; the drain (src/main/index.ts) surfaces them with a
 * user-visible dialog (M-WINDOWS-15: no silent no-ops end to end).
 */
export function parseDeepLinkUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'phlix:') {
      log.warn(`[deeplink] Invalid protocol: ${parsed.protocol}`);
      return null;
    }

    const host = parsed.hostname;
    if (!host) {
      log.warn('[deeplink] Empty host');
      return null;
    }

    if (!KNOWN_HOSTS.has(host)) {
      log.warn(`[deeplink] Unknown host: ${host}`);
      return null;
    }

    const rawPath = parsed.pathname ?? '/';

    // Null byte injection check — every arm, internal included.
    if (rawPath.includes('\x00')) {
      log.warn(`[deeplink] Null byte in path for host: ${host}`);
      return null;
    }

    // Internal routing (notification clicks) may carry a multi-segment router
    // path, but no longer bypasses validation (W-low b): traversal and length
    // gates run here exactly as they do for external hosts — plus the
    // M-WINDOWS-15 law below.
    if (host === 'internal') {
      const path = rawPath;
      if (path.length > MAX_INTERNAL_PATH_LENGTH) {
        log.warn(`[deeplink] Internal path exceeds ${MAX_INTERNAL_PATH_LENGTH} chars (got ${path.length})`);
        return null;
      }
      // The URL parser already normalizes slash dot-segments (a/../../evil →
      // /evil), but backslash forms keep a literal ".." in pathname for
      // non-special schemes — reject any surviving traversal marker.
      if (path.includes('..')) {
        log.warn(`[deeplink] Path traversal attempt in internal path: ${redactDeepLinkUrl(url)}`);
        return null;
      }
      // URL parsing percent-encodes raw NUL to %00, so check both forms.
      if (path.includes('\x00') || /%00/i.test(path)) {
        log.warn(`[deeplink] Null byte in internal path: ${redactDeepLinkUrl(url)}`);
        return null;
      }
      // M-WINDOWS-15 (windows__gameux M4): EVERY emitted router path must be
      // resolvable by the renderer's router. Every record — vendored ui routes
      // AND this repo's extraRoutes — lives under the '/app' base, and the
      // '/app/:pathMatch(.*)*' catch-all guarantees at least a rendered 404
      // view underneath it. A path outside that base (e.g. dot-segment
      // normalization landing on '/evil') matches ZERO records: router.push()
      // rejects unhandled and the link is a silent no-op — the exact bug class this
      // review item names. Reject it here, where the drain can surface the
      // failure honestly, instead of shipping dead paths to the renderer.
      if (path !== '/app' && !path.startsWith('/app/')) {
        log.warn(`[deeplink] Internal path is not an /app-rooted router path: ${redactDeepLinkUrl(url)}`);
        return null;
      }
      return path; // Return the path directly for internal routing
    }

    if (rawPath === '/') {
      log.warn(`[deeplink] Empty path for host: ${host}`);
      return null;
    }

    // Remove leading slash to get the id/token
    const value = rawPath.slice(1);

    if (!value) {
      log.warn(`[deeplink] Empty value after host: ${host}`);
      return null;
    }

    // Check for path traversal attempts
    if (value.includes('..') || value.includes('/')) {
      log.warn(`[deeplink] Path traversal or extra slash attempt for host: ${host}`);
      return null;
    }

    // Validate based on host type
    if (host === 'accept-invite') {
      if (!TOKEN_PATTERN.test(value)) {
        // Never echo the candidate token — an "invalid" token can still be a
        // real secret that merely got mangled in transit.
        log.warn(`[deeplink] Invalid token format for host: ${host} (length ${value.length})`);
        return null;
      }
      if (value.length > MAX_TOKEN_LENGTH) {
        log.warn(`[deeplink] Invite token exceeds ${MAX_TOKEN_LENGTH}-char cap (length ${value.length})`);
        return null;
      }
    } else {
      if (!ID_PATTERN.test(value)) {
        log.warn(`[deeplink] Invalid id format for host: ${host}`);
        return null;
      }
    }

    // Build the internal path against the real route table (ROUTE_BY_HOST).
    return `${ROUTE_BY_HOST[host]}/${value}`;
  } catch (err) {
    log.warn(`[deeplink] Failed to parse URL: ${redactDeepLinkUrl(url)} — ${err}`);
    return null;
  }
}

/**
 * Finds the first `phlix://` argument in an argv-style array.
 */
export function extractDeepLinkUrl(argv: string[]): string | null {
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.startsWith('phlix://')) {
      return arg;
    }
  }
  return null;
}

/**
 * Once-guard for deep-link deliveries (W-low a): the same URL arriving twice
 * within `windowMs` is reported as a duplicate so a token-consuming accept
 * flow (or a double notification click) can never fire twice.
 */
export interface DeepLinkDeduper {
  /** Returns true when `url` was already seen within the dedupe window. */
  suppresses(url: string): boolean;
}

export function createDeepLinkDeduper(windowMs: number): DeepLinkDeduper {
  const lastSeenByUrl = new Map<string, number>();
  return {
    suppresses(url: string): boolean {
      const now = Date.now();
      for (const [seenUrl, seenAt] of lastSeenByUrl) {
        if (now - seenAt >= windowMs) {
          lastSeenByUrl.delete(seenUrl);
        }
      }
      const seenAt = lastSeenByUrl.get(url);
      const isDuplicate = seenAt !== undefined;
      lastSeenByUrl.set(url, now);
      return isDuplicate;
    }
  };
}
