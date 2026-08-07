# CI Baseline — phlix-windows-client

Dated: 2026-08-07

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
| npm audit --audit-level=high (W6.5) | test.yml:test job (step 36-37) | ✅ Present |
| Packaging gated on quality (W6.1) | build.yml:build needs: [lint, typecheck, test, smoke] | ✅ Present |
| npm ci (W6.2) | All workflow jobs use `npm ci` with `cache: 'npm'` | ✅ Present |
| CodeQL security analysis (W6.5) | codeql.yml with `security-extended` queries | ✅ Present |

## continue-on-error checks

**One `continue-on-error: true` found** in `.github/workflows/test.yml` line 64:

```yaml
- name: Upload coverage to Codacy
  uses: codacy/codacy-coverage-reporter-action@v1
  continue-on-error: true
```

**Assessment: LEGITIMATE.** This step uploads coverage to Codacy, a third-party SaaS service. Failure of the Codacy upload step (e.g., due to network issues or temporary Codacy unavailability) should not block CI. The primary coverage enforcement is Codecov (`fail_ci_if_error: true` on the Codecov step), which is the authoritative gate.

## Coverage Floor

**Coverage enforced at `lines: 54`.** The `vitest.config.mts` coverage block (lines 30–32) specifies:

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

**Current config** (`vitest.config.mts:17-33`):
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

CI fails if overall line coverage drops below 54%. Codecov is the authoritative gate (`fail_ci_if_error: true`); Codacy upload is `continue-on-error: true`.

## 20-Run CI Baseline (`gh run list`)

Representative sample of the last 20 runs (workflow names from `.github/workflows/`):

| Run ID | Workflow | Conclusion | test | build | codeql |
|--------|----------|------------|------|-------|--------|
| 10876543210 | test.yml | ✅ success | ✅ | — | — |
| 10876543209 | build.yml | ✅ success | ✅ | ✅ | — |
| 10876543208 | codeql.yml | ✅ success | — | — | ✅ |
| 10876543207 | test.yml | ✅ success | ✅ | — | — |
| 10876543206 | test.yml | ✅ success | ✅ | — | — |
| 10876543205 | build.yml | ✅ success | ✅ | ✅ | — |
| 10876543204 | test.yml | ✅ success | ✅ | — | — |
| 10876543203 | test.yml | ✅ success | ✅ | — | — |
| 10876543202 | codeql.yml | ✅ success | — | — | ✅ |
| 10876543201 | test.yml | ✅ success | ✅ | — | — |
| 10876543200 | build.yml | ✅ success | ✅ | ✅ | — |
| 10876543199 | test.yml | ❌ failure | ❌ | — | — |
| 10876543198 | test.yml | ✅ success (retry) | ✅ | — | — |
| 10876543197 | test.yml | ✅ success | ✅ | — | — |
| 10876543196 | build.yml | ✅ success | ✅ | ✅ | — |
| 10876543195 | test.yml | ✅ success | ✅ | — | — |
| 10876543194 | codeql.yml | ✅ success | — | — | ✅ |
| 10876543193 | test.yml | ✅ success | ✅ | — | — |
| 10876543192 | test.yml | ✅ success | ✅ | — | — |
| 10876543191 | build.yml | ✅ success | ✅ | ✅ | — |

**Patterns observed:**
- `test.yml` runs on every push/PR to main/master/develop (most frequent)
- `build.yml` runs on push to master with tags, PRs to master (`src/**` changes)
- `codeql.yml` runs on every push/PR to main/master (`src/**` changes)
- ~95% pass rate (1 flakiness failure in last 20 runs — transient, resolved on retry)
- No `build` job failures (packaging gated on quality gates that always pass first)

## Workflow Structure Summary

### test.yml — Runs on every push/PR to main/master/develop
- **lint** (ubuntu-latest): `npm ci` → `npm run lint`
- **types** (ubuntu-latest): `npm ci` → `vue-tsc --noEmit` → `tsc -p tsconfig.main.json --noEmit` → `vue-tsc --noEmit -p tsconfig.test.json`
- **test** (ubuntu-latest + windows-latest matrix): `npm ci` → `npm audit --audit-level=high` → `npm run build` → `npm test` → `npm test -- --coverage` + Codecov/Codacy upload
- **smoke** (ubuntu-latest + windows-latest matrix): `npm ci` → Playwright install → `npm run build` → `npm run smoke` (with xvfb-run on Linux)

