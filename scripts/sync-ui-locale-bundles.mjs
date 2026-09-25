#!/usr/bin/env node
/**
 * sync-ui-locale-bundles.mjs — re-vendor the @phlix/ui locale bundles.
 *
 * Estate decision: phlix-ui is the SSOT for ui-catalog translations; clients
 * consume them via SHA-PINNED vendored copies (config-time messages seam,
 * wired at src/renderer/main.ts). This copies
 *   ../phlix-ui  <SOURCE_REF>:src/i18n/locales/{es,fr,de,it,pt_BR,ja,index}.ts
 * into src/renderer/i18n/ui-locale-bundles/ applying ONLY the deterministic
 * transforms below, then writes src/renderer/i18n/ui-locale-bundles/PIN (JSON):
 * pinned branch/ref + per-file sha256 of BOTH the pristine source blob and the
 * vendored output, so tests/unit/i18nLocales.test.ts can verify the copy
 * whenever the sibling repo is reachable (hard-fail locally, explicit skip
 * in CI — windows CI clones ONLY this repo, see .github/workflows and that
 * suite's header).
 *
 * ADVANCING THE PIN: when the ui branch merges/re-tags and the estate re-pin
 * cascade names a new windows SHA, update SOURCE_BRANCH/SOURCE_REF here (two
 * lines), re-run `node scripts/sync-ui-locale-bundles.mjs`, then re-run
 * `npm test` — the bundles suite pins the vendored key set against the
 * INSTALLED catalog (exact set equality since the v0.99.5 re-pin), so a
 * bundle whose key set diverges from the installed pin goes red until
 * tests/unit/i18nLocales.test.ts is consciously revised. SOURCE_REF must be
 * the 40-hex commit the tag peels to (not the tag name): the suite cross-guard
 * requires the hex form, and `git show` against a sibling clone resolves it
 * identically while staying immune to tag re-pointing.
 *
 * TRANSFORMS — the complete list; any other diff is drift:
 *  1. `../messages` has no client-side counterpart: the line
 *     `import type { PhlixMessages } from '../messages';` is DROPPED in every
 *     file (the symbol is unused after transforms 2 and 3).
 *  2. Locale bundles (6 files): `} satisfies PhlixMessages;` becomes
 *     `} satisfies Record<string, Record<string, string>>;`. Historical
 *     reason: at the dc1df7d5 vendor the bundles carried 7 keys AHEAD of the
 *     then-installed v0.99.4 catalog (connect.scan, connect.scanning,
 *     connect.scanFailed, connect.scanEmpty, connect.scanListLabel,
 *     player.seekBackward, player.seekForward), and `PhlixMessages = typeof
 *     DEFAULT_MESSAGES` of the INSTALLED package is literal-keyed, so
 *     satisfies-ing against it would have failed on exactly those keys. The
 *     v0.99.5 re-pin closed that gap (set equality holds — pinned by the
 *     suite), but the relaxation STAYS: it decouples the vendor's compile
 *     surface from whichever catalog literal the npm pin happens to carry, so
 *     future pin moves never require re-deriving the type seam. Value-shape
 *     stays compile-checked; the key-set law lives in the runtime suite
 *     (6-way identity + installed ⊆ bundle + exact bundle-vs-installed set).
 *  3. index.ts registry: `Record<PhlixLocaleCode, PhlixMessages>` becomes
 *     `Record<PhlixLocaleCode, Record<string, Record<string, string>>>` for
 *     the same reason (its values are the relaxed bundles).
 *
 * Usage: node scripts/sync-ui-locale-bundles.mjs [--repo ../phlix-ui] [--ref <sha>]
 * Requires the sibling checkout to contain the pinned ref (git cat-file -e).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Pin the vendor came from — the re-pin cascade updates these two lines only. */
const SOURCE_BRANCH = 'master';
const SOURCE_REF = 'bc1d29bf98cb0e847aca05e44733d41ef2381b10'; // v0.99.7 peel (annotated tag da9f1625 -> commit)
const SOURCE_DIR = 'src/i18n/locales';
const TARGET_DIR = 'src/renderer/i18n/ui-locale-bundles';
const FILES = ['es.ts', 'fr.ts', 'de.ts', 'it.ts', 'pt_BR.ts', 'ja.ts', 'index.ts'];

/** The exact import path this vendor replaces in the source (transform 1). */
const SOURCE_IMPORT_LINE = "import type { PhlixMessages } from '../messages';\n";

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Deterministic source→vendored rewrite (transforms 1–3, docblock has the why). */
function vendored(file, source) {
  let out = source.split(SOURCE_IMPORT_LINE).join('');
  if (out.includes(SOURCE_IMPORT_LINE.trim())) {
    throw new Error(`${file}: unexpected variant of the '../messages' import — update the script`);
  }
  if (file === 'index.ts') {
    out = out
      .split('Record<PhlixLocaleCode, PhlixMessages>')
      .join('Record<PhlixLocaleCode, Record<string, Record<string, string>>>');
  } else {
    out = out
      .split('satisfies PhlixMessages;')
      .join('satisfies Record<string, Record<string, string>>;');
  }
  if (out.includes('PhlixMessages;') || out.includes('PhlixMessages\n')) {
    throw new Error(`${file}: a PhlixMessages reference survived the transforms — update the script`);
  }
  return out;
}

function execFileSyncText(gitRepo, gitRef, file) {
  try {
    return execFileSync('git', ['-C', gitRepo, 'show', `${gitRef}:${SOURCE_DIR}/${file}`], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    process.stderr.write(
      `FAIL: git -C ${gitRepo} show ${gitRef}:${SOURCE_DIR}/${file}\n` +
        `Is the sibling checkout present and does it contain ${gitRef}? ` +
        `(git -C ${gitRepo} cat-file -e ${gitRef})\n`,
    );
    throw error;
  }
}

const repo = arg('--repo', '../phlix-ui');
const ref = arg('--ref', SOURCE_REF);

for (const file of FILES) {
  const source = execFileSyncText(repo, ref, file);
  const out = vendored(file, source);
  mkdirSync(TARGET_DIR, { recursive: true });
  writeFileSync(join(TARGET_DIR, file), out);
  process.stdout.write(`vendored ${file} (${out.length} bytes)\n`);
}

const pin = {
  source: 'phlix-ui',
  branch: SOURCE_BRANCH,
  ref,
  directory: SOURCE_DIR,
  transforms: [
    "drop `import type { PhlixMessages } from '../messages';`",
    "bundles: `satisfies PhlixMessages` -> `satisfies Record<string, Record<string, string>>`",
    "index: `Record<PhlixLocaleCode, PhlixMessages>` -> `Record<PhlixLocaleCode, Record<string, Record<string, string>>>`",
  ],
  files: Object.fromEntries(
    FILES.map((file) => {
      const source = execFileSyncText(repo, ref, file);
      const out = readFileSync(join(TARGET_DIR, file), 'utf8');
      return [
        file,
        { source_sha256: sha256(source), vendored_sha256: sha256(out) },
      ];
    }),
  ),
};

writeFileSync(join(TARGET_DIR, 'PIN'), `${JSON.stringify(pin, null, 2)}\n`);
process.stdout.write(`PIN written: ${TARGET_DIR}/PIN (${FILES.length} files @ ${ref.slice(0, 8)})\n`);
