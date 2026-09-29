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
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, relativePath);
  if (resolved === resolvedBase) return true;
  // W-low(c): compare against base + separator, not bare base — a sibling
  // directory sharing the base's name as a text prefix (e.g. base 'renderer'
  // vs sibling 'rendererEvil') must NOT pass.
  return resolved.startsWith(resolvedBase + path.sep);
}
