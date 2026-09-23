/**
 * Brazilian Portuguese catalog for the Electron MAIN process chrome (tray,
 * menu, thumbar, updater notifications, About dialog). Typed against
 * `MainCatalog` — a missing or extra key versus `en.ts` does not compile.
 *
 * Registered as 'pt_BR' and reached by every 'pt*' tag (the estate's single
 * Portuguese catalog — region-aware rule in the main/renderer i18n normalize).
 *
 * Language decisions (flagged for review):
 * - "você" register matching the pt_BR ui bundle; Configurações is the SSOT
 *   settings term, 'bandeja' the pt_BR system-tray word.
 * - Brand kept verbatim: 'Phlix', 'Phlix Media Server' (tray.tooltip,
 *   about.message); '{version}' placeholders untouched.
 * - pt_BR media convention writes seconds as '10s' (no space) in short button
 *   labels — kept compact for the thumbar tooltip.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { MainCatalog } from '../index';

export const pt_BR = {
  tray: {
    show: 'Mostrar Phlix',
    playPause: 'Reproduzir/Pausar',
    stop: 'Parar',
    minimizeToTray: 'Minimizar para a bandeja',
    quit: 'Sair',
    tooltip: 'Phlix Media Server'
  },
  menu: {
    file: 'Arquivo',
    settings: 'Configurações',
    playback: 'Reprodução',
    playPause: 'Reproduzir/Pausar',
    stop: 'Parar',
    rewind: 'Retroceder',
    fastForward: 'Avanço rápido',
    fullscreen: 'Tela cheia',
    view: 'Exibir',
    help: 'Ajuda',
    about: 'Sobre o Phlix',
    checkForUpdates: 'Verificar atualizações'
  },
  thumbar: {
    previous: 'Anterior / Retroceder 10s',
    play: 'Reproduzir',
    pause: 'Pausar',
    next: 'Próximo / Avançar 10s'
  },
  updater: {
    availableTitle: 'Atualização disponível',
    availableBody: 'Phlix {version} está disponível. Clique para baixar.',
    readyTitle: 'Atualização pronta',
    readyBody: 'Phlix {version} foi baixada. Reinicie para aplicar.'
  },
  about: {
    title: 'Sobre o Phlix',
    message: 'Phlix Media Server',
    detail: 'Versão {version}\n\nUm servidor de mídia gratuito para sua casa.'
  }
} satisfies MainCatalog;
