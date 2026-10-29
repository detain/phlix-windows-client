/**
 * @vitest-environment node
 *
 * M-WINDOWS-18 signing-posture POLICY WITH PROOF — package.json says
 * "unsigned", the docs say why, and the vendor bytes prove the why.
 *
 * WHY: the queue item flagged `build.win` as signing-bare ("no
 * certificateFile, no signtoolOptions, no forceCodeSigning"). The naive
 * cure — flip `forceCodeSigning: true` to "force" integrity — is
 * impossible against the locked builder: with no certificate configured,
 * app-builder-lib's `windowsSignToolManager.signFile` logs
 * "no code signing certificate configured, signing is skipped" and
 * returns false, and `winPackager._sign` then throws
 * InvalidConfigurationError — enabling the flag before WIN-08 certs are
 * provisioned reddens EVERY electron-builder leg. Certificates are an
 * owner action (WIN-08); until then the honest posture is documented
 * `false`, and this test makes the whole posture machine-checked: the
 * policy constants in package.json root key `signingPosture`, the docs
 * mirror in docs/signing.md, the cited vendor paths, and tripwires
 * against the exact misconfiguration the docs now forbid.
 *
 * This file deliberately does NOT touch the sibling laws already owned by
 * M-WINDOWS-05 (`updateFeedWorkflow.test.mjs`, authentic sha512 feed) or
 * M-WINDOWS-08 (`signingPostureWorkflow.test.mjs`, workflow secret-name
 * round-trip + inactive-signtool tripwires). It adds the missing
 * config↔docs↔vendor triangle.
 *
 * LAWS:
 *  1. package.json root `signingPosture` states the truth: status
 *     "unsigned", forceCodeSigning false, certificatesProvisioned false.
 *  2. TRIPWIRE: no signing-family key (forceCodeSigning, certificateFile,
 *     certificateSubject, signtoolOptions, azureSignOptions) inside any
 *     validated build subtree — the planted flag-without-certs combo this
 *     policy exists to forbid reddens here (and in law 3's sync check).
 *  3. flag↔posture sync: the effective forceCodeSigning the builder would
 *     read (build.win override ?? build fallback ?? false) must equal the
 *     declared posture constant; drift either direction is red.
 *  4. placement law: the posture key lives at package.json ROOT, never
 *     inside `build` — proved against the shipped schema (law 5), since
 *     electron-builder validates `build` with additionalProperties:false
 *     and an unknown key there is a hard InvalidConfigurationError.
 *  5. vendor SCHEMA proof (parsed shipped artifact): scheme.json root
 *     (Configuration) and definitions.WindowsConfiguration both set
 *     additionalProperties:false, and forceCodeSigning IS a legitimate
 *     WindowsConfiguration property (the lawful flip knob for a future
 *     cert-gated enablement).
 *  6. vendor SOURCE proof: windowsSignToolManager.js still carries the
 *     cert-less skip path (phrase + `return false`) fed by
 *     WIN_CSC_LINK resolution; winPackager.js still throws
 *     InvalidConfigurationError naming "forceCodeSigning" when signing
 *     was skipped and the flag is set; platformPackager.js still prefers
 *     the per-platform forceCodeSigning over the top-level one — exactly
 *     the chain docs/signing.md quotes. Byte-pins, so a vendor refactor
 *     that moves these paths reddens this lane, not a silent doc lie.
 *  7. docs mirror: docs/signing.md carries the forceCodeSigning section
 *     naming both vendor files, InvalidConfigurationError, the WIN-08
 *     gate, and every secret name the posture block's flipGate names;
 *     README still states the installers are not code-signed.
 *  8. updater trust = INTEGRITY, never claimed authenticity: no ACTIVE
 *     workflow step whose script touches the updater feed (latest.yml /
 *     electron-updater) mentions signatures or signed output — read
 *     STRUCTURALLY from parsed YAML (the repo's r2 lesson: raw-text pins
 *     are comment-maskable), and the feed law still speaks sha512.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const signingDocs = readFileSync(path.join(repoRoot, 'docs', 'signing.md'), 'utf8');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const buildYml = readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');

const abiRoot = path.join(repoRoot, 'node_modules', 'app-builder-lib');
const abiVersion = JSON.parse(readFileSync(path.join(abiRoot, 'package.json'), 'utf8')).version;
const scheme = JSON.parse(readFileSync(path.join(abiRoot, 'scheme.json'), 'utf8'));
const signToolSrc = readFileSync(path.join(abiRoot, 'out', 'codeSign', 'windowsSignToolManager.js'), 'utf8');
const winPackagerSrc = readFileSync(path.join(abiRoot, 'out', 'winPackager.js'), 'utf8');
const platformPackagerSrc = readFileSync(path.join(abiRoot, 'out', 'platformPackager.js'), 'utf8');

/** Signing-family keys electron-builder would act on if present. */
const SIGNING_KEYS = ['forceCodeSigning', 'certificateFile', 'certificateSubject', 'signtoolOptions', 'azureSignOptions'];

function workflow() {
  return load(buildYml);
}

