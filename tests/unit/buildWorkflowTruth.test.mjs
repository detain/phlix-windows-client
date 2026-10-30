/**
 * @vitest-environment node
 *
 * M-WINDOWS-27 (review windows__devops MIN-4): the build pipeline carried
 * three dead or misleading surfaces —
 *  1. `workflow_dispatch.inputs.version` read ONLY inside the tag-gated
 *     release job: a maintainer dispatching "to build 1.1.0" got 1.0.0 stamped
 *     artifacts and no release. The input can never do its advertised job, so
 *     it is deleted (wiring it would be a feature, not a minors fix).
 *  2. checksum steps globbing `*.appx *.nupkg` patterns this repo never
 *     produces, with `2>/dev/null || echo "No artifacts found"` printing a
 *     lie next to a file that DOES contain checksums (partial glob failure),
 *     while the release body text promises an integrity asset.
 *  3. an "updater note" claiming the auto-updater consumer lives in @phlix/ui
 *     — false: the Electron MAIN PROCESS of this repo is the consumer
 *     (src/main/index.ts autoUpdater; @phlix/ui is the renderer).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const wf = readFileSync(resolve(__dirname, '../../.github/workflows/build.yml'), 'utf-8');
const mainTs = readFileSync(resolve(__dirname, '../../src/main/index.ts'), 'utf-8');

describe('build.yml pipeline truth (M-WINDOWS-27)', () => {
  it('the dead workflow_dispatch version input is gone', () => {
    expect(wf).not.toMatch(/workflow_dispatch:\s*\n\s*inputs:/);
    expect(wf).not.toMatch(/github\.event\.inputs\.version/);
    // dispatch itself stays (CI validation runs), just without a lying input
    expect(wf).toMatch(/workflow_dispatch:/);
  });

  it('the release job derives its version from the tag alone', () => {
    // the tag-extraction line survives; the inputs-first branch does not
    expect(wf).toMatch(/\$\{GITHUB_REF#refs\/tags\/v\}/);
    const getVersionJob = wf.slice(wf.indexOf('- name: Get version'));
    expect(getVersionJob.slice(0, 900)).not.toMatch(/inputs/);
  });

  it('checksum steps are nullglob fail-loud and never print "No artifacts found"', () => {
    expect(wf).not.toMatch(/No artifacts found/);
    const nullglobCount = (wf.match(/shopt -s nullglob/g) || []).length;
    expect(nullglobCount).toBe(2); // build-leg per-target + release-latest
    // the never-produced .nupkg pattern must not survive in a checksum step
    expect(wf).not.toMatch(/sha256sum[^|\n]*\.nupkg/);
    // both steps refuse to write an empty/misleading integrity file
    expect(wf).toMatch(/::error::[^\n]*checksum|::error::[^\n]*artifact/i);
  });

  it("the updater note names THIS repo's main process as the consumer", () => {
    const note = wf.slice(wf.indexOf('# ─── updater note'), wf.indexOf('# ─── version-check'));
    expect(note.length, 'updater note block located').toBeGreaterThan(80);
    // honest: the consumer lives here...
    expect(note).toMatch(/main process/);
    // ...and no longer outsources consumption to @phlix/ui
    expect(note).not.toMatch(/if @phlix\/ui \(the consuming package\)/i);
    // and that claim is real — the main process is an electron-updater consumer
    expect(mainTs).toMatch(/autoUpdater/);
  });
});
