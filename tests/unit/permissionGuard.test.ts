/**
 * @vitest-environment node
 *
 * M-WINDOWS-29 (review windows__exploiter MINOR-1): the client never touched
 * `session.defaultSession` permission hooks, so every OS permission Electron
 * recognizes (media/camera/microphone, geolocation, notifications, MIDI, …)
 * was granted by default to anything the renderer asked for — a malicious
 * server driving the UI could prompt (or silently obtain) camera/mic from a
 * media-player shell that has no legitimate use for them.
 *
 * Cure: default-deny guard (`src/main/permissionGuard.ts`, pure-module
 * extraction law). Single carve-out, measured rather than assumed: the pinned
 * `@phlix/ui` bundle calls `navigator.clipboard.writeText` at 9 sites (copy
 * buttons in admin/token/share surfaces), which Electron resolves through the
 * `clipboard-sanitized-write` permission — a blanket deny would have broken
 * shipped functionality. The review's 'deny-all is cost-free' claim is
 * therefore slightly wrong and was corrected from the bundle, not the prose.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { allowPermission, installPermissionGuard, isTrustedRequesterUrl } from '../../src/main/permissionGuard';

const PROJECT_ROOT = resolve(__dirname, '../..');
const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8').replace(/\r\n/g, '\n');

describe('allowPermission decision table (M-WINDOWS-29)', () => {
  it('denies every surveillance-class and device permission Electron lists', () => {
    for (const permission of [
      'media', 'audioCapture', 'videoCapture', 'geolocation', 'notifications',
      'midi', 'midiSysex', 'openExternal', 'pointerLock', 'fullscreen',
      'keyboardLock', 'storage'
    ]) {
      expect(allowPermission(permission), permission).toBe(false);
    }
  });

  it('allows clipboard-sanitized-write — the vendored ui copy buttons run through it', () => {
    expect(allowPermission('clipboard-sanitized-write')).toBe(true);
  });

  it('denies unknown and malformed requests (default-deny, not allow-list-by-omission)', () => {
    expect(allowPermission('brand-new-privilege')).toBe(false);
    expect(allowPermission(undefined)).toBe(false);
    expect(allowPermission(42)).toBe(false);
  });
});

describe('installPermissionGuard wiring (M-WINDOWS-29)', () => {
  it('installs BOTH the request handler and the sync check handler on the session given', () => {
    const calls: Array<{ kind: string; permission: string; result: unknown }> = [];
    const fakeSession = {
      setPermissionRequestHandler: (h: (c: unknown, p: string, cb: (g: boolean) => void) => void) => {
        calls.push({ kind: 'request', permission: 'media', result: undefined });
        h({}, 'media', (granted) => calls.push({ kind: 'request-verdict', permission: 'media', result: granted }));
      },
      setPermissionCheckHandler: (h: (c: unknown, p: string) => boolean) => {
        calls.push({ kind: 'check', permission: 'geolocation', result: undefined });
        calls.push({ kind: 'check-verdict', permission: 'geolocation', result: h({}, 'geolocation') });
      }
    };
    installPermissionGuard(fakeSession);
    const installed = calls.filter((c) => !c.kind.endsWith('-verdict')).map((c) => c.kind).sort();
    expect(installed).toEqual(['check', 'request']);
    expect(calls.find((c) => c.kind === 'request-verdict')!.result).toBe(false);
    expect(calls.find((c) => c.kind === 'check-verdict')!.result).toBe(false);
  });

  it('the guard is installed on defaultSession at window build time', () => {
    expect(mainSource).toMatch(/installPermissionGuard\(session\.defaultSession\)/);
    // and 'session' is imported from electron
    expect(mainSource).toMatch(/import\s*\{[^}]*\bsession\b[^}]*\}\s*from\s*'electron'/);
  });
});

describe('m15: the clipboard carve-out is origin-bound (review windows__crossfe 3)', () => {
  it('isTrustedRequesterUrl table — local app doc and dev server only', () => {
    expect(isTrustedRequesterUrl('app://-/app/settings')).toBe(true);
    expect(isTrustedRequesterUrl('app://evil-host/app/x')).toBe(false);
    expect(isTrustedRequesterUrl('http://localhost:5173/')).toBe(true);
    expect(isTrustedRequesterUrl('http://127.0.0.1:8096/')).toBe(true);
    expect(isTrustedRequesterUrl('https://media.example/app')).toBe(false);
    expect(isTrustedRequesterUrl('')).toBe(false);
    expect(isTrustedRequesterUrl(undefined)).toBe(false);
    expect(isTrustedRequesterUrl(42)).toBe(false);
  });

  it('clipboard-sanitized-write is granted to the app document and denied to a hostile page', () => {
    const verdicts: Array<[string, boolean]> = [];
    const fakeSession = {
      setPermissionRequestHandler: (h: (c: unknown, p: string, cb: (g: boolean) => void) => void) => {
        h({ getURL: () => 'app://-/app' }, 'clipboard-sanitized-write', (g) => verdicts.push(['request-local', g]));
        h({ getURL: () => 'https://evil.example/pwned' }, 'clipboard-sanitized-write', (g) => verdicts.push(['request-hostile', g]));
        h({}, 'clipboard-sanitized-write', (g) => verdicts.push(['request-urlless', g]));
      },
      setPermissionCheckHandler: (h: (c: unknown, p: string) => boolean) => {
        verdicts.push(['check-local', h({ getURL: () => 'app://-/' }, 'clipboard-sanitized-write')]);
        verdicts.push(['check-hostile', h({ getURL: () => 'https://evil.example/' }, 'clipboard-sanitized-write')]);
      }
    };
    installPermissionGuard(fakeSession);
    const map = new Map(verdicts);
    expect(map.get('request-local')).toBe(true);
    expect(map.get('request-hostile')).toBe(false);
    expect(map.get('request-urlless')).toBe(false); // structural fallback fails closed
    expect(map.get('check-local')).toBe(true);
    expect(map.get('check-hostile')).toBe(false);
  });
});
