/**
 * M-WINDOWS-22 (minor, windows__gameux): SMTC depth. The vendored ui store
 * feeds playbackState (playing/paused), positionState and metadata itself —
 * bundle-verified at v0.99.10 — but it NEVER clears to 'none' when playback
 * stops, so the taskbar thumbnail kept a stale paused tile forever. The shell
 * owns exactly that gap: the bridge's no-media arm clears the transport.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { clearMediaSessionTransport } from '../../src/renderer/mediaSession';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function stubMediaSession(): { playbackState: string; setPositionState: ReturnType<typeof vi.fn> } {
  const ms = { playbackState: 'playing', setPositionState: vi.fn() };
  Object.defineProperty(globalThis.navigator, 'mediaSession', { configurable: true, value: ms });
  return ms;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'mediaSession');
});

describe('stop clears the SMTC transport (M-WINDOWS-22)', () => {
  it('sets playbackState none and clears positionState', () => {
    const ms = stubMediaSession();
    clearMediaSessionTransport();
    expect(ms.playbackState).toBe('none');
    expect(ms.setPositionState).toHaveBeenCalledTimes(1);
    expect(ms.setPositionState).toHaveBeenCalledWith();
  });

  it('is a silent no-op where navigator.mediaSession does not exist', () => {
    expect(() => clearMediaSessionTransport()).not.toThrow();
  });

  it('the bridge calls the clear in its no-media arm (wiring pin)', () => {
    const bridge = readFileSync(resolve(root, 'src/renderer/electronBridge.ts'), 'utf-8');
    expect(bridge).toMatch(/import \{[^}]*clearMediaSessionTransport[^}]*\} from '\.\/mediaSession'/);
    const arm = bridge.slice(bridge.indexOf('if (!current) {'), bridge.indexOf('if (!current) {') + 400);
    expect(arm).toContain('clearMediaSessionTransport();');
  });
});
