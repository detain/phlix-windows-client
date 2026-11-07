import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
// Using relative path because @ alias points to src/renderer/, not src/main/
import { parseServerVersion, checkMinServerVersion, detectHubShapedBase, MIN_SERVER_VERSION } from '../../src/main/versionCheck';
import log from 'electron-log';

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('parseServerVersion', () => {
  it('parses "1.2.3" correctly', () => {
    const result = parseServerVersion('1.2.3');
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses "1.1.0" correctly', () => {
    const result = parseServerVersion('1.1.0');
    expect(result).toEqual({ major: 1, minor: 1, patch: 0 });
  });

  it('parses "0.9.0" correctly', () => {
    const result = parseServerVersion('0.9.0');
    expect(result).toEqual({ major: 0, minor: 9, patch: 0 });
  });

  it('parses "10.20.30" correctly', () => {
    const result = parseServerVersion('10.20.30');
    expect(result).toEqual({ major: 10, minor: 20, patch: 30 });
  });

  it('returns null for malformed version strings', () => {
    expect(parseServerVersion('1.2')).toBeNull();
    expect(parseServerVersion('1')).toBeNull();
    expect(parseServerVersion('v1.2.3')).toBeNull();
    expect(parseServerVersion('1.2.3.4')).toBeNull();
    expect(parseServerVersion('')).toBeNull();
    expect(parseServerVersion('abc')).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(parseServerVersion(null as unknown as string)).toBeNull();
    expect(parseServerVersion(undefined as unknown as string)).toBeNull();
    expect(parseServerVersion(123 as unknown as string)).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    const result = parseServerVersion('  1.2.3  ');
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
  });
});

