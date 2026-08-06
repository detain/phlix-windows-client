/**
 * @vitest-environment node
 *
 * Overrides vitest.config.mts's global `environment: 'jsdom'` for THIS FILE
 * ONLY. The module under test is plain Node ESM that touches no DOM, so a jsdom
 * instance is pure overhead here. The global default is deliberately left as
 * jsdom — every other test under tests/ mounts components and needs it.
 */

// Tests for the copyright-header injection helpers in scripts/lib/copyright.mjs.
//
// Root cause of the defect these guard (fixed in the accompanying change):
// injectCssComment() used to scan for the LAST line containing `*/` in the WHOLE
// file — a loop with no `break`, keeping the highest matching index — instead of
// the terminator of the file's OWN opening comment block. Any CSS file with
// later `/* ... */` annotation comments therefore got the `* @copyright` line
// dropped on whatever comment happened to close last, as a naked,
// delimiter-less line in the middle of the stylesheet.
//
// That was live-reachable in THIS repo. Measured against the real
// src/renderer/components/rating-styles.css with its existing @copyright line
// stripped (i.e. exactly what a newly added CSS file looks like): the pre-fix
// script put the line at 126, immediately before `/* ChapterList styles */`, and
// postcss 8.5.16 then parsed the following rule's selector as
// `* @copyright 2026 Joe Huss <detain@interserver.net>\n\n.chapter-list` —
// a selector that matches nothing, i.e. the `.chapter-list` rule silently
// vanished (27 rules in, 27 rules out, one of them unusable). The same defect
// shipped in phlix-tokens commit 9ec4298, destroyed 4 design tokens plus an
// entire `.eyebrow` rule, and reached the published npm tarball.
//
// The existing rating-styles.css is NOT protected by its comment layout — it
// has terminators at lines 7, 55 and 127, so first-`*/` and last-`*/` do not
// coincide. It is protected only by the whole-content marker pre-check, because
// it already carries the header. Any NEW .css file under src/ would have been
// corrupted.
//
// NOT every case below discriminates against the pre-fix code, and they are
// labelled so the distinction survives. Each label is derived from ONE MEASURED
// signature — the result of running THIS test body, unmodified, against the
// pre-fix implementation extracted from git (scripts/add-copyright.mjs at the
// commit before this change, truncated at its `// ---- Main ----` marker so it
// has no side effects, plus the MARKER const the old file inlined as a
// literal). Every label is mechanically checkable against that run, not a
// matter of judgement:
//
//   REGRESSION (pre-fix) — FAILS against the pre-fix implementation, PASSES
//                          now. These are the real regression guards.
//   GUARD (ported logic) — PASSES against the pre-fix implementation too. The
//                          pre-fix code got these right, or got them right by
//                          accident (its duplicate guard was widened as a
//                          side effect of scanning to the LAST `*/`, and its
//                          scan started at line 1 so it never mis-closed a
//                          degenerate `/*/` opener). Kept because the ported
//                          implementation could plausibly break them; do NOT
//                          mistake them for guards against the shipped bug.
//   CHARACTERIZATION     — PASSES against both. Documents intended behaviour
//                          without discriminating between implementations.
//
// This is a plain Node .mjs test (not .ts) because the module under test is
// plain Node ESM outside the TypeScript project: tsconfig.json's `include` is
// ["src/renderer"], which matches neither scripts/ nor tests/, so
// `npm run typecheck` never sees either. vitest.config.mts's `include` was
// extended with 'tests/**/*.test.mjs' so this file is picked up.
//
// This is a pure-function test: it imports from scripts/lib/copyright.mjs,
// which reads no files, writes no files and walks no directories, so importing
// it can never touch the tree. The walking CLI lives in
// scripts/add-copyright.mjs and is deliberately NOT imported here.

import { describe, it, expect } from 'vitest';
import {
  injectCssComment,
  prependCssComment,
  prependTsDocblock,
  COPYRIGHT,
  MARKER,
} from '../../scripts/lib/copyright.mjs';

const BOM = String.fromCharCode(0xfeff);

// Mirrors scripts/add-copyright.mjs::processCssFile — the whole-content
// marker pre-check plus the inject-or-prepend dispatch.
function process_(content) {
  if (content.includes(MARKER)) return null;
  return injectCssComment(content) ?? prependCssComment(content);
}

