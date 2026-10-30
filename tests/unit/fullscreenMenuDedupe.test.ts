/**
 * @vitest-environment node
 *
 * M-WINDOWS-41 (review windows__gameux m7): the menu bound F11 twice — the
 * explicit Playback row `{ accelerator: 'F11', click: toggleFullscreen }` and
 * the View submenu's `role: 'togglefullscreen'` (same default accelerator on
 * Windows) — one accelerator, two menu rows, winner Electron-internal trivia.
 *
 * Cure: the custom row is the single fullscreen entry (its label flows through
 * the i18n catalog; role labels are native-rendered and cannot). These pins
 * keep the duplicate from re-entering, in the same source-shape style the repo
 * already uses for menu/notification wiring (notification.test.ts,
 * minimizeToTray.test.ts).
 *
 * Deliberately NOT pinned here: the third vocabulary (the vendored ui's `f` →
 * HTML5 fullscreen) lives inside the `@phlix/ui` bundle — syncing window
 * fullscreen with in-page fullscreen state is an upstream seam, recorded as a
 * rider in the W-min199 report, not curable from this repo's side alone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');
const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8').replace(/\r\n/g, '\n');

describe('F11 menu binding is unique (M-WINDOWS-41)', () => {
  it('exactly one menu row carries the F11 accelerator', () => {
    const hits = mainSource.match(/accelerator:\s*'F11'/g) || [];
    expect(hits.length).toBe(1);
  });

  it('no menu row re-claims the binding via role: togglefullscreen', () => {
    expect(mainSource).not.toMatch(/role:\s*'togglefullscreen'/);
  });

  it('the surviving row is the i18n-labeled toggleFullscreen() custom entry', () => {
    expect(mainSource).toMatch(/\{ label: t\('menu\.fullscreen'\), accelerator: 'F11', click: \(\) => toggleFullscreen\(\) \}/);
  });

  it('the dedupe is documented at the View submenu so a future lane keeps it', () => {
    // The comment sits where the role entry used to be — law: pins carry their why.
    // Window widened 700 → 1250 in W-min206: the M-WINDOWS-32 dev-only roles
    // block now sits between the View label and the dedupe note. Mechanical
    // reach only — the presence assertion is unchanged.
    const idx = mainSource.indexOf("label: t('menu.view')");
    expect(idx).toBeGreaterThan(-1);
    expect(mainSource.slice(idx, idx + 1250)).toMatch(/M-WINDOWS-41/);
  });
});