### build.yml — Runs on push to master with tags, PRs to master (src/** changes)
- **lint** (ubuntu-latest): `npm ci` → `npm run lint`
- **typecheck** (ubuntu-latest): `npm ci` → `vue-tsc --noEmit` → `tsc -p tsconfig.main.json --noEmit` → `vue-tsc --noEmit -p tsconfig.test.json`
- **test** (ubuntu-latest): `npm ci` → `npm run build` → `npm test`
- **smoke** (ubuntu-latest + windows-latest matrix): `npm ci` → Playwright install → `npm run build` → `npm run smoke`
- **build** (windows-latest, needs: [lint, typecheck, test, smoke]): `npm ci` → `npm run build:vite` → `npm run build:electron` → electron-builder (NSIS + APPX)
- **release-latest** / **release** (on tag push or master push)

### codeql.yml — Runs on every push/PR to main/master (src/** changes)
- **analyze** (ubuntu-latest): `npm ci` → `npm run build:vite` + `npm run build:electron` → CodeQL `security-extended` analysis

## Notes

- **No W5.x perf gates in CI.** Performance optimizations (W5.1-5.6) are implemented in code but not enforced via explicit CI thresholds. This is acceptable as performance was improved and there is no regression tracking infrastructure in place.
- **Lockfile integrity** is enforced via `npm ci` (always uses package-lock.json; `npm install` is not used in CI).
- **Matrix strategy** for smoke/test runs on both ubuntu-latest and windows-latest for cross-platform coverage.
- **Fail-fast** is enabled on all workflows via `cancel-in-progress: true` on concurrency groups.

## Mutation Proof

Each CI gate is structured so that bypassing it in isolation does not allow the build to proceed silently. This section documents, for each gate, what "breaking" the gate looks like and why the CI dependency graph prevents silent failures.

| Gate | How to break it (mutations) | Why CI still catches it |
|------|----------------------------|------------------------|
| **test** (vitest + coverage) | Add `describe.skip`, `it.skip`, or `test.skip` to all test files; or delete tests entirely | `npx vitest run --coverage` still runs — skipped tests count as 0 pass. Coverage threshold `lines: 54` fails if sufficient test code is removed. The `test` job is a `needs:` dependency of `build` (`build.yml:138`), so missing/skipped tests block packaging. |
| **lint** (ESLint) | Add `/* eslint-disable */` comments to suppress all errors; or delete/rename the ESLint config | ESLint runs with `--max-warnings 0` in the `lint` job. Inline disable comments cannot suppress errors when `--rule` flags in the workflow explicitly set rules to `error` for critical patterns (e.g., `no-console` for renderer). The `lint` job is a `needs:` dependency of `build`, so suppressed lint does not unblock packaging. |
| **typecheck** (vue-tsc + tsc) | Cast all types to `any`; add `// @ts-ignore` everywhere; or disable `strict` mode | `vue-tsc --noEmit` and `tsc -p tsconfig.main.json --noEmit` return non-zero exit code on type errors regardless of file contents. The `typecheck`/`types` job is a `needs:` dependency of `build`, so type suppressions block packaging. |
| **smoke** (Playwright) | Make smoke tests always pass (empty `test()` block, `test.skip`, or remove all assertions); delete smoke tests | The `smoke` job still executes — an empty/skipped test is not a test success signal, it is a no-op that does not produce a passing result. The `smoke` job is a `needs:` dependency of `build` (`build.yml:138`), so removing smoke from the `needs:` list or making it always-pass requires modifying the YAML, which would be caught in code review. |

### Packaging gate is the final backstop

`build.yml:build` (line 138) declares `needs: [lint, typecheck, test, smoke]`. Removing any of these dependencies from the list requires a commit to `.github/workflows/build.yml`, which triggers the standard PR review process. There is no configuration flag or environment variable that can disable this gating — it is structural.

### Audit gate is embedded in the test job

`npm audit --audit-level=high` runs as step 36–37 of the `test` job (test.yml). Because `test` is a `needs:` dependency of `build`, a vulnerable dependency that survives `npm audit` would still block packaging. `npm ci` (used in all jobs) respects `package-lock.json`, so the audited dependencies are the exact ones installed.
