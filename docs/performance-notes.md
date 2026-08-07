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

**Measurements:** Not performed — the `@phlix/ui` package ships only pre-built `dist/` (no `src/`), so source-level inspection of the virtualization implementation was used instead. The windowing logic in `MediaGrid` is self-contained and does not depend on external packages, confirming it is a first-party implementation.
