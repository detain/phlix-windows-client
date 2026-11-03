/**
 * @vitest-environment node
 *
 * m32 (deferred-9 lane, 2026-11-03): every Windows leg re-downloaded the
 * Electron binary (npm postinstall) and the electron-builder tool zips on
 * every CI run — setup-node's `cache: 'npm'` covers packages, not these.
 * The cure is one actions/cache step per Windows-capable job (test.yml:
 * test + smoke; build.yml: smoke + build), guarded by `runner.os ==
 * 'Windows'` so ubuntu legs keep their exact step lists.
 *
 * Law pinned here:
 *  1. exactly two cache steps in each workflow — one per Windows leg, no
 *     creep onto ubuntu-only jobs (the total across both files is 4);
 *  2. the action is SHA-pinned with its version comment (supply-chain law:
 *     no floating tags anywhere in these workflows);
 *  3. both Windows cache dirs are listed — the Electron download cache and
 *     the electron-builder tool cache, each version-filename-addressed, so
 *     a stale restore can never supply the wrong artifact and a miss is
 *     exactly today's download (the step is a pure speed change);
 *  4. the key hashes package-lock.json and prefix restore-keys are kept —
 *     cross-lockfile reuse of version-named entries is the safe direction;
 *  5. every cache step sits immediately BEFORE `Install dependencies`
 *     (restore must precede the npm ci that triggers the download).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const STEP = 'Cache Electron tooling (Windows)';
const CACHE_SHA = 'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0';

const wf = (name) =>
  readFileSync(resolve(__dirname, '../../.github/workflows', name), 'utf-8');

const count = (doc, re) => (doc.match(re) ?? []).length;

describe('m32: Windows legs cache the Electron toolchain (speed-only, zero semantics)', () => {
  for (const file of ['test.yml', 'build.yml']) {
    it(`${file} carries exactly two Windows cache steps (one per Windows-capable job)`, () => {
      const doc = wf(file);
      expect(count(doc, new RegExp(`- name: ${STEP.replace(/[()]/g, '\\$&')}`, 'g')))
        .toBe(2);
    });

    it(`${file}: each step is runner.os-guarded and SHA-pinned (no floating tag)`, () => {
      const doc = wf(file);
      expect(count(doc, new RegExp(`- name: ${STEP.replace(/[()]/g, '\\$&')}\n {8}if: runner\\.os == 'Windows'\n {8}uses: ${CACHE_SHA.replace(/[.@#]/g, '\\$&')}`, 'g')))
        .toBe(2);
    });

    it(`${file}: both version-addressed cache dirs are restored`, () => {
      const doc = wf(file);
      expect(count(doc, /~\\AppData\\Local\\electron\\Cache/g)).toBe(2);
      expect(count(doc, /~\\AppData\\Local\\electron-builder\\Cache/g)).toBe(2);
    });

    it(`${file}: keys ride the lockfile with a prefix restore`, () => {
      const doc = wf(file);
      expect(count(doc, /key: \$\{\{ runner\.os \}\}-electron-tooling-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/g)).toBe(2);
      expect(count(doc, /\$\{\{ runner\.os \}\}-electron-tooling-\n/g)).toBe(2);
    });

    it(`${file}: every cache step restores BEFORE npm ci`, () => {
      const doc = wf(file);
      // restore-keys tail ... then two newlines ... then the install step.
      expect(count(doc, new RegExp(`restore-keys: \\|\n {12}\\$\\{\\{ runner\\.os \\}\\}-electron-tooling-\n\n {6}- name: Install dependencies`, 'g')))
        .toBe(2);
    });
  }

  it('the estate total stays exactly 4 — the step never creeps onto ubuntu legs', () => {
    const total = ['test.yml', 'build.yml']
      .map((f) => count(wf(f), new RegExp(`- name: ${STEP.replace(/[()]/g, '\\$&')}`, 'g')))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it('ubuntu jobs keep their exact step lists (cache is Windows-only by guard)', () => {
    // Structural proof of the guard: the step's `if` line is part of its
    // only legal shape, already asserted above; here we pin there is no
    // second unguarded actions/cache usage anywhere in either workflow.
    for (const file of ['test.yml', 'build.yml']) {
      expect(count(wf(file), /uses: actions\/cache@/g)).toBe(2);
    }
  });
});
