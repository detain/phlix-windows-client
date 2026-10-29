/**
 * @vitest-environment node
 *
 * M-WINDOWS-05 feed-shape guard — the release pipeline must never fabricate
 * the electron-updater feed again.
 *
 * WHY: `.github/workflows/build.yml` used to hand-write `artifacts/latest.yml`
 * with `sha256:`/`target:` fields (electron-updater's contract is `sha512`
 * base64 + `size` + blockmap support; `sha256`/`target` are fields it never
 * consumes), discard the schema-correct `release/latest.yml` that
 * electron-builder itself emits during the nsis leg, invent a
 * `latest-windows.yml` no updater path reads (NsisUpdater, not appx, is the
 * Windows feed consumer), and upload zero `.blockmap` files (differential
 * downloads impossible). The cure moves every guarantee to the authentic
 * side: the builder feed + blockmap are carried verbatim through the build
 * artifact upload and attached to the versioned release, guarded by a
 * fail-loud schema-verification step.
 *
 * NAME LAW (config, not cat): the default nsis artifact name contains spaces
 * (`Phlix Setup 1.0.0.exe`). Proven against this repo's own live release on
 * 2026-10-29: GitHub stores such asset names with dots
 * (`Phlix.Setup.1.0.0.exe`), while electron-builder's GitHub feed url and
 * electron-updater's space→dash URL normalization both request the DASH form
 * (`Phlix-Setup-1.0.0.exe`) — a 404 for every updater download.
 * `build.nsis.artifactName` is therefore pinned space-free so the feed url,
 * the on-disk file, the stored asset name, and the updater's request path are
 * literally one and the same string. The space-free upload path is proven by
 * the identically-named `SHA256SUMS.txt` asset, served verbatim.
 *
 * These are source-of-truth text pins (the repo's established workflow-guard
 * idiom — see audit-gate.test.mjs for the scripts-level precedent); the
 * verification step's own greps do the runtime enforcement on CI. Every law
 * below reddens on the pre-cure build.yml at parent 1fa7694.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const buildYml = readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');
const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

/** The `files: |` block of the versioned release's Create Release step. */
function releaseJobText() {
  const start = buildYml.indexOf('\n  release:');
  expect(start, 'release job exists in build.yml').toBeGreaterThan(-1);
  return buildYml.slice(start);
}

describe('release job never hand-writes the updater feed', () => {
  it('contains no cat-generated feed file', () => {
    expect(buildYml).not.toMatch(/cat > artifacts\/(nsis\/)?latest.*\.yml/);
    expect(buildYml).not.toContain('EXE_SHA256');
    expect(buildYml).not.toContain('APPX_SHA256');
  });

  it('has purged the latest-windows.yml alias no updater ever reads', () => {
    expect(buildYml).not.toContain('latest-windows');
    expect(buildYml).not.toContain('artifacts/latest.yml'); // hand-written path (builder's is artifacts/nsis/latest.yml)
  });

  it('writes no fabricated feed schema fields anywhere at YAML body depth', () => {
    // The fabricated heredoc carried `target: nsis`/`target: appx` as plain
    // YAML body lines; legitimate matrix entries use `- target: <name>`.
    expect(buildYml).not.toMatch(/^\s+target: (nsis|appx)\s*$/m);
    // sha256 survives only as the human SHA256SUMS.txt companion, never as a
    // feed field interpolation.
    expect(buildYml).not.toMatch(/sha256: \$\{/);
  });
});

describe('the authentic electron-builder feed + blockmap ride the pipeline', () => {
  it("build job uploads builder's own latest.yml and *.blockmap from release/", () => {
    expect(buildYml).toContain('release/latest.yml');
    expect(buildYml).toContain('release/*.blockmap');
  });

  it('versioned release attaches the feed, the installer blockmap, and the installer', () => {
    const releaseJob = releaseJobText();
    expect(releaseJob).toContain('artifacts/nsis/latest.yml');
    expect(releaseJob).toContain('artifacts/nsis/*.exe.blockmap');
    expect(releaseJob).toContain('artifacts/nsis/*.exe');
  });

  it('release job fails loud when the feed is missing or fabricated (verification step)', () => {
    const verify = /- name: Verify the updater feed is electron-builder's own[\s\S]*?\n {6}- name: Create Release/;
    const match = buildYml.match(verify);
    expect(match, "verification step sits where the hand-written steps used to, before Create Release").not.toBeNull();
    const step = match[0];
    expect(step).toContain('test -f artifacts/nsis/latest.yml');
    expect(step).toContain('ls artifacts/nsis/*.exe.blockmap > /dev/null');
    expect(step).toContain('sha512: [A-Za-z0-9+/=]+');
    // no neutering idiom: no '|| true', no continue-on-error in the gate
    expect(step).not.toContain('|| true');
    expect(step).not.toContain('continue-on-error');
  });
});

describe('package.json carries the config-level feed contracts', () => {
  it('publishes through the GitHub provider (what makes builder emit the feed at all)', () => {
    expect(pkg.build.publish).toMatchObject({
      provider: 'github',
      owner: 'detain',
      repo: 'phlix-windows-client',
    });
  });

  it('pins a space-free nsis artifactName — feed url == asset name == updater request path', () => {
    const artifactName = pkg.build.nsis?.artifactName;
    expect(typeof artifactName, 'build.nsis.artifactName must be declared').toBe('string');
    expect(artifactName).not.toContain(' ');
    expect(artifactName).toBe('${productName}-Setup-${version}.${ext}');
  });

  it('leaves the appx target updater-unaware (no second feed may reappear)', () => {
    expect(pkg.build.appx?.electronUpdaterAware ?? false).toBe(false);
  });
});
