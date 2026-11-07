/**
 * Japanese windows-own nav catalog — labels the ui message seam cannot reach
 * (client-supplied `MenuItem.label`s handed to createPhlixApp).
 *
 * Terminology mirrors the vendored ja ui bundle where an equivalent exists:
 * shell.browse 'ブラウズ', shell.explore '見つける', shell.watchHistory '視聴履歴',
 * shell.settings '設定', music.nav '音楽'; search root follows
 * common.searchPlaceholder '検索…'. Library-type entries use the compact
 * Jellyfin-ja style (書籍 / オーディオブック / フォト); hub terms use the
 * established ja software loan-translations (マイサーバー, フェデレーション,
 * 共有, 招待リンク, 管理).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { WindowOwnCatalog } from './index';

export const WIN_JA = {
  nav: {
    myServers: 'マイサーバー',
    federation: 'フェデレーション',
    shares: '共有',
    sharedWithMe: '自分と共有',
    inviteLinks: '招待リンク',
    history: '視聴履歴',
    explore: '見つける',
    recommendations: 'あなたへのおすすめ',
    syncPlay: 'SyncPlay同期視聴',
    admin: '管理',
    browse: 'ブラウズ',
    music: '音楽',
    books: '書籍',
    audiobooks: 'オーディオブック',
    photos: 'フォト',
    search: '検索',
    settings: '設定'
  },
  boot: {
    incompatibleTitle: 'Phlix サーバーが古すぎます',
    incompatibleIntro: 'この Phlix サーバーは、このバージョンの Phlix for Windows には古すぎます。',
    reportedVersion: 'サーバーが報告したバージョン',
    requiredVersion: 'Phlix for Windows の必要最低バージョン',
    incompatibleAction: 'サーバー管理者に Phlix Media Server の更新を依頼し、「再試行する」を押してください。その場で再チェックされ、再起動は不要です。',
    incompatibleRetry: '再試行する'
,
    incompatibleChange: '別のサーバーを使用',
    failTitle: 'Phlix を起動できませんでした',
    failMessage: 'アプリは起動に必要なデータを読み込めませんでした。安全なストレージが利用できないか、インストールが破損している可能性があります。再度試すと解決することがあります。解決しない場合は Phlix for Windows を再インストールしてください。',
    failRetry: '再試行'
  },
  // M-WINDOWS-11: player-overlay labels (see en.ts law note; values are
  // this locale's translations of the shipped literals).
  deeplink: {
    hubOnlyTitle: 'このリンクは Phlix Hub のものです',
    inviteBody: '招待リンクは Phlix Hub から発行されます。このウィンドウはサーバーへ直接接続しているため、リンクを受け取ったブラウザで開くか、Phlix を Hub モードで実行してください。',
    serverBody: 'サーバーカードのリンクは Phlix Hub に属します。このウィンドウはサーバーへ直接接続しているため、ここで開く対象はありません。'
  },
  overlay: {
    sleepTimer: 'スリープタイマー',
    cancelSleepTimer: 'スリープタイマーをキャンセル',
    expiredNotice: 'スリープタイマーが終了しました — 再生は停止しました',
    menuHeading: 'スリープタイマー',
    cancelMenuItem: 'タイマーをキャンセル',
    unitMin: '分',
    unitHr: '時間',
    unitHrs: '時間',
    enterPip: 'ピクチャー・イン・ピクチャーを開始',
    exitPip: 'ピクチャー・イン・ピクチャーを終了',
    titlePip: 'ピクチャー・イン・ピクチャー',
    titlePipExit: 'PiP 終了'
  }
} satisfies WindowOwnCatalog;
