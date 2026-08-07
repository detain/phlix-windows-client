# Performance Notes — phlix-windows-client

## List Virtualization (W5.6)

**Local lists:** None remain after Phase W2 deletion of local forks.

**Upstream (@phlix/ui):** Virtualized where it matters.

- `MediaGrid` (`@phlix/ui`): **Virtualized** via built-in windowing — no external virtualization library required.
  - Implementation: `MediaGrid-DZEnqo4u.js` calculates `startIndex`/`endIndex` per viewport using `scrollTop`, `viewportHeight`, `rowHeight`, `columns`, `itemCount`, and `overscan` props.
  - Pattern: standard windowing slice — only items within `[startIndex, endIndex)` are rendered to the DOM at any time.
  - Scroll tracking: `window.scrollY` + `window.innerHeight` via passive scroll/resize listeners, rAF-coalesced measurement.
  - Source: `node_modules/@phlix/ui/dist/MediaGrid-DZEnqo4u.js` (lines 33–48, 143–168).
  - The README (`node_modules/@phlix/ui/README.md`) explicitly documents it as `MediaGrid (virtualized)`.

- No `vue-virtual-scroller`, `@tanstack/vue-virtual`, `vue3-virtual-scroller`, or similar third-party lib found in `node_modules/`.

**Measurements:** Source-level analysis performed.

**Method**: Inspection of `@phlix/ui` built artifacts (`dist/`).

**Findings**:
- MediaGrid component uses **virtual scrolling / windowing** — confirmed.
- Evidence from `dist/components/virtual-grid.d.ts`: header reads "virtual-grid (R2.2) — pure windowing math for `MediaGrid.vue`"
- Evidence from `dist/MediaGrid-AKYejJuV.cjs`: contains `computeWindow()` function accepting `{scrollTop, viewportHeight, rowHeight, columns, itemCount, overscan}` — classic windowing parameters.
- `virtual-grid.d.ts` documents `computeWindow()` explicitly: "With a fixed `rowHeight` this is O(1): only the rows intersecting the viewport (plus `overscan` above/below) are returned, so **the DOM never holds more than a windowful regardless of `itemCount`**."
- No third-party virtualization libraries (`vue-virtual-scroller`, `@tanstack/vue-virtual`, `vue3-virtual-scroller`) found in `node_modules/@phlix/ui`.

**DOM Node Count** (source estimate, poster grid at 4 columns):
- Estimated visible rows in viewport: ~5-7 rows × 4 columns = **20-28 item nodes** per window
- `overscan` prop (default: 2) adds ~8 extra nodes above/below
- vs. non-virtualized for 1000 items: ~1000 × 1 = **1000 item nodes** (4 columns each, but all rendered)
- Virtualized renders only ~**2-3%** of items as DOM nodes at any scroll position
