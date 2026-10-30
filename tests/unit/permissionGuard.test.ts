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
import { allowPermission, installPermissionGuard } from '../../src/main/permissionGuard';

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
