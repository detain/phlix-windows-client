/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PHLIX_SERVER_URL?: string;
  /** Build-time locale override for the @phlix/ui message seam (e.g. 'es', 'es-MX'). */
  readonly VITE_PHLIX_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
