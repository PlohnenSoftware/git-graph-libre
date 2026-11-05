---
summary: >-
  W12 · wave C · needs W10, W03, Y22 · TypeScript + Rust · ~200 lines: a
  worktree with a detached HEAD on a commit no branch reaches is invisible
  today, because both backends start the log from HEAD, the branches, tags and
  remotes only. Pass the other worktrees' HEAD commits as extra tips on both
  backends, with a parity test, and mark each such row "HEAD of worktree
  <folder>".
---

# W12 — Other worktrees' detached HEADs in the graph

Status: gated on Y22
Needs: W10, W03 (the engine must accept the same tips)
Decisions: Y22 (show them by default, and whether a setting turns them off)
Kind: TypeScript and Rust, the Rust arm applies · Size budget: ~200 changed
lines outside tests
Source: the TypeScript worktree map (`2026-11-04`): `loadCommits` uses
`HEAD --branches`, not `--all`

## Facts (checked `2026-11-04`, `c47207e`)

- The CLI log starts from `--ignore-missing HEAD --branches`, plus
  `--tags`, `--reflog`, `--remotes` and `additionalRefs` when enabled
  (`src/backend/queries/loadCommits.ts:221`–`:226`).
- The engine's `resolve_tips()` (`engine/native/core/src/graph.rs:153`)
  mirrors it.
- Neither includes another worktree's HEAD, so a detached worktree on an
  unreachable or older commit is not drawn. An agent's worktree checked out
  `--detach` at a commit is the usual case.

## Steps

1. Read first how `additionalRefs` reaches both backends. Pass the other
   worktrees' HEAD hashes (from W10's list, detached entries only, since a
   branch HEAD is already a tip) as extra tips on the CLI, and through the
   engine's `load_commits` options, the same set on both.
2. Mark each such commit row "HEAD of worktree <folder>", with a marker
   distinct from the current HEAD's dot, using W11's segment style or a
   graph-node variant per Y22. Tooltip with the path. Add l10n.
3. Parity test: a fixture with a detached worktree on a commit only it
   reaches. Both backends include it, with identical rows.
4. Bump the engine version if the options shape changes.

## Touch

`src/backend/queries/loadCommits.ts`, `src/backend/engine/commits.ts`,
`engine/native/core/src/graph.rs` (tips), `engine/native/node/src/lib.rs`
(options), engine version files if bumped, `src/webview/main.ts` (row
marker), `media/*.css`, l10n bundles, `tests/**`

## Acceptance

A detached worktree's commit is drawn and marked on both backends, and the
parity test is identical.

## Report

Not started.
