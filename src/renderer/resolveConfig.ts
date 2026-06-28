// Pure, unit-testable resolution of the phlix-ui app mode + apiBase from the
// Electron hub config + persisted direct server URL + build-time env fallback.

export interface HubConfig {
  hubUrl?: string | null;
  activeServerId?: string | null;
  connectionMode?: string | null;
}

export interface ResolveConfigInput {
  /** Result of window.electronAPI.hubGetConfig() (or null if unavailable). */
  hub?: HubConfig | null;
  /** Result of window.electronAPI.getServerUrl() (or null if unset). */
  serverUrl?: string | null;
  /** Build-time fallback (import.meta.env.VITE_PHLIX_SERVER_URL). */
  envUrl?: string | null;
}

export interface ResolvedAppConfig {
  app: 'server' | 'hub';
  apiBase: string;
}

/**
 * Decide whether to talk to a hub or a direct server, and which base URL to use.
 *
 * - If a hubUrl is configured AND the connection mode is not explicitly 'direct',
 *   run in hub mode against the hub URL.
 * - Otherwise run in server mode against the persisted direct server URL, falling
 *   back to the build-time env URL, then an EMPTY base.
 *
 * An empty `apiBase` is intentional: the app no longer guesses `localhost:8096`
 * (which on a real user's machine is nothing). Instead `main.ts` passes
 * `requireConnection: true`, so an empty base routes the user to the shared
 * `@phlix/ui` first-run Connect screen to enter their server/hub address — which
 * is then persisted (and mirrored back via `setServerUrl`) so it re-seeds here on
 * the next launch.
 */
export function resolveAppConfig(input: ResolveConfigInput): ResolvedAppConfig {
  const hub = input.hub ?? null;

  if (hub?.hubUrl && hub.connectionMode !== 'direct') {
    return { app: 'hub', apiBase: hub.hubUrl };
  }

  const apiBase = input.serverUrl || input.envUrl || '';
  return { app: 'server', apiBase };
}
