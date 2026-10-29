/**
 * M-WINDOWS-04 status pins — friend-watch (SyncPlay) on the desktop.
 *
 * The four docs sources disagreed about whether Windows ships SyncPlay at all.
 * The ground truth, measured against the installed `@phlix/ui` bundle:
 *
 *  1. The shell DOES register `/app/syncplay` and the player DOES ship the
 *     SyncPlay room modal — the surface exists (it was never "dropped").
 *  2. The room socket, however, dials `window.location.hostname + :8097` — a
 *     same-origin assumption built for the web player the server itself hosts.
 *     This renderer is served from the internal `app://-/` origin, whose
 *     hostname is the literal `-`, so from a packaged desktop build the socket
 *     can never reach a remote server: rooms list/join over REST but never go
 *     live. The surface is therefore deliberately NOT in `buildMenu` —
 *     advertising a control that cannot connect would recreate the very
 *     docs-vs-reality gap this file pins shut.
 *  3. The cure is an installed-bundle capability, not a windows-side patch:
 *     the `__PHLIX__.wsUrl` socket seam (phlix-ui `94579936`, R12-02) lets the
 *     host point the room socket at the persisted server instead of the page
 *     origin. It is absent from every chunk today.
 *
 * These tests are tripwires, not decoration: each one REDS exactly when the
 * underlying bundle reality flips, at which point the rider in
 * `.reviews/fixlog/M-WINDOWS-04__fix.md` (and the README "Watching with
 * friends" section) must be re-landed: wire the seam at boot, add the nav
 * entry, retire the allow-list carve-out in routeReachability.test.ts.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createPhlixApp } from '@phlix/ui';
import { buildMenu, buildExtraRoutes } from '@/main';

const UI_DIST_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'node_modules', '@phlix', 'ui', 'dist'
);

/** Every ESM chunk of the installed bundle, joined for whole-surface scans. */
function readInstalledEsmBundle(): string {
  expect(existsSync(UI_DIST_DIR), `vendored bundle missing at ${UI_DIST_DIR}`).toBe(true);
  const chunks = readdirSync(UI_DIST_DIR)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(join(UI_DIST_DIR, name), 'utf8'));
  // Chunk-count floor: an empty scan would make every absence-assertion below
  // pass vacuously. The v0.99.x bundle ships hundreds of chunks; the floor is
  // deliberately far below any real era.
  expect(chunks.length, 'vendored bundle produced no .js chunks').toBeGreaterThan(10);
  return chunks.join('\n');
}

const BUNDLE = readInstalledEsmBundle();

/**
 * The same-origin room-socket derivation, as it appears minified:
 * `const host = … ? window.location.hostname : "localhost"` … `…//${host}:8097?room=…`
 * (chunk hashes rotate on every re-pin, so the scan is over all chunks, never
 * a named file).
 */
const SAME_ORIGIN_ROOM_DIAL = /location\.hostname\s*:\s*"localhost"[\s\S]{0,200}:8097\?room=/;

describe('SyncPlay desktop status (M-WINDOWS-04)', () => {
  it('the vendored shell registers /app/syncplay — the surface ships, it was never dropped', () => {
    const app = createPhlixApp({
      app: 'server',
      apiBase: 'http://localhost:8096',
      menu: [],
      extraRoutes: buildExtraRoutes('server'),
      requireConnection: true,
    });
    const router = app.config.globalProperties.$router as import('vue-router').Router;
    const syncplay = router.getRoutes().filter((r) => r.path === '/app/syncplay');

    expect(syncplay, 'vendored shell no longer registers /app/syncplay').toHaveLength(1);
    expect(syncplay[0].name).toBe('syncplay');
  });

  it('the room socket still dials the PAGE host — the desktop origin can never reach a remote server', () => {
    expect(
      SAME_ORIGIN_ROOM_DIAL.test(BUNDLE),
      'the same-origin :8097 room dial is gone from the vendored bundle — the socket endpoint ' +
      'changed shape: re-measure the README "Watching with friends (SyncPlay)" story and the ' +
      'routeReachability.test.ts carve-out before anything else trusts this file'
    ).toBe(true);
  });

  it('the __PHLIX__.wsUrl socket seam is NOT in the installed bundle — nav entry stays withheld until it is', () => {
    const seamCarriers = ['wsUrl', 'wsPath'];
    const found = seamCarriers.filter((literal) => BUNDLE.includes(literal));

    expect(
      found,
      'the installed @phlix/ui bundle now carries the wsUrl/wsPath socket seam ' +
      `(literals: ${found.join(', ')}). M-WINDOWS-04 rider condition MET: derive the room ` +
      'endpoint from the persisted serverUrl at boot (phlix-ui 94579936 / R12-02), add the ' +
      "SyncPlay entry to buildMenu('server'), retire the routeReachability carve-out, and " +
      'flip the README limitation to the live-party story — then delete this red pin.'
    ).toEqual([]);
  });

  it('neither desktop nav advertises SyncPlay while its room socket cannot connect', () => {
    for (const mode of ['server', 'hub'] as const) {
      const ids = buildMenu(mode).map((item) => item.id);
      expect(
        ids,
        `buildMenu('${mode}') advertises a SyncPlay nav entry whose room socket is proven ` +
        'inert from the app:// origin by the pin above — withheld until the wsUrl seam rider lands'
      ).not.toContain('syncplay');
    }
  });
});
