/**
 * @vitest-environment node
 *
 * M-WINDOWS-11 — pure protocol pins for src/main/secretStore.ts.
 *
 * The custody rules under test (each a deliberate answer to review
 * windows__exploiter MAJOR-11's plaintext-at-rest finding):
 *   1. sealed writes carry the dpapi:v1: envelope; the plaintext never
 *      reaches the sink;
 *   2. legacy plaintext rows migrate on read and the value SURVIVES
 *      (verify-after-write, rollback on failed verification — never-orphan);
 *   3. an undecryptable envelope is KEPT and reported missing (no silent
 *      destruction of credentials);
 *   4. unavailable encryption degrades to plaintext with exactly ONE
 *      disclosed warning per custody instance — and re-armed encryption
 *      re-seals the row on the next read;
 *   5. key/value guards fail fast, and neither rejected shapes nor secret
 *      VALUES ever reach a log line.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import log from 'electron-log';
import {
  createSecretCustody,
  ENVELOPE_PREFIX,
  MAX_SECRET_VALUE_LENGTH,
  type SafeStorageLike,
  type SettingsSink
} from '../../src/main/secretStore';

vi.mock('electron-log', () => ({
  default: {
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

type Mock = ReturnType<typeof vi.fn>;
const logMock = log as unknown as { info: Mock; warn: Mock; error: Mock };

// ---------------------------------------------------------------------------
// Deterministic reversible fake: XOR + marker. Decrypting foreign bytes
// throws, so the tests can distinguish "envelope I made" from corruption.
// ---------------------------------------------------------------------------
const XOR_KEY = 0x2b;
const PREFIX = 'FAKECUSTODY:';

interface FakeOptions {
  available?: boolean;
  failEncrypt?: boolean;
  failDecrypt?: boolean;
}

function makeFakeSafeStorage(options: FakeOptions = {}): SafeStorageLike {
  return {
    isEncryptionAvailable: () => {
      if (options.available === false) {
        return false;
      }
      return true;
    },
    encryptString: (plain: string) => {
      if (options.available === false || options.failEncrypt) {
        throw new Error('fake: encryption unavailable');
      }
      const raw = Buffer.from(PREFIX + plain, 'utf8');
      return Buffer.from(raw.map((b) => b ^ XOR_KEY));
    },
    decryptString: (buf: Buffer) => {
      if (options.failDecrypt) {
        throw new Error('fake: decrypt failed');
      }
      const opened = Buffer.from(buf.map((b) => b ^ XOR_KEY)).toString('utf8');
      if (!opened.startsWith(PREFIX)) {
        throw new Error('fake: foreign ciphertext');
      }
      return opened.slice(PREFIX.length);
    }
  };
}

function makeSink(initial: Record<string, unknown> = {}): SettingsSink & { rows: Map<string, unknown> } {
  const rows = new Map<string, unknown>(Object.entries(initial));
  return {
    rows,
    get: (key: string) => rows.get(key),
    set: (key: string, value: unknown) => rows.set(key, value),
    delete: (key: string) => rows.delete(key)
  };
}

const SECRET = 'sk-live-9f8e7d6c5b4a3f2e1d0c-windows-custody';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sealed round-trips', () => {
  it('write seals with the dpapi:v1: envelope and the plaintext never reaches the sink', () => {
    const sink = makeSink();
    const custody = createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink });

    custody.write('deviceId', SECRET);

    const raw = sink.rows.get('deviceId');
    expect(typeof raw).toBe('string');
    expect((raw as string).startsWith(ENVELOPE_PREFIX)).toBe(true);
    expect(raw as string).not.toContain(SECRET);
    expect(custody.read('deviceId')).toBe(SECRET);
  });

  it('serialised sink contents contain zero plaintext copies of the secret', () => {
    const sink = makeSink();
    const custody = createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink });
    custody.write('serverUrl', SECRET);
    custody.write('ui.user', `user-${SECRET}`);
    expect(JSON.stringify([...sink.rows])).not.toContain(SECRET);
  });

  it('read of an absent row answers null without touching the sink', () => {
    const sink = makeSink();
    const custody = createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink });
    expect(custody.read('deviceId')).toBeNull();
    expect(sink.rows.size).toBe(0);
  });
});

describe('plaintext migration (never-orphan law)', () => {
  it('a legacy plaintext row is served AND re-sealed in place on read', () => {
    const sink = makeSink({ deviceId: SECRET });
    const custody = createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink });

    expect(custody.read('deviceId')).toBe(SECRET); // value served intact…
    const raw = sink.rows.get('deviceId') as string;
    expect(raw.startsWith(ENVELOPE_PREFIX)).toBe(true); // …and now sealed
    expect(raw).not.toContain(SECRET);
    expect(custody.read('deviceId')).toBe(SECRET); // envelope opens back to the SAME value
  });

  it('migration ROLLS BACK to plaintext when the sealed value fails verification', () => {
    const sink = makeSink({ deviceId: SECRET });
    // Encrypt "succeeds" (a real Buffer goes to the sink) but the
    // verify-after-write decrypt throws → the rollback must restore the
    // plaintext. A stored secret is never orphaned by a half-good migration.
    const hostile: SafeStorageLike = {
      isEncryptionAvailable: () => true,
      encryptString: (plain: string) => Buffer.from(PREFIX + plain, 'utf8'),
      decryptString: () => {
        throw new Error('fake: verify-after-write decrypt failed');
      }
    };
    const custody = createSecretCustody({ safeStorage: hostile, settings: sink });

    expect(custody.read('deviceId')).toBe(SECRET); // never orphaned
    expect(sink.rows.get('deviceId')).toBe(SECRET); // rollback persisted
  });

  it('an undecryptable persisted envelope is KEPT and reported missing', () => {
    const writable = makeFakeSafeStorage();
    const sink = makeSink();
    createSecretCustody({ safeStorage: writable, settings: sink }).write('ui.access_token', SECRET);
    const sealed = sink.rows.get('ui.access_token') as string;

    const custody = createSecretCustody({ safeStorage: makeFakeSafeStorage({ failDecrypt: true }), settings: sink });
    expect(custody.read('ui.access_token')).toBeNull();
    expect(sink.rows.get('ui.access_token')).toBe(sealed); // ciphertext preserved
    expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining('ui.access_token'));
  });
});

describe('disclosed plaintext fallback', () => {
  it('unavailable encryption stores plaintext but warns EXACTLY once per instance', () => {
    const sink = makeSink();
    const custody = createSecretCustody({
      safeStorage: makeFakeSafeStorage({ available: false }),
      settings: sink
    });

    custody.write('deviceId', SECRET);
    custody.write('serverUrl', 'https://x.test');

    expect(sink.rows.get('deviceId')).toBe(SECRET);
    expect(custody.read('deviceId')).toBe(SECRET);
    const custodyWarns = logMock.warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('[custody]'));
    expect(custodyWarns).toHaveLength(1);
    expect(String(custodyWarns[0][0])).not.toContain(SECRET); // disclosure names the problem, never the value
  });

  it('re-armed encryption re-seals a fallback plaintext row on next read', () => {
    const sink = makeSink({ serverUrl: SECRET });
    let available = false;
    const base = makeFakeSafeStorage();
    const custody = createSecretCustody({
      safeStorage: {
        isEncryptionAvailable: () => available,
        encryptString: (plain: string) => {
          if (!available) {
            throw new Error('unavailable');
          }
          return base.encryptString(plain);
        },
        decryptString: (buf: Buffer) => base.decryptString(buf)
      },
      settings: sink
    });

    expect(custody.read('serverUrl')).toBe(SECRET);
    expect(sink.rows.get('serverUrl')).toBe(SECRET); // still plaintext, migration skipped
    available = true;
    expect(custody.read('serverUrl')).toBe(SECRET);
    expect((sink.rows.get('serverUrl') as string).startsWith(ENVELOPE_PREFIX)).toBe(true);
  });

  it('an availability probe that THROWS is treated as unavailable (fail closed)', () => {
    const sink = makeSink();
    const custody = createSecretCustody({
      safeStorage: {
        isEncryptionAvailable: () => {
          throw new Error('keychain daemon dead');
        },
        encryptString: () => {
          throw new Error('nope');
        },
        decryptString: () => {
          throw new Error('nope');
        }
      },
      settings: sink
    });
    expect(custody.isEncryptionAvailable()).toBe(false);
    custody.write('deviceId', SECRET);
    expect(sink.rows.get('deviceId')).toBe(SECRET); // disclosed fallback, app keeps working
  });
});

describe('guards (fail fast, log hygiene)', () => {
  const custodyFor = (sink: SettingsSink) =>
    createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink });

  it.each(['', 'has spaces', 'bad/key', 'bad:key', 'emoji-🔐', 'x'.repeat(65)])('rejects key %p on read and write', (key) => {
    const custody = custodyFor(makeSink());
    expect(() => custody.read(key)).toThrow(/custody rejected a key/);
    expect(() => custody.write(key, 'v')).toThrow(/custody rejected a key/);
    expect(() => custody.remove(key)).toThrow(/custody rejected a key/);
  });

  it('never echoes a rejected key into the thrown message (keys are caller-controlled)', () => {
    const custody = custodyFor(makeSink());
    const hostileKey = 'super-duper-sensitive-probe key!';
    expect.assertions(2);
    try {
      custody.write(hostileKey, 'v');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain('super-duper');
    }
  });

  it('rejects non-string values and values over the 64 KiB ceiling', () => {
    const custody = custodyFor(makeSink());
    expect(() => custody.write('deviceId', 42 as unknown as string)).toThrow(/requires a string value/);
    expect(() => custody.write('deviceId', { token: 'x' } as unknown as string)).toThrow(/requires a string value/);
    expect(() => custody.write('deviceId', 'x'.repeat(MAX_SECRET_VALUE_LENGTH + 1))).toThrow(/ceiling/);
    expect(() => custody.write('deviceId', 'x'.repeat(MAX_SECRET_VALUE_LENGTH))).not.toThrow(); // at-ceiling is fine
  });

  it('write(null) removes the row; remove() clears envelopes alike', () => {
    const sink = makeSink();
    const custody = custodyFor(sink);
    custody.write('hubUrl', SECRET);
    expect(sink.rows.has('hubUrl')).toBe(true);
    custody.write('hubUrl', null);
    expect(sink.rows.has('hubUrl')).toBe(false);
    custody.write('hubUrl', SECRET);
    custody.remove('hubUrl');
    expect(sink.rows.has('hubUrl')).toBe(false);
  });

  it('a non-string persisted value is treated as missing with a key-named warning', () => {
    const sink = makeSink({ deviceId: { nested: true } });
    const custody = custodyFor(sink);
    expect(custody.read('deviceId')).toBeNull();
    expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining('deviceId'));
    expect(logMock.warn).not.toHaveBeenCalledWith(expect.stringContaining('nested'));
  });
});

describe('no secret values ever reach the logger', () => {
  it('every log call across the full lifecycle is value-free', () => {
    const sink = makeSink();
    const custody = createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink });
    custody.write('ui.refresh_token', SECRET);
    custody.read('ui.refresh_token');
    custody.remove('ui.refresh_token');
    // undecryptable leg too:
    const sink2 = makeSink();
    createSecretCustody({ safeStorage: makeFakeSafeStorage(), settings: sink2 }).write('ui.user', SECRET);
    createSecretCustody({ safeStorage: makeFakeSafeStorage({ failDecrypt: true }), settings: sink2 }).read('ui.user');

    const allMessages = [...logMock.info.mock.calls, ...logMock.warn.mock.calls, ...logMock.error.mock.calls]
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(allMessages).not.toContain(SECRET);
  });
});
