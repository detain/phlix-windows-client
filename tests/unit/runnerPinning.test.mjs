/**
 * @vitest-environment node
 *
 * m31 (deferred-9 lane, 2026-11-03): runner pinning was half-done — every
 * ubuntu leg deliberately pins `ubuntu-26.04` (estate-wide rollover policy),
 * while every Windows leg floated on `windows-latest`, letting a hosted-image
 * rollover silently swap the Electron/electron-builder toolchain underneath
 * the release chain. windows-client is the ONLY estate repo running Windows
 * legs (estate workflow grep, 2026-11-03), so pinning COMPLETES the policy
 * here rather than diverging from it.
 *
 * Law pinned here:
 *  1. no floating `-latest` runner label appears in any workflow — Windows
 *     legs ride `windows-2025`, the label `windows-latest` resolved to at pin
 *     time (actions/runner-images README, 2026-11-03 read), freezing current
 *     behavior instead of moving it;
 *  2. the pinned label is used at every matrix/runs-on/if-guard position —
 *     counts are exact so a future half-rename (a leg floating, a guard
 *     comparing a dead string) reddens this suite;
 *  3. the docs that describe the legs stay currency-synced (same law the
 *     ubuntu-26.04 migration lane upheld estate-wide).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const wf = (name) =>
  readFileSync(resolve(__dirname, '../../.github/workflows', name), 'utf-8');

describe('workflow runner labels are deliberately pinned (m31)', () => {
  for (const file of ['test.yml', 'build.yml', 'codeql.yml']) {
    it(`${file} carries no floating -latest label`, () => {
      const doc = wf(file);
      expect(doc, 'windows-latest floats the toolchain').not.toMatch(/windows-latest/);
      expect(doc, 'ubuntu-latest is the estate anti-pattern').not.toMatch(/ubuntu-latest/);
      expect(doc, 'macos-latest is outside the pin policy').not.toMatch(/macos-latest/);
    });
  }

  it('build.yml pins the label at all four positions (smoke matrix + guard, nsis + appx runs-on)', () => {
    const doc = wf('build.yml');
    expect((doc.match(/os: \[ubuntu-26\.04, windows-2025\]/g) ?? []).length).toBe(1);
    expect((doc.match(/matrix\.os == 'windows-2025'/g) ?? []).length).toBe(1);
    expect((doc.match(/^ {12}runs-on: windows-2025$/gm) ?? []).length).toBe(2);
  });

  it('test.yml pins the label at all three positions (test + smoke matrices, smoke guard)', () => {
    const doc = wf('test.yml');
    expect((doc.match(/os: \[ubuntu-26\.04, windows-2025\]/g) ?? []).length).toBe(2);
    expect((doc.match(/matrix\.os == 'windows-2025'/g) ?? []).length).toBe(1);
  });

  it('ubuntu legs keep the estate pin', () => {
    for (const file of ['test.yml', 'build.yml', 'codeql.yml']) {
      expect(wf(file), file).toMatch(/ubuntu-26\.04/);
    }
  });

  it('the docs that describe the legs stayed currency-synced', () => {
    for (const doc of ['../../docs/ci-baseline.md', '../../docs/signing.md']) {
      expect(
        readFileSync(resolve(__dirname, doc), 'utf-8'),
        doc,
      ).not.toMatch(/windows-latest/);
    }
  });
});
