/**
 * Japanese catalog for the Electron MAIN process chrome (tray, menu, thumbar,
 * updater notifications, About dialog). Typed against `MainCatalog` — a missing
 * or extra key versus `en.ts` does not compile.
 *
 * Language decisions (flagged for review):
 * - Polite desktop wording mirroring the ja ui bundle (設定 = settings, 更新を確認
 *   = check for updates, 再生/一時停止 transport pair).
 * - Media convention: 早戻し/早送り for Rewind/Fast Forward (Jellyfin-ja style),
 *   thumbar uses the compact 10秒戻す/10秒進める form.
 * - Brand kept verbatim in Latin script: 'Phlix', 'Phlix Media Server'
 *   (tray.tooltip, about.message) — pinned in the no-English-leak allow-list;
 *   '{version}' placeholders untouched; the About \n\n structure is preserved.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { MainCatalog } from '../index';

export const ja = {
  tray: {
    show: 'Phlix を表示',
    playPause: '再生/一時停止',
    stop: '停止',
    minimizeToTray: 'トレイに最小化',
    quit: '終了',
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'ファイル',
    settings: '設定',
    playback: '再生',
    playPause: '再生/一時停止',
    stop: '停止',
    rewind: '早戻し',
    fastForward: '早送り',
    fullscreen: '全画面',
    view: '表示',
    help: 'ヘルプ',
    about: 'Phlix について',
    checkForUpdates: '更新を確認'
  },
  thumbar: {
    previous: '前へ / 10秒戻す',
    play: '再生',
    pause: '一時停止',
    next: '次へ / 10秒進める'
  },
  updater: {
    availableTitle: '更新があります',
    availableBody: 'Phlix {version} が利用可能です。クリックしてダウンロード。',
    readyTitle: '更新の準備完了',
    readyBody: 'Phlix {version} のダウンロードが完了しました。再起動して適用してください。'
  },
  about: {
    title: 'Phlix について',
    message: 'Phlix Media Server',
    detail: 'バージョン {version}\n\nご家庭向けの無料メディアサーバー。'
  }
} satisfies MainCatalog;
