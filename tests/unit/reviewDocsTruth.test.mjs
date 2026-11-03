/**
 * @vitest-environment node
 *
 * Review batch 8 (m22/m23/m24/m25/m26/m27): user-docs truth pins. Each of
 * these findings was a doc contradicting code or another doc — the cures are
 * pinned so a future edit cannot silently re-open the contradiction.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf-8');
const README = read('README.md');
const winEn = read('src/renderer/i18n/windows-own/en.ts');
const mainEn = read('src/main/i18n/en.ts');
const uiSurface = read('docs/ui-surface.md');
const deepLinks = read('docs/deep-links.md');

describe('too-old-server copy agrees with the retry law (m24)', () => {
  it('neither boot catalog claims a restart any more', () => {
    expect(winEn).not.toMatch(/restart this app/i);
    expect(mainEn).not.toMatch(/restart this app/i);
    expect(winEn).toMatch(/incompatibleAction: .*Try again/i);
    expect(mainEn).toMatch(/tooOldDetail: .*no restart needed/);
  });

  it('the README states the same law the copy now tells', () => {
    expect(README).toMatch(/check re-runs in place/i);
    expect(README).toMatch(/no in-app way to\s+point it at a different server/i);
  });
});

describe('keyboard shortcuts are documented, honestly scoped (m22)', () => {
  it('the README carries a Keyboard shortcuts section', () => {
    expect(README).toMatch(/### Keyboard shortcuts/);
  });

  it('it names the two registered accelerators', () => {
    expect(README).toMatch(/`F11`/);
    expect(README).toMatch(/`Ctrl` \+ `,`/);
  });

  it('it states the player-scope law for the displayed transport keys', () => {
    expect(README).toMatch(/Only while the \*\*player\*\* has focus/);
    expect(README).toMatch(/not\* registered as menu accelerators/);
  });
});

describe('GPU blank-window path ships to users (m23)', () => {
  it('Troubleshooting names PHLIX_DISABLE_GPU with a Windows set method', () => {
    const trouble = README.slice(README.indexOf('### Common Issues'));
    expect(trouble).toMatch(/blank or black window/i);
    expect(trouble).toMatch(/setx PHLIX_DISABLE_GPU 1/);
  });

  it('it is honest that no settings-screen toggle writes the store key', () => {
    expect(README).toMatch(/ships no toggle that writes it/);
  });
});

describe('platform scope (m25, m27)', () => {
  it('deep-links.md marks the macOS branch code-path-only, not a platform claim', () => {
    expect(deepLinks).toMatch(/### macOS \(code path only/);
    expect(deepLinks).toMatch(/SHIPS FOR WINDOWS ONLY/);
  });

  it('the end-user install section states the OS/arch requirement up front', () => {
    const install = README.slice(README.indexOf('## Install (end users)'), README.indexOf('### What is published today'));
    expect(install).toMatch(/Windows 10 or 11, 64-bit \(x64\)/);
    expect(install).toMatch(/ARM64/);
  });
});

describe('ui-surface status keys stay machine-readable (m26)', () => {
  it('the SyncPlay row uses a status key in the hub column, not prose', () => {
    const row = uiSurface.match(/^\| SyncPlayPage \|.*$/m)?.[0] ?? '';
    expect(row).toMatch(/OK \(menu\)/);
    expect(row).toMatch(/UNREACHABLE \(/);
    expect(row.split('|').length).toBe(6); // 4 cells, well-formed row
  });

  it('the unlinked-pages claim is scoped to hub mode (server nav entry is real)', () => {
    expect(uiSurface).toMatch(/No navigation link exists for any of them \*\*in hub mode\*\*/);
    expect(uiSurface).toMatch(/In SERVER mode this page is NOT unlinked/);
  });
});