describe('checkMinServerVersion', () => {
  const { fetch } = window;
  let fetchSpy: Mock;

  beforeEach(() => {
    fetchSpy = vi.fn();
    (window as unknown as { fetch: typeof fetch }).fetch = fetchSpy;
    vi.clearAllMocks();
  });

  afterEach(() => {
    (window as unknown as { fetch: typeof fetch }).fetch = fetch;
  });

  it('returns compatible:true (skip check) when apiBase is empty string', async () => {
    const result = await checkMinServerVersion('');
    expect(result.compatible).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns compatible:true when server version is 1.2.3 (above minimum 1.1.0)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.2.3' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
  });

  it('returns compatible:true when server version is exactly 1.1.0', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.1.0' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
  });

  it('returns compatible:false when server version is 0.9.0 (below minimum 1.1.0)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.9.0' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(false);
    expect(log.error).toHaveBeenCalledWith(
      '[versionCheck] Server version 0.9.0 is below minimum supported 1.1.0 — blocking boot'
    );
  });

  it('returns compatible:false when server version is 1.0.9 (below minimum 1.1.0)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.9' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(false);
  });

  it('returns compatible:true when server version is 2.0.0 (major version above minimum)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '2.0.0' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
  });

  it('returns compatible:true (fail-open) on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not reach version endpoint')
    );
  });

  it('returns compatible:true (fail-open) on HTTP error (404, 500, etc.)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 404')
    );
  });

  it('returns compatible:true (fail-open) when response has no version field', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      '[versionCheck] Server response missing version field — allowing boot to continue'
    );
  });

  it('returns compatible:true (fail-open) when response has malformed JSON', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error('parse error'); }
    } as unknown as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      '[versionCheck] Server returned non-JSON response for version endpoint — allowing boot to continue'
    );
  });

  it('returns compatible:true (fail-open) when version field is empty string', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      '[versionCheck] Server response missing version field — allowing boot to continue'
    );
  });

  it('handles version nested under "data" field', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { version: '1.2.3' } })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
  });

  it('strips trailing slash from apiBase before building URL', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.1.0' })
    } as Response);

    await checkMinServerVersion('http://localhost:8096/');
    expect(fetchSpy).toHaveBeenCalledWith(
      // W2: re-targeted from the nonexistent /api/v1/server/version to the
      // real root endpoint (phlix-server/src/Server/Core/Application.php:256).
      'http://localhost:8096/system/info',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('reads the top-level version field of the real /system/info payload', async () => {
    // Shape served by phlix-server Application.php:256-266 (server is a NAME
    // string; version is top-level). The handler at master 20d37f53 serves
    // exactly {server, version} — the php_version/workerman_version keys here
    // are the 9a805a66-era superset (since dropped for stack-fingerprint
    // reasons), kept deliberately: the parser must tolerate unknown
    // top-level keys.
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        server: 'Phlix Media Server',
        version: '1.2.3',
        php_version: '8.3.6',
        workerman_version: '4.1.0'
      })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.info).toHaveBeenCalledWith('[versionCheck] Server reports version: 1.2.3');
  });

  // Law (windows__secnet 2[m], MW-090): the raw server version never reaches
  // the log file. A hostile server forging electron-log lines with embedded
  // newlines — or shoving an unbounded payload into the app-data log dir —
  // must land only as a length summary; every logged argument stays
  // newline-free and free of the injected token. Fail-open VERDICT is
  // unchanged (this is a log sanitizer, not a gate). Red on the parent: the
  // raw interpolations echo both payloads.
  it('logs an unforged line summary for a newline-bearing hostile version, verdict still fail-open', async () => {
    const hostile = '1.0.0\n[versionCheck] FORGED LINE attacker@example.com';
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: hostile })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);

    const allArgs = [
      ...vi.mocked(log.info).mock.calls,
      ...vi.mocked(log.warn).mock.calls,
      ...vi.mocked(log.error).mock.calls
    ]
      .flat()
      .filter((a): a is string => typeof a === 'string');
    for (const arg of allArgs) {
      expect(arg, `log line escaped newline-free law: ${JSON.stringify(arg)}`).not.toContain('\n');
      expect(arg).not.toContain('FORGED');
    }
    expect(log.info).toHaveBeenCalledWith(
      `[versionCheck] Server reports version: <unverifiable version, length=${hostile.length}>`
    );
  });

  it('caps over-length parsable-shaped versions to a length summary (reject-not-truncate)', async () => {
    const huge = `${'9'.repeat(40)}.0.0`; // matches X.Y.Z but blows past the 32-char log cap
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: huge })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.info).toHaveBeenCalledWith(
      `[versionCheck] Server reports version: <unverifiable version, length=${huge.length}>`
    );
    const infos = vi.mocked(log.info).mock.calls.map((c) => String(c[0]));
    expect(infos.some((line) => line.includes('9'.repeat(40)))).toBe(false);
  });

  it('warns that enforcement is INACTIVE when the endpoint is unreachable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('enforcement INACTIVE')
    );
  });

  it('warns that enforcement is INACTIVE on a non-OK response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('/system/info — min-server-version enforcement INACTIVE')
    );
  });

  // M-WINDOWS-02: the verdict is a structured ServerVersionCheck so the
  // user-facing surfaces (main-process dialog + renderer screen) can NAME the
  // versions behind a block. These toEqual pins prove all three fields ride
  // from the probe to the IPC boundary; drop any field or leak a wrong value
  // in src/main/versionCheck.ts and exactly these go red.
  it('returns the full verdict shape when blocking a too-old server', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.9.0' })
    } as Response);

    expect(await checkMinServerVersion('http://localhost:8096'))
      .toEqual({ compatible: false, serverVersion: '0.9.0', minimumVersion: MIN_SERVER_VERSION });
  });

  it('returns the fail-open verdict shape (serverVersion null) on HTTP 404', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    expect(await checkMinServerVersion('http://localhost:8096'))
      .toEqual({ compatible: true, serverVersion: null, minimumVersion: MIN_SERVER_VERSION });
  });

  it('captures the reported version when the server satisfies the gate', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.2.3' })
    } as Response);

    const result = await checkMinServerVersion('http://localhost:8096');
    expect(result.compatible).toBe(true);
    expect(result.serverVersion).toBe('1.2.3');
    expect(result.minimumVersion).toBe(MIN_SERVER_VERSION);
  });

  it('fails open but keeps the raw string when the version is present yet unparseable', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: 'v1.2.3' })
    } as Response);

    expect(await checkMinServerVersion('http://localhost:8096'))
      .toEqual({ compatible: true, serverVersion: 'v1.2.3', minimumVersion: MIN_SERVER_VERSION });
  });

  it('respects the MIN_SERVER_VERSION constant', () => {
    expect(MIN_SERVER_VERSION).toBe('1.1.0');
  });
});

