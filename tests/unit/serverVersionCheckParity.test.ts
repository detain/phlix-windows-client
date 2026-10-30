/**
 * @vitest-environment node
 *
 * M-WINDOWS-02 review INFO-1 (rider R-WINDOWS-02): `ServerVersionCheck` exists
 * twice by necessity — the SSOT in src/main/versionCheck.ts (main process) and
 * an ambient mirror in src/renderer/types/electron.d.ts (the renderer cannot
 * import from main). The mirror's docblock CLAIMED to be pinned, but until now
 * nothing actually pinned it: a field added or a type changed on one side of
 * the IPC boundary would compile green while the renderer silently misread the
 * verdict shape (the exact cross-boundary drift class the ipcChannels pairing
 * test guards for channel names).
 *
 * This is the same fail-loud fs-parse idiom as tests/unit/ipcChannels.test.ts:
 * both declarations are extracted from source text, normalized (doc comments
 * and whitespace stripped — the contract is the member set, not the prose),
 * and asserted EXACTLY equal. Renaming, adding, removing or re-typing a
 * member on either side alone reddens this test with a diff-style message.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');
const SSOT_FILE = 'src/main/versionCheck.ts';
const MIRROR_FILE = 'src/renderer/types/electron.d.ts';

/**
 * Extracts the body of `interface ServerVersionCheck { ... }` from a file
 * (with or without a leading `export`), throwing fail-loud when absent —
 * deleting or renaming the declaration must break the tripwire, not void it.
 */
function extractInterfaceBody(filePath: string): string {
  const content = readFileSync(resolve(PROJECT_ROOT, filePath), 'utf8');
  const match = content.match(/(?:export\s+)?interface\s+ServerVersionCheck\s*\{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error(
      `ServerVersionCheckParity: no \`interface ServerVersionCheck\` found in ${filePath}. ` +
      'The SSOT/mirror pairing law (M-WINDOWS-02) requires the declaration to exist in BOTH files.'
    );
  }
  return match[1];
}

/**
 * Normalizes an interface body into sorted `name: type` member strings:
 * strips block and line comments (per-field prose may legitimately differ),
 * collapses whitespace, and drops blank members.
 */
function extractMembers(body: string): string[] {
  const withoutComments = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return withoutComments
    .split(';')
    .map((member) => member.replace(/\s+/g, ' ').trim())
    .filter((member) => member.length > 0)
    .sort();
}

describe('ServerVersionCheck cross-boundary type parity (R-WINDOWS-02)', () => {
  const ssotMembers = extractMembers(extractInterfaceBody(SSOT_FILE));
  const mirrorMembers = extractMembers(extractInterfaceBody(MIRROR_FILE));

  it('the SSOT declares the ratified three-member verdict shape', () => {
    // Self-presence pin: the tripwire names the current contract explicitly,
    // so a wholesale rewrite of either side cannot quietly rename the target.
    expect(ssotMembers).toEqual([
      'compatible: boolean',
      'minimumVersion: string',
      'serverVersion: string | null',
    ]);
  });

  it('the renderer mirror declares EXACTLY the SSOT member set', () => {
    expect(mirrorMembers).toEqual(ssotMembers);
  });
});
