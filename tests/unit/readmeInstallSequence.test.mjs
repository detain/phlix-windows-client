/**
 * @vitest-environment node
 *
 * M-WINDOWS-20 install-sequence guard — every `git clone` in README must be
 * followed, command for command, by the directory the clone ACTUALLY creates.
 *
 * WHY: the review (windows__writer M2) found the first install block broke
 * copy-paste readers:
 *
 *   git clone https://github.com/detain/phlix-windows-client.git
 *   cd phlix-windows            ← errors: the clone made phlix-windows-client/
 *
 * The cure (README sweep at 0fac869) fixed the text; this lane makes the fix a
 * LAW so the name triple (repo slug / clone dir / structure-tree root) can
 * never drift apart again. Every expectation here is RUNTIME-DERIVED: the repo
 * name comes from package.json's build.publish.repo (the same pointer
 * updateFeedWorkflow.test.mjs pins as the canonical publish identity — what CI
 * releases against), the clone dir is parsed from README's own clone
 * invocations, and the pairing is structural. Nothing hardcodes a directory
 * string, so a future rename that updates the URL and publish config cannot
 * leave this pin lying, and a rename that does not reddens it.
 *
 * | # | Pin                                             | reddens when                                  |
 * |---|-------------------------------------------------|-----------------------------------------------|
 * | 1 | each `git clone …` in README's NEXT command in  | the copy-paste sequence breaks again: wrong    |
 * |   | the same block is `cd <dir the clone yields>`,   | dir, missing cd, or a second clone mid-pair    |
 * |   | and README clones the repo build.publish.repo    | (the self-clone vanishing or pointing away)    |
 * |   | names at all                                     |                                               |
 * | 2 | the Project Structure tree's root line is that   | the tree root renames without the clone dir    |
 * |   | same derived directory (`<dir>/`)                | (the review's third triple member)             |
 * | 3 | no markdown law file carries a `cd phlix-windows | the copy-paste-breaker (or a variant) revives  |
 * |   | …`-shaped command whose argument differs from    | in any doc; CHANGELOG.md is exempt as the      |
 * |   | any clone dir README yields                      | verbatim historical record of the defect       |
 *
 * Red-on-parent, measured: all three pins fail against README.md at
 * 0fac869^ (the `cd phlix-windows` era) and pass at the cure and at HEAD.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const README = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const PKG = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

/** A fenced block: { info, lines, startLine (1-based README line of the fence).
 *  Fences may be indented up to 3 spaces (Markdown allows 0-3) — README's
 *  install fences sit inside a numbered list at 3 spaces. */
function fencedBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const fence = /^ {0,3}```(.*)$/.exec(lines[i]);
    if (fence && open === null) {
      open = { info: fence[1].trim(), lines: [], startLine: i + 1 };
      continue;
    }
    if (fence && open !== null && fence[1].trim() === '') {
      blocks.push(open);
      open = null;
    } else if (open !== null) {
      open.lines.push(lines[i]);
    }
  }
  if (open) {
    throw new Error('README has an unterminated ``` fence — parse stops at EOF otherwise; fix the markup.');
  }
  return blocks;
}

/** The directory a `git clone` invocation yields: the explicit dir arg when
 *  present, else the URL's last path/segment (scp form included) minus `.git`. */
function cloneCommand(line) {
  const m = /^\s*git\s+clone\s+(.+)$/.exec(line);
  if (!m) return null;
  const positional = m[1].trim().split(/\s+/).filter((t) => t !== '' && !t.startsWith('-'));
  if (positional.length === 0) return { repoUrl: '', dir: '', bare: true };
  const [repoUrl, explicitDir] = positional;
  const base = repoUrl.replace(/\/+$/, '').split(/[/:]/).pop();
  return { repoUrl, dir: explicitDir ?? base.replace(/\.git$/, ''), bare: false };
}

/** One entry per README clone: its line, the dir it yields, and the first
 *  command line after it in the same block (nulls when absent). */
