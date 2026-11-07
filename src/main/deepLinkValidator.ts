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
 * REVIEW-w09L2windows-ff2 Minor — the redactor's canonicalization seam.
 *
 * The w09/L2-FF cure folded only LETTER CASE of the compared segment, so any
 * spelling reaching the redactor un-normalized — percent escapes ('%41',
 * '%2D', double-encoded '%2541'), fullwidth/combining Unicode, Cyrillic or
 * dotless look-alikes — waved a one-time invite token straight through into
 * every log site and the rejection dialog. The fix folds BEFORE comparing:
 *
 *   1. bounded percent-decode, max MAX_DECODE_ROUNDS rounds, to a fixed
 *      point; a decodeURIComponent throw (malformed escape) returns NULL,
 *      which touchesInviteRoute treats as redact — FAIL TOWARD REDACTION:
 *      any spelling not confidently NOT an invite route redacts its tail;
 *   2. NFKD — deliberately the DECOMPOSING form (a documented deviation from
 *      the reviewer's NFKC suggestion): a raw combining mark (e + U+0307)
 *      must lose the mark under step 4's strip, while NFKC would RECOMPOSE
 *      it into U+0117, an unmapped codepoint the strip deletes along with
 *      the base letter — breaking the fold instead of canonicalizing it;
 *   3. letter-case fold + a documented single-codepoint LOOKALIKE_FOLD map;
 *   4. separator scrub (everything outside [a-z0-9] disappears), so the
 *      marker test is a plain substring check for 'acceptinvite' — immune
 *      to '-', '%2F'-decoded '/', trailing dots, and padding spaces.
 *
 * Disclosed boundaries (register REVIEW-w09L2windows-ff2): encoding nested
 * deeper than MAX_DECODE_ROUNDS survives as a literal '%41…' form that folds
 * to no marker (the reviewer's own decode cap is 2 rounds), and look-alikes
 * outside the map (e.g. Greek 'α') are stripped rather than mapped. Neither
 * form can REACH the invite record through the renderer router — the
 * consumed ⇒ gate-confirmed invariant, and exactly why neither boundary
 * leaves a consuming surface unredacted — and is pinned as such by
 * tests/unit/deepLinkRouteContract.test.ts (ff2 equivalence table).
 */
const MAX_DECODE_ROUNDS = 2;

/** Separator-free form of the invite route name; the marker under fold. */
const INVITE_ROUTE_MARKER = 'acceptinvite';

/**
 * Single-codepoint look-alikes for letters used by the marker (plus adjacent
 * confusables as defense-in-depth), lowercase forms only — the case fold runs
 * before the map. The ff2 hostile table exercises Cyrillic а/е/і and Latin
 * dotless ı; the remaining entries pre-cover every other marker letter shape
 * (с→c, р→p) and common Latin stand-ins (ø→o, ı→i) so a future marker cannot
 * outrun the seam without the map growing first.
 */
const LOOKALIKE_FOLD: ReadonlyMap<string, string> = new Map([
  ['\u0430', 'a'], // Cyrillic а
  ['\u0441', 'c'], // Cyrillic с
  ['\u0435', 'e'], // Cyrillic е
  ['\u0456', 'i'], // Cyrillic і
  ['\u0458', 'j'], // Cyrillic ј
  ['\u043e', 'o'], // Cyrillic о
  ['\u0440', 'p'], // Cyrillic р
  ['\u0443', 'y'], // Cyrillic у
  ['\u0445', 'x'], // Cyrillic х
  ['\u0455', 's'], // Cyrillic ѕ
  ['\u0501', 'd'], // Cyrillic ԁ
  ['\u0131', 'i'], // Latin dotless ı
  ['\u00f8', 'o'] // Latin slashed ø
]);

function foldRouteText(value: string): string | null {
  let current = value;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return null; // malformed escape → cannot disprove invite → redact
    }
    if (decoded === current) {
      break; // fixed point — nothing left to decode
    }
    current = decoded;
  }
  const lowered = current.normalize('NFKD').toLowerCase();
  let folded = '';
  for (const char of lowered) {
    folded += LOOKALIKE_FOLD.get(char) ?? char;
  }
  return folded.replace(/[^a-z0-9]/g, '');
}

/** True when `value` may touch the invite route under ANY folded spelling. */
function touchesInviteRoute(value: string): boolean {
  const folded = foldRouteText(value);
  return folded === null ? true : folded.includes(INVITE_ROUTE_MARKER);
}

/**
 * Redacts a deep link for logging: keeps scheme + host + path structure but
 * replaces the final path segment with `[redacted]` when the route touches
 * the `accept-invite` segment (its tail is a one-time secret). The match
 * folds the COMPARISON only — case (REVIEW-w09L2windows) and, since
 * REVIEW-w09L2windows-ff2, percent/Unicode normalization via the seam above
 * — across host AND full pathname, so the host form, the
 * `internal/app/accept-invite/…` arm, and every normalization-deferred
 * spelling all redact. Over-redacting a look-alike browse path is the safe
 * direction: a log that hides too much leaks nothing. Query strings and
 * fragments are always dropped — they may carry further secrets.
 */
export function redactDeepLinkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    // WHATWG already lowercases the hostname and UTF-8 percent-encodes
    // non-ASCII path bytes, so the joined string feeds the seam directly.
    const inviteRoute = touchesInviteRoute(`${parsed.hostname}/${parsed.pathname}`);
    if (inviteRoute && segments.length > 0) {
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
/**
 * M-WINDOWS-31 (review windows__exploiter MINOR-3): which parsed routes
 * CONSUME a secret and therefore need explicit user confirmation before the
 * shell forwards them. Today that is exactly one route — invite acceptance,
 * whose renderer view redeems the one-time token on mount. Everything else
 * (`media`, `play`, `server`, `internal`) is browse-only: the worst a stray
 * link can do is navigate. The gate lives in the MAIN process on purpose:
 * the renderer (vendored ui) has no concept of "ask first".
 *
 * REVIEW-w09L2windows MAJOR: the comparison is CASE-FOLDED. The renderer's
 * vue-router resolves route records case-insensitively (executed: every
 * letter-case spelling of '/app/Accept-Invite/T' matches the accept-invite
 * record with its token intact), so exact-case classification let a mere
 * letter-case variant skip this consent gate and burn the one-time secret
 * ungated. Only the COMPARISON is folded — callers keep forwarding the
 * original path, because the base64url token itself is case-sensitive.
 * Percent-encoded spellings ('%2D', '%65') fold to no match here AND cannot
 * reach the record through the router (executed: they fall to the 404 catch-
 * all), so the fold neither over-blocks nor under-covers any reachable class.
 * That consumed ⇒ gate-confirmed invariant is no longer review-lore: the ff2
 * equivalence table (tests/unit/deepLinkRouteContract.test.ts) re-executes it
 * every CI run — if a future router ever decodes a spelling this gate misses,
 * the table reddens in the same commit that must widen the gate.
 */
export function requiresDeepLinkConfirmation(path: string): boolean {
  const canonical = path.toLowerCase();
  return canonical === '/app/accept-invite' || canonical.startsWith('/app/accept-invite/');
}

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
