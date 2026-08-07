# ADR-005: Tag Pinning

## Context

`@phlix/ui` and `@phlix/contracts` are pinned by GitHub tag, not branch. This means upstream `master` changes are invisible until both the tag and the pin move.

## Decision

Pin by GitHub tag (e.g., `github:detain/phlix-ui#v0.98.34`). The `dist/` directory is built before the tag is created — `@phlix/ui`'s `dist/` is included in the tarball at tag time.

## Consequences

A `master` change in `@phlix/ui` does nothing until someone cuts a new tag AND bumps the pin in this repo. This is intentional — it prevents upstream drift from silently breaking the packaged app.
