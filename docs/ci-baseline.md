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

**Coverage configured but no explicit threshold floor.** The vitest.config.mts coverage block specifies:

```javascript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  exclude: ['node_modules/', 'tests/', 'dist/', '**/*.d.ts', '**/*.config.{ts,mts,js,mjs,cjs}', 'src/main/**', 'src/preload/**']
}
```

No `threshold` or `100` enforcement is set. This means the coverage reporter generates coverage data (uploaded to Codecov and Codacy) but CI does **not** fail for low coverage.

**Not a concern:** Coverage is informational. The codebase excludes `src/main/**` and `src/preload/**` (Electron main/preload glue code that is not unit-testable in jsdom). Renderer coverage is generated and uploaded. No threshold was lowered — there was never a threshold to begin with.

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
