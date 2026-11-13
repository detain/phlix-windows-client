/**
 * WIN-52 / WIN-S30: report the active theme's `--bg` to main so the next
 * launch's BrowserWindow backgroundColor matches the persisted theme.
 * Best-effort and silent: no bridge / non-hex token / IPC failure all leave
 * the Nocturne default in place.
 */
export function readThemeBackground(root: HTMLElement = document.documentElement): string | null {
  const raw = getComputedStyle(root).getPropertyValue('--bg').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : null;
}

export function startLaunchThemeReporter(
  bridge: { setLaunchBackground?: (color: string) => Promise<unknown> } | undefined,
  root: HTMLElement = document.documentElement
): () => void {
  if (!bridge?.setLaunchBackground) return () => undefined;
  let last: string | null = null;
  const report = (): void => {
    const bg = readThemeBackground(root);
    if (!bg || bg === last) return;
    last = bg;
    void Promise.resolve(bridge.setLaunchBackground?.(bg)).catch(() => undefined);
  };
  report();
  const observer = new MutationObserver(report);
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
  return () => observer.disconnect();
}
