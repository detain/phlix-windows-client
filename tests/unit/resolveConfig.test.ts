import { describe, it, expect } from 'vitest';
import { resolveAppConfig } from '@/resolveConfig';

describe('resolveAppConfig', () => {
  it('uses hub mode when a hubUrl is set and mode is not direct', () => {
    const result = resolveAppConfig({
      hub: { hubUrl: 'https://hub.example.com', connectionMode: 'hub' },
      serverUrl: 'http://localhost:8096',
      envUrl: null
    });
    expect(result).toEqual({ app: 'hub', apiBase: 'https://hub.example.com' });
  });

  it('uses hub mode when a hubUrl is set and mode is unset', () => {
    const result = resolveAppConfig({
      hub: { hubUrl: 'https://hub.example.com' },
      serverUrl: null,
      envUrl: null
    });
    expect(result).toEqual({ app: 'hub', apiBase: 'https://hub.example.com' });
  });

  it('falls back to server mode when connectionMode is direct even with a hubUrl', () => {
    const result = resolveAppConfig({
      hub: { hubUrl: 'https://hub.example.com', connectionMode: 'direct' },
      serverUrl: 'http://my-server:8096',
      envUrl: null
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://my-server:8096' });
  });

  it('uses the persisted server URL in server mode', () => {
    const result = resolveAppConfig({
      hub: null,
      serverUrl: 'http://my-server:8096',
      envUrl: 'http://env-server:8096'
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://my-server:8096' });
  });

  it('falls back to the env URL when no persisted server URL', () => {
    const result = resolveAppConfig({
      hub: null,
      serverUrl: null,
      envUrl: 'http://env-server:8096'
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://env-server:8096' });
  });

  it('falls back to localhost:8096 when nothing else is set', () => {
    const result = resolveAppConfig({ hub: null, serverUrl: null, envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: 'http://localhost:8096' });
  });

  it('falls back to server mode when hub has no hubUrl', () => {
    const result = resolveAppConfig({
      hub: { hubUrl: null, connectionMode: 'hub' },
      serverUrl: 'http://my-server:8096',
      envUrl: null
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://my-server:8096' });
  });
});
