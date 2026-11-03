/**
 * @vitest-environment node
 *
 * Review batch 7 (M13+D2 / m28 / m29 / m30 / m35): the tag→release path is
 * still unexercised (no v* tag has ever been pushed — that rehearsal is an
 * OWNER action), but its latent defects are cured and the family laws now
 * carry teeth:
 *  1. M13/D2 — the Create Release step used to attach TWO assets named
 *     SHA256SUMS.txt (the build leg's artifacts/nsis copy and the release
 *     job's regenerated copy). GitHub release assets are name-unique: the
 *     first tag push would have silently overwritten one (losing blockmap
 *     coverage or the installers, depending on order) or 422'd. Exactly one
 *     SHA256SUMS asset may be listed, and the surviving release-job file
 *     must hash the .blockmap the deleted twin used to cover.
 *  2. m28 — electron-builder output goes to release/ (package.json
 *     build.directories.output); AGENTS.md and DEVELOPER.md always CLAIMED it
 *     was gitignored while .gitignore listed no such entry. The ignore is
 *     real now; this test keeps the docs' claim true.
 *  3. m29 — version-check ran with `needs: build`, burning ~45 packaging
 *     minutes before a 10-second tag-vs-package.json drift check could
 *     reject the push. It is needs: [] now; safety is preserved because the
 *     release job still needs BOTH build and version-check.
 *  4. m30 — prerelease detection flagged only beta/alpha; a -rc tag would
 *     have published as STABLE and allowPrerelease=false clients would
 *     auto-install it. '-rc' counts now.
 *  5. m35 — codeql.yml was the only workflow whose jobs lacked
 *     timeout-minutes (the M-WINDOWS-25 deliberate-bounds family law).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const wf = readFileSync(resolve(root, '.github/workflows/build.yml'), 'utf-8');
const codeql = readFileSync(resolve(root, '.github/workflows/codeql.yml'), 'utf-8');
const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf-8');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));

describe('release asset integrity (M13/D2)', () => {
  const createRelease = wf.slice(wf.indexOf('- name: Create Release'));
  const filesBlock = createRelease.slice(
    createRelease.indexOf('files: |'),
    createRelease.indexOf('env:', createRelease.indexOf('files: |'))
  );

  it('the release lists EXACTLY one SHA256SUMS.txt asset', () => {
    // count ASSET LINES only (12-space indented paths) — the prose comments
    // inside the block name the file too and must not poison the count.
    const assetLines = filesBlock.match(/^ {12}artifacts\/\S+$/gm) ?? [];
    const sums = assetLines.filter((l) => l.endsWith('SHA256SUMS.txt'));
    expect(sums).toHaveLength(1);
    expect(sums[0]).toBe('            artifacts/SHA256SUMS.txt');
    expect(filesBlock).not.toMatch(/^ {12}artifacts\/nsis\/SHA256SUMS\.txt$/m);
  });

  it('the release job keeps the nsis triplet + appx installer', () => {
    for (const asset of ['artifacts/nsis/*.exe', 'artifacts/nsis/*.exe.blockmap', 'artifacts/nsis/latest.yml', 'artifacts/appx/*.appx']) {
      expect(filesBlock).toContain(asset);
    }
  });

  it('the surviving checksum command hashes installers AND blockmaps, fail-loud', () => {
    const step = wf.slice(wf.indexOf('- name: Generate SHA256 checksums', wf.indexOf('- name: Get version')));
    const body = step.slice(0, step.indexOf('\n      - name:', 10));
    expect(body).toContain('nsis/*.exe nsis/*.exe.blockmap appx/*.appx');
    expect(body).toMatch(/shopt -s nullglob/);
    expect(body).toMatch(/::error::/);
  });
});

describe('release/ is really gitignored (m28)', () => {
  it('package.json sends builder output to release/', () => {
    expect(pkg.build.directories.output).toBe('release');
  });

  it('.gitignore carries a release/ entry', () => {
    expect(gitignore).toMatch(/^release\/$/m);
  });
});

describe('job-graph bounds (m29, m35)', () => {
  it('version-check depends on nothing and rejects drift before packaging', () => {
    const start = wf.indexOf('  version-check:');
    expect(start).toBeGreaterThan(-1);
    const body = wf.slice(start, start + 1200);
    expect(body).toMatch(/needs: \[\]/);
    expect(body).not.toMatch(/needs: build/);
  });

  it('the release job still waits for build AND version-check', () => {
    expect(wf).toMatch(/needs:\s*\[build,\s*version-check\]/);
  });

  it('every codeql job carries timeout-minutes (M-WINDOWS-25 family law)', () => {
    // codeql.yml defines exactly one job today; count top-level job keys under
    // `jobs:` and require one timeout-minutes per job, so adding a job without
    // a bound reddens this pin.
    const jobsSection = codeql.slice(codeql.indexOf('\njobs:\n'));
    const jobCount = (jobsSection.match(/^ {2}[\w-]+:$/gm) ?? []).length;
    const timeoutCount = (jobsSection.match(/^ {4}timeout-minutes:/gm) ?? []).length;
    expect(jobCount).toBeGreaterThan(0);
    expect(timeoutCount).toBe(jobCount);
  });
});

describe('prerelease detection (m30)', () => {
  it('beta, alpha AND -rc flip the prerelease flag', () => {
    expect(wf).toMatch(/contains\(steps\.version\.outputs\.VERSION, 'beta'\)/);
    expect(wf).toMatch(/contains\(steps\.version\.outputs\.VERSION, 'alpha'\)/);
    expect(wf).toMatch(/contains\(steps\.version\.outputs\.VERSION, '-rc'\)/);
  });
});