describe('M-WINDOWS-18 signing posture — package.json policy', () => {
  it('declares the current truth at root: unsigned, forceCodeSigning off, no certs provisioned', () => {
    const posture = pkg.signingPosture;
    expect(posture, 'package.json must carry the root signingPosture block').toBeTypeOf('object');
    expect(posture.status).toBe('unsigned');
    expect(posture.forceCodeSigning).toBe(false);
    expect(posture.certificatesProvisioned).toBe(false);
    expect(posture.note).toMatch(/additionalProperties/i); // placement law travels with the block
    expect(posture.why).toMatch(/windowsSignToolManager/);
    expect(posture.why).toMatch(/winPackager/);
    expect(posture.why).toMatch(/InvalidConfigurationError|throws/i);
    expect(posture.flipGate).toMatch(/WIN-08/);
  });

  it('keeps every signing-family key out of the validated build subtrees (flag-without-certs tripwire)', () => {
    const subtrees = { build: pkg.build, 'build.win': pkg.build.win, 'build.nsis': pkg.build.nsis, 'build.appx': pkg.build.appx };
    for (const [label, node] of Object.entries(subtrees)) {
      for (const key of SIGNING_KEYS) {
        expect(node[key], `build config subtree '${label}' carries signing key '${key}' while posture is unsigned`).toBeUndefined();
      }
    }
  });

  it('effective builder flag equals the declared posture constant (drift either direction is red)', () => {
    const effective = pkg.build.win?.forceCodeSigning ?? pkg.build.forceCodeSigning ?? false;
    expect(effective).toBe(pkg.signingPosture.forceCodeSigning);
  });

  it('lives at package.json root, never inside build (schema-validated territory)', () => {
    expect(pkg.build.signingPosture, 'posture block inside build would hard-fail electron-builder (see scheme law)').toBeUndefined();
  });
});

describe('M-WINDOWS-18 signing posture — vendor proof at the installed app-builder-lib', () => {
  it('is written against a 26.x builder whose major matches the declared range', () => {
    expect(abiVersion).toMatch(/^26\./);
    expect(pkg.devDependencies['electron-builder']).toBe('^26.8.1');
  });

  it('scheme.json forbids unknown keys in build and build.win, and legitimizes forceCodeSigning as the Windows knob', () => {
    expect(scheme.additionalProperties, 'Configuration root must reject unknown keys (posture block must stay at package.json root)').toBe(false);
    const windowsConfig = scheme.definitions.WindowsConfiguration;
    expect(windowsConfig.additionalProperties).toBe(false);
    expect(windowsConfig.properties.forceCodeSigning, 'flip knob must exist as a real WindowsConfiguration property').toBeDefined();
  });

  it('windowsSignToolManager.signFile skips (returns false) when no certificate is configured', () => {
    expect(signToolSrc).toContain('no code signing certificate configured, signing is skipped');
    expect(signToolSrc).toContain('WIN_CSC_LINK'); // the env fallback whose emptiness resolves cscInfo to null
    const skipIdx = signToolSrc.indexOf('no code signing certificate configured, signing is skipped');
    expect(signToolSrc.slice(skipIdx, skipIdx + 120)).toContain('return false;');
  });

  it('winPackager._sign throws InvalidConfigurationError when the skipped signing meets forceCodeSigning', () => {
    expect(winPackagerSrc).toContain('App is not signed and "forceCodeSigning" is set to true');
    expect(winPackagerSrc).toContain('InvalidConfigurationError');
  });

  it('platformPackager prefers the per-platform flag — the docs flip-gate targets build.win, not top-level', () => {
    const platformIdx = platformPackagerSrc.indexOf('platformSpecificBuildOptions.forceCodeSigning');
    const topLevelIdx = platformPackagerSrc.indexOf('this.config.forceCodeSigning');
    expect(platformIdx).toBeGreaterThanOrEqual(0);
    expect(topLevelIdx).toBeGreaterThanOrEqual(0);
    expect(platformIdx).toBeLessThan(topLevelIdx);
  });
});

describe('M-WINDOWS-18 signing posture — docs mirror and updater trust story', () => {
  it('docs/signing.md carries the forceCodeSigning section naming the vendor chain and the WIN-08 gate', () => {
    expect(signingDocs).toMatch(/forceCodeSigning: Why It Stays/);
    for (const token of ['windowsSignToolManager', 'winPackager', 'InvalidConfigurationError', 'WIN-08', 'scheme.json', 'additionalProperties']) {
      expect(signingDocs, `docs/signing.md no longer mirrors posture element '${token}'`).toContain(token);
    }
    // every secret name the package.json flipGate promises must be prescribed by the runbook
    for (const match of pkg.signingPosture.flipGate.matchAll(/\b([A-Z][A-Z0-9_]*CERT[A-Z0-9_]*)\b/g)) {
      expect(signingDocs, `flipGate names '${match[1]}' which docs/signing.md does not prescribe`).toContain(match[1]);
    }
  });

  it('README still tells users the shipped installers are not code-signed', () => {
    expect(readme).toMatch(/not code-signed/i);
  });

  it('no ACTIVE updater-feed step claims signatures — the updater story is sha512 integrity only (structural)', () => {
    const feedScript = buildYml.match(/electron-updater[\s\S]{0,400}?verifies[\s\S]{0,80}?sha512/) || [];
    expect(feedScript[0] ?? '', 'build.yml must keep stating the electron-updater sha512 integrity law').toContain('sha512');
    for (const jobId of Object.keys(workflow().jobs)) {
      for (const step of workflow().jobs[jobId].steps ?? []) {
        const script = String(step.run ?? '');
        if (!/latest\.yml|electron-updater/.test(script)) continue;
        expect(script, `job '${jobId}' updater-feed script claims signature handling`).not.toMatch(/signature/i);
        expect(script, `job '${jobId}' updater-feed script says 'signed'`).not.toMatch(/\bsigned\b/i);
      }
    }
  });
});
