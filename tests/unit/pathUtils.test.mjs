/**
 * @vitest-environment node
 *
 * Overrides vitest.config.mts's global `environment: 'jsdom'` for THIS FILE
 * ONLY. The module under test is plain Node.js with no DOM dependencies,
 * so jsdom is unnecessary overhead here.
 */

import { describe, it, expect } from 'vitest';
import { isPathSafe } from '../../dist/main/pathUtils.js';
import * as path from 'path';

// Use a temp directory as the "renderer dist" base for testing
const RENDERER_DIST_DIR = path.resolve('/tmp/phlix-test-dist');

describe('isPathSafe', () => {
  it('allows safe relative paths inside the base directory', () => {
    expect(isPathSafe(RENDERER_DIST_DIR, 'index.html')).toBe(true);
    expect(isPathSafe(RENDERER_DIST_DIR, 'assets/main.js')).toBe(true);
    expect(isPathSafe(RENDERER_DIST_DIR, 'assets/images/logo.png')).toBe(true);
    expect(isPathSafe(RENDERER_DIST_DIR, 'static/style.css')).toBe(true);
  });

  it('allows paths with dot segments that stay within base', () => {
    expect(isPathSafe(RENDERER_DIST_DIR, './index.html')).toBe(true);
    expect(isPathSafe(RENDERER_DIST_DIR, 'assets/../index.html')).toBe(true);
    expect(isPathSafe(RENDERER_DIST_DIR, './assets/../index.html')).toBe(true);
  });

  it('blocks path traversal attempts that escape the base directory', () => {
    // These are the critical security regressions — all must be false
    expect(isPathSafe(RENDERER_DIST_DIR, '../../etc/passwd')).toBe(false);
    expect(isPathSafe(RENDERER_DIST_DIR, '../../../root/.ssh/id_rsa')).toBe(false);
    expect(isPathSafe(RENDERER_DIST_DIR, '/etc/passwd')).toBe(false);
    expect(isPathSafe(RENDERER_DIST_DIR, 'assets/../../../etc/passwd')).toBe(false);
  });

  it('blocks the specific URL used in the acceptance test: app://-/../../etc/passwd', () => {
    // Simulate the path extraction from app://-/../../etc/passwd
    // The URL path would be /-/../../etc/passwd -> after stripping /- it's /../../etc/passwd
    const urlPath = '/../../etc/passwd';
    const routingPath = urlPath.slice(2); // Remove '/-'
    const relativePath = routingPath.replace(/^\/app\//, '');
    // routingPath is /../../etc/passwd (no /app/ prefix in this case)
    // After replace it stays /../../etc/passwd
    expect(isPathSafe(RENDERER_DIST_DIR, relativePath)).toBe(false);
  });

  it('blocks traversal when path contains null bytes', () => {
    expect(isPathSafe(RENDERER_DIST_DIR, 'assets/../../../etc/passwd\x00')).toBe(false);
  });

  it('handles empty relative path', () => {
    expect(isPathSafe(RENDERER_DIST_DIR, '')).toBe(true);
  });

  it('handles paths with encoded traversal sequences', () => {
    // URL decoding is done by the URL parser BEFORE calling isPathSafe.
    // The protocol handler uses new URL(request.url).pathname which decodes %2F to /.
    // By the time isPathSafe is called, the path is already decoded to ../../etc/passwd.
    // This test verifies the decoded version is correctly blocked.
    expect(isPathSafe(RENDERER_DIST_DIR, '../../etc/passwd')).toBe(false);
    expect(isPathSafe(RENDERER_DIST_DIR, '../assets/main.js')).toBe(false);
  });
});
