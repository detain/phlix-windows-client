/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import log from 'electron-log';

/**
 * M-WINDOWS-11 — safeStorage-backed custody for persisted secrets.
 *
 * Root cause (review windows__exploiter MAJOR-11): everything the app
 * persists to disk sat in plaintext — the stable install identifier
 * (`deviceId`, echoed on the wire as `X-Phlix-Device-ID`) and the auth
 * endpoints (`serverUrl`/`hubUrl`, which the ApiClient auto-attaches
 * bearer tokens to) lived raw in electron-store's `config.json`, and the
 * estate audit recorded that `safeStorage` (DPAPI on Windows) was never
 * imported anywhere in main, preload, or renderer.
 *
 * This module is the single custody protocol for any secret written to a
 * key/value settings sink:
 *
 *   - `write()` seals with safeStorage and stores an envelope string
 *     (`dpapi:v1:` + base64 ciphertext) under the same key;
 *   - `read()` opens envelopes, and transparently migrates pre-fix
 *     plaintext rows (verify-after-write: the sealed value is decrypted
 *     back before the plaintext is dropped, and rolled back if that
 *     verification fails — a stored secret is NEVER orphaned);
 *   - a ciphertext that will not decrypt (key rotation, machine move) is
 *     KEPT on disk and reported missing — silent destruction of a user's
 *     credential is worse than a forced re-login;
 *   - when OS encryption is unavailable (non-Windows dev, locked-down
 *     keychain), writes degrade to plaintext ONCE with a disclosed
 *     warning — availability is re-armed per custody instance, never
 *     silent, and the value is still readable (forward-compatible with a
 *     later migration when the keychain comes back);
 *   - nothing on any path logs a secret VALUE; only guard-passed key
 *     names appear in log lines.
 *
 * The envelope prefix is content-addressed versioning: a future crypto
 * change (e.g. per-app salt) ships as `dpapi:v2:` and reads stay open
 * to v1 rows.
 *
 * Pure module: `safeStorage` and the settings sink are injected, so the
 * whole protocol is unit-testable without Electron (see
 * tests/unit/secretStore.test.ts) and the Electron wiring itself is
 * pinned against REAL electron-store bytes in
 * tests/unit/mainSecretCustody.test.ts.
 */

/** Envelope marker: `dpapi:v1:` + base64(safeStorage ciphertext). */
export const ENVELOPE_PREFIX = 'dpapi:v1:';

/** Keys are logged on degradation paths — only inert shapes may ever reach a log line. */
const KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** 64 KiB ceiling: real secrets (JWTs, UUIDs, URLs) are far under; oversized blobs are a misuse signal. */
export const MAX_SECRET_VALUE_LENGTH = 64 * 1024;

/** The slice of Electron's `safeStorage` this protocol needs (injectable for tests). */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** Key/value persistence this custody writes through (electron-store is structurally compatible). */
export interface SettingsSink {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface SecretCustody {
  /** Decrypted value, or null when absent/undecryptable. Migrates legacy plaintext rows in place. */
  read(key: string): string | null;
  /** Seals and persists `value` (null removes the key). Plaintext fallback is disclosed, never silent. */
  write(key: string, value: string | null): void;
  /** Removes the stored row (envelope or plaintext alike). */
  remove(key: string): void;
  /** Whether writes will be sealed (fail-closed: any throw reads as unavailable). */
  isEncryptionAvailable(): boolean;
}

function assertKey(key: string): void {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    // The raw key is deliberately NOT echoed: it is caller-controlled and
    // log lines must not carry untrusted shapes.
    throw new Error('custody rejected a key failing ^[A-Za-z0-9._-]{1,64}$');
  }
}

function assertValue(key: string, value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`custody write for "${key}" requires a string value`);
  }
  if (value.length > MAX_SECRET_VALUE_LENGTH) {
    throw new Error(`custody write for "${key}" exceeds the ${MAX_SECRET_VALUE_LENGTH}-char ceiling`);
  }
}

export function createSecretCustody(deps: {
  safeStorage: SafeStorageLike;
  settings: SettingsSink;
}): SecretCustody {
  const { safeStorage, settings } = deps;
  let fallbackDisclosed = false;

  const encryptionAvailable = (): boolean => {
    try {
      return safeStorage.isEncryptionAvailable() === true;
    } catch {
      return false; // fail-closed: an unreadable availability answer is "no crypto"
    }
  };

  const discloseFallback = (context: string): void => {
    if (fallbackDisclosed) {
      return;
    }
    fallbackDisclosed = true;
    log.warn(`[custody] OS encryption unavailable (${context}) — affected secrets persist as PLAINTEXT in the settings file; disclosed once per custody instance`);
  };

  const seal = (plain: string): string =>
    ENVELOPE_PREFIX + safeStorage.encryptString(plain).toString('base64');

  const open = (envelope: string): string =>
    safeStorage.decryptString(Buffer.from(envelope.slice(ENVELOPE_PREFIX.length), 'base64'));

  const migrateToEnvelope = (key: string, plain: string): void => {
    if (!encryptionAvailable()) {
      discloseFallback(`legacy plaintext row "${key}"`);
      return;
    }
    let sealed: string;
    try {
      sealed = seal(plain);
    } catch {
      discloseFallback(`encrypt failed while migrating "${key}"`);
      log.warn(`[custody] migration of "${key}" left the row plaintext (encrypt threw)`);
      return;
    }
    settings.set(key, sealed);
    // Verify-after-write, never-orphan law: only replace the plaintext once
    // the envelope demonstrably opens back to the SAME value.
    try {
      if (open(sealed) === plain) {
        log.info(`[custody] migrated "${key}" from plaintext to encrypted custody`);
        return;
      }
    } catch {
      // fall through to rollback
    }
    settings.set(key, plain);
    log.warn(`[custody] migration verify failed for "${key}" — rolled back to plaintext (never orphan)`);
  };

  const read = (key: string): string | null => {
    assertKey(key);
    const raw = settings.get(key);
    if (raw === undefined || raw === null) {
      return null;
    }
    if (typeof raw !== 'string') {
      log.warn(`[custody] "${key}" holds a non-string value — treated as missing`);
      return null;
    }
    if (!raw.startsWith(ENVELOPE_PREFIX)) {
      // Pre-M11 row (or disclosed plaintext fallback): serve it now, seal it on the side.
      migrateToEnvelope(key, raw);
      return raw;
    }
    try {
      return open(raw);
    } catch {
      log.warn(`[custody] decrypt failed for "${key}" — ciphertext KEPT, value reported missing`);
      return null;
    }
  };

  const write = (key: string, value: string | null): void => {
    assertKey(key);
    if (value === null) {
      settings.delete(key);
      return;
    }
    assertValue(key, value);
    if (!encryptionAvailable()) {
      discloseFallback(`write to "${key}"`);
      settings.set(key, value);
      return;
    }
    try {
      settings.set(key, seal(value));
    } catch {
      discloseFallback(`encrypt threw for "${key}"`);
      log.warn(`[custody] write of "${key}" fell back to plaintext (encrypt threw)`);
      settings.set(key, value);
    }
  };

  const remove = (key: string): void => {
    assertKey(key);
    settings.delete(key);
  };

  return { read, write, remove, isEncryptionAvailable: encryptionAvailable };
}
