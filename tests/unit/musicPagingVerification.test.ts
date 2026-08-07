/**
 * W5.5 Verification: Confirm unbounded list fetches are gone
 *
 * This test verifies:
 * 1. MusicScreen.tsx and MusicAlbumScreen.tsx were deleted (W2.5)
 * 2. No remaining unbounded music/artists or music/albums fetches in src/
 * 3. No remaining references to MusicScreen or MusicAlbumScreen
 * 4. @phlix/ui MusicLibraryPage uses limit/offset paging
 */

import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';

describe('W5.5: Unbounded list fetch cleanup', () => {
  const srcDir = 'src';

  it('src/screens/ directory does not exist (screens were deleted)', () => {
    let screensExist = false;
    try {
      execSync(`ls ${srcDir}/screens/`, { stdio: 'pipe' });
      screensExist = true;
    } catch {
      screensExist = false;
    }
    expect(screensExist).toBe(false);
  });

  it('no music/artists or music/albums fetches in src/', () => {
    const output = execSync(
      `grep -rn 'music/artists\\|music/albums' ${srcDir}/ 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    expect(output.trim()).toBe('');
  });

  it('no MusicScreen or MusicAlbumScreen references in src/', () => {
    const output = execSync(
      `grep -rn 'MusicScreen\\|MusicAlbumScreen' ${srcDir}/ 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    expect(output.trim()).toBe('');
  });

  it('no unbounded fetch or apiClient calls without limit in src/', () => {
    const output = execSync(
      `grep -rn "fetch(\\|apiClient\\." ${srcDir}/ | grep -v 'limit' | grep -v 'node_modules' | grep -v 'src/main/versionCheck' || true`,
      { encoding: 'utf-8' }
    );
    expect(output.trim()).toBe('');
  });

  it('@phlix/ui MusicLibraryPage has limit/offset/paging support', () => {
    const output = execSync(
      `grep -o 'limit\\|offset\\|paging\\|page' node_modules/@phlix/ui/dist/MusicLibraryPage-*.js | sort | uniq -c`,
      { encoding: 'utf-8' }
    );
    expect(output).toContain('limit');
    expect(output).toContain('offset');
    expect(output).toContain('page');
  });
});
