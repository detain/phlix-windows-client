/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';
// M-WINDOWS-44: version-endpoint logs carry a scheme+host summary, never the
// raw (possibly renderer-influenced) base with its path.
import { isFetchableApiBase, summarizeUrlForLog } from './urlValidator';
export { isFetchableApiBase };

const MIN_SERVER_VERSION = '1.1.0';

/**
 * Structured outcome of the boot-time server-version gate (M-WINDOWS-02).
 *
 * A bare boolean could only say "no" — the user-facing surface then had
 * nothing to explain. Every emitter of a blocking verdict carries the two
 * versions that made the decision, so dialog and screen can name them.
 * This is the SSOT shape; the renderer-side mirror lives in
 * src/renderer/types/electron.d.ts (same pattern as `HubConfig`).
 */
export interface ServerVersionCheck {
  /** False ONLY when the server explicitly reported a version below `minimumVersion`. */
  compatible: boolean;
  /** The version string the server reported, or null when no version could be read (fail-open paths). */
  serverVersion: string | null;
  /** The minimum supported server version this gate enforces (semver X.Y.Z). */
  minimumVersion: string;
}

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
 * M-WINDOWS-30: the apiBase fetch guard. The LAW lives in urlValidator.ts
 * (M-WINDOWS-34 relocated it there so the config-write guards share it);
 * this re-export preserves the versionCheck test/consumer surface.
 */
/**
 * M-WINDOWS-30: the apiBase fetch guard. The LAW lives in urlValidator.ts
 * (M-WINDOWS-34 relocated it there so the config-write guards share it);
 * the import at the head of this file both binds it locally and re-exports
 * it for the existing versionCheck test/consumer surface.
 */

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
 * @returns A ServerVersionCheck: `compatible` is true when the server version
 *          satisfies the minimum OR the check could not be completed (network
 *          error, version endpoint missing — the fail-open policy above).
 *          It is false only when the server explicitly reports a version < 1.1.0;
 *          in every outcome the caller sees the reported `serverVersion`
 *          (null when none could be read) and the enforced `minimumVersion`,
 *          so a blocking decision always carries its own explanation.
 */
export async function checkMinServerVersion(apiBase: string): Promise<ServerVersionCheck> {
  if (!apiBase) {
    // No server configured — skip the check, allow boot to continue
    log.info('[versionCheck] No apiBase configured, skipping server version check');
    return { compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION };
  }

  if (!isFetchableApiBase(apiBase)) {
    // M-WINDOWS-30: a non-http(s) scheme, credentialed or host-less base is
    // refused WITHOUT touching the network (the old code fetched whatever the
    // caller supplied). Refusal follows the documented fail-open policy.
    log.warn('[versionCheck] Refused non-fetchable apiBase (http(s)/no-userinfo/host law), skipping check');
    return { compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION };
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
    log.info(`[versionCheck] Checking server version at ${summarizeUrlForLog(versionUrl)}`);
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
      return { compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION };
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
      return { compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION };
    }

    if (!version || typeof version !== 'string') {
      // No version field in response — fail-open
      log.warn('[versionCheck] Server response missing version field — allowing boot to continue');
      return { compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION };
    }

    log.info(`[versionCheck] Server reports version: ${version}`);

    if (!versionSatisfiesMin(version, MIN_SERVER_VERSION)) {
      log.error(`[versionCheck] Server version ${version} is below minimum supported ${MIN_SERVER_VERSION} — blocking boot`);
      return { compatible: false, serverVersion: version, minimumVersion: MIN_SERVER_VERSION };
    }

    log.info(`[versionCheck] Server version ${version} satisfies minimum ${MIN_SERVER_VERSION}`);
    return { compatible: true, serverVersion: version, minimumVersion: MIN_SERVER_VERSION };
  } catch (err) {
    // Network error, timeout, etc. — fail-open for pre-1.1.0 servers, but the
    // warn tells operators the gate did not actually run this boot.
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`[versionCheck] Could not reach version endpoint (${message}) — min-server-version enforcement INACTIVE for this boot; allowing boot to continue`);
    return { compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION };
  }
}

export { MIN_SERVER_VERSION };
