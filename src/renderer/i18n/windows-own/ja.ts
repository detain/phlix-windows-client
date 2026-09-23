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
    admin: '管理',
    browse: 'ブラウズ',
    music: '音楽',
    books: '書籍',
    audiobooks: 'オーディオブック',
    photos: 'フォト',
    search: '検索',
    settings: '設定'
  }
} satisfies WindowOwnCatalog;
