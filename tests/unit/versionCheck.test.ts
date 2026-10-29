import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
// Using relative path because @ alias points to src/renderer/, not src/main/
import { parseServerVersion, checkMinServerVersion, MIN_SERVER_VERSION } from '../../src/main/versionCheck';
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
      // real root endpoint (phlix-server/src/Server/Core/Application.php:245).
      'http://localhost:8096/system/info',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('reads the top-level version field of the real /system/info payload', async () => {
    // Exact shape served by phlix-server Application.php:245-256 (server is a
    // NAME string; version is top-level).
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
