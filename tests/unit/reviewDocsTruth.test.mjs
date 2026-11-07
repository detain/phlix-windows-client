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
    // MW-119 rotation: m24 pinned "no in-app way to point it at a different
    // server" while that was the honest limitation. The too-old screen now
    // carries a change-server button (clears the stored URL, reopens Connect),
    // so the retired sentence is tripwired OUT and the new affordance IN.
    expect(README).not.toMatch(/no in-app way to\s+point it at a different server/i);
    expect(README).toMatch(/Use a different server/);
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

  it('it states the true scope of the transport keys (w10/L1 rotation of the m22 pin)', () => {
    // m22 pinned "Only while the **player** has focus" believing it honest —
    // review windows__casualgamer #5 proved it BACKWARDS: the shell's focus
    // guard relays these bare keys on every route EXCEPT the player, where
    // the vendored engine owns them. The pin now holds the corrected law;
    // the second arm (no fake accelerators) was true then and stays true.
    expect(README).toMatch(/Everywhere \*\*outside\*\* the player/);
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

// --- batch 8b: supplemental devops-docs findings (D3-D11) -------------------

const DEVELOPER = read('DEVELOPER.md');
const AGENTS = read('AGENTS.md');

describe('coverage pipeline honesty (D3)', () => {
  it('the stale "uploaded to Codecov and Codacy on each CI run" claim is gone', () => {
    expect(README).not.toMatch(/uploaded to Codecov and Codacy on each CI run/i);
  });

  it('the vitest lines:54 threshold is named as the authoritative gate', () => {
    expect(README).toMatch(/lines: 54/);
    expect(README).toMatch(/best-effort/i);
    expect(README).toMatch(/ci-baseline\.md/);
  });
});

describe('CI inventory complete (D8)', () => {
  it('codeql.yml appears in the README workflow list', () => {
    expect(README).toMatch(/\*\*codeql\.yml\*\*/);
  });
});

describe('dev-loop wording scoped (D5)', () => {
  it('the README says main/preload do NOT hot-reload', () => {
    expect(README).toMatch(/main-process and preload changes do not/);
    expect(README).not.toMatch(/automatic reload on changes/);
  });
});

describe('testing stats truthful (D6)', () => {
  it('the "22 tests across three files" era is retired in DEVELOPER.md', () => {
    expect(DEVELOPER).not.toMatch(/22 tests across three/i);
    expect(DEVELOPER).toMatch(/lines: 54/);
    expect(DEVELOPER).not.toMatch(/58% floor/);
  });

  it('AGENTS.md carries the threshold, not the stale 58%', () => {
    expect(AGENTS).toMatch(/lines: 54/);
    expect(AGENTS).not.toMatch(/58%/);
  });
});

describe('secret hygiene directive current (D9)', () => {
  it('AGENTS.md forbids hardcoding instead of mandating it', () => {
    expect(AGENTS).not.toMatch(/credentials hardcoded/);
    expect(AGENTS).toMatch(/NEVER hardcode tokens/);
  });

  it('the secret names it quotes match the real workflows', () => {
    expect(AGENTS).toMatch(/CODECOV_TOKEN/);
    expect(AGENTS).toMatch(/CODACY_API_TOKEN/);
  });
});

describe('contributor guidance exists (D10)', () => {
  it('CONTRIBUTING.md documents the fork-secret behavior and links from README', () => {
    const contributing = read('CONTRIBUTING.md');
    expect(contributing).toMatch(/fail_ci_if_error: false/);
    expect(contributing).toMatch(/release-latest/);
    expect(README).toMatch(/\[CONTRIBUTING\.md\]\(CONTRIBUTING\.md\)/);
  });
});

describe('release process owns the changelog (D11)', () => {
  it('step 0 tells the human to update CHANGELOG.md before tagging', () => {
    const rel = README.slice(README.indexOf('### Release Process'));
    expect(rel).toMatch(/0\. \*\*Update `CHANGELOG\.md` first\.\*\*/);
    expect(rel).toMatch(/generate_release_notes/);
  });
});

describe('feed hosting math disclosed (D7)', () => {
  it('the privacy section names api.github.com, the rate budget and asset size', () => {
    expect(README).toMatch(/api\.github\.com/);
    expect(README).toMatch(/60 requests\/hour/);
    expect(README).toMatch(/290 MiB/);
  });
});

describe('M4 landed: What Works reflects wired token custody', () => {
  it('no README bullet still claims the adapter awaits its seam', () => {
    expect(README).not.toMatch(/awaiting its ui seam/);
    expect(README).toMatch(/token-store adapter WIRED/);
  });
});
