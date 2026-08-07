# ADR-004: No Local UI

## Context

Local forks of UI components accumulated (14 components, 2 screens, 1 store) because there was no explicit rule against them.

## Decision

The renderer owns zero UI. All screens, components, stores, and routing come from `@phlix/ui`. Local code is limited to the Electron shell, boot/bridge glue, and IPC.

## Consequences

Phase W2 deleted ~1,900 lines of duplicate UI. Bumping `@phlix/ui` is the correct path for adding/changing UI. Before adding any local component, check `node_modules/@phlix/ui/src/`.
