/**
 * @vitest-environment node
 *
 * CI cure (deferred-9 lane, 2026-11-03): the renderer's m20 import of
 * `../main/urlValidator` rides tsconfig.json's composite project reference
 * (tsconfig.main.json) — a referenced project resolves through its BUILD
 * OUTPUT (.d.ts), which a bare `npm ci` never creates. The Type Check jobs
 * ran `npx vue-tsc --noEmit` straight after install, so on the clean CI
 * tree the very first renderer check failed TS6305 (Test 41714206181 /
 * Build 41714206577, and again at 549ec98) while local runs rested green on
 * a stale dist/ from earlier builds — the estate's 'local gates must mirror
 * CI steps' lesson in its inverse form (stale local artifacts mask reds).
 *
 * Law pinned here:
 *  1. BOTH Type Check jobs (test.yml `types`, build.yml `typecheck`) build
 *     the main composite project (exactly `npx tsc -p tsconfig.main.json`)
 *     BEFORE the renderer pass, so the referenced outputs exist;
 *  2. that build step precedes 'Type check renderer' and 'Type check tests'
 *     in step order (the tests project resolves the same outputs);
 *  3. the pre-existing trio of type steps keeps its exact names — the cure
 *     inserts a step, it never renames the checks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const wf = (name) =>
  readFileSync(resolve(__dirname, '../../.github/workflows', name), 'utf-8');

const stepNames = (doc) =>
  [...doc.matchAll(/^ {6}- name: (.+)$/gm)].map((m) => m[1]);

describe('Type Check jobs build the composite main project before the renderer pass', () => {
  for (const file of ['test.yml', 'build.yml']) {
    it(`${file} has the main-project build step with the exact command`, () => {
      const doc = wf(file);
      const names = stepNames(doc);
      expect(names.filter((n) => n === 'Build main process (project-reference output)')).toHaveLength(1);
      expect((doc.match(/run: npx tsc -p tsconfig\.main\.json\n/g) ?? []).length).toBe(1);
    });

    it(`${file}: the build precedes BOTH dependent checks in step order`, () => {
      const names = stepNames(wf(file));
      const build = names.indexOf('Build main process (project-reference output)');
      const renderer = names.indexOf('Type check renderer');
      const tests = names.indexOf('Type check tests');
      expect(build, 'missing build step').toBeGreaterThan(-1);
      expect(renderer).toBeGreaterThan(build);
      expect(tests).toBeGreaterThan(build);
      expect(renderer, 'missing renderer step').toBeGreaterThan(-1);
    });

    it(`${file}: the three type-check step names stay verbatim`, () => {
      const names = stepNames(wf(file));
      for (const n of [
        'Type check renderer',
        'Type check main process',
        'Type check tests',
      ]) {
        expect(names, n).toContain(n);
      }
    });
  }
});
