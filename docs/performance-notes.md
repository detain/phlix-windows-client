# Performance Notes — phlix-windows-client

> **Era snapshot (w07/L3, 2026-11-07):** the W5.6 audit that opened this file
> (sha `f9cb906`, 2026-08-07) measured the `@phlix/ui` **v0.98.x** dist — those
> hash-named chunk files (`MediaGrid-DZEnqo4u.js`, `MediaGrid-AKYejJuV.cjs`)
> rot by design and no longer exist. The citations below were re-anchored
> against the installed `@phlix/ui` **v0.99.22** dist (measured 2026-11-07);
> the durable named source of truth is `dist/components/virtual-grid.d.ts`,
> whose declarations outlive chunk renames.

## List Virtualization (W5.6)

**Local lists:** None remain after Phase W2 deletion of local forks.

**Upstream (@phlix/ui):** Virtualized where it matters.

- `MediaGrid` (`@phlix/ui`): **Virtualized** via built-in windowing — no external virtualization library required.
  - Implementation: the `MediaGrid` chunk (hash-named in `dist/`; locate it by symbol, not filename) derives `startIndex`/`endIndex` per viewport from `scrollTop`, `viewportHeight`, `rowHeight`, `columns`, `itemCount`, and `overscan` via the windowing helper `computeWindow()` (declared in `dist/components/virtual-grid.d.ts`).
  - Pattern: standard windowing slice — only items within `[startIndex, endIndex)` are rendered to the DOM at any time.
  - Scroll tracking: `window.scrollY` + `window.innerHeight` read through passive `scroll`/`resize` listeners, with `requestAnimationFrame`-coalesced measurement.
  - Source: `node_modules/@phlix/ui/dist/MediaGrid-*.js` — find it by grepping for `startIndex`, `scrollY`, `passive`, and `requestAnimationFrame`. Chunk filenames and line numbers rotate with upstream builds, so anchor on these symbols and re-measure rather than trust coordinates (same law as `docs/ui-surface.md`: coordinates rot; symbols don't).
  - The README (`node_modules/@phlix/ui/README.md`) explicitly documents it as `MediaGrid (virtualized)` (`### Components` section).

- No `vue-virtual-scroller`, `@tanstack/vue-virtual`, `vue3-virtual-scroller`, or similar third-party lib found in `node_modules/`.

**Measurements:** the analysis below is a static examination of `@phlix/ui`'s built artifacts (`dist/`) and architecture; the DOM-node figures at the end are a source-derived estimate, not a runtime profile.

**Method:** Inspection of `@phlix/ui` built artifacts (`dist/`).

**Findings:**
- MediaGrid component uses **virtual scrolling / windowing** — confirmed.
- Evidence from `dist/components/virtual-grid.d.ts`: the file header reads "virtual-grid (R2.2) — pure windowing math for `MediaGrid.vue`"
- Evidence from the `MediaGrid` CJS twin (`dist/MediaGrid-*.cjs`, minified to a single line): the windowing helper destructures `{scrollTop, viewportHeight, rowHeight, columns, itemCount, overscan}` and returns `{startRow, endRow, startIndex, endIndex, rowCount, padTop, totalHeight}` — classic windowing parameters.
- `virtual-grid.d.ts` documents `computeWindow()` explicitly: "With a fixed `rowHeight` this is O(1): only the rows intersecting the viewport (plus `overscan` above/below) are returned, so **the DOM never holds more than a windowful regardless of `itemCount`**."
- No third-party virtualization libraries (`vue-virtual-scroller`, `@tanstack/vue-virtual`, `vue3-virtual-scroller`) found in `node_modules/@phlix/ui`.

**DOM Node Count:** (source estimate, poster grid at 4 columns)
- Estimated visible rows in viewport: ~5–7 rows × 4 columns = **20–28 item nodes** per window
- `overscan` prop (default: 2) adds ~8 extra nodes above/below
- vs. non-virtualized for 1000 items: ~1000 × 1 = **1000 item nodes** (4 columns each, but all rendered)
- Virtualized renders only ~**2–3%** of items as DOM nodes at any scroll position
