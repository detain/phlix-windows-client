/**
 * @vitest-environment node
 *
 * M-WINDOWS-08 signing-posture guard — the repo must tell ONE honest story
 * about what is signed and what is not.
 *
 * WHY: `.github/workflows/build.yml` carried a commented-out signing sketch
 * whose header promised "uncomment and fill in" once a `WINDOWS_CERT_BASE64`
 * secret is provisioned — a secret name that contradicts the repo's own
 * runbook (`docs/signing.md` prescribes `AUTHENTICODE_CERT*` /
 * `APPX_SIGNING_CERT*`), and a `signtool` invocation sitting in the
 * `ubuntu-26.04` release job where the Windows SDK binary does not exist.
 * Meanwhile every published artifact (the rolling "latest" prerelease and any
 * future tag release) ships UNSIGNED — the reality README "First run:
 * 'Windows protected your PC'" already teaches (SmartScreen Unknown
 * Publisher + Get-FileHash verification against SHA256SUMS.txt). The cure is
 * documentation truth, not fabricated certificates: the sketch stays, but is
 * annotated as the inactive future path, secret names are canonicalized to
 * docs/signing.md, and the release-page body stops being silent about the
 * unsigned posture.
 *
 * LAWS (measured 2026-10-29: five of the seven its redden at pre-cure
 * 4e95cac — the annotation, name-drift, retired-names, docs-header and
 * release-body laws; the two NEGATIVE tripwires below are green unless a
 * lie is planted, which is their whole function):
 *  1. the workflow comment states the inactive posture in plain words;
 *  2. workflow and docs agree on the signing secret names (no drift either
 *     direction — a round-trip equality law);
 *  3. docs/signing.md opens by telling users what ships TODAY (unsigned),
 *     before it teaches how to sign what does not yet exist;
 *  4. the rolling "latest" release body discloses the unsigned posture —
 *     read STRUCTURALLY from the parsed YAML `with.body` (the repo's r2
 *     lesson: whole-file text pins are comment-maskable);
 *  5. the tag-release Create Release step stays silent about signing only
 *     because generate_release_notes carries no trust claim (negative law:
 *     no step body may CLAIM signed output).
 *  6. TRIPWIRE: no ACTIVE (uncommented) signtool step may exist in any job —
 *     uncommenting the sketch in place (e.g. onto the ubuntu leg) reddens
 *     this until the enabling lane genuinely moves signing to a windows leg
 *     and re-pins the law with its flip documented.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const buildYmlPath = path.join(repoRoot, '.github', 'workflows', 'build.yml');
const buildYml = readFileSync(buildYmlPath, 'utf8');
const signingDocs = readFileSync(path.join(repoRoot, 'docs', 'signing.md'), 'utf8');

let parsedWorkflow;
function workflow() {
  if (!parsedWorkflow) parsedWorkflow = load(buildYml);
  return parsedWorkflow;
}

function jobSteps(jobId) {
  const steps = workflow()?.jobs?.[jobId]?.steps;
  if (!Array.isArray(steps)) {
    throw new Error(`build.yml must define a '${jobId}' job with a steps list`);
  }
  return steps;
}

/** Every signing-related `secrets.NAME` token in the raw file (comments included). */
function signingSecretRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(/secrets\.([A-Z][A-Z0-9_]*)/g)) {
    if (/CERT|SIGN/i.test(match[1])) refs.add(match[1]);
  }
  return refs;
}

describe('M-WINDOWS-08 signing posture is told honestly (workflow)', () => {
  it('annotates the commented signing block as inactive and states that artifacts ship unsigned', () => {
    expect(buildYml).toMatch(/INACTIVE/);
    expect(buildYml).toMatch(/UNSIGNED/);
    expect(buildYml).toMatch(/docs\/signing\.md/);
  });

  it('references none of the drifted secret names the old comment carried', () => {
    expect(buildYml).not.toMatch(/WINDOWS_CERT_BASE64/);
    expect(buildYml).not.toMatch(/SIGNTOOL_PASSWORD/);
  });

  it('names only secrets docs/signing.md prescribes, and docs prescribes every name the workflow mentions', () => {
    const documented = new Set(['AUTHENTICODE_CERT', 'AUTHENTICODE_CERT_PASSWORD', 'APPX_SIGNING_CERT', 'APPX_SIGNING_CERT_PASSWORD']);
    const inDocs = new Set([...documented].filter((name) => signingDocs.includes(name)));
    expect(inDocs.size).toBe(documented.size); // runbook still defines the canonical four
    const inWorkflow = signingSecretRefs(buildYml);
    expect(inWorkflow.size).toBeGreaterThan(0); // the future path references the canonical names…
    for (const name of inWorkflow) {
      expect(inDocs.has(name), `build.yml references '${name}', which docs/signing.md does not prescribe`).toBe(true);
    }
    for (const name of documented) {
      if (buildYml.includes(name)) expect(inDocs.has(name)).toBe(true);
    }
  });

  it('keeps signtool out of any active step — the sketch only exists as a comment until a windows-leg lane lands it', () => {
    for (const jobId of Object.keys(workflow().jobs)) {
      for (const step of jobSteps(jobId)) {
        const activeScript = String(step.run ?? '');
        const activeName = String(step.name ?? '');
        expect(/signtool/i.test(activeScript), `job '${jobId}' has an active signtool step`).toBe(false);
        expect(/signtool/i.test(activeName), `job '${jobId}' has a step named for signtool`).toBe(false);
      }
    }
  });

  it('never claims signed output anywhere no signing runs', () => {
    for (const jobId of Object.keys(workflow().jobs)) {
      for (const step of jobSteps(jobId)) {
        const body = String(step.with?.body ?? '');
        expect(/signed installer|code-signed build|signed release assets/i.test(body), `job '${jobId}' body claims signed output`).toBe(false);
      }
    }
  });
});

describe('M-WINDOWS-08 signing posture is told honestly (docs + release bodies)', () => {
  it('opens docs/signing.md with the current unsigned reality before the how-to-sign future', () => {
    const head = signingDocs.slice(0, 1200);
    expect(head).toMatch(/UNSIGNED/i);
    expect(head).toMatch(/status/i);
  });

  it('the rolling "latest" release body discloses the unsigned posture (structural, not comment-masked)', () => {
    const step = jobSteps('release-latest').find(
      (s) => String(s.uses ?? '').startsWith('softprops/action-gh-release') && s.with?.tag_name === 'latest'
    );
    if (!step) throw new Error("release-latest job has no softprops step publishing tag 'latest'");
    const body = String(step.with?.body ?? '');
    expect(body.toLowerCase()).toContain('unsigned');
    expect(body).toMatch(/SmartScreen|verify/i);
  });
});