function cloneCdPairs(text) {
  const pairs = [];
  for (const block of fencedBlocks(text)) {
    let pending = null;
    block.lines.forEach((line, idx) => {
      const clone = cloneCommand(line);
      if (clone) {
        if (pending && pending.next === null) pending.next = { line: null, at: null };
        pending = { at: block.startLine + idx + 1, clone, next: null };
        pairs.push(pending);
        return;
      }
      if (pending === null || pending.next !== null) return;
      if (/^\s*(#|$)/.test(line)) return; // blanks and shell comments stay legal
      pending.next = { line, at: block.startLine + idx + 1 };
    });
  }
  return pairs;
}

/** Every dir README's own clones yield. */
function readmeCloneDirs(text) {
  return cloneCdPairs(text).map((p) => p.clone.dir);
}

describe('README install sequence enters the directory it clones (M-WINDOWS-20)', () => {
  it('every git clone is followed by the cd for exactly the directory the clone yields', () => {
    const pairs = cloneCdPairs(README);
    expect(
      pairs.length,
      'README no longer contains a single `git clone` command — the install-from-source ' +
      'sequence this law guards has been deleted; re-anchor the law with the new story.'
    ).toBeGreaterThanOrEqual(1);
    for (const pair of pairs) {
      if (pair.clone.bare) {
        expect.fail(`README.md:${pair.at} — a git clone with no repository argument; the ` +
          'pairing law cannot derive a directory from it. Fix the README block.');
      }
      if (pair.next === null || pair.next.line === null) {
        expect.fail(
          `README.md:${pair.at} — the clone is never followed by a cd in its block ` +
          `(${pair.next === null ? 'nothing follows it' : 'another git clone intervenes'}). It ` +
          `yields "${pair.clone.dir}/" and a reader pasting the block top-to-bottom must be ` +
          'taken into it next (the first command after cloning is missing — M2).'
        );
      }
      const cd = /^\s*cd\s+(\S+)\s*$/.exec(pair.next.line);
      if (!cd) {
        const second = cloneCommand(pair.next.line);
        expect.fail(
          `README.md:${pair.next.at} — the command after \`git clone\` is ` +
          `"${pair.next.line.trim()}"${second ? ' (another clone)' : ''}, not a \`cd\`. The clone ` +
          `yields "${pair.clone.dir}/"; the block no longer reads as a sequence a user can paste.`
        );
      }
      expect(
        cd[1],
        `README.md:${pair.next.at} — \`cd ${cd[1]}\` names a directory the clone does not ` +
        `create. Cloning ${pair.clone.repoUrl} yields "${pair.clone.dir}/"; \`cd ${cd[1]}\` ` +
        'errors for every reader pasting it (the exact M2 defect).'
      ).toBe(pair.clone.dir);
    }
  });

  it('README clones the repo the release pipeline publishes against', () => {
    const self = PKG.build?.publish?.repo;
    expect(
      typeof self === 'string' && self !== '',
      'package.json build.publish.repo is missing — the canonical repo slug this law derives ' +
      'from no longer exists; re-anchor the derivation (updateFeedWorkflow pins it too).'
    ).toBe(true);
    expect(
      readmeCloneDirs(README),
      `README never clones this repo (build.publish.repo = "${self}"). The self-install story ` +
      'disappeared or points elsewhere.'
    ).toContain(self);
  });

  it('the Project Structure tree root is the directory the clone yields', () => {
    const heading = README.indexOf('## Project Structure');
    expect(heading, 'README lost its "## Project Structure" heading — the tree is the third ' +
      'member of the name triple M2 found drifted; re-anchor this pin with it.').toBeGreaterThanOrEqual(0);
    const tree = fencedBlocks(README.slice(heading))[0];
    expect(tree, 'no fenced tree block under "## Project Structure"').toBeTruthy();
    const root = (tree.lines.find((l) => l.trim() !== '') ?? '').trim();
    expect(
      root,
      `the Project Structure root is "${root}" but cloning README's URL yields the directories ` +
      `${readmeCloneDirs(README).join(', ')} — the tree and the install block must name the ` +
      'same directory (M2 triple).'
    ).toBe(PKG.build.publish.repo + '/');
  });
});

describe('no doc revives a cd for a directory the clone does not create (M-WINDOWS-20)', () => {
  /** Root *.md files plus every .md under docs/, CHANGELOG.md excluded: it
   *  records the defect verbatim ("next line said cd phlix-windows") and
   *  history is never rewritten. */
  function markdownLawFiles() {
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.md') ? [full] : [];
    });
    const rootDocs = readdirSync(repoRoot)
      .filter((e) => e.endsWith('.md') && e !== 'CHANGELOG.md')
      .map((e) => path.join(repoRoot, e));
    return [...rootDocs, ...walk(path.join(repoRoot, 'docs'))];
  }
  const lawFiles = markdownLawFiles();
  const derivedDirs = readmeCloneDirs(README);

  it('the survivor set is non-vacuous', () => {
    // Guards the guard: if discovery ever breaks, the sweep below is vacuous green.
    expect(lawFiles.length).toBeGreaterThanOrEqual(3);
    expect(lawFiles.map((f) => path.basename(f))).toContain('README.md');
  });

  it('no markdown law file carries a cd phlix-windows…-shaped command with the wrong directory', () => {
    for (const file of lawFiles) {
      const text = readFileSync(file, 'utf8');
      const rel = path.relative(repoRoot, file);
      const offenders = [...text.matchAll(/(?:^|\s)cd\s+([^\s`'"]+)/g)]
        .map((m) => m[1])
        .filter((dir) => /^phlix-windows\b/.test(dir) && !derivedDirs.includes(dir));
      expect(
        offenders,
        offenders.length
          ? `${rel} tells readers to \`cd ${offenders[0]}\`, but no git clone in README yields ` +
            'that directory — the copy-paste-breaking name triple (repo slug / clone dir / ' +
            'tree root) has drifted again (review windows__writer M2).'
          : undefined
      ).toEqual([]);
    }
  });
});
