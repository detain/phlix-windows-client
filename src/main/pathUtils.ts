/**
 * Path utilities for the Electron main process.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import * as path from 'path';

/**
 * Checks whether a resolved file path is within the allowed base directory.
 *
 * This is the core of the path-traversal protection: the relative path is
 * resolved against baseDir and then checked to ensure the result is still
 * inside baseDir. Without this check, a request for "../../etc/passwd" could
 * escape the renderer distribution directory.
 *
 * @param baseDir - The allowed base directory (absolute path)
 * @param relativePath - The relative path to check
 * @returns true if the resolved path is inside baseDir, false otherwise
 */
export function isPathSafe(baseDir: string, relativePath: string): boolean {
  const resolved = path.resolve(baseDir, relativePath);
  return resolved.startsWith(path.resolve(baseDir));
}
