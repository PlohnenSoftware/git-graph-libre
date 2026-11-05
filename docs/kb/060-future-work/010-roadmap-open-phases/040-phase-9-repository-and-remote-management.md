---
summary: >-
  Mostly complete: fetch shown only when remotes exist, upstream-aware
  push/pull, remotes CRUD popup, add/remove repo commands, full-path tooltips,
  Source Control title-bar repo selection (#32), and missing-global-config
  remote retention (#30). Open: push dialog upstream/set-upstream defaults
  (issue #36) and a preference for repository dropdown ordering.
---

# Phase 9: Repository and Remote Management

**Status: mostly complete** — remotes-gated fetch (`88a7176`), upstream-aware push/pull/fetch-into-local with delete-on-remote (`5966cf3`), the remotes CRUD popup (`693f6eb`), add/remove repo commands, full-path tooltips, missing-global-config remote retention ([issue #30](https://github.com/PlohnenSoftware/git-graph-libre/issues/30), `1.9.0`), and Source Control title-bar repository selection ([issue #32](https://github.com/PlohnenSoftware/git-graph-libre/issues/32), `1.9.0`) are done. Remaining: push dialog default remote and `setUpstream` alignment with Git ([issue #36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36)) and a repository dropdown ordering preference. Linked-worktree visibility and switching are tracked in Phase 18 ([issue #37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37)).

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
- Align the Push Branch dialog (`showPushBranchDialog` in `src/webview/main.ts`)
  with default Git push behavior ([issue #36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36),
  reported `2026-10-26` by `@cktgh`, acknowledged by the maintainer `2026-10-27`
  for the next release):
  - Default the pre-checked remote to the branch's configured upstream tracking
    remote (falling back to a configurable default remote name or `origin` /
    first remote when the branch has no upstream), instead of always picking
    `origin` via `defaultPushRemoteName`.
  - Uncheck **Set upstream** (`--set-upstream`) by default (or make its default
    configurable / contingent on whether the branch already tracks an upstream),
    instead of hardcoding `value: true`.
  - The facts checked on `2026-11-04` and the options to decide between are in
    Issue #36: push dialog default remote and Set upstream, under Open GitHub
    issues. They cover Git's own push remote via `%(push:remotename)`, honoring
    `remote.pushDefault` rather than adding a setting, and a bug: `-u` on
    several remotes leaves the last remote pushed as the upstream.
- Also filed against this area (maintainer decisions, `2026-11-04`): issue #45
  (checking out a remote branch whose local branch exists, with a confirmed
  bug in the suggested local name) is to tackle; issue #40 (fetch that also
  updates the current branch) is on hold in the backlog as a matter of taste.
  See their subsections of Open GitHub issues.

Acceptance:

- Remote actions only appear when relevant remotes exist.
- Running actions shows progress and preserves scroll position.
- Errors are surfaced with the command context and git output.
- Pushing a branch defaults to its upstream remote when one is configured and does not force `--set-upstream` on every push by default.
