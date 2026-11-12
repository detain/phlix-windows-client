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
 * - Brand kept verbatim: 'Phlix' (tray.tooltip — brand-only since
 *   M-WINDOWS-02 retired the client-as-server misname) and 'Phlix for
 *   Windows' (about.message); the server product name survives only where it
 *   actually names the server (boot.tooOldDetail).
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
    tooltip: 'Phlix',
    tooltipPlaying: 'Phlix — reproduzindo'
  },
  menu: {
    file: 'Arquivo',
    settings: 'Configurações',
    playback: 'Reprodução',
    playPause: 'Reproduzir/Pausar',
    stop: 'Parar',
    rewind: 'Retroceder 10s',
    fastForward: 'Avançar 10s',
    fullscreen: 'Tela cheia',
    view: 'Exibir',
    help: 'Ajuda',
    about: 'Sobre o Phlix',
    checkForUpdates: 'Verificar atualizações',
    notifications: 'Notificações',
    keyboardShortcutsHint: 'Atalhos: Espaço, ←, → (fora do player)'
  },
  thumbar: {
    previous: 'Retroceder 10s',
    play: 'Reproduzir',
    pause: 'Pausar',
    next: 'Avançar 10s'
  },
  updater: {
    availableTitle: 'Atualização disponível',
    availableBody: 'Phlix {version} está disponível. Clique para baixar.',
    availableDialogBody: 'Phlix {version} está disponível.',
    downloadButton: 'Baixar',
    laterButton: 'Mais tarde',
    notAvailableTitle: 'Você está na versão mais recente',
    notAvailableBody: 'Phlix {version} já é a versão mais recente.',
    checkFailedTitle: 'Falha ao verificar atualizações',
    checkFailedBody: 'Phlix não pôde verificar atualizações agora. Tente novamente mais tarde.',
    readyTitle: 'Atualização pronta',
    readyBody: 'Phlix {version} foi baixada. Reinicie para aplicar.'
  },
  about: {
    title: 'Sobre o Phlix',
    message: 'Phlix for Windows',
    detail: 'Versão {version}\n\nUm cliente de mídia gratuito para o seu servidor Phlix.'
  },
  boot: {
    tooOldTitle: 'Versão do servidor antiga demais',
    tooOldMessage: 'O servidor Phlix ao qual este aplicativo se conectou é antigo demais para esta versão do Phlix para Windows.',
    tooOldDetail: 'Versão do servidor: {serverVersion}\nMínimo necessário: {minimumVersion}\n\nPeça ao proprietário do servidor para atualizar o Phlix Media Server. Depois de atualizado, o aplicativo detecta na próxima verificação, sem reiniciar.'
  },
  deeplink: {
    failedTitle: 'Não foi possível abrir o link',
    failedMessage: 'O Phlix recebeu um link que não pôde abrir. Verifique a origem e tente novamente.',
    confirmTitle: 'Abrir este link?',
    confirmMessage: 'Seguir este link do Phlix?',
    confirmAccept: 'Seguir link',
    confirmReject: 'Cancelar'
  },
  crash: {
    title: 'Algo deu errado',
    message: 'A janela do Phlix parou de responder. Recarregue para recuperar sua sessão.',
    reload: 'Recarregar janela',
    dismiss: 'Descartar'
  },
  net: {
    tlsTitle: 'Conexão não confiável',
    tlsBody: 'Uma conexão segura com {url} foi rejeitada porque o certificado não pôde ser verificado.',
    loadTitle: 'Falha ao carregar a página',
    loadBody: 'O Phlix não pôde carregar {url}.',
    hubTitle: 'Este endereço é um Phlix Hub',
    hubBody: 'O modo hub ainda não está disponível no desktop. Digite em vez disso o endereço do seu servidor Phlix.'
  }
} satisfies MainCatalog;
