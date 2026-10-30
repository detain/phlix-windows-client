/**
 * @vitest-environment node
 *
 * SMTC ownership (M-WINDOWS-35): navigator.mediaSession belongs to the
 * vendored @phlix/ui's capability-gated installer. The shell ran a SECOND,
 * unconditional installer that loaded after the ui's (last setActionHandler
 * wins), and its prev/next arms re-dispatched into playlist dead-ends the
 * shell cannot fulfill — phantom buttons over no-ops. The cure is full
 * deletion of the shell's SMTC leg (disclosed in W-min207__report.md);
 * the LIVE shell surfaces (thumbar / tray / menu push channels) and the
 * M-WINDOWS-22 stop-clear helper stay.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p) => readFileSync(resolve(__dirname, '../../', p), 'utf-8');

describe('M-WINDOWS-35: the shell installs no media-session handlers', () => {
  it('mediaSession.ts keeps only the stop-clear helper', () => {
    const ms = read('src/renderer/mediaSession.ts');
    expect(ms).not.toMatch(/setupMediaSession/);
    expect(ms).toMatch(/export function clearMediaSessionTransport/);
    expect(ms).not.toMatch(/setActionHandler/);
  });

  it('main.ts never mentions the retired installer', () => {
    expect(read('src/renderer/main.ts')).not.toMatch(/setupMediaSession/);
  });

  it('main process serves none of the 7 SMTC invoke channels', () => {
    const main = read('src/main/index.ts');
    for (const ch of ['media:play', 'media:pause', 'media:previous', 'media:next',
      'media:seek-backward', 'media:seek-forward', 'media:seek-to']) {
      expect(main).not.toContain(`ipcMain.handle('${ch}'`);
    }
  });

  it('preload drops the 7 invoke wrappers and the 3 orphaned subscriptions', () => {
    const pl = read('src/preload/index.ts');
    for (const m of ['mediaPlay', 'mediaPause', 'mediaPrevious', 'mediaNext',
      'mediaSeekBackward', 'mediaSeekForward', 'mediaSeekTo']) {
      expect(pl).not.toMatch(new RegExp(`\\b${m}:`));
    }
    for (const m of ['onMediaPrevious', 'onMediaNext', 'onMediaSeekTo']) {
      expect(pl).not.toContain(m);
    }
    // live push wrappers survive
    for (const m of ['onMediaPlayPause', 'onMediaStop', 'onMediaRewind', 'onMediaForward']) {
      expect(pl).toContain(m);
    }
  });

  it('electronBridge drops the dead arms but keeps the live transport mirrors', () => {
    const br = read('src/renderer/electronBridge.ts');
    for (const m of ['onMediaPrevious', 'onMediaNext', 'onMediaSeekTo']) {
      expect(br).not.toContain(m);
    }
    for (const m of ['onMediaPlayPause', 'onMediaStop', 'onMediaRewind', 'onMediaForward']) {
      expect(br).toContain(m);
    }
  });

  it('electron.d.ts declares no removed wrapper', () => {
    const d = read('src/renderer/types/electron.d.ts');
    for (const m of ['mediaSeekTo', 'onMediaPrevious', 'mediaPlay:']) {
      expect(d).not.toContain(m);
    }
  });

  it('the IPC doc carries no rows for deleted channels', () => {
    const doc = read('docs/ipc-channels.md');
    expect(doc).not.toMatch(/\|\s*`media:play`\s*\|/);
    expect(doc).not.toMatch(/\|\s*`media-seek-to`\s*\|/);
    expect(doc).not.toMatch(/\|\s*`media-previous`\s*\|/);
  });

  it('live push producers survive (tray/menu/thumbar still drive the ui)', () => {
    const main = read('src/main/index.ts');
    expect(main).toMatch(/send\('media-play-pause'\)/);
    expect(main).toMatch(/send\('media-rewind'\)/);
    expect(main).toMatch(/send\('media-stop'\)/);
    expect(main).toMatch(/send\('media-forward'\)/);
  });
});
