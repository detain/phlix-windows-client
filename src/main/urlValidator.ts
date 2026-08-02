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
