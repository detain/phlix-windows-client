/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import type { TokenStore } from '@phlix/ui';

/**
 * M-WINDOWS-11 — DPAPI-backed TokenStore adapter.
 *
 * What it cures: @phlix/ui's shipped `LocalStorageTokenStore` keeps the
 * access token, refresh token and user object as PLAINTEXT renderer
 * localStorage under the `app://` origin. This class is the windows-side
 * custody endpoint: identical sync contract, but every value is routed
 * through `window.electronAPI.vault*` into main-process safeStorage (DPAPI
 * on Windows) custody — sealed with the `dpapi:v1:` envelope in
 * secrets.json (src/main/secretStore.ts + the vault channels in
 * src/main/index.ts).
 *
 * Wiring status (honest): @phlix/ui v0.99.10's `createPhlixApp` hardcodes
 * `LocalStorageTokenStore` — `PhlixAppConfig` exposes no tokenStore seam
 * yet. This adapter therefore SHIPS UNUSED: it compiles, is unit-pinned,
 * and awaits the v0.99.12-wave rider that threads `config.tokenStore`
 * through client construction. The moment that seam lands, boot() passes
 * `new SafeStorageTokenStore()` and tokens stop touching localStorage.
 * Vendored ui files are not edited (thin-consumer law).
 *
 * The vault VALUES are already encrypted at rest by main; this layer adds
 * no crypto of its own and never logs values (Fail Fast on a missing
 * bridge: constructing outside a trusted Electron boot is a wiring bug,
 * not a runtime condition to swallow).
 */

/** Vault key for the bearer access token (guard-safe charset, `ui.` namespaced). */
export const VAULT_KEY_ACCESS_TOKEN = 'ui.access_token';
/** Vault key for the refresh token. */
export const VAULT_KEY_REFRESH_TOKEN = 'ui.refresh_token';
/** Vault key for the JSON-serialised user object. */
export const VAULT_KEY_USER = 'ui.user';

type ElectronApi = NonNullable<Window['electronAPI']>;

function hasVaultBridge(api: Window['electronAPI'] | undefined): api is ElectronApi {
  return (
    !!api &&
    typeof api.vaultGet === 'function' &&
    typeof api.vaultSet === 'function' &&
    typeof api.vaultDelete === 'function' &&
    typeof api.vaultIsAvailable === 'function'
  );
}

export class SafeStorageTokenStore implements TokenStore {
  private readonly vault: ElectronApi;

  /**
   * @param electronAPI injectable for tests; defaults to the live
   *        `window.electronAPI`. Fail-fast when the vault bridge is absent
   *        (plain-browser dev, or a document the preload trust gate excluded).
   */
  constructor(electronAPI?: Window['electronAPI']) {
    const api = electronAPI ?? (typeof window !== 'undefined' ? window.electronAPI : undefined);
    if (!hasVaultBridge(api)) {
      throw new Error(
        'SafeStorageTokenStore requires the M-WINDOWS-11 vault bridge (window.electronAPI.vault*)'
      );
    }
    this.vault = api;
  }

  private readString(key: string): string | null {
    const value = this.vault.vaultGet(key);
    return typeof value === 'string' ? value : null;
  }

  getAccessToken(): string | null {
    return this.readString(VAULT_KEY_ACCESS_TOKEN);
  }

  setAccessToken(token: string): void {
    this.vault.vaultSet(VAULT_KEY_ACCESS_TOKEN, token);
  }

  getRefreshToken(): string | null {
    return this.readString(VAULT_KEY_REFRESH_TOKEN);
  }

  setRefreshToken(token: string): void {
    this.vault.vaultSet(VAULT_KEY_REFRESH_TOKEN, token);
  }

  getUser(): unknown | null {
    const raw = this.readString(VAULT_KEY_USER);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      // A corrupt user row must not crash boot — it is a re-login condition.
      return null;
    }
  }

  setUser(user: unknown): void {
    if (user === null || user === undefined) {
      this.vault.vaultDelete(VAULT_KEY_USER);
      return;
    }
    this.vault.vaultSet(VAULT_KEY_USER, JSON.stringify(user));
  }

  clear(): void {
    this.vault.vaultDelete(VAULT_KEY_ACCESS_TOKEN);
    this.vault.vaultDelete(VAULT_KEY_REFRESH_TOKEN);
    this.vault.vaultDelete(VAULT_KEY_USER);
  }
}
