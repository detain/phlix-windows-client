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
