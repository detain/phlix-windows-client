/**
 * M-WINDOWS-19 status pins — the end-user install story must track shipped release reality.
 *
 * Root cause (review windows__writer M1): "No end-user install story; the actual download
 * path is undocumented." The cure chain 3360d41 → df19e3f → this lane gives README an
 * "Install (end users)" story wired to the REAL path: the rolling "Latest (master)"
 * prerelease GitHub Release published by `release-latest` in .github/workflows/build.yml,
 * carrying `Phlix-Setup-<version>.exe`, `Phlix.<version>.appx` and `SHA256SUMS.txt`
 * (asset names verified against the live release 2026-10-29; the exe name is the
 * electron-builder `build.nsis.artifactName` template in package.json rendered with the
 * current product name and version).
 *
 * Every asset name embedded in README carries the package.json version, so a version bump
 * silently rots the story. These pins make the drift LOUD:
 *
 * | # | Pin                                            | reddens when                                   |
 * |---|------------------------------------------------|------------------------------------------------|
 * | 1 | README names the derived exe/appx/SUMS assets  | package.json version/productName/template moves|
 * |   | + exact direct-download URL                    | or README stops naming them                     |
 * | 2 | No stale versioned asset literal anywhere in   | a bump updates only some of README's copies     |
 * |   | README; the "currently `X.Y.Z`" prose agrees   |                                                 |
 * | 3 | "release-latest" job still uploads the exact   | CI's published asset set changes shape          |
 * |   | three globs and still points users at the      | (rewrite README's table in the same commit)     |
 * |   | README SmartScreen section                     |                                                 |
 * | 4 | Install-story sections run in real chronology  | a section is deleted or reordered               |
 * |   | published → installer/SmartScreen → first      |                                                 |
 * |   | launch → updates                               |                                                 |
 * | 5 | First-launch copy names the shipped surfaces   | boot-failure copy changes (re-sync README with  |
 * |   | (Connect screen, minimum version, the too-old  | the catalogs — docs follow producers)            |
 * |   | screen's catalog literals, Try again)          |                                                 |
 * | 6 | Tripwire: updater stays allowPrerelease=false  | prerelease-flip ships → "Getting updates" must   |
 * |   | while only pre-releases exist, matching the    | be rewritten BEFORE either side moves            |
 * |   | README's silent-no-op disclosure               |                                                 |
 * | 7 | First-launch copy keeps the fail-open          | versionCheck.ts design decision docblock        |
 * |   | sentence AND its docblock literal still        | moves (policy flips) OR README drops the        |
 * |   | names the gate as blocking ONLY explicit       | end-user truth it mirrors - rewrite the         |
 * |   | below-min reports; unreported servers boot     | copy in the same commit (docs-follow-producers) |
 * | 8 | Troubleshooting's "Ensure Node.js X+ is        | README's advice OR package.json engines.node    |
 * |   | installed" bullet matches the MAJOR derived    | drifts apart — a doc-following dev would land   |
 * |   | from package.json engines.node (M-WINDOWS-21)  | on a version the repo itself rejects            |
 * | 9 | Neither doc revives the blanket "no local      | someone re-authors the pre-P3-S4 zero-ownship   |
 * |   | pages/components/stores" claim literals, and    | claims while the renderer ships overlays, a     |
 * |   | both enumerate the shipped local surfaces by    | boot-failure screen, catalogs, a token adapter  |
 * |   | name (M-WINDOWS-22)                             | (docs-follow-code, and code-follows-DPAPI)      |
 * | 10| No zero-ownship SURVIVOR literal in the six    | someone revives an AGENTS/CLAUDE/004/test-      |
 * |   | law files (scan is whitespace-normalized +      | comment blanket claim the r2 whole-tree sweep   |
 * |   | lowercase — wrapping/casing cannot dodge)       | cured (M-WINDOWS-22 r2)                         |
 * | 11| ADR-004 keeps its "Status: Amended" and         | the amendment is un-marked, or the ADR is       |
 * |   | no-forking-rule markers                         | silently rewritten to the old premise           |
 * | 12| TRUE nuance statements stay present (negative   | blanket-censoring "fixes" a real claim, or the  |
 * |   | controls: "no local page views", "owns no       | kept-true nuance itself rots out of the docs    |
 * |   | settings form", "No localhost guess")           |                                                 |
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const README = readFileSync(join(PROJECT_ROOT, 'README.md'), 'utf-8');
const DEVELOPER = readFileSync(join(PROJECT_ROOT, 'DEVELOPER.md'), 'utf-8');
const PKG = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8')) as {
  version: string;
  engines: { node: string };
  build: { productName: string; nsis: { artifactName: string } };
};
const WORKFLOW = readFileSync(join(PROJECT_ROOT, '.github', 'workflows', 'build.yml'), 'utf-8');
const MAIN_SOURCE = readFileSync(join(PROJECT_ROOT, 'src', 'main', 'index.ts'), 'utf-8');
const WIN_EN = readFileSync(join(PROJECT_ROOT, 'src', 'renderer', 'i18n', 'windows-own', 'en.ts'), 'utf-8');
const VERSION_CHECK = readFileSync(join(PROJECT_ROOT, 'src', 'main', 'versionCheck.ts'), 'utf-8');

/** The exact NSIS asset name CI publishes: package.json's own template, rendered. */
function renderedNsisAssetName(): string {
  expect(
    PKG.build.nsis.artifactName,
    'build.nsis.artifactName template changed — re-derive the README asset table against ' +
    'it (and re-check the live release-latest assets); this pin renders the old shape.'
  ).toBe('${productName}-Setup-${version}.${ext}');
  return PKG.build.nsis.artifactName
    .replace('${productName}', PKG.build.productName)
    .replace('${version}', PKG.version)
    .replace('${ext}', 'exe');
}

