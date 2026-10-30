/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';

/**
 * M-WINDOWS-44 (review windows__secnet 3): the W3 redaction law said
 * rejected URLs are logged only in redacted form — the ORIGINAL
 * redactDeepLinkUrl export exists for the phlix:// deep-link leg — but the
 * generic rejection warns below logged the raw string, which for a
 * `file:///path` or credentialed URL leaks user data (paths, userinfo) into
 * electron-log files. Law: a rejection warn carries AT MOST scheme + host of
 * a parseable URL, and the literal 'unparseable URL' for the rest. (Host,
 * not path: a refused http(s) base's path may itself carry a token.)
 */
export function summarizeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host || '(no host)'}`;
  } catch {
    return 'unparseable URL';
  }
}

/**
 * M-WINDOWS-30 (W-min206) + M-34 (this batch): definition relocated from
 * versionCheck.ts to the URL-law module so BOTH the version-check fetch
 * guard and the config WRITE guards share one law. versionCheck keeps a
 * re-export for its existing test surface (no import cycle: this module
 * depends only on electron-log).
 *
 * A base is fetchable when it parses as http(s) with a non-empty host and
 * carries no userinfo — credentials embedded in a server URL would be sent
 * as Authorization headers by the health probe (and today nobody types
 * them). Loopback stays legal: self-hosted Phlix on localhost IS the
 * product; the guard is about SHAPE (no file:, no javascript:, no creds),
 * not about network position.
 */
export function isFetchableApiBase(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username !== '' || parsed.password !== '') return false;
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validates that a URL uses an allowed external protocol (https: or http:).
 *
 * @param url - The URL string to validate.
 * @returns true if the URL has an allowed protocol, false otherwise.
 */
export function validateExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return true;
    }
    // M-WINDOWS-44: scheme + host only — the raw string may carry paths or
    // credentials the user never agreed to log.
    log.warn(`[security] Blocked external URL with disallowed protocol: ${parsed.protocol}//${parsed.host || '(no host)'}`);
    return false;
  } catch {
    log.warn('[security] Blocked malformed URL: unparseable URL');
    return false;
  }
}

/**
 * Navigation law for the MAIN WINDOW (will-navigate guard).
 *
 * M-WINDOWS-18: app:// is this shell's own origin — the SPA router and
 * reload-style hops live there and must not be blocked. The app:// protocol
 * handler behind it only ever serves the packaged renderer
 * (setupAppProtocolHandler hostname+prefix law), so allowing the scheme
 * grants no new surface. Every other protocol falls through to the external
 * law; malformed URLs deny.
 *
 * @param url - The navigation target.
 * @returns true when the window may navigate there.
 */
export function validateNavigationUrl(url: string): boolean {
  try {
    if (new URL(url).protocol === 'app:') {
      return true;
    }
  } catch {
    log.warn('[security] Blocked malformed navigation URL: unparseable URL');
    return false;
  }
  return validateExternalUrl(url);
}
