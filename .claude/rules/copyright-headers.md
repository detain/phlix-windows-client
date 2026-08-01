---
description: Copyright headers on source files — injected and verified by scripts/add-copyright.mjs
globs:
  - "src/**"
  - "scripts/**"
---

# Copyright headers

Every source file (`.ts`, `.tsx`, `.vue`, `.mjs`, `.css`) carries a docblock
ending in `@copyright 2026 Joe Huss <detain@interserver.net>`. The project is
MIT-licensed (`LICENSE`).

- Add the header to any new file — `/** ... */` for TS/TSX/MJS, `/* ... */` for CSS.
- Do not hand-fix headers across many files. Run the injector instead:

```bash
node scripts/add-copyright.mjs
```

  It is idempotent: a re-run on a fully-headered tree produces zero diff.
- All pure header manipulation lives in `scripts/lib/copyright.mjs`
  (`injectCssComment` / `prependCssComment` / `injectTsDocblock` /
  `prependTsDocblock` / `MARKER`) so it stays unit-testable from
  `tests/unit/copyright.test.mjs`. Put new logic there, not in the CLI half.
- `scripts/add-copyright.mjs` deliberately has NO
  `import.meta.url === pathToFileURL(process.argv[1]).href` main guard — it
  evaluates false through a symlink and turns the whole run into a silent,
  zero-output exit-0 no-op.
- `scripts/**` is exempt from `no-console` in `eslint.config.mjs` — build
  scripts log to the terminal.
- `tests/unit/copyright.test.mjs` is picked up by the `tests/**/*.test.mjs`
  include in `vitest.config.mts`; it is authored as `.mjs` on purpose because
  `scripts/` sits outside the TypeScript project.