/** README slice between two headings (end heading absent → to end of file). */
function readmeSection(startHeading: string, endHeading: string): string {
  const start = README.indexOf(startHeading);
  expect(start, `README lost the "${startHeading}" heading`).toBeGreaterThanOrEqual(0);
  const end = README.indexOf(endHeading, start + startHeading.length);
  return end === -1 ? README.slice(start) : README.slice(start, end);
}

describe('End-user install story tracks shipped release reality (M-WINDOWS-19)', () => {
  // -- 1. The published assets README names are the assets CI publishes ------
  it('README names the derived installer, sideload package and checksum file', () => {
    const exe = renderedNsisAssetName();
    const appx = `${PKG.build.productName}.${PKG.version}.appx`;
    const install = readmeSection('## Install (end users)', '## Prerequisites');
    expect(install, `README asset table lost the installer "${exe}"`).toContain(exe);
    expect(install, `README asset table lost the sideload package "${appx}"`).toContain(appx);
    expect(install, 'README asset table lost SHA256SUMS.txt').toContain('SHA256SUMS.txt');
    expect(
      install,
      `README lost the direct-download link for ${exe} (tag "latest", rolling prerelease)`
    ).toContain(`releases/download/latest/${exe}`);
    // The SmartScreen walkthrough must keep verifying the CURRENT exe name.
    expect(
      install,
      'the Get-FileHash walkthrough no longer hashes the current asset name'
    ).toContain(`Get-FileHash .\\${exe}`);
  });

  // -- 2. No half-bumped literals survive a version bump ---------------------
  it('every versioned asset literal in README carries the current package.json version', () => {
    const stale = (re: RegExp): string[] =>
      [...README.matchAll(re)].map((m) => m[1]).filter((v) => v !== PKG.version);
    const offenders = [
      ...stale(/\bPhlix-Setup-(\d+\.\d+\.\d+)\.exe\b/g),
      ...stale(/\bPhlix\.(\d+\.\d+\.\d+)\.appx\b/g),
      ...stale(/currently `(\d+\.\d+\.\d+)`/g)
    ];
    expect(
      offenders,
      `README still names assets at an old version (${[...new Set(offenders)].join(', ')}; ` +
      `current is ${PKG.version}) — a bump updated only some copies. Fix the README asset ` +
      'table, the direct-download link, the hash walkthrough and the prose in one sweep.'
    ).toEqual([]);
  });

  // -- 3. The release-latest job still uploads exactly what README promises --
  it('build.yml release-latest still publishes the three assets README advertises', () => {
    const start = WORKFLOW.indexOf('release-latest:');
    expect(start, 'the release-latest job vanished from build.yml — the rolling download ' +
      'story README tells end users is now fiction; rewrite Install (end users) with reality').toBeGreaterThanOrEqual(0);
    const end = WORKFLOW.indexOf('\n  release:', start);
    expect(end, 'the versioned release job vanished after release-latest — re-check this slice').toBeGreaterThan(start);
    const job = WORKFLOW.slice(start, end);
    expect(job, 'release-latest no longer uploads the NSIS .exe — README installer row is stale').toContain('artifacts/nsis/*.exe');
    expect(job, 'release-latest no longer uploads the APPX .appx — README sideload row is stale').toContain('artifacts/appx/*.appx');
    expect(job, 'release-latest no longer uploads SHA256SUMS.txt — README checksum row is stale').toContain('artifacts/SHA256SUMS.txt');
    expect(
      job,
      'release-latest stopped pointing users at the README SmartScreen walkthrough; the ' +
      'section heading it names must move in lockstep with the release body.'
    ).toContain('Windows protected your PC');
  });

  // -- 4. Chronology of the story ---------------------------------------------
  it('the install story sections run in real user chronology', () => {
    const order = [
      '## Install (end users)',
      '### What is published today',
      '### First run:',
      '### First launch:',
      '### Getting updates'
    ];
    const positions = order.map((heading) => {
      const at = README.indexOf(heading);
      expect(at, `README lost the install-story section "${heading}"`).toBeGreaterThanOrEqual(0);
      return at;
    });
    expect(positions, 'install-story sections went out of chronological order').toEqual([...positions].sort((a, b) => a - b));
  });

  // -- 5. First-launch copy names the shipped surfaces ------------------------
  it('first-launch copy covers Connect, the minimum version and the too-old surface (catalog literals)', () => {
    const launch = readmeSection('### First launch:', '### Getting updates');
    expect(launch, 'first-launch copy lost the Connect screen').toContain('Connect');
    expect(launch, 'first-launch copy lost the server minimum').toContain('1.1.0');

    const title = /incompatibleTitle:\s*'([^']+)'/.exec(WIN_EN)?.[1];
    const retry = /incompatibleRetry:\s*'([^']+)'/.exec(WIN_EN)?.[1];
    expect(title, 'windows-own catalog lost boot.incompatibleTitle').toBeTruthy();
    expect(retry, 'windows-own catalog lost boot.incompatibleRetry').toBeTruthy();
    expect(launch, `too-old screen title "${title}" drifted out of README`).toContain(title);
    expect(launch, `the "${retry}" affordance shipped but README stopped documenting it`).toContain(retry);
  });

  // -- 6. Updater posture tripwire ----------------------------------------------
  it('the updater still ignores pre-releases while only the rolling prerelease exists', () => {
    expect(
      MAIN_SOURCE,
      'autoUpdater.allowPrerelease flipped — the in-app updater may now self-serve rolling ' +
      'builds (or stable ones exist). Rewrite README "Getting updates" in the SAME commit; ' +
      'right now it discloses the silent-no-op posture (WIN-01).'
    ).toContain('autoUpdater.allowPrerelease = false');
    const updates = readmeSection('### Getting updates', '## Prerequisites');
    expect(updates, '"Getting updates" stopped disclosing the prerelease-blind posture').toContain('pre-release');
  });

  // -- 7. Fail-open truth: README mirrors the versionCheck design decision ----
  it('first-launch copy documents the fail-open-for-unreported truth the gate ships', () => {
    expect(
      VERSION_CHECK,
      'versionCheck.ts no longer carries its "fail-open for unknown servers" design-decision ' +
      'docblock — the policy flipped. Re-write the README first-launch sentence in the SAME ' +
      'commit (docs follow producers); right now it tells users the gate stops ONLY an ' +
      'explicit below-minimum report.'
    ).toContain('fail-open for unknown servers');
    const launch = readmeSection('### First launch:', '### Getting updates');
    // Whitespace-normalized: the pin guards the TRUTH's presence, not README's wrap column.
    const launchFlat = launch.replace(/\s+/g, ' ');
    expect(
      launchFlat,
      'the first-launch story dropped the fail-open disclosure (r2/M19 ask #2): end users ' +
      'must know the gate blocks ONLY servers that explicitly report below 1.1.0, and a ' +
      'pre-1.1.0 server without the version endpoint boots a degraded app instead of ' +
      'showing the too-old screen.'
    ).toContain('fails open');
  });

  // -- 8. Troubleshooting Node advice == engines floor (M-WINDOWS-21) ----------
  it('troubleshooting Node bullet matches the package.json engines floor', () => {
    const enginesMajor = /^>=(\d+)\./.exec(PKG.engines.node)?.[1];
    expect(
      enginesMajor,
      `package.json engines.node is "${PKG.engines.node}" — not the ">=MAJOR.MINOR.PATCH" ` +
      'shape this pin derives from. Re-read the floor and update BOTH sides of this pin.'
    ).toBeTruthy();
    const bullet = /- Ensure Node\.js (\d+)\+ is installed/.exec(README);
    expect(
      bullet,
      'README\'s "App doesn\'t start" troubleshooting lost its Node.js install bullet — ' +
      'restore it pointing at the engines floor (a dev on a too-old Node gets EBADENGINE, ' +
      'exactly the advice defect M-WINDOWS-21 cured).'
    ).toBeTruthy();
    expect(
      bullet?.[1],
      `README troubleshooting advises Node ${bullet?.[1]}+ but package.json engines.node ` +
      `requires ${PKG.engines.node} — the doc sends devs to a version the repo rejects.`
    ).toBe(enginesMajor);
  });

  // -- 9. Zero-ownship claims stay dead; local surfaces stay named (M-WINDOWS-22) --
  const LOCAL_SURFACES_DOCS: Array<[string, string]> = [
    ['README.md', README],
    ['DEVELOPER.md', DEVELOPER]
  ];
  const DEAD_CLAIM_LITERALS: string[] = [
    '(no local pages/components/stores)',
    'does not define its own pages, components, or stores',
    'there are no local pages, components, or stores',
    'no local UI ownship',
    'does not ship its own pages'
  ];
  it('neither doc revives the blanket "no local surfaces" claims it cured (M-WINDOWS-22)', () => {
    for (const [name, text] of LOCAL_SURFACES_DOCS) {
      for (const dead of DEAD_CLAIM_LITERALS) {
        expect(
          text,
          `${name} carries the zero-ownship claim "${dead}" — FALSE since the P3-S4 era: ` +
          'the renderer ships overlay components, a boot-failure screen, i18n catalogs and ' +
          'a DPAPI token-store adapter. Docs must say thin consumer PLUS enumerate them.'
        ).not.toContain(dead);
      }
    }
  });
  it('both docs enumerate the shipped local renderer surfaces by name (M-WINDOWS-22)', () => {
    for (const [name, text] of LOCAL_SURFACES_DOCS) {
      for (const surface of [
        'overlay.tsx',
        'PlayerSupplement',
        'SleepTimer',
        'PiPButton',
        'safeStorageTokenStore',
        'i18n'
      ]) {
        expect(
          text,
          `${name} no longer names the shipped local surface "${surface}" — the tree/prose ` +
          'enumeration from the M-WINDOWS-22 docs-truth pass must be kept in sync with code.'
        ).toContain(surface);
      }
    }
  });
});