describe('injectCssComment (CSS copyright injection)', () => {
  // REGRESSION (pre-fix) — the exact shape of this repo's own
  // src/renderer/components/rating-styles.css: a `/** ... */` opening docblock
  // followed by section-banner comments further down.
  it('inserts inside the OPENING docblock, not a later section-banner comment', () => {
    const input = [
      '/**',
      ' * Phlix Media Server Client for Windows.',
      ' *',
      ' * Rating components styling - Electron/Windows dark theme (nocturne)',
      ' */',
      '',
      '.rating-badge {',
      '  display: inline-flex;',
      '}',
      '',
      '.rating-star-btn {',
      '  font-size: 1.5rem;',
      '}',
      '',
      '/* ChapterList styles */',
      '.chapter-list {',
      '  display: flex;',
      '}',
      '',
    ].join('\n');

    const result = process_(input);
    const lines = result.split('\n');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));

    // Landed inside the opening docblock, before its closing ` */`.
    expect(copyIdx).toBeGreaterThan(0);
    expect(copyIdx).toBeLessThan(lines.indexOf(' */'));

    // The pre-fix code put it immediately before the LAST comment in the file.
    // It must never sit adjacent to a later banner comment.
    const lastBannerIdx = lines.findIndex((l) => l.includes('ChapterList styles'));
    expect(lines[lastBannerIdx - 1]).not.toContain('@copyright');

    // Nothing swallowed: every rule and banner survives verbatim.
    expect(result).toContain('/* ChapterList styles */');
    expect(lines).toContain('.chapter-list {');
    expect(lines).toContain('.rating-badge {');
  });

  // REGRESSION (pre-fix) — the corruption signature itself: a `* @copyright`
  // line with no enclosing `/* */`. This is what makes a CSS parser glue the
  // stray text onto the next selector and silently drop that rule.
  it('never emits a naked @copyright line outside a comment', () => {
    const input = [
      '/* base.css - tokens',
      '   colors, spacing, radii */',
      ':root {',
      '  --radius-sm: 6px;     /* badges, ticks, kbd */',
      '  --radius-md: 10px;    /* buttons, inputs, chips */',
      '  --radius-full: 9999px;',
      '}',
      '',
      '/* vendor-fonts:end */',
      '',
    ].join('\n');

    const result = process_(input);

    // Removing every well-formed block comment must remove every @copyright.
    // CSS comments do not nest, so a non-greedy strip is exact.
    const stripped = result.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toContain('@copyright');

    // Each declaration (with its inline trailing comment) survives intact.
    const lines = result.split('\n');
    expect(lines).toContain('  --radius-sm: 6px;     /* badges, ticks, kbd */');
    expect(lines).toContain('  --radius-md: 10px;    /* buttons, inputs, chips */');
    expect(lines).toContain('  --radius-full: 9999px;');

    // And it landed before the first rule, i.e. inside the opening comment.
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));
    expect(copyIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(lines.indexOf(':root {'));
  });

  // REGRESSION (pre-fix) — a single-line opening comment. The pre-fix loop
  // started at line 1, so it skipped the opener's own terminator and latched
  // onto a later comment instead, injecting mid-file.
  it('expands a single-line `/* */` opening comment instead of injecting mid-file', () => {
    const input = [
      '/* rating-styles.css */',
      '.rating-badge {',
      '  display: inline-flex;',
      '}',
      '',
      '/* a later annotation comment */',
      '.foo {',
      '  color: red;',
      '}',
      '',
    ].join('\n');

    const result = process_(input);
    const lines = result.split('\n');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));

    expect(copyIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(lines.indexOf('.rating-badge {'));

    // Still well-formed: no @copyright outside a comment.
    expect(result.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('@copyright');

    // The later annotation and both rules are untouched.
    expect(result).toContain('/* a later annotation comment */');
    expect(result).toContain('  display: inline-flex;');
    expect(result).toContain('  color: red;');
  });

  // REGRESSION (pre-fix) — an injected line must adopt the file's own EOL. The
  // pre-fix implementation had no EOL-preservation logic at all, so it spliced
  // a bare-LF line into an otherwise CRLF file.
  it('preserves CRLF line endings on the lines it injects', () => {
    const hasOnlyCrlf = (s) => !/(^|[^\r])\n/.test(s);

    // Multi-line opening comment → the "insert before the closer" branch.
    const multi = ['/**', ' * hdr', ' *', ' */', '', '.a { color: red; }', ''].join('\r\n');
    const multiOut = process_(multi);
    expect(multiOut).toContain('@copyright');
    expect(hasOnlyCrlf(multiOut)).toBe(true);
    expect(multiOut).toContain(COPYRIGHT + '\r\n');

    // Single-line opening comment → the "expand into a block" branch.
    const single = ['/* hdr */', '.a { color: red; }', ''].join('\r\n');
    const singleOut = process_(single);
    expect(singleOut).toContain('@copyright');
    expect(hasOnlyCrlf(singleOut)).toBe(true);

    // No opening comment at all → the prepend branch.
    const bare = ['.a { color: red; }', ''].join('\r\n');
    const bareOut = process_(bare);
    expect(bareOut).toContain('@copyright');
    expect(hasOnlyCrlf(bareOut)).toBe(true);

    // LF files stay pure LF — the CR is adopted from the input, never added.
    const lf = ['/**', ' * hdr', ' *', ' */', '', '.a { color: red; }', ''].join('\n');
    expect(process_(lf)).not.toContain('\r');
  });

  // REGRESSION (pre-fix) — a leading UTF-8 BOM must stay at byte 0. The
  // pre-fix prependCssComment() emitted its fresh header IN FRONT of the BOM,
  // stranding U+FEFF mid-file right before the first selector, which a CSS
  // parser then reads as part of that selector — silent rule loss, the same
  // failure class as the naked-line bug.
  it('keeps a leading BOM at the very start of the file, not before the injected header', () => {
    const input = BOM + ['.a { color: red; }', ''].join('\n');

    const result = process_(input);

    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.indexOf(BOM, 1)).toBe(-1);
    expect(result.slice(1).startsWith('/*')).toBe(true);
    expect(result).toContain('.a { color: red; }');
  });

  // GUARD (ported logic) — a degenerate `/*/` first line SHARES its `*` between
  // the opener and the apparent closer (`'/*/'.indexOf('*/') === 1`). Treating
  // index 1 as the terminator would split the line into a bare `/` plus a stray
  // ` */`, destroying a source character. The ported scan starts at
  // `openAt + 2` to avoid that. The pre-fix code never hit this because its
  // scan began at line 1.
  it('does not corrupt a degenerate `/*/` first line — falls back to prepending', () => {
    const input = ['/*/', '.a { color: red; }', ''].join('\n');

    // There is no terminator for the opening comment, so injection declines.
    expect(injectCssComment(input)).toBeNull();

    const result = process_(input);
    const lines = result.split('\n');

    // The input survives verbatim after a freshly prepended header.
    expect(result.endsWith(input)).toBe(true);
    expect(result).toContain('/*/');

    // Well-formed prepended block, and no line reduced to a bare `/`.
    expect(lines[0]).toBe('/*');
    expect(lines.findIndex((l) => l.includes('@copyright'))).toBe(1);
    expect(lines[2]).toBe(' */');
    expect(lines).not.toContain('/');
  });

  // GUARD (ported logic) — the exported function's duplicate guard covers the
  // WHOLE content, not just the opening block, so a standalone caller cannot
  // inject a SECOND copyright into a file that already has one further down.
  it('refuses a file whose existing copyright sits outside the opening block', () => {
    const input = ['/*', ' * hdr', ' */', '.a { color: red; }', '/* ' + COPYRIGHT.trim() + ' */', ''].join('\n');

    // Called directly — process_()'s own whole-content pre-check would mask a
    // narrowed guard inside injectCssComment().
    expect(injectCssComment(input)).toBeNull();
    expect((input.match(/@copyright/g) || []).length).toBe(1);
  });

  // CHARACTERIZATION — no leading comment at all → prepend a fresh header.
  it('prepends a fresh header when the file has no leading comment at all', () => {
    const input = ['.rating-badge {', '  display: inline-flex;', '}', ''].join('\n');

    const result = process_(input);
    const lines = result.split('\n');

    expect(lines[0]).toBe('/*');
    expect(lines.some((l) => l.includes('@copyright'))).toBe(true);
    expect(result).toContain('.rating-badge {');
    expect(result).toContain('  display: inline-flex;');
  });

  // CHARACTERIZATION — idempotency, the property the CLI's "re-run produces
  // zero diff" promise rests on.
  it('is idempotent: a file that already has the copyright is left alone', () => {
    const input = ['/**', ' * already has it', ' *', COPYRIGHT, ' */', '', '.a { color: red; }', ''].join('\n');

    expect(process_(input)).toBeNull();
    expect(injectCssComment(input)).toBeNull();
  });
});

