/**
 * @vitest-environment node
 *
 * M-WINDOWS-11 — the preload vault bridge reaches main over the SYNCHRONOUS
 * IPC protocol with the exact channel/payload shapes the vault handlers in
 * src/main/index.ts answer (and the answers pass through untouched).
 *
 * Sync-by-contract: @phlix/ui's TokenStore is synchronous, so the bridge
 * uses ipcRenderer.sendSync — these pins keep it that way (a silent move to
 * invoke would return Promises into a string|null consumer and resurrect the
 * custody bug as a runtime TypeError). The members ride INSIDE
 * electronApiSurface, so the M-WINDOWS-10 trust gate already decides who can
 * hold them — pinned here only for existence on the trusted surface.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const exposeInMainWorld = vi.fn();
const sendSync = vi.fn();

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke: vi.fn(), send: vi.fn(), sendSync, on: vi.fn(), removeListener: vi.fn() }
}));

type ApiSurface = Record<string, (...args: unknown[]) => unknown>;

async function loadTrustedSurface(): Promise<ApiSurface> {
  (globalThis as unknown as { window: { location: { href: string } } }).window = {
    location: { href: 'app://-/app/' }
  };
  (process as unknown as { isMainFrame?: boolean }).isMainFrame = true;
  vi.resetModules();
  await import('../../src/preload/index');
  expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
  return exposeInMainWorld.mock.calls[0][1] as ApiSurface;
}

beforeEach(() => {
  exposeInMainWorld.mockReset();
  sendSync.mockReset();
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (process as unknown as { isMainFrame?: boolean }).isMainFrame;
});

describe('preload vault bridge (M-WINDOWS-11)', () => {
  it('exposes the four vault members on the trusted boot surface', async () => {
    const api = await loadTrustedSurface();
    for (const key of ['vaultGet', 'vaultSet', 'vaultDelete', 'vaultIsAvailable']) {
      expect(typeof api[key], key).toBe('function');
    }
  });

  it('vaultGet sends the exact channel+payload and returns main\'s answer', async () => {
    const api = await loadTrustedSurface();
    sendSync.mockReturnValue('decrypted-value');
    expect(api.vaultGet('ui.access_token')).toBe('decrypted-value');
    expect(sendSync).toHaveBeenCalledWith('vault:get', { key: 'ui.access_token' });
  });

  it('vaultGet passes main\'s null through (absent/refused/rejected alike)', async () => {
    const api = await loadTrustedSurface();
    sendSync.mockReturnValue(null);
    expect(api.vaultGet('ui.nope')).toBeNull();
  });

  it('vaultSet forwards {key,value} and the boolean verdict', async () => {
    const api = await loadTrustedSurface();
    sendSync.mockReturnValue(true);
    expect(api.vaultSet('ui.refresh_token', 'tok')).toBe(true);
    expect(sendSync).toHaveBeenCalledWith('vault:set', { key: 'ui.refresh_token', value: 'tok' });
  });

  it('vaultDelete forwards {key} and the boolean verdict', async () => {
    const api = await loadTrustedSurface();
    sendSync.mockReturnValue(true);
    expect(api.vaultDelete('ui.user')).toBe(true);
    expect(sendSync).toHaveBeenCalledWith('vault:delete', { key: 'ui.user' });
  });

  it('vaultIsAvailable sends its channel with no payload', async () => {
    const api = await loadTrustedSurface();
    sendSync.mockReturnValue(false);
    expect(api.vaultIsAvailable()).toBe(false);
    expect(sendSync).toHaveBeenCalledWith('vault:is-available');
  });
});