describe('M-WINDOWS-22 r2 — zero-ownship survivor family stays dead whole-tree', () => {
  // The r1 sweep was docs/-scoped and case-sensitive, so this family lived on in
  // AGENTS.md, CLAUDE.md, the ADR-004 title/body, DEVELOPER.md's wrapped sentence,
  // and one test docblock. The r2 law scans the WHOLE survivor set, case-INsensitively
  // and wrap-tolerantly (whitespace-normalized), and names its own dead literals so a
  // revived claim reddens regardless of how it is re-line-broken or re-cased.
  const norm = (s: string): string => s.replace(/\s+/g, ' ').toLowerCase();
  const LAW_FILES: Array<[string, string]> = [
    ['README.md', norm(readFileSync(join(PROJECT_ROOT, 'README.md'), 'utf-8'))],
    ['DEVELOPER.md', norm(readFileSync(join(PROJECT_ROOT, 'DEVELOPER.md'), 'utf-8'))],
    ['AGENTS.md', norm(readFileSync(join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8'))],
    ['CLAUDE.md', norm(readFileSync(join(PROJECT_ROOT, 'CLAUDE.md'), 'utf-8'))],
    ['docs/decisions/004-no-local-ui.md',
      norm(readFileSync(join(PROJECT_ROOT, 'docs', 'decisions', '004-no-local-ui.md'), 'utf-8'))],
    ['tests/unit/hubModeStatus.test.ts',
      norm(readFileSync(join(PROJECT_ROOT, 'tests', 'unit', 'hubModeStatus.test.ts'), 'utf-8'))]
  ];
  const SURVIVOR_CLAIM_LITERALS: string[] = [
    'owns zero ui',
    'ships zero ui',
    'ships no ui of its own',
    'the renderer owns no ui',
    'all screens/stores/routing come from',
    'all screens, components, stores, and routing come from',
    'this repo only owns the electron shell',
    'this repo owns only the electron shell',
    'local code is limited to the electron shell',
    'routes are not defined here',
    'routes are not defined in this repo',
    'do not re-add local pages',
    'no local pages/components/stores',
    'adr-004: no local ui'
  ];
  it('no law file revives a zero-ownship survivor claim (r2 whole-tree family)', () => {
    for (const [name, text] of LAW_FILES) {
      for (const dead of SURVIVOR_CLAIM_LITERALS) {
        expect(
          text,
          `${name} carries the zero-ownship claim "${dead}" — the M-WINDOWS-22 r2 sweep cured ` +
          'it to shipped truth: thin consumer PLUS the enumerated local surfaces (player ' +
          'overlays via overlay.tsx, boot-failure screen, i18n catalogs, media-session, DPAPI ' +
          'token-store adapter, local route wiring). Scanned normalized+lowercased: casing or ' +
          'line-wrapping cannot dodge this pin.'
        ).not.toContain(dead);
      }
    }
  });
  it('ADR-004 stays marked as amended and keeps the surviving no-forking rule (r2)', () => {
    const adr = norm(readFileSync(join(PROJECT_ROOT, 'docs', 'decisions', '004-no-local-ui.md'), 'utf-8'));
    expect(adr, 'ADR-004 lost its amendment marker — an ADR may age only when MARKED, not silently false').toContain('status: amended');
    expect(adr, 'ADR-004 lost the no-forking rule — the part of the decision that still stands must stay stated').toContain('no-forking rule');
  });
  it('the r2 law targets claims, not true statements (negative controls)', () => {
    // Legit distinct claims that survived the sweep: deleting them (or blanket-censoring
    // shared words) is overreach and must redden this pin.
    const developer = norm(readFileSync(join(PROJECT_ROOT, 'DEVELOPER.md'), 'utf-8'));
    const main = norm(readFileSync(join(PROJECT_ROOT, 'src', 'main', 'index.ts'), 'utf-8'));
    const hubMode = norm(readFileSync(join(PROJECT_ROOT, 'tests', 'unit', 'hubModeStatus.test.ts'), 'utf-8'));
    const resolve = norm(readFileSync(join(PROJECT_ROOT, 'tests', 'unit', 'resolveConfig.test.ts'), 'utf-8'));
    expect(developer, 'TRUE kept nuance: routes render vendored page VIEWS').toContain('no local page views');
    expect(developer, 'TRUE kept nuance: app state stays in vendored stores').toContain('no local application stores');
    expect(main, 'TRUE: src/main/index.ts records that the renderer owns no settings FORM (vendored one serves)').toContain('owns no settings form');
    expect(hubMode, 'TRUE: the M17 docblock still states no local settings form').toContain('owns no settings form');
    expect(resolve, 'unrelated prose: "No localhost guess" is not a zero-ownship claim').toContain('no localhost guess');
  });
});
