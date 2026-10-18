---
summary: >-
  Mostly complete: fetch shown only when remotes exist, upstream-aware
  push/pull, remotes CRUD popup, add/remove repo commands, full-path tooltips.
  Open: a preference for repository dropdown ordering.
---

# Phase 9: Repository and Remote Management

**Status: mostly complete** — remotes-gated fetch (`88a7176`), upstream-aware push/pull/fetch-into-local with delete-on-remote (`5966cf3`), the remotes CRUD popup (`693f6eb`), add/remove repo commands, and full-path tooltips are done. Remaining: a repository dropdown ordering preference.

Goal: make multi-repo work and remote operations available without bloating the
main graph table.

Implementation plan:

- Add manual add/remove repository commands for sub-repos.
- Add open-to-active-editor-repo behavior.
- Add repository dropdown ordering and full-path tooltips.
- Add fetch from remote(s) with prune/prune-tags options through the Phase 0.5
  Git runner so progress, logging, and errors are consistent.
- Add remote list management in the repo settings menu.
- Add pull/push branch actions only after fetch/remotes are stable.

Acceptance:

- Remote actions only appear when relevant remotes exist.
- Running actions shows progress and preserves scroll position.
- Errors are surfaced with the command context and git output.
