/**
 * M-WINDOWS-04 status pins — friend-watch (SyncPlay) on the desktop.
 *
 * The four docs sources disagreed about whether Windows ships SyncPlay at all.
 * The ground truth, re-measured at the @phlix/ui v0.99.12 pin (tag-wave C4,
 * 2026-11-02): the surface is LIVE in SERVER mode.
 *
 *  1. The shell DOES register `/app/syncplay` and the player DOES ship the
 *     SyncPlay room modal — the surface exists (it was never "dropped").
 *  2. The historical inertness: the room socket's legacy derivation dials
 *     `window.location.hostname + :8097` — a same-origin assumption built for
 *     the web player the server itself hosts. This renderer is served from the
 *     internal `app://-/` origin (hostname the literal `-`), so on that path a
 *     packaged desktop build could never reach a remote server.
 *  3. THE CURE LANDED: the `__PHLIX__.wsUrl` socket seam (phlix-ui 94579936,
 *     R12-02) ships in every v0.99.12 chunk set, and this repo's boot() now
 *     feeds it from the effective server URL (deriveSyncPlaySocketHint →
 *     window.__PHLIX__.wsUrl, pinned in tests/unit/main.test.ts). The legacy
 *     same-origin path stays in the bundle as the NO_HINT fallback — the seam
 *     only PRECEDES it. The nav entry buildMenu('server') added in this wave
 *     is therefore honest, and routeReachability.test.ts keeps the syncplay
 *     allow-list entry for hub mode only.
 *  4. Hub mode stays withheld (rider leg 4): the hub transport runs the :8804
 *     relay and the same wsUrl seam overrides relay dials wholesale (upstream
 *     hubRelay.ts) — surfacing a watch party there needs relay-aware evidence,
 *     not just the seam.
 *
 * These tests remain tripwires, not decoration: each one REDS exactly when the
 * underlying bundle reality flips — the vendored dial changing shape, the seam
 * disappearing (re-pin to a pre-seam era), or the nav posture changing.
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
 * The same-origin room-socket LEGACY derivation, as it appears minified:
 * `const host = … ? window.location.hostname : "localhost"` … `…//${host}:8097?room=…`
 * (chunk hashes rotate on every re-pin, so the scan is over all chunks, never
 * a named file). Post-seam this is the NO_HINT fallback — it must SURVIVE
 * (the fail-soft promise is that non-hinted boots behave exactly as before).
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

  it('the wsUrl/wsPath socket seam IS in the installed bundle — the desktop ride is live, not withheld', () => {
    // v0.99.12 rider condition MET (this pin was the rider's tripwire; it
    // reddened on 2026-11-02 and the second leg was executed in the same
    // wave). Inverse hazard it now guards: a re-pin to a pre-seam ui era
    // would flip this red — and boot()'s hint would then advertise a dead
    // surface again, exactly the docs-vs-reality gap this file exists to shut.
    const seamCarriers = ['wsUrl', 'wsPath'];
    const found = seamCarriers.filter((literal) => BUNDLE.includes(literal));

    expect(
      found,
      'the installed @phlix/ui bundle lost the wsUrl/wsPath socket seam literals ' +
      `(found: ${found.join(', ') || 'none'}). The vendored room socket is inert from the ` +
      'app:// origin again — re-withhold buildMenu syncplay + flip the README section back ' +
      'to the limitation story (see git log for this wave) before anything else ships.'
    ).toEqual(['wsUrl', 'wsPath']);
  });

  it('the legacy same-origin room fallback survives the seam (fail-soft promise)', () => {
    expect(
      SAME_ORIGIN_ROOM_DIAL.test(BUNDLE),
      'the same-origin :8097 room dial is gone from the vendored bundle — the socket endpoint ' +
      'changed shape: re-measure the README "Watching with friends (SyncPlay)" story and the ' +
      'boot hint in src/renderer/main.ts before anything else trusts this file'
    ).toBe(true);
  });

  it('server nav advertises the now-live SyncPlay room; hub nav stays withheld (rider leg 4)', () => {
    const serverIds = buildMenu('server').map((item) => item.id);
    expect(
      serverIds,
      "buildMenu('server') lost its syncplay entry — the seam ships in the installed bundle " +
      '(pinned above) and boot() feeds it (main.test.ts), so the room page is reachable; a ' +
      'silent nav removal is the docs-vs-reality gap this file exists to catch'
    ).toContain('syncplay');

    const hubIds = buildMenu('hub').map((item) => item.id);
    expect(
      hubIds,
      "buildMenu('hub') advertises SyncPlay without relay-aware evidence: the hub transport " +
      'runs the :8804 relay and a wsUrl hint would override those dials wholesale ' +
      '(upstream hubRelay.ts). Leg 4 demands new evidence before this flips — see ' +
      '.reviews/fixlog/M-WINDOWS-04__fix.md'
    ).not.toContain('syncplay');
  });
});
