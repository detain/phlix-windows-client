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
 * - Brand kept verbatim: 'Phlix' (tray.tooltip — brand-only since
 *   M-WINDOWS-02 retired the client-as-server misname) and 'Phlix for
 *   Windows' (about.message); the server product name survives only where it
 *   actually names the server (boot.tooOldDetail).
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
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — 再生中'
  },
  menu: {
    file: 'ファイル',
    settings: '設定',
    playback: '再生',
    playPause: '再生/一時停止',
    stop: '停止',
    rewind: '10秒戻す',
    fastForward: '10秒進める',
    fullscreen: '全画面',
    view: '表示',
    help: 'ヘルプ',
    about: 'Phlix について',
    checkForUpdates: '更新を確認'
  },
  thumbar: {
    previous: '10秒戻す',
    play: '再生',
    pause: '一時停止',
    next: '10秒進める'
  },
  updater: {
    availableTitle: '更新があります',
    availableBody: 'Phlix {version} が利用可能です。クリックしてダウンロード。',
    notAvailableTitle: '最新版を使用しています',
    notAvailableBody: 'Phlix {version} はすでに最新バージョンです。',
    readyTitle: '更新の準備完了',
    readyBody: 'Phlix {version} のダウンロードが完了しました。再起動して適用してください。'
  },
  about: {
    title: 'Phlix について',
    message: 'Phlix for Windows',
    detail: 'バージョン {version}\n\nPhlix サーバーのための無料メディアクライアントです。'
  },
  boot: {
    tooOldTitle: 'サーバーのバージョンが古すぎます',
    tooOldMessage: 'このアプリが接続した Phlix サーバーは、このバージョンの Phlix for Windows には古すぎます。',
    tooOldDetail: 'サーバーのバージョン: {serverVersion}\n必要とされる最低バージョン: {minimumVersion}\n\nサーバーの管理者に Phlix Media Server の更新を依頼し、このアプリを再起動してください。'
  },
  deeplink: {
    failedTitle: 'リンクを開けませんでした',
    failedMessage: 'Phlix は開けなかったリンクを受け取りました。入手元を確認してから再試行してください。',
    confirmMessage: 'この Phlix リンクを開きますか？',
    confirmAccept: 'リンクを開く',
    confirmReject: 'キャンセル'
  },
  crash: {
    title: '問題が発生しました',
    message: 'Phlix ウィンドウの応答が停止しました。再読み込みするとセッションに復帰できます。',
    reload: 'ウィンドウを再読み込み',
    dismiss: '閉じる'
  }
} satisfies MainCatalog;
