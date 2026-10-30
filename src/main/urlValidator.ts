/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';

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
    log.warn(`[security] Blocked external URL with disallowed protocol: ${parsed.protocol} — ${url}`);
    return false;
  } catch {
    log.warn(`[security] Blocked malformed URL: ${url}`);
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
    log.warn(`[security] Blocked malformed navigation URL: ${url}`);
    return false;
  }
  return validateExternalUrl(url);
}
