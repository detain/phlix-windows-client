/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';

const MIN_SERVER_VERSION = '1.1.0';

/**
 * Parses a semantic version string into its numeric components.
 * Returns null if the string is malformed (not "X.Y.Z" format).
 */
export function parseServerVersion(version: string): { major: number; minor: number; patch: number } | null {
  if (typeof version !== 'string') return null;
  const trimmed = version.trim();
  // W7.6: Support only semver format (major.minor.patch), no prefixes like "v"
  const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Compares two version strings semantically.
 * Returns true if current >= required.
 */
function versionSatisfiesMin(current: string, required: string): boolean {
  const currentParts = parseServerVersion(current);
  const requiredParts = parseServerVersion(required);

  // Fail-open: if we can't parse either version, assume it satisfies the requirement
  if (!currentParts || !requiredParts) {
    log.warn(`[versionCheck] Could not parse version strings: current="${current}", required="${required}" — allowing boot to continue`);
    return true;
  }

  if (currentParts.major !== requiredParts.major) {
    return currentParts.major > requiredParts.major;
  }
  if (currentParts.minor !== requiredParts.minor) {
    return currentParts.minor > requiredParts.minor;
  }
  return currentParts.patch >= requiredParts.patch;
}

/**
 * Checks the server's version against the minimum supported version (1.1.0).
 *
 * Design decision: fail-open for unknown servers. Pre-1.1.0 servers that don't
 * implement the version endpoint may still work for basic features. Logging a
 * warning and allowing boot to continue is the pragmatic choice here — the
 * alternative (blocking boot on an unknown server) would break existing
 * deployments unnecessarily.
 *
 * @param apiBase - The server's base URL (e.g., "https://media.example.com")
 * @returns true if the server version satisfies the minimum or if the check
 *          could not be completed (network error, version endpoint missing).
 *          Returns false only when the server explicitly reports a version < 1.1.0.
 */
export async function checkMinServerVersion(apiBase: string): Promise<boolean> {
  if (!apiBase) {
    // No server configured — skip the check, allow boot to continue
    log.info('[versionCheck] No apiBase configured, skipping server version check');
    return true;
  }

  // Strip trailing slash for consistent URL construction
  const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
  // W2: the real server metadata endpoint is GET /system/info at the ROOT —
  // NOT /api/v1/... and there is no /api/v1/server/version anywhere on server
  // or hub (the previous target made this gate inert). Verified against
  // server source: phlix-server/src/Server/Core/Application.php:245 registers
  // `$this->router->get('/system/info', ...)` and its JSON carries a TOP-LEVEL
  // `version` string (Application.php:253, Version::STRING); the /api/v1
  // discovery route confirms the root paths
  // ('endpoints' => '/health, /system/info', Application.php:368-372).
  // The hub exposes only root /health (phlix-hub/src/Application.php:339),
  // so hub-mode bases fail open through the warn paths below.
  const versionUrl = `${base}/system/info`;

  try {
    log.info(`[versionCheck] Checking server version at ${versionUrl}`);
    const response = await fetch(versionUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Aggressive timeout — this check is on the critical boot path
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      // Old servers (and hubs, which have no /system/info) answer 404 here —
      // fail-open, but warn loudly that enforcement did not run.
      log.warn(`[versionCheck] Server returned HTTP ${response.status} for /system/info — min-server-version enforcement INACTIVE for this boot; allowing boot to continue`);
      return true;
    }

    let version: string | undefined;
    try {
      // /system/info carries a top-level `version` (server name is under
      // `server` as a string); the `data.version` shape is kept as a
      // defensive alias for proxy-wrapped responses.
      const data = await response.json() as { server?: string; version?: string; data?: { version?: string } };
      version = data.version ?? data.data?.version;
    } catch {
      // Malformed JSON response
      log.warn('[versionCheck] Server returned non-JSON response for version endpoint — allowing boot to continue');
      return true;
    }

    if (!version || typeof version !== 'string') {
      // No version field in response — fail-open
      log.warn('[versionCheck] Server response missing version field — allowing boot to continue');
      return true;
    }

    log.info(`[versionCheck] Server reports version: ${version}`);

    if (!versionSatisfiesMin(version, MIN_SERVER_VERSION)) {
      log.error(`[versionCheck] Server version ${version} is below minimum supported ${MIN_SERVER_VERSION} — blocking boot`);
      return false;
    }

    log.info(`[versionCheck] Server version ${version} satisfies minimum ${MIN_SERVER_VERSION}`);
    return true;
  } catch (err) {
    // Network error, timeout, etc. — fail-open for pre-1.1.0 servers, but the
    // warn tells operators the gate did not actually run this boot.
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`[versionCheck] Could not reach version endpoint (${message}) — min-server-version enforcement INACTIVE for this boot; allowing boot to continue`);
    return true;
  }
}

export { MIN_SERVER_VERSION };