describe('prependTsDocblock (TS/JS copyright injection — BOM handling)', () => {
  // REGRESSION (pre-fix) — same root cause as the CSS BOM case:
  // prependTsDocblock() used to emit its fresh docblock IN FRONT of a leading
  // BOM. Kept lower-stakes than the CSS path (U+FEFF is ECMAScript WhiteSpace,
  // so a relocated BOM is benign to tsc/node) but it is the same bug in the
  // same function family.
  it('keeps a leading BOM at byte 0, with the docblock landing after it', () => {
    const input = BOM + 'export const x = 1;\n';

    const result = prependTsDocblock(input);

    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.indexOf(BOM, 1)).toBe(-1);
    expect(result.slice(1).startsWith('/**')).toBe(true);
    expect(result).toContain(COPYRIGHT);
    expect(result).toContain('export const x = 1;');
  });

  // REGRESSION (pre-fix) — the shebang path, which the BOM fix changes most:
  // pre-fix, `isShebang(BOM + '#!...')` was false (the BOM defeats
  // startsWith('#!')), so the docblock was spliced in FRONT of the shebang,
  // demoting it off byte 0 where alone it is honoured.
  it('keeps a shebang at line 0 when a leading BOM is present, docblock after both', () => {
    const input = BOM + '#!/usr/bin/env node\nexport const x = 1;\n';

    const result = prependTsDocblock(input);

    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.indexOf(BOM, 1)).toBe(-1);
    expect(result.slice(1).split('\n')[0]).toBe('#!/usr/bin/env node');

    const shebangIdx = result.indexOf('#!/usr/bin/env node');
    const docblockIdx = result.indexOf('/**');
    expect(docblockIdx).toBeGreaterThan(shebangIdx);
    expect(result).toContain(COPYRIGHT);
    expect(result).toContain('export const x = 1;');
  });
});
