# ADR-003: ElectronAPI is Optional

## Context

The type definition for `window.electronAPI` asserted a guarantee the runtime did not provide — it was typed as always present, but in a plain browser dev context (no Electron) it was undefined. This hid the preload P0 bug from `vue-tsc`.

## Decision

Made `electronAPI` optional in the type (`electronAPI?: ElectronAPI`). Code defensively checks `if (window.electronAPI)` before use.

## Consequences

- The type now matches the runtime contract.
- Any code that assumes electronAPI without a guard is now a type error.
