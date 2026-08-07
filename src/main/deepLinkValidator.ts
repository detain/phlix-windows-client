/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';

/**
 * Supported deep link hosts and their corresponding SPA routes.
 * Key: host name, Value: route prefix
 */
const HOST_ROUTE_MAP: Record<string, string> = {
  media: '/media/',
  play: '/play/',
  'accept-invite': '/accept-invite/',
  server: '/server/'
};

/**
 * Validates a media ID (alphanumeric + dash, matching plan grammar).
 * Grammar: [a-zA-Z0-9-]+
 */
function isValidMediaId(id: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(id);
}

/**
 * Validates a base64url-encoded token (no padding, URL-safe chars).
 */
function isValidBase64UrlToken(token: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(token) && token.length > 0 && token.length <= 256;
}

/**
 * Result of a successful deep link parse.
 */
export interface DeepLinkRoute {
  /** SPA route path, e.g. '/media/abc-123' */
  route: string;
  /** The original deep link URL string */
  raw: string;
}

/**
 * Parses and validates a phlix:// URL.
 *
 * Supported grammar:
 *   phlix://media/{id}     → /media/{id}
 *   phlix://play/{id}      → /play/{id}
 *   phlix://accept-invite/{token} → /accept-invite/{token}
 *   phlix://server/{id}    → /server/{id}
 *
 * @param url - The raw URL string to parse (e.g. 'phlix://media/abc-123')
 * @returns DeepLinkRoute on success, null if the URL is invalid or rejected
 */
export function parseDeepLink(url: string): DeepLinkRoute | null {
  // Guard: must be a string
  if (typeof url !== 'string' || url.length === 0) {
    log.warn('[deeplink] Empty or non-string URL received');
    return null;
  }

  // Guard: must start with phlix://
  if (!url.startsWith('phlix://')) {
    log.warn(`[deeplink] URL does not start with phlix://: ${url}`);
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    log.warn(`[deeplink] Failed to parse URL: ${url}`);
    return null;
  }

  const host = parsed.hostname;
  const pathSegment = parsed.pathname.replace(/^\//, ''); // strip leading slash

  // Guard: host must be in whitelist
  if (!Object.prototype.hasOwnProperty.call(HOST_ROUTE_MAP, host)) {
    log.warn(`[deeplink] Unknown host: ${host}`);
    return null;
  }

  const routePrefix = HOST_ROUTE_MAP[host];

  // Guard: path segment must not be empty
  if (!pathSegment) {
    log.warn(`[deeplink] Missing path segment for host: ${host}`);
    return null;
  }

  // Validate path segment format based on host type
  if (host === 'accept-invite') {
    // Token: base64url format
    if (!isValidBase64UrlToken(pathSegment)) {
      log.warn(`[deeplink] Invalid token format: ${pathSegment}`);
      return null;
    }
  } else {
    // ID: alphanumeric + dash (matching plan grammar)
    if (!isValidMediaId(pathSegment)) {
      log.warn(`[deeplink] Invalid ID for ${host}: ${pathSegment}`);
      return null;
    }
  }

  const route = `${routePrefix}${pathSegment}`;

  log.info(`[deeplink] Valid deep link: ${url} → ${route}`);

  return { route, raw: url };
}
