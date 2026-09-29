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
 * Grammar:
 *   phlix://media/{id}             → /media/{id}
 *   phlix://play/{id}              → /play/{id}
 *   phlix://accept-invite/{token}  → /accept-invite/{token}   (base64url, ≤256 chars)
 *   phlix://server/{id}            → /server/{id}
 *   phlix://internal/{route...}    → /{route...}               (gated: no traversal, no null bytes, ≤1024 chars)
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
    // gates run here exactly as they do for external hosts.
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

    // Build the internal path
    const routePath = `/${host}/${value}`;
    return routePath;
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
