/**
 * M-WINDOWS-37 — the tray tooltip verdict, pure.
 *
 * The tray used to be a static object: one tooltip set at creation, blind to
 * whether anything was playing. Main already receives the renderer's live
 * playing flag (power:update, W4.6) and the cleared-session signal
 * (playback:progress {0,0}); this module turns (state, labels) into the one
 * string the tray should carry. Kept pure + label-injected so the localized
 * strings are the caller's (i18n) concern and the logic is testable bare.
 *
 * Scope law: the review also asked for syncplay-party awareness — main has no
 * state source for that (the room socket lives inside the vendored ui
 * bundle; no renderer→main channel exists), and faking it would be theater.
 * The party leg is deferred honestly in the W-min201 report.
 */
export interface TrayTooltipLabels {
  readonly idle: string;
  readonly playing: string;
}

export function trayTooltipFor(playing: boolean, labels: TrayTooltipLabels): string {
  return playing ? labels.playing : labels.idle;
}
