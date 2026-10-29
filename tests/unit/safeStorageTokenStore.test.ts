/**
 * M-WINDOWS-11 — SafeStorageTokenStore adapter pins.
 *
 * The adapter is the windows-side implementation of @phlix/ui's TokenStore
 * contract over the DPAPI vault bridge. Layering law proved here: THIS layer
 * adds no crypto (main seals the bytes; see src/main/secretStore.ts) — it
 * maps the ui contract onto the vault channels with namespaced keys, JSON
 * for the user object, and fail-fast construction when the bridge is absent.
 *
 * Wiring status: createPhlixApp v0.99.10 hardcodes LocalStorageTokenStore;
 * this class goes live the moment the upstream tokenStore seam lands
 * (v0.99.12-wave rider, recorded in the M-WINDOWS-11 fixlog).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { TokenStore } from '@phlix/ui';
import {
  SafeStorageTokenStore,
  VAULT_KEY_ACCESS_TOKEN,
  VAULT_KEY_REFRESH_TOKEN,
  VAULT_KEY_USER
} from '../../src/renderer/safeStorageTokenStore';

type VaultBridge = NonNullable<Window['electronAPI']>;

function makeVaultBridge(): { rows: Map<string, string>; api: VaultBridge } {
  const rows = new Map<string, string>();
  const api = {
    vaultGet: (key: string) => rows.get(key) ?? null,
    vaultSet: (key: string, value: string) => {
      rows.set(key, value);
      return true;
    },
    vaultDelete: (key: string) => rows.delete(key),
    vaultIsAvailable: () => true
  };
  return { rows, api: api as unknown as VaultBridge };
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('SafeStorageTokenStore (ui TokenStore over the vault bridge)', () => {
  it('satisfies the @phlix/ui TokenStore contract (compile-time + runtime)', () => {
    const { api } = makeVaultBridge();
    const store: TokenStore = new SafeStorageTokenStore(api);
    for (const method of ['getAccessToken', 'setAccessToken', 'getRefreshToken', 'setRefreshToken', 'getUser', 'setUser', 'clear']) {
      expect(typeof (store as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it('round-trips access + refresh tokens through the namespaced vault keys, values passed through untouched', () => {
    const { rows, api } = makeVaultBridge();
    const store = new SafeStorageTokenStore(api);

    store.setAccessToken('access.tok-abc');
    store.setRefreshToken('refresh.tok-def');

    // This layer forwards; the sealing happens in main (secretStore.ts).
    expect(rows.get(VAULT_KEY_ACCESS_TOKEN)).toBe('access.tok-abc');
    expect(rows.get(VAULT_KEY_REFRESH_TOKEN)).toBe('refresh.tok-def');
    expect(store.getAccessToken()).toBe('access.tok-abc');
    expect(store.getRefreshToken()).toBe('refresh.tok-def');
    // Keys are ui.* namespaced — no collision with main's own custody rows.
    expect([...rows.keys()].every((k) => k.startsWith('ui.'))).toBe(true);
  });

  it('round-trips the user object via JSON and answers null for absent/corrupt rows', () => {
    const { rows, api } = makeVaultBridge();
    const store = new SafeStorageTokenStore(api);

    expect(store.getUser()).toBeNull();
    store.setUser({ id: 'u1', username: 'kumar' });
    expect(rows.get(VAULT_KEY_USER)).toBe('{"id":"u1","username":"kumar"}');
    expect(store.getUser()).toEqual({ id: 'u1', username: 'kumar' });

    rows.set(VAULT_KEY_USER, 'not-json{');
    expect(store.getUser()).toBeNull(); // corrupt row = re-login condition, not a crash
  });

  it('setUser(null/undefined) deletes the row; clear() wipes all three keys', () => {
    const { rows, api } = makeVaultBridge();
    const store = new SafeStorageTokenStore(api);

    store.setUser({ id: 'u1' });
    store.setUser(null);
    expect(rows.has(VAULT_KEY_USER)).toBe(false);
    store.setUser({ id: 'u2' });
    store.setAccessToken('a');
    store.setRefreshToken('r');

    store.clear();
    expect(rows.size).toBe(0);
    expect(store.getAccessToken()).toBeNull();
    expect(store.getUser()).toBeNull();
  });

  it('a bridge answering a non-string becomes null (never forwarded garbage)', () => {
    const api = {
      vaultGet: vi.fn(() => 42),
      vaultSet: vi.fn(() => true),
      vaultDelete: vi.fn(() => true),
      vaultIsAvailable: vi.fn(() => true)
    } as unknown as VaultBridge;
    const store = new SafeStorageTokenStore(api);
    expect(store.getAccessToken()).toBeNull();
  });

  it('constructor fails fast when the vault bridge is absent (plain browser / gated document)', () => {
    expect(() => new SafeStorageTokenStore({} as VaultBridge)).toThrow(/vault bridge/);
    expect(() => new SafeStorageTokenStore()).toThrow(/vault bridge/); // window.electronAPI undefined in jsdom
    const partial = makeVaultBridge();
    delete (partial.api as unknown as { vaultIsAvailable?: unknown }).vaultIsAvailable;
    expect(() => new SafeStorageTokenStore(partial.api)).toThrow(/vault bridge/);
  });

  it('defaults to window.electronAPI when no bridge is injected (the boot()-time shape)', () => {
    const { rows, api } = makeVaultBridge();
    (window as unknown as { electronAPI: VaultBridge }).electronAPI = api;
    const store = new SafeStorageTokenStore();
    store.setAccessToken('from-window');
    expect(rows.get(VAULT_KEY_ACCESS_TOKEN)).toBe('from-window');
  });
});
