/**
 * M-WINDOWS-17 status pins — "Hub Mode" is shipped machinery, not an enterable feature.
 *
 * Root cause (review windows__gameux M6): README.md advertised a "Hub Mode" the app
 * could never enter — its only config writer, the `hub:set-config` IPC, has ZERO
 * callers. Verified at HEAD (b5547cea era): main handlers (`src/main/index.ts`
 * hub:get-config / hub:set-config), the preload surface (`hubGetConfig` /
 * `hubSetConfig`), the resolver's hub branch (`src/renderer/resolveConfig.ts`) and the
 * full hub nav/route set (`buildMenu('hub')` / `buildExtraRoutes('hub')`) all exist —
 * but the renderer owns no settings form (this repo's thin-consumer law: Settings UI is
 * vendored from `@phlix/ui`, never forked locally), and the pinned `@phlix/ui` bundle
 * never touches `electronAPI`, so no
 * vendored surface can drive the writer either. Every launch boots server mode.
 *
 * Cure: docs-demotion to shipped truth (this repo's own M-WINDOWS-04/SyncPlay template —
 * honest section + Known-Limitations pointer + tripwire pins), NOT a windows-side form
 * (forbidden by the thin-consumer law) and NOT a new dialog affordance (no input piece
 * exists; building entry UX is the upstream `@phlix/ui` connection-seam wave — the
 * v0.99.12 rider, same wave already carrying the tokenStore seam of
 * `src/renderer/safeStorageTokenStore.ts`).
 *
 * Claim → disposition table (each row is a pin below):
 *
 * | # | Cite (parent era)                                  | Claim                     | Truth                          | Disposition                  |
 * |---|----------------------------------------------------|---------------------------|--------------------------------|------------------------------|
 * | 1 | README.md:25 (Features)                            | Hub Mode ships as feature | writer has zero callers        | bullet deleted; fiction-literal pins |
 * | 2 | README.md:412 ("### What Works")                   | Hub Mode "works"          | same                             | bullet deleted; section-scope pin   |
 * | 3 | README.md:335-369 (Hub Mode section + fake steps)  | "Open Settings → Hub Mode section → Enter Hub URL → Sign in" | no such steps exist | section rewritten to machinery-truth status; step literals forbidden |
 * | 4 | README.md:61/161/164 ("(or Hub)" / "server or Hub" / "configured at runtime") | Hub URL usable at Connect / configures at runtime | hub URL at Connect lands server mode; channel never fired | re-attributed to server-only truth; literals forbidden |
 * | 5 | src/main/index.ts hub handlers                     | (silent)                  | enterability gap undiscoverable | rider comment naming M-WINDOWS-17 pinned |
 * | 6 | docs/ui-surface.md hub-mode summary                | 11 OK (mode-conditional)  | mode unreachable               | rider sentence (fixed by this lane; not pinned here) |
 * | 7 | docs/deep-links.md:23 + Examples :74/:77 (r1-era)  | hub-mode routes "registered by this repo" (enterability implied) | mode unreachable — both arms parse fine yet 404-view in the shipped build | rider note + per-arm "404-views today" annotations (cured in r2, 0034662f2; not pinned here) |
 *
 * The zero-caller and seam-absence pins are TRIPWIRES: the moment an upstream re-pin
 * ships a hub-connection form or a lane wires the writer, they redden and their
 * messages carry the full rider procedure (wire boot → restore the enterable claims →
 * retire the current-state pins).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildMenu, buildExtraRoutes } from '@/main';
import { resolveAppConfig } from '@/resolveConfig';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const UI_DIST_DIR = join(PROJECT_ROOT, 'node_modules', '@phlix', 'ui', 'dist');

const README = readFileSync(join(PROJECT_ROOT, 'README.md'), 'utf-8');
const MAIN_SOURCE = readFileSync(join(PROJECT_ROOT, 'src', 'main', 'index.ts'), 'utf-8');

/** README slice between two headings (end heading absent → to end of file). */
function readmeSection(startHeading: string, endHeading: string): string {
  const start = README.indexOf(startHeading);
  expect(start, `README lost the "${startHeading}" heading`).toBeGreaterThanOrEqual(0);
  const end = README.indexOf(endHeading, start + startHeading.length);
  return end === -1 ? README.slice(start) : README.slice(start, end);
}