// M-WINDOWS-30: the renderer-supplied apiBase reached main-process fetch with
// only a truthiness check — any scheme (file:, data:, gopher:) and embedded
// credentials sailed through. The SSRF primitive is bounded now: http(s) only,
// no userinfo, non-empty host; loopback stays legal (self-hosted LAN servers
// are the product). Non-fetchable input fails OPEN per the documented policy,
// and never touches the network.
describe('fetchable-base boundary (M-WINDOWS-30)', () => {
  let spy: Mock;
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    spy = vi.fn();
    (globalThis as unknown as { fetch: Mock }).fetch = spy;
  });
  afterEach(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
  });

  it('classifies bases without fetching', async () => {
    const { isFetchableApiBase } = await import('../../src/main/versionCheck');
    expect(isFetchableApiBase('https://media.example.com')).toBe(true);
    expect(isFetchableApiBase('http://localhost:8096')).toBe(true); // loopback is the product
    expect(isFetchableApiBase('http://127.0.0.1:8096')).toBe(true);
    expect(isFetchableApiBase('file:///C:/Windows')).toBe(false);
    expect(isFetchableApiBase('data:text/html,hi')).toBe(false);
    expect(isFetchableApiBase('http://user:pw@internal.metadata/')).toBe(false);
    expect(isFetchableApiBase('http://')).toBe(false);
    expect(isFetchableApiBase('not a url')).toBe(false);
  });

  it('refuses to fetch a disallowed scheme but stays fail-open', async () => {
    const result = await checkMinServerVersion('file:///etc/passwd');
    expect(spy).not.toHaveBeenCalled();
    expect(result.compatible).toBe(true);
    expect(result.serverVersion).toBeNull();
  });

  it('refuses to fetch a credentialed host (no network at all)', async () => {
    const result = await checkMinServerVersion('http://admin:hunter2@169.254.169.254');
    expect(spy).not.toHaveBeenCalled();
    expect(result.compatible).toBe(true);
  });
});

// M7 (review batch 10): hub-shape detection off the route signatures —
// hub answers /health with service:'phlix-hub' and has no /system/info;
// anything else must NEVER be guessed as a hub.
describe('detectHubShapedBase', () => {
  const { fetch } = window;
  let fetchSpy: Mock;

  beforeEach(() => {
    fetchSpy = vi.fn();
    (window as unknown as { fetch: typeof fetch }).fetch = fetchSpy;
    vi.clearAllMocks();
  });

  afterEach(() => {
    (window as unknown as { fetch: typeof fetch }).fetch = fetch;
  });

  it('hub-shaped: /system/info answers NOT-ok and /health names phlix-hub', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', service: 'phlix-hub' }) } as Response);
    expect(await detectHubShapedBase('http://hub.example/')).toBe(true);
    expect((fetchSpy.mock.calls[0] as unknown as [string])[0]).toBe('http://hub.example/system/info');
    expect((fetchSpy.mock.calls[1] as unknown as [string])[0]).toBe('http://hub.example/health');
  });

  it('a server-shaped /health (no service key) is NOT a hub', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', version: '1.2.0' }) } as Response);
    expect(await detectHubShapedBase('http://srv.example')).toBe(false);
  });

  it('a reachable /system/info short-circuits to false WITHOUT the health probe', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ version: '1.1.0' }) } as Response);
    expect(await detectHubShapedBase('http://srv.example')).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('network failure answers false (never guess hub on an unreachable host)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await detectHubShapedBase('http://gone.example')).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('guards refuse without touching the network', async () => {
    expect(await detectHubShapedBase('')).toBe(false);
    expect(await detectHubShapedBase('ftp://nope.example')).toBe(false);
    expect(await detectHubShapedBase('http://admin:x@169.254.169.254')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
