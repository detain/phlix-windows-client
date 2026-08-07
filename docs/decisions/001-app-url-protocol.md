# ADR-001: App URL Protocol

## Context

The renderer needs to load its entry HTML and module scripts. `loadFile` with a `file://` URL was tried first but produced a blank window.

## Decision

Use `app://` custom protocol via `session.setProtocolHandler('app')` in main process, and `createWebHistory('app://renderer')` in the renderer. The custom protocol sidesteps the opaque-origin module block that prevents `loadFile` from loading ES module graph entries.

## Alternatives Rejected

- **`loadFile`**: Produces a blank window due to opaque origin, which blocks ES module graph loading.
- **`window.location.replace`**: Loses browser history, making back/forward navigation impossible.

## Consequences

- Anyone reverting to `loadFile` will get a blank window.
- The `app://` protocol must be registered before `app.whenReady()`.
