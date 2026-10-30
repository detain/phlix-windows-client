# CI Baseline — phlix-windows-client

Dated: 2026-08-07 — **era-frozen audit snapshot** (the W0–W6 closure review).
The gate inventory below is still checked against the live workflows and the
prose carries inline corrections where reality drifted; treat any line number
this doc once quoted as a symbol anchor instead (coordinates rot, symbols
don't).

> **M-WINDOWS-54 note (2026-10-31):** present-tense claims below that were true at
> audit time but have since drifted were corrected in place — audit gate shape,
> the Codecov authoritativeness claim, and the `build` job's `needs:` list.

## W0-W6 Gates Verified

| Gate | Location | Status |
|------|----------|--------|
| Smoke test (W0.8) | test.yml:smoke job + build.yml:smoke job | ✅ Present |
| ESLint | test.yml:lint job + build.yml:lint job | ✅ Present |
| vue-tsc (renderer) | test.yml:types + build.yml:typecheck | ✅ Present |
| tsc main (main/preload) | test.yml:types + build.yml:typecheck | ✅ Present |
| vitest unit tests | test.yml:test + build.yml:test | ✅ Present |
| Test typecheck (W6.3) | test.yml:types + build.yml:typecheck (tsconfig.test.json) | ✅ Present |
| no-console error (W6.4) | eslint.config.mjs rule `'no-console': ['error', { allow: ['error', 'warn'] }]` (renderer only; off for main/preload/scripts) | ✅ Present |
| Audit gate (W6.5) | `node scripts/audit-gate.mjs` (wraps `npm audit --json --audit-level=high` with a justified allow-list, fail-loud on any neutering vector) — last step of test.yml:test + its own build.yml:audit job | ✅ Present |
| Packaging gated on quality (W6.1) | build.yml:build needs: [lint, typecheck, test, smoke, audit] | ✅ Present |
| npm ci (W6.2) | All workflow jobs use `npm ci` with `cache: 'npm'` | ✅ Present |
| CodeQL security analysis (W6.5) | codeql.yml with `security-extended` queries | ✅ Present |

## continue-on-error checks

**One `continue-on-error: true` found** in `.github/workflows/test.yml` (the Codacy upload step of the `test` job):

```yaml
- name: Upload coverage to Codacy
  uses: codacy/codacy-coverage-reporter-action@v1
  continue-on-error: true
```

**Assessment: LEGITIMATE.** This step uploads coverage to Codacy, a third-party SaaS service. Failure of the Codacy upload step (e.g., due to network issues or temporary Codacy unavailability) should not block CI.

**Correction (M-WINDOWS-54):** the original text named Codecov the "authoritative gate" via `fail_ci_if_error: true` — that is no longer (and per the workflow's own comment, can currently not be) the case: the repo's CODECOV_TOKEN does not authorize uploads here, so the step runs `fail_ci_if_error: false` as best-effort. The authoritative coverage gate is the **vitest threshold** (`thresholds: { lines: 54 }` in `vitest.config.mts`), which fails the job locally in CI.

## Coverage Floor

**Coverage enforced at `lines: 54`** (verified still true 2026-10-31). The `vitest.config.mts` coverage `thresholds` block specifies:

```javascript
thresholds: {
  lines: 54
}
```

### History

| Phase | Config state | Coverage |
|-------|-------------|----------|
| **Before W0.7** | `src/main/**` and `src/preload/**` were **excluded** from coverage; no threshold set | Renderer-only (~58%) |
| **After W0.7** | Removed `src/main/**` and `src/preload/**` from `exclude`; added `thresholds: { lines: 54 }` | ~69% |
| **After W2.5** (deletions: offline/syncplay UI) | Config unchanged | 69.41% → 69.33% (negligible impact) |

**Config at audit time** (the `coverage` block of `vitest.config.mts`; exclude-list unchanged today):
```javascript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  exclude: [
    'node_modules/',
    'tests/',
    'dist/',
    '**/*.d.ts',
    '**/*.config.{ts,mts,js,mjs,cjs}'
    // src/main/** and src/preload/** are INCLUDED (no longer excluded)
  ],
  thresholds: {
    lines: 54
  }
}
```

CI fails if overall line coverage drops below 54%. The vitest threshold is the authoritative gate; Codecov upload is best-effort (`fail_ci_if_error: false` — token cannot authorize protected-branch uploads yet); Codacy upload is `continue-on-error: true`.

## Recent CI Snapshot (`gh run list`, fetched 2026-10-30T19:16Z)

Real runs — this section replaces the fabricated illustrative table the
August audit carried (M-WINDOWS-26: a baseline document must not hold
invented data, even labelled-as-illustrative). One row per workflow run;
the SHA column is the pushed commit each run tested.

| Run ID | Workflow | SHA | Conclusion |
|--------|----------|-----|------------|
| 41113883883 | Test | b34178d | in progress at fetch |
| 41113883703 | Build | b34178d | in progress at fetch |
| 41113883332 | CodeQL | b34178d | success |
| 41112207579 | Build | 3ab97f3 | cancelled |
| 41112207362 | Test | 3ab97f3 | success |
| 41111546320 | Build | 9761d7d | cancelled |
| 41111546261 | Test | 9761d7d | cancelled |
| 41110722229 | Test | 0b71e31 | cancelled |
| 41110722159 | CodeQL | 0b71e31 | success |
| 41110722155 | Build | 0b71e31 | cancelled |
| 41107760055 | CodeQL | 908227b | success |
| 41107759567 | Build | 908227b | cancelled |
| 41107759547 | Test | 908227b | success |
| 41104827965 | CodeQL | f5b301a | success |

**Patterns observed (honest reading):**
- Test, Build and CodeQL all fire per push to master (path filters as
  inventoried above).
- The workflows set `concurrency.cancel-in-progress`, so a rapid push chain
  — like the minors-batch cadence of 2026-10-30 — CANCELS superseded
  in-flight runs. The cancelled rows are that cadence, not failures; each
  batch tip was attested on its own completing run before the next push.
- The "20 consecutive green" shape the audit needed its invented table for
  is unverifiable from here on; per-run conclusions live on the Actions tab.


## Workflow Structure Summary

### test.yml — Runs on every push/PR to main/master/develop
- **lint** (ubuntu-26.04): `npm ci` → `npm run lint`
- **types** (ubuntu-26.04): `npm ci` → `vue-tsc --noEmit` → `tsc -p tsconfig.main.json --noEmit` → `vue-tsc --noEmit -p tsconfig.test.json`
- **test** (ubuntu-26.04 + windows-latest matrix): `npm ci` → `npm run build` → `npm test` → `npm test -- --coverage` + Codecov/Codacy upload → `node scripts/audit-gate.mjs` (audit runs LAST — a red earlier step can never skip the audit signal, and the audit's own raw exit code still hard-gates the job)
- **smoke** (ubuntu-26.04 + windows-latest matrix): `npm ci` → Playwright install → `npm run build` → `npm run smoke` (with xvfb-run on Linux)

### build.yml — Runs on push to master with tags, PRs to master (src/** changes)
- **lint** (ubuntu-26.04): `npm ci` → `npm run lint`
- **typecheck** (ubuntu-26.04): `npm ci` → `vue-tsc --noEmit` → `tsc -p tsconfig.main.json --noEmit` → `vue-tsc --noEmit -p tsconfig.test.json`
- **test** (ubuntu-26.04): `npm ci` → `npm run build` → `npm test`
- **smoke** (ubuntu-26.04 + windows-latest matrix): `npm ci` → Playwright install → `npm run build` → `npm run smoke`
- **build** (windows-latest, needs: [lint, typecheck, test, smoke, audit]): `npm ci` → `npm run build:vite` → `npm run build:electron` → electron-builder (NSIS + APPX)
- **release-latest** / **release** (on tag push or master push)

### codeql.yml — Runs on every push/PR to main/master (src/** changes)
- **analyze** (ubuntu-26.04): `npm ci` → `npm run build:vite` + `npm run build:electron` → CodeQL `security-extended` analysis

## Notes

- **No W5.x perf gates in CI.** Performance optimizations (W5.1-5.6) are implemented in code but not enforced via explicit CI thresholds. This is acceptable as performance was improved and there is no regression tracking infrastructure in place.
- **Lockfile integrity** is enforced via `npm ci` (always uses package-lock.json; `npm install` is not used in CI).
- **Matrix strategy** for smoke/test runs on both ubuntu-26.04 and windows-latest for cross-platform coverage.
- **Fail-fast** is enabled on all workflows via `cancel-in-progress: true` on concurrency groups.

## Mutation Proof

Each CI gate is structured so that bypassing it in isolation does not allow the build to proceed silently. This section documents, for each gate, what "breaking" the gate looks like and why the CI dependency graph prevents silent failures.

| Gate | How to break it (mutations) | Why CI still catches it |
|------|----------------------------|------------------------|
| **test** (vitest + coverage) | Add `describe.skip`, `it.skip`, or `test.skip` to all test files; or delete tests entirely | `npx vitest run --coverage` still runs — skipped tests count as 0 pass. Coverage threshold `lines: 54` fails if sufficient test code is removed. The `test` job is a `needs:` dependency of `build` (`build.yml:build`'s `needs:` list), so missing/skipped tests block packaging. |
| **lint** (ESLint) | Add `/* eslint-disable */` comments to suppress all errors; or delete/rename the ESLint config | ESLint runs as `npm run lint` (`eslint .`) — errors always redden the exit code, and the ruleset itself pins the critical patterns to `error` severity in `eslint.config.mjs` (e.g. renderer `no-console`), which inline disables cannot survive a review of the config. The `lint` job is a `needs:` dependency of `build`, so suppressed lint does not unblock packaging. |
| **typecheck** (vue-tsc + tsc) | Cast all types to `any`; add `// @ts-ignore` everywhere; or disable `strict` mode | `vue-tsc --noEmit` and `tsc -p tsconfig.main.json --noEmit` return non-zero exit code on type errors regardless of file contents. The `typecheck`/`types` job is a `needs:` dependency of `build`, so type suppressions block packaging. |
| **smoke** (Playwright) | Make smoke tests always pass (empty `test()` block, `test.skip`, or remove all assertions); delete smoke tests | The `smoke` job still executes — an empty/skipped test is not a test success signal, it is a no-op that does not produce a passing result. The `smoke` job is a `needs:` dependency of `build` (`build.yml:build`'s `needs:` list), so removing smoke from the `needs:` list or making it always-pass requires modifying the YAML, which would be caught in code review. |

### Packaging gate is the final backstop

`build.yml:build` declares `needs: [lint, typecheck, test, smoke, audit]` (audit joined the list with the 2026-08 gate work). Removing any of these dependencies from the list requires a commit to `.github/workflows/build.yml`, which triggers the standard PR review process. There is no configuration flag or environment variable that can disable this gating — it is structural.

### Audit gate shape (corrected per M-WINDOWS-54)

The audit is no longer a bare `npm audit --audit-level=high` mid-step of the `test` job. It runs as `node scripts/audit-gate.mjs` — the LAST step of test.yml's `test` job (so a red earlier step can never skip the audit signal) plus its own `audit` job in build.yml, wired into `build`'s `needs:`. The script wraps `npm audit --json --audit-level=high` with an explicit, justified allow-list and fails loudly on any neutering vector (unparseable audit output, failed spawn, an audit reporting zero advisories, `|| true`, `continue-on-error`). Raw exit code, no suppression. `npm ci` (used in all jobs) respects `package-lock.json`, so the audited dependencies are the exact ones installed.