/** Every production .ts file under src/ except the named rel-path exemptions. */
function readProductionSources(exempt: ReadonlySet<string>): Array<{ rel: string; source: string }> {
  const files: Array<{ rel: string; source: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.ts')) {
        const rel = relative(PROJECT_ROOT, full).split(sep).join('/');
        if (!exempt.has(rel)) {
          files.push({ rel, source: readFileSync(full, 'utf-8') });
        }
      }
    }
  };
  walk(join(PROJECT_ROOT, 'src'));
  expect(files.length, 'src walk found no production sources').toBeGreaterThan(0);
  return files;
}

describe('Hub Mode is not enterable (M-WINDOWS-17)', () => {
  // -------------------------------------------------------------------------
  // Fiction forbidden: the retired enterable claims must never resurface in
  // README while the writer has zero callers.
  // -------------------------------------------------------------------------

  it('README carries no enterability fiction literals (retired M-WINDOWS-17 claims)', () => {
    const forbidden = [
      '**Hub Mode** - Connect to a Phlix Hub to manage multiple servers', // old Features bullet
      '**Hub Mode** — Connect to a Phlix Hub; direct-LAN and relay connection modes', // old What Works bullet
      'Navigate to Hub Mode section', // old fake in-app steps
      'Sign in with your Hub credentials', // old fake in-app steps
      '#### In-App Configuration', // old fake-steps heading
      'User configures Hub URL and signs in', // old fake Connection Flow
      '(or Hub)', // old Connect-screen claim that a Hub URL is accepted there
      'server or Hub' // old env-var / first-run phrasing treating Hub as user-configurable
    ];
    const found = forbidden.filter((literal) => README.includes(literal));
    expect(
      found,
      'README re-advertises Hub Mode as enterable (literals above). While `hub:set-config` ' +
      'has zero callers (pinned below) that is theater: review windows__gameux M6. If hub ' +
      'mode has BECOME enterable (upstream connection seam wired), instead: wire boot to ' +
      'hubSetConfig, restore the Features + What Works bullets and the how-to section to ' +
      'live copy, and retire the fiction and zero-caller pins together.'
    ).toEqual([]);
  });

  it('Hub Mode is absent from "What Works" and present in "Known Limitations"', () => {
    const whatWorks = readmeSection('### What Works', '### Known Limitations');
    expect(whatWorks, 'Hub Mode listed under What Works though it cannot be entered').not.toContain('Hub Mode');

    const limitations = readmeSection('### Known Limitations', '## Watching with friends');
    expect(limitations, 'Known Limitations lost the Hub Mode pointer added by M-WINDOWS-17').toContain('Hub Mode');
  });

  it('README tells the shipped-truth disposition (status heading + zero-caller admission)', () => {
    expect(README, 'README no longer carries the M-WINDOWS-17 status section').toContain(
      '## Hub Mode (not yet enterable)'
    );
    expect(README, 'the Hub Mode section must admit the writer has no callers').toContain('zero callers');
  });

  // -------------------------------------------------------------------------
  // In-code rider: the dead writer site must name the disease.
  // -------------------------------------------------------------------------

  it('the hub config handlers carry the M-WINDOWS-17 no-entry rider', () => {
    const start = MAIN_SOURCE.indexOf("ipcMain.handle('hub:get-config'");
    const end = MAIN_SOURCE.indexOf("ipcMain.handle('app:get-server-url'");
    expect(start, 'hub:get-config handler vanished from src/main/index.ts').toBeGreaterThanOrEqual(0);
    expect(end, 'app:get-server-url handler vanished from src/main/index.ts').toBeGreaterThan(start);
    const slice = MAIN_SOURCE.slice(Math.max(0, start - 1200), end); // riders live in the comment block above the pair
    expect(slice, 'the hub handlers lost their M-WINDOWS-17 rider comment').toContain('M-WINDOWS-17');
  });

  // -------------------------------------------------------------------------
  // Machinery truth: the README status text describes what actually ships.
  // -------------------------------------------------------------------------

  it('the resolver hub branch behaves as the status section describes', () => {
    expect(resolveAppConfig({ hub: { hubUrl: 'https://hub.example', connectionMode: 'relay' } }))
      .toEqual({ app: 'hub', apiBase: 'https://hub.example' });
    expect(resolveAppConfig({ hub: { hubUrl: 'https://hub.example', connectionMode: 'direct' }, serverUrl: 'http://s:8096' }))
      .toEqual({ app: 'server', apiBase: 'http://s:8096' });
  });

  it('buildMenu("hub") and buildExtraRoutes("hub") ship the hub pages the status section names', () => {
    expect(buildMenu('hub').map((item) => item.id)).toEqual(
      expect.arrayContaining(['my-servers', 'federation', 'manage-shares', 'shared-with-me', 'invite-links', 'admin'])
    );
    const paths = buildExtraRoutes('hub').map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining(['/app/servers', '/app/federation', '/app/shares', '/app/shared', '/app/invites', '/app/accept-invite/:token'])
    );
  });

  // -------------------------------------------------------------------------
  // Tripwires (green today; they redden when reality flips)
  // -------------------------------------------------------------------------

  it('hubSetConfig has ZERO production callers — nothing can persist a hub config', () => {
    const exempt = new Set(['src/preload/index.ts', 'src/renderer/types/electron.d.ts']);
    const offenders = readProductionSources(exempt)
      .filter(({ source }) => source.includes('hubSetConfig'))
      .map(({ rel }) => rel);
    expect(
      offenders,
      'a caller of hubSetConfig just landed — hub mode may now be enterable. Rider procedure: ' +
      'prove entry end-to-end (scheme-gated write + boot re-resolution), restore the README ' +
      'enterable claims to live copy, and retire this pin + the fiction-literal pin together.'
    ).toEqual([]);
  });

  it('the installed @phlix/ui bundle touches no electronAPI — no vendored surface can drive the writer', () => {
    expect(existsSync(UI_DIST_DIR), `vendored bundle missing at ${UI_DIST_DIR}`).toBe(true);
    // R-WINDOWS-15: dist ships every chunk in BOTH module formats (.js + .cjs).
    // The renderer loads only .js chunks, but the claim under test is about the
    // installed bundle — scanning one format left the other technically
    // unpinned, a silent hole where an upstream hub-connection seam could ship
    // in .cjs unseen. All JS chunk formats are scanned; .mjs is admitted
    // defensively in case a future build switches format.
    const names = readdirSync(UI_DIST_DIR);
    const jsChunks = names.filter((name) => name.endsWith('.js'));
    const cjsChunks = names.filter((name) => name.endsWith('.cjs'));
    const mjsChunks = names.filter((name) => name.endsWith('.mjs'));
    // Floor guards: an empty (or format-starved) scan would make the
    // absence-assertion vacuous. The per-format floors are the R-WINDOWS-15
    // tripwire's own tripwire — if a re-pin ever changes the dist layout,
    // these redden so the scan set is re-derived, never silently narrowed.
    expect(jsChunks.length, 'vendored bundle produced no .js chunks').toBeGreaterThan(10);
    expect(
      cjsChunks.length,
      'vendored bundle produced no .cjs chunks — the dist module-format layout changed; ' +
      're-derive the R-WINDOWS-15 scan set before trusting this pin'
    ).toBeGreaterThan(10);
    const chunks = [...jsChunks, ...cjsChunks, ...mjsChunks];
    const carriers = chunks.filter(
      (name) => readFileSync(join(UI_DIST_DIR, name), 'utf-8').includes('electronAPI')
    );
    expect(
      carriers,
      `installed @phlix/ui chunks now reference electronAPI (${carriers.join(', ')}): the ` +
      'upstream hub-connection seam may have shipped. Re-pin this repo, check whether the form ' +
      'calls the hub config bridge, and run the M-WINDOWS-17 rider procedure if entry is now real.'
    ).toEqual([]);
  });
});
