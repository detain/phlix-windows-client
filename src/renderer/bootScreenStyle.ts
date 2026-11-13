/**
 * WIN-22/WIN-23: shared styling for the two blocking boot surfaces (the
 * incompatible-server screen and the boot-failure panel). Both render before
 * the app's stylesheet/theme exists, so the look is built here from inline
 * styles plus ONE injected <style> sheet (inline styles cannot express
 * :hover / :focus-visible / :disabled).
 *
 * No user/network text passes through here — only fixed literals and the
 * catalog labels handed in by callers (set via textContent).
 */

const STYLE_ID = 'phlix-boot-screen-style';
export const RECOVERY_BUTTON_CLASS = 'phlix-recovery-btn';

const SHEET = [
  `.${RECOVERY_BUTTON_CLASS}{padding:10px 22px;font-size:14px;font-family:inherit;color:#e8e8f0;`
    + 'background:#26264a;border:1px solid #3a3a5e;border-radius:6px;cursor:pointer;}',
  `.${RECOVERY_BUTTON_CLASS}[data-variant="secondary"]{background:transparent;}`,
  `.${RECOVERY_BUTTON_CLASS}:hover:not(:disabled){background:#33335e;border-color:#5a5a8e;}`,
  `.${RECOVERY_BUTTON_CLASS}:focus-visible{outline:2px solid #9aa0ff;outline-offset:2px;}`,
  `.${RECOVERY_BUTTON_CLASS}:disabled{opacity:0.6;cursor:progress;}`
].join('\n');

function ensureSheet(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SHEET;
  (document.head ?? document.body).appendChild(style);
}

/** Shared centered dark container look (incompatible-card container). */
export function applyFailureScreenContainer(el: HTMLElement, opts: { overlay?: boolean } = {}): void {
  el.setAttribute('style', [
    ...(opts.overlay ? ['position:fixed', 'inset:0', 'z-index:2147483647'] : []),
    'display:flex', 'align-items:center', 'justify-content:center', 'height:100vh',
    'padding:24px', 'box-sizing:border-box', 'background:#1a1a2e', 'color:#e8e8f0',
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif', 'text-align:center'
  ].join(';') + ';');
}

/** Gives a recovery button the shared affordance (hover/focus-visible/disabled). */
export function styleRecoveryButton(
  button: HTMLButtonElement,
  variant: 'primary' | 'secondary' = 'primary'
): void {
  ensureSheet();
  button.classList.add(RECOVERY_BUTTON_CLASS);
  button.dataset.variant = variant;
  button.dataset.idleLabel = button.textContent ?? '';
}

/**
 * In-flight toggle: busy disables and shows the "Checking…" label; idle
 * re-enables and restores the original label. Call on EVERY re-arm so the
 * label can never stay stuck on a re-enabled button.
 */
export function setRecoveryBusy(button: HTMLButtonElement, busy: boolean, busyLabel?: string): void {
  if (busy) {
    button.disabled = true;
    if (busyLabel !== undefined) button.textContent = busyLabel;
  } else {
    button.disabled = false;
    if (button.dataset.idleLabel !== undefined) button.textContent = button.dataset.idleLabel;
  }
}
