/**
 * @vitest-environment node
 *
 * README/AGENTS copy truth (M-WINDOWS-03 / M-WINDOWS-46 / M-WINDOWS-07):
 *  - the packaged .exe user needs NO Node.js — yet Troubleshooting told them
 *    to install Node and run npm install (dev-source steps wearing an
 *    end-user costume);
 *  - the shipped app's Electron userData dir is %APPDATA%\Phlix (packaged
 *    app.name == builder productName; vendor: app-builder-lib sets it at
 *    packaging time), while %APPDATA%\phlix-windows belongs to `npm run dev`
 *    (package.json name). The README taught only the dev path to end users;
 *  - AGENTS.md still described resolveConfig's fallback as
 *    `http://localhost:8096` — the code's law since the Connect-screen era is
 *    serverUrl -> envUrl -> EMPTY base with requireConnection routing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p) => readFileSync(resolve(__dirname, '../../', p), 'utf-8');
const readme = read('README.md');
const agents = read('AGENTS.md');

describe('README end-user truth (M-WINDOWS-03 / M-WINDOWS-46)', () => {
  it('troubleshooting no longer tells packaged users to install Node', () => {
    const trouble = readme.slice(readme.indexOf('## Troubleshooting'));
    // The source-build guidance (Node 24+, npm install) may survive ONLY after
    // an explicit from-source marker — a packaged .exe user needs no Node.
    expect(trouble).toMatch(/from source/i);
    const srcIdx = trouble.toLowerCase().indexOf('from source');
    const nodeIdx = trouble.indexOf('Node.js 24');
    const npmIdx = trouble.indexOf('npm install');
    expect(nodeIdx, 'Node guidance may not precede the from-source arm').toBeGreaterThan(srcIdx);
    expect(npmIdx, 'npm guidance may not precede the from-source arm').toBeGreaterThan(srcIdx);
    // The end-user arm exists and points at something REAL: the shipped logs.
    const startIdx = trouble.indexOf("**App doesn't start:**");
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(trouble.slice(startIdx, srcIdx)).toMatch(/logs|electron-log/);
  });

  it('config/log paths distinguish packaged %APPDATA%\\Phlix from dev phlix-windows', () => {
    const cfg = readme.slice(readme.indexOf('## Configuration'), readme.indexOf('## Configuration') + 900);
    expect(cfg).toMatch(/%APPDATA%\\Phlix\b/);
    expect(cfg).toMatch(/phlix-windows/); // dev path still disclosed
    expect(cfg.match(/packaged|installer/i).length, 'packaged-vs-dev distinction named').toBeGreaterThan(0);
    const logs = readme.slice(readme.indexOf('### Logs'), readme.indexOf('### Logs') + 700);
    expect(logs).toMatch(/%APPDATA%\\Phlix\\logs\\/);
    expect(logs).toMatch(/phlix-windows\\logs/);
  });
});

describe('AGENTS.md resolveConfig law (M-WINDOWS-07)', () => {
  it('describes the empty-base fallback, not the retired localhost guess', () => {
    const line = agents.split('\n').find((l) => l.includes('resolveConfig.ts'));
    expect(line, 'resolveConfig row present').toBeDefined();
    expect(line).not.toMatch(/localhost:8096/);
    expect(line).toMatch(/empty/i);
    expect(line).toMatch(/Connect/i);
  });
});

// ---- W-min203 ----

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
const signing = read('docs/signing.md');
const developer = read('DEVELOPER.md');

describe('package scripts publish-safety (M-WINDOWS-28)', () => {
  it('both package targets carry --publish never', () => {
    expect(pkg.scripts.package).toMatch(/--publish never/);
    expect(pkg.scripts['package:store'], 'appx step must not inherit publish semantics').toMatch(/--publish never/);
  });
});

describe('signing.md artifact name (M-WINDOWS-13)', () => {
  it('names the artifact the build actually produces', () => {
    // package.json build.nsis.artifactName = ${productName}-Setup-${version}.${ext}
    //   → Phlix-Setup-1.0.0.exe. The doc's old 'Phlix-1.0.0-setup.exe' never matches.
    expect(pkg.build.nsis.artifactName).toBe('${productName}-Setup-${version}.${ext}');
    expect(signing).not.toMatch(/Phlix-1\.0\.0-setup\.exe/);
    expect(signing).toMatch(/Phlix-Setup-1\.0\.0\.exe/);
  });
});

describe('README end-user disclosures (M-WINDOWS-08 / 21 / 43 / 47 / 55)', () => {
  it('privacy section discloses the updater phone-home and nothing else', () => {
    expect(readme).toMatch(/## Privacy/);
    const privacy = readme.slice(readme.indexOf('## Privacy'));
    expect(privacy).toMatch(/github\.com/);
    expect(privacy).toMatch(/update/i);
    expect(privacy.slice(0, 1200)).toMatch(/no usage data|no telemetry/i);
  });
  it('uninstall + data-persistence truth is documented', () => {
    expect(readme).toMatch(/## Uninstall/);
    const un = readme.slice(readme.indexOf('## Uninstall'), readme.indexOf('## Uninstall') + 1500);
    expect(un).toMatch(/%APPDATA%\\Phlix/);
    expect(un).toMatch(/deleteAppDataOnUninstall/); // named law: unset on purpose
  });
  it('TLS expectations cover self-signed certificates', () => {
    expect(readme).toMatch(/self-signed/i);
    expect(readme).toMatch(/certificate/i);
  });
  it('env table names every knob the code reads', () => {
    for (const knob of ['PHLIX_DISABLE_GPU', 'PHLIX_FORCE_PRODUCTION', 'VITE_PHLIX_LOCALE', 'VITE_PHLIX_SERVER_URL']) {
      expect(readme, `README env docs: ${knob}`).toContain(knob);
    }
  });
  it('DEVELOPER.md enumerates the electron-store keys the main process writes', () => {
    for (const key of ['serverUrl', 'hubUrl', 'deviceId', 'windowBounds', 'minimizeToTray',
      'notificationsEnabled', 'connectionMode', 'activeServerId', 'disableHardwareAcceleration']) {
      expect(developer, `DEVELOPER store-key docs: ${key}`).toContain(`'${key}'`);
    }
  });
});

describe('canonical naming (M-WINDOWS-48)', () => {
  it('the human name is Phlix for Windows everywhere end-user facing', () => {
    expect(readme.split('\n')[0]).toBe('# Phlix for Windows');
    expect(readme).not.toMatch(/Phlix Windows\b/); // bare drift form retired
    expect(readme).toMatch(/## Naming/);           // the law itself is recorded
  });
  it('package.json description drops the server/client ambiguity', () => {
    expect(pkg.description).not.toBe('Phlix Media Server Client for Windows');
    expect(pkg.description).toMatch(/Phlix for Windows/);
  });
});
